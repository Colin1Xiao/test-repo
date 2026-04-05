/**
 * Phase 4.x-A2-5: Batch III - Recovery Cross-Layer Safety
 * 
 * 验证 replay / recovery 跨层安全性：
 * - replay dry-run 不误 claim
 * - recovery scan 不被旧 suppression 误挡
 * - stale instance / stale lease / item 暴露 / suppression 记录在恢复后仍一致
 * - 不出现幽灵 owner 或重复处理
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 4.x-A2-5: Batch III - Recovery Cross-Layer Safety', () => {
  let dataDir: string;
  let instanceRegistry: InstanceRegistry;
  let leaseManager: LeaseManager;
  let itemCoordinator: WorkItemCoordinator;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-a2-5-recovery-' + Date.now());

    instanceRegistry = new InstanceRegistry({
      dataDir,
      instanceIdFile: join(dataDir, 'instance_id.json'),
      autoHeartbeat: false,
    });
    await instanceRegistry.initialize();

    leaseManager = new LeaseManager({
      dataDir,
      registry: instanceRegistry,
      config: { default_ttl_ms: 500 },
      autoCleanup: false,
    });
    await leaseManager.initialize();

    itemCoordinator = new WorkItemCoordinator({
      dataDir,
      leaseManager,
      registry: instanceRegistry,
      config: { default_lease_ttl_ms: 500 },
      autoCleanup: false,
    });
    await itemCoordinator.initialize();

    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 500,
        scope_ttls: { 'recovery_scan': 300 },
      },
      autoCleanup: false,
    });
    await suppressionManager.initialize();
  });

  afterEach(async () => {
    await suppressionManager.shutdown();
    await itemCoordinator.shutdown();
    await leaseManager.shutdown();
    await instanceRegistry.shutdown();
  });

  // ==================== A2-5-28: Replay Dry-Run Safety ====================

  describe('A2-5-28: Replay Dry-Run Safety', () => {
    it('应该 replay dry-run 不误 claim item', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:replay-dry-run-1';

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Replay mode - should bypass suppression but not actually claim
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('replay_safe');

      // Verify no duplicate item created
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('completed'); // Still completed, not re-claimed
    });

    it('应该 replay dry-run 不获取 lease', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:replay-dry-run-lease-1';

      // First claim and complete
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Verify lease released
      const leaseBefore = await leaseManager.getLease(correlationId);
      expect(leaseBefore!.status).toBe('released');

      // Replay mode
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      // Verify lease still released (not re-acquired)
      const leaseAfter = await leaseManager.getLease(correlationId);
      expect(leaseAfter!.status).toBe('released');
    });
  });

  // ==================== A2-5-29: Recovery Scan Not Blocked by Old Suppression ====================

  describe('A2-5-29: Recovery Scan Not Blocked by Old Suppression', () => {
    it('应该 recovery scan 不被旧 suppression 误挡', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:recovery-not-blocked-1';

      // First claim and complete
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for suppression TTL to expire (500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Recovery scan - should be allowed (window_expired)
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('window_expired');

      // Note: Cannot re-claim completed item (terminal state)
      // This test verifies suppression allows, not item re-claim
      // In real recovery, a new item would be created with different correlation_id
    });

    it('应该 replay mode 绕过未过期的 suppression', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:replay-bypass-active-1';

      // First claim and complete
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Don't wait for TTL - replay mode should bypass
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('replay_safe');
    });
  });

  // ==================== A2-5-30: Stale Instance / Lease / Item / Suppression Consistency ====================

  describe('A2-5-30: Stale Instance / Lease / Item / Suppression Consistency', () => {
    it('应该 stale lease 后 suppression 记录仍一致', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:stale-consistency-1';

      // Claim
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for lease TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      // Detect stale leases
      const staleLeases = await leaseManager.detectStaleLeases();
      expect(staleLeases.some((l: any) => l.lease_key === correlationId)).toBe(true);

      // Verify suppression record still exists
      const suppressionRecord = await suppressionManager.getRecord('recovery_scan:claim:' + correlationId);
      expect(suppressionRecord).toBeDefined();
    });

    it('应该 recovery 后不出现幽灵 owner', async () => {
      const identity = await instanceRegistry.getIdentity();
      const leaseKey = 'test:ghost-owner-1';

      // Acquire lease with short TTL
      await leaseManager.acquire({
        lease_key: leaseKey,
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 100,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Reclaim
      const staleLeases = await leaseManager.detectStaleLeases();
      const staleLease = staleLeases.find((l: any) => l.lease_key === leaseKey);

      if (staleLease) {
        await leaseManager.reclaimStaleLease({
          lease_key: staleLease.lease_key,
          reclaimed_by_instance_id: identity.instance_id,
          reclaimed_by_session_id: identity.session_id,
          reason: 'expired',
        });
      }

      // Verify lease status
      const lease = await leaseManager.getLease(leaseKey);
      expect(lease!.status).toBe('reclaimed');
      expect(lease!.owner_instance_id).toBe(identity.instance_id); // Owner updated to reclaiming instance

      // No ghost owner - lease is properly reclaimed
    });

    it('应该 recovery 后不出现重复处理', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:no-double-processing-1';

      // First claim and complete
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for suppression TTL to expire (500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Recovery - should be allowed (window_expired)
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');

      // Note: Cannot re-claim completed item (terminal state)
      // Suppression allows, but item state machine prevents re-claim
      // This is correct behavior - no double processing
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('completed'); // Still completed
    });
  });

  // ==================== A2-5-31: Cross-Layer Recovery Invariant ====================

  describe('A2-5-31: Cross-Layer Recovery Invariant', () => {
    it('应该 recovery 后 lease / item / suppression 状态一致', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId1 = 'test:recovery-invariant-1';
      const correlationId2 = 'test:recovery-invariant-2';

      // Initial claim and complete (correlationId1)
      await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId1,
      });

      await itemCoordinator.claim({
        item_key: correlationId1,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId1,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for suppression TTL to expire (500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Recovery for new item (correlationId2) - should be allowed
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'recovery_scan',
        action_type: 'claim',
        correlation_id: correlationId2,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');

      const claimResult = await itemCoordinator.claim({
        item_key: correlationId2,
        item_type: 'recovery',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(claimResult.success).toBe(true);

      // Verify consistency for new item
      const item = await itemCoordinator.getItem(correlationId2);
      const lease = await leaseManager.getLease(correlationId2);

      expect(item!.state).toBe('claimed');
      expect(lease!.status).toBe('active');
      expect(lease!.lease_key).toBe(item!.lease_key);
    });
  });
});
