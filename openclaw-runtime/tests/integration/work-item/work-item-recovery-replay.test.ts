/**
 * Phase 4.x-A2-3: Work Item Recovery & Replay Tests
 * 
 * 验证规则:
 * - snapshot + log replay 恢复 item 状态
 * - item 与 lease 的恢复一致性
 * - 旧数据兼容
 * - 部分损坏日志容错
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-3: Work Item Recovery & Replay', () => {
  let dataDir: string;
  let instanceIdFile: string;
  let registry: InstanceRegistry;
  let leaseManager: LeaseManager;

  afterEach(async () => {
    if (dataDir) {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  describe('A2-3-19: Snapshot Recovery', () => {
    it('应该从 snapshot 恢复 item 状态', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      // Create registry and coordinators
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator1 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator1.initialize();

      // Claim item
      await coordinator1.claim({
        item_key: 'test:recovery-1',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for snapshot
      await new Promise(resolve => setTimeout(resolve, 100));
      await coordinator1.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();

      // Create new coordinator - should recover from snapshot
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator2 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator2.initialize();

      const item = await coordinator2.getItem('test:recovery-1');
      expect(item).toBeDefined();
      expect(item!.state).toBe('claimed');
    });

    it('应该 replay log 恢复增量事件', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator1 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator1.initialize();

      // Claim
      await coordinator1.claim({
        item_key: 'test:recovery-2',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Complete
      await coordinator1.complete({
        item_key: 'test:recovery-2',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Shutdown without snapshot
      await coordinator1.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();

      // Recover - should replay log
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator2 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator2.initialize();

      const item = await coordinator2.getItem('test:recovery-2');
      expect(item).toBeDefined();
      expect(item!.state).toBe('completed');
    });
  });

  describe('A2-3-20: Lease Consistency On Recovery', () => {
    it('应该恢复 item 与 lease 的一致性', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator1 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator1.initialize();

      // Claim item
      await coordinator1.claim({
        item_key: 'test:recovery-lease-1',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await coordinator1.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();

      // Recover
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator2 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator2.initialize();

      const item = await coordinator2.getItem('test:recovery-lease-1');
      expect(item).toBeDefined();

      // Verify lease consistency
      const lease = await leaseManager.getLease('test:recovery-lease-1');
      expect(lease).toBeDefined();
      expect(lease!.status).toBe('active');
    });

    it('应该恢复 completed item 的 released lease', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator1 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator1.initialize();

      // Claim and complete
      await coordinator1.claim({
        item_key: 'test:recovery-lease-2',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await coordinator1.complete({
        item_key: 'test:recovery-lease-2',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await coordinator1.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();

      // Recover
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator2 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator2.initialize();

      const item = await coordinator2.getItem('test:recovery-lease-2');
      expect(item!.state).toBe('completed');

      // Verify lease is released
      const lease = await leaseManager.getLease('test:recovery-lease-2');
      expect(lease!.status).toBe('released');
    });
  });

  describe('A2-3-21: Backward Compatibility', () => {
    it('应该兼容旧 item 格式', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const workItemsDir = join(dataDir, 'work_items');
      await fs.mkdir(workItemsDir, { recursive: true });

      // Create old format snapshot (without session_id)
      const oldSnapshot = {
        items: {
          'test:old-format': {
            item_key: 'test:old-format',
            item_type: 'test',
            state: 'claimed',
            owner_instance_id: 'old-instance',
            updated_at: Date.now(),
            version: 1,
          },
        },
        last_snapshot_at: Date.now() - 1000,
      };
      await fs.writeFile(
        join(workItemsDir, 'work_items_snapshot.json'),
        JSON.stringify(oldSnapshot, null, 2)
      );

      // Initialize
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator.initialize();

      const item = await coordinator.getItem('test:old-format');
      expect(item).toBeDefined();
      expect(item!.item_key).toBe('test:old-format');
    });
  });

  describe('A2-3-22: Error Tolerance', () => {
    it('应该处理 corrupted log 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const workItemsDir = join(dataDir, 'work_items');
      await fs.mkdir(workItemsDir, { recursive: true });

      // Create corrupted log
      await fs.writeFile(
        join(workItemsDir, 'work_items_log.jsonl'),
        'invalid json line\n{"type":"item_claimed","item_key":"test"}\nanother invalid\n',
        'utf-8'
      );

      // Should not crash, should skip invalid lines
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator.initialize();

      // Should still work
      const identity = await registry.getIdentity();
      const result = await coordinator.claim({
        item_key: 'test:new-item',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(result.success).toBe(true);
    });

    it('应该处理 partial snapshot 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const workItemsDir = join(dataDir, 'work_items');
      await fs.mkdir(workItemsDir, { recursive: true });

      // Create partial/corrupted snapshot
      await fs.writeFile(
        join(workItemsDir, 'work_items_snapshot.json'),
        '{"items": {"test": {', // Incomplete JSON
        'utf-8'
      );

      // Should fallback to log replay or start fresh
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator.initialize();

      // Should still work
      const identity = await registry.getIdentity();
      const result = await coordinator.claim({
        item_key: 'test:new-item',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(result.success).toBe(true);
    });

    it('应该处理 complete/fail 后恢复一致', async () => {
      dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator1 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator1.initialize();

      // Claim
      await coordinator1.claim({
        item_key: 'test:recovery-state',
        item_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Complete
      await coordinator1.complete({
        item_key: 'test:recovery-state',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await coordinator1.shutdown();
      await leaseManager.shutdown();
      await registry.shutdown();

      // Recover
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const coordinator2 = new WorkItemCoordinator({ dataDir, leaseManager, registry, autoCleanup: false });
      await coordinator2.initialize();

      const item = await coordinator2.getItem('test:recovery-state');
      expect(item).toBeDefined();
      expect(item!.state).toBe('completed');

      // Verify lease is released
      const lease = await leaseManager.getLease('test:recovery-state');
      expect(lease!.status).toBe('released');
    });
  });
});
