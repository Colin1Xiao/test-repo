/**
 * Phase 4.x-A2-5: Batch III - Full Chain: Ingest → Suppression → Lease → Item → Complete
 * 
 * 验证 A2-1 + A2-2 + A2-3 + A2-4 完整协议链：
 * - ingest request
 * - suppression evaluate
 * - lease acquire
 * - work item claim
 * - lifecycle transition
 * - terminal release / cleanup
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 4.x-A2-5: Batch III - Full Chain', () => {
  let dataDir: string;
  let instanceRegistry: InstanceRegistry;
  let leaseManager: LeaseManager;
  let itemCoordinator: WorkItemCoordinator;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-a2-5-full-chain-' + Date.now());

    // Setup all components
    instanceRegistry = new InstanceRegistry({
      dataDir,
      instanceIdFile: join(dataDir, 'instance_id.json'),
      autoHeartbeat: false,
    });
    await instanceRegistry.initialize();

    leaseManager = new LeaseManager({
      dataDir,
      registry: instanceRegistry,
      config: { default_ttl_ms: 1000 },
      autoCleanup: false,
    });
    await leaseManager.initialize();

    itemCoordinator = new WorkItemCoordinator({
      dataDir,
      leaseManager,
      registry: instanceRegistry,
      config: { default_lease_ttl_ms: 1000 },
      autoCleanup: false,
    });
    await itemCoordinator.initialize();

    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 1000,
        scope_ttls: { 'alert_ingest': 500 },
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

  // ==================== A2-5-19: Complete Success Chain ====================

  describe('A2-5-19: Complete Success Chain', () => {
    it('应该完整链路成功 (ingest → suppression → lease → item → complete)', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'alert:full-chain-1';

      // Step 1: Ingest - Suppression Evaluate
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('ALLOWED');
      expect(suppressionResult.reason).toBe('first_seen');

      // Step 2: Lease Acquire (via claim)
      // Step 3: Work Item Claim
      const claimResult = await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'alert',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(claimResult.success).toBe(true);
      if (claimResult.success) {
        expect(claimResult.item.state).toBe('claimed');
      }

      // Step 4: Verify lease is active
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('active');

      // Step 5: Business Logic (simulated)
      // Simulate processing...

      // Step 6: Lifecycle Transition - Complete
      const completeResult = await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(completeResult.success).toBe(true);
      if (completeResult.success) {
        expect(completeResult.item.state).toBe('completed');
      }

      // Step 7: Verify lease released
      const leaseAfter = await leaseManager.getLease(correlationId);
      expect(leaseAfter!.status).toBe('released');

      // Step 8: Verify suppression record kept (for deduplication)
      const suppressionRecord = await suppressionManager.getRecord('alert_ingest:create:' + correlationId);
      expect(suppressionRecord).toBeDefined();
    });

    it('应该完整链路失败处理 (ingest → suppression → lease → item → fail)', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'alert:full-chain-fail-1';

      // Suppression
      await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: correlationId,
      });

      // Claim
      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'alert',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Fail
      const failResult = await itemCoordinator.fail({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        error: 'processing_error',
        retryable: true,
      });

      expect(failResult.success).toBe(true);
      if (failResult.success) {
        expect(failResult.item.state).toBe('failed');
      }

      // Verify lease released
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('released');
    });
  });

  // ==================== A2-5-20: Duplicate Blocking in Full Chain ====================

  describe('A2-5-20: Duplicate Blocking in Full Chain', () => {
    it('应该 duplicate 请求在 suppression 层被挡住', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'alert:duplicate-block-1';

      // First request - full chain
      await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'alert',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Second request - should be suppressed
      const suppressionResult = await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: correlationId,
      });

      expect(suppressionResult.decision).toBe('SUPPRESSED');

      // Verify no duplicate item created
      const items = await itemCoordinator.getActiveItems();
      expect(items.some(i => i.item_key === correlationId)).toBe(false);
    });
  });

  // ==================== A2-5-21: Terminal State Cleanup ====================

  describe('A2-5-21: Terminal State Cleanup', () => {
    it('应该 terminal state 后资源正确清理', async () => {
      const identity = await instanceRegistry.getIdentity();
      const correlationId = 'alert:terminal-cleanup-1';

      // Complete
      await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: correlationId,
      });

      await itemCoordinator.claim({
        item_key: correlationId,
        item_type: 'alert',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await itemCoordinator.complete({
        item_key: correlationId,
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Verify item not in active list
      const activeItems = await itemCoordinator.getActiveItems();
      expect(activeItems.some(i => i.item_key === correlationId)).toBe(false);

      // Verify lease released
      const lease = await leaseManager.getLease(correlationId);
      expect(lease!.status).toBe('released');

      // Verify suppression record kept
      const suppressionRecord = await suppressionManager.getRecord('alert_ingest:create:' + correlationId);
      expect(suppressionRecord).toBeDefined();
    });
  });
});
