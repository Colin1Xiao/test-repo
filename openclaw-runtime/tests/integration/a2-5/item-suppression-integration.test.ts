/**
 * Phase 4.x-A2-5: Batch I - Item + Suppression Integration
 * 
 * 验证 A2-3 (Work Item) + A2-4 (Duplicate Suppression) 集成：
 * - 重复请求被 suppression 挡住
 * - 不创建重复 work item
 * - allow 路径能正常 claim item
 * - replay-safe 场景不误抑制
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Phase 4.x-A2-5: Batch I - Item + Suppression Integration', () => {
  let dataDir: string;
  let instanceRegistry: InstanceRegistry;
  let leaseManager: LeaseManager;
  let itemCoordinator: WorkItemCoordinator;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-a2-5-item-suppression-' + randomUUID());

    // Setup Instance Registry (A2-1)
    instanceRegistry = new InstanceRegistry({
      dataDir,
      instanceIdFile: join(dataDir, 'instance_id.json'),
      autoHeartbeat: false,
    });
    await instanceRegistry.initialize();

    // Setup Lease Manager (A2-2)
    leaseManager = new LeaseManager({
      dataDir,
      registry: instanceRegistry,
      autoCleanup: false,
    });
    await leaseManager.initialize();

    // Setup Work Item Coordinator (A2-3)
    itemCoordinator = new WorkItemCoordinator({
      dataDir,
      leaseManager,
      registry: instanceRegistry,
      config: {
        default_lease_ttl_ms: 1000,
      },
      autoCleanup: false,
    });
    await itemCoordinator.initialize();

    // Setup Suppression Manager (A2-4)
    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 1000,
        scope_ttls: {
          'work_item_claim': 500,
        },
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

  // ==================== A2-5-1: Suppression Blocks Duplicate Claim ====================

  describe('A2-5-1: Suppression Blocks Duplicate Claim', () => {
    it('应该阻止重复的 claim 请求', async () => {
      const correlationId = 'test:duplicate-claim-1';
      const ownerId = await instanceRegistry.getIdentity();

      // First request - should be allowed
      const suppressionResult1 = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult1.decision).toBe('ALLOWED');

      // Claim item
      const claimResult1 = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(claimResult1.success).toBe(true);

      // Second request - should be suppressed
      const suppressionResult2 = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult2.decision).toBe('SUPPRESSED');

      // Try to claim again - should fail
      const claimResult2 = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(claimResult2.success).toBe(false);
      if (!claimResult2.success) {
        expect(claimResult2.error).toBe('ALREADY_CLAIMED');
      }
    });

    it('应该不创建重复 work item', async () => {
      const correlationId = 'test:no-duplicate-item-1';
      const ownerId = await instanceRegistry.getIdentity();

      // Evaluate and claim multiple times
      for (let i = 0; i < 5; i++) {
        const suppressionResult = await suppressionManager.evaluate({
          suppression_scope: 'work_item_claim',
          action_type: 'claim',
          correlation_id: correlationId,
        });

        if (suppressionResult.decision === 'ALLOWED') {
          await itemCoordinator.claim({
            item_key: correlationId,
            item_type: 'test',
            owner_instance_id: ownerId.instance_id,
            owner_session_id: ownerId.session_id,
          });
        }
      }

      // Verify only one item exists
      const item = await itemCoordinator.getItem(correlationId);
      expect(item).toBeDefined();
      expect(item!.version).toBe(1); // Not claimed multiple times
    });
  });

  // ==================== A2-5-2: Allowed Path Claims Item ====================

  describe('A2-5-2: Allowed Path Claims Item', () => {
    it('应该允许首次 claim 成功', async () => {
      const correlationId = 'test:first-claim-1';
      const ownerId = await instanceRegistry.getIdentity();

      // Evaluate - should be allowed
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('first_seen');

      // Claim - should succeed
      const claimResult = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(claimResult.success).toBe(true);
      if (claimResult.success) {
        expect(claimResult.item.state).toBe('claimed');
      }
    });

    it('应该允许 TTL 过期后重新 claim', async () => {
      const correlationId = 'test:ttl-expire-claim-1';
      const ownerId = await instanceRegistry.getIdentity();

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Complete the item (releases lease)
      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      // Evaluate again - should be allowed (window expired)
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('window_expired');
    });
  });

  // ==================== A2-5-3: Replay Safe Mode ====================

  describe('A2-5-3: Replay Safe Mode', () => {
    it('应该在 replay 模式绕过抑制', async () => {
      const correlationId = 'test:replay-bypass-1';
      const ownerId = await instanceRegistry.getIdentity();

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Replay mode - should bypass suppression
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('replay_safe');
    });

    it('应该在 replay 模式不创建重复 item', async () => {
      const correlationId = 'test:replay-no-duplicate-1';
      const ownerId = await instanceRegistry.getIdentity();

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Replay mode (dry-run, don't actually claim)
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');

      // Verify item state unchanged
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('claimed'); // Not claimed again
    });
  });

  // ==================== A2-5-4: Cross-Layer Invariant ====================

  describe('A2-5-4: Cross-Layer Invariant - Suppression-Item Mutual Exclusion', () => {
    it('应该验证 suppression 抑制时不创建 item', async () => {
      const correlationId = 'test:invariant-1';
      const ownerId = await instanceRegistry.getIdentity();

      // First request
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Second request - suppressed
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('SUPPRESSED');

      // Verify no new item created
      const items = await itemCoordinator.getActiveItems();
      const matchingItems = items.filter((i: any) => i.item_key === correlationId);
      expect(matchingItems.length).toBe(1); // Only one item exists
    });

    it('应该验证 allowed 路径 item 状态正确', async () => {
      const correlationId = 'test:invariant-2';
      const ownerId = await instanceRegistry.getIdentity();

      // Evaluate
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');

      // Claim
      const claimResult = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(claimResult.success).toBe(true);
      if (claimResult.success) {
        expect(claimResult.item.state).toBe('claimed');
        expect(claimResult.item.owner_instance_id).toBe(ownerId.instance_id);
      }
    });
  });
});
