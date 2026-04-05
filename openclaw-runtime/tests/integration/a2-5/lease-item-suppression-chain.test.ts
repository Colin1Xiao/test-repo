/**
 * Phase 4.x-A2-5: Batch II - Lease + Item + Suppression Chain
 * 
 * 验证 A2-2 + A2-3 + A2-4 三层链路：
 * - suppression allow 才进入 claim
 * - claim 成功后 lease 与 item 绑定
 * - duplicate 被 suppression 挡住时不创建重复 item
 * - replay-safe 不误抑制合法恢复动作
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 4.x-A2-5: Batch II - Lease + Item + Suppression Chain', () => {
  let dataDir: string;
  let instanceRegistry: InstanceRegistry;
  let leaseManager: LeaseManager;
  let itemCoordinator: WorkItemCoordinator;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-a2-5-lease-item-suppression-' + Date.now());

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
      config: {
        default_ttl_ms: 500,
      },
      autoCleanup: false,
    });
    await leaseManager.initialize();

    // Setup Work Item Coordinator (A2-3)
    itemCoordinator = new WorkItemCoordinator({
      dataDir,
      leaseManager,
      registry: instanceRegistry,
      config: {
        default_lease_ttl_ms: 500,
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

  // ==================== A2-5-16: Suppression → Lease → Item Complete Chain ====================

  describe('A2-5-16: Suppression → Lease → Item Complete Chain', () => {
    it('应该 suppression allow 后完整链路成功', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:allow-chain-1';

      // Step 1: Evaluate suppression
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('first_seen');

      // Step 2: Claim item (automatically acquires lease)
      const claimResult = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(claimResult.success).toBe(true);
      if (claimResult.success) {
        expect(claimResult.item.state).toBe('claimed');
      }

      // Step 3: Verify lease is active
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('active');

      // Step 4: Complete item
      const completeResult = await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(completeResult.success).toBe(true);
      if (completeResult.success) {
        expect(completeResult.item.state).toBe('completed');
      }

      // Step 5: Verify lease is released
      const leaseAfter = await leaseManager.getLease(correlationId);
      expect(leaseAfter!.status).toBe('released');
    });

    it('应该 suppression duplicate 时不创建 item 不获取 lease', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:duplicate-block-1';

      // First request - allow
      const suppressionResult1 = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult1.decision).toBe('ALLOWED');

      // First claim
      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Second request - suppressed
      const suppressionResult2 = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult2.decision).toBe('SUPPRESSED');

      // Verify no duplicate item created
      const items = await itemCoordinator.getActiveItems();
      const matchingItems = items.filter((i: any) => i.item_key === correlationId);
      expect(matchingItems.length).toBe(1);

      // Verify lease is still active (not re-acquired)
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('active');
    });
  });

  // ==================== A2-5-17: Replay Safe → Lease → Item Safety ====================

  describe('A2-5-17: Replay Safe → Lease → Item Safety', () => {
    it('应该 replay 模式不误 claim item', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:replay-safety-1';

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Complete
      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Replay mode - should bypass suppression but not actually claim
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('replay_safe');

      // Verify item state unchanged (not claimed again)
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('completed');
    });

    it('应该 TTL 过期后 replay 不误抑制', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:replay-ttl-1';

      // First claim and complete
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for suppression TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      // Replay mode - should be allowed (window_expired, not replay_safe)
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('window_expired');
    });
  });

  // ==================== A2-5-18: Lease-Item-Suppression Consistency Invariant ====================

  describe('A2-5-18: Lease-Item-Suppression Consistency Invariant', () => {
    it('应该验证 suppression suppressed 时 lease 和 item 状态不变', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:invariant-suppressed-1';

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Get initial state
      const itemBefore = await itemCoordinator.getItem(correlationId);
      const leaseBefore = await leaseManager.getLease(correlationId);

      // Second request - suppressed
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('SUPPRESSED');

      // Verify state unchanged
      const itemAfter = await itemCoordinator.getItem(correlationId);
      const leaseAfter = await leaseManager.getLease(correlationId);

      expect(itemAfter!.state).toBe(itemBefore!.state);
      expect(leaseAfter!.status).toBe(leaseBefore!.status);
    });

    it('应该验证 claimed item 有 active lease 且 suppression 记录存在', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:invariant-active-1';

      // Evaluate and claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Verify item state
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('claimed');

      // Verify lease is active
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('active');
      expect(lease!.lease_key).toBe(item!.lease_key);

      // Verify suppression record exists
      const suppressionKey = 'work_item_claim:claim:' + correlationId;
      const suppressionRecord = await suppressionManager.getRecord(suppressionKey);
      expect(suppressionRecord).toBeDefined();
      expect(suppressionRecord!.hit_count).toBe(1);
    });

    it('应该验证 completed item 的 lease 释放且 suppression 记录保持', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:invariant-complete-1';

      // Evaluate, claim, and complete
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Verify item state
      const item = await itemCoordinator.getItem(correlationId);
      expect(item!.state).toBe('completed');

      // Verify lease is released
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('released');

      // Verify suppression record still exists (for deduplication)
      const suppressionKey = 'work_item_claim:claim:' + correlationId;
      const suppressionRecord = await suppressionManager.getRecord(suppressionKey);
      expect(suppressionRecord).toBeDefined();
      expect(suppressionRecord!.hit_count).toBe(1);
    });

    it('应该验证 duplicate 请求不改变 lease 和 item 状态', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'test:invariant-duplicate-1';

      // First claim
      await suppressionManager.evaluate({
        suppression_scope: 'work_item_claim',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Get initial state
      const itemBefore = await itemCoordinator.getItem(correlationId);
      const leaseBefore = await leaseManager.getLease(correlationId);
      const suppressionBefore = await suppressionManager.getRecord('work_item_claim:claim:' + correlationId);

      // Multiple duplicate requests
      for (let i = 0; i < 3; i++) {
        const suppressionResult = await suppressionManager.evaluate({
          suppression_scope: 'work_item_claim',
          action_type: 'claim',
          correlation_id: correlationId,
        });

        expect(suppressionResult.decision).toBe('SUPPRESSED');
      }

      // Verify state unchanged
      const itemAfter = await itemCoordinator.getItem(correlationId);
      const leaseAfter = await leaseManager.getLease(correlationId);
      const suppressionAfter = await suppressionManager.getRecord('work_item_claim:claim:' + correlationId);

      expect(itemAfter!.state).toBe(itemBefore!.state);
      expect(leaseAfter!.status).toBe(leaseBefore!.status);
      expect(suppressionAfter!.hit_count).toBe(4); // 1 (first) + 3 (duplicates)
    });
  });
});
