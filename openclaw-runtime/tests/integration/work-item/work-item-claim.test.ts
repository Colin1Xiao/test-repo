/**
 * Phase 4.x-A2-3: Work Item Claim Tests
 * 
 * 验证规则:
 * - pending -> claimed 成功
 * - 已被 claim 时返回 already_claimed 或 lease_conflict
 * - claim 成功后自动绑定 lease
 * - owner 必须来自有效 lease owner
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-3: Work Item Claim', () => {
  let coordinator: WorkItemCoordinator;
  let leaseManager: LeaseManager;
  let registry: InstanceRegistry;
  let dataDir: string;
  let instanceIdFile: string;
  let ownerId: { instance_id: string; session_id: string };

  beforeEach(async () => {
    dataDir = join(TEST_DATA_DIR, 'work-item-test-' + Date.now());
    instanceIdFile = join(dataDir, 'instance_id.json');
    await fs.mkdir(dataDir, { recursive: true });

    // Initialize registry
    registry = new InstanceRegistry({
      dataDir,
      instanceIdFile,
      autoHeartbeat: false,
    });
    await registry.initialize();

    const identity = await registry.getIdentity();
    ownerId = {
      instance_id: identity.instance_id,
      session_id: identity.session_id,
    };

    // Initialize lease manager
    leaseManager = new LeaseManager({
      dataDir,
      registry,
      autoCleanup: false,
    });
    await leaseManager.initialize();

    // Initialize work item coordinator
    coordinator = new WorkItemCoordinator({
      dataDir,
      leaseManager,
      registry,
      autoCleanup: false,
    });
    await coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.shutdown();
    await leaseManager.shutdown();
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-3-1: Successful Claim', () => {
    it('应该成功 claim pending item', async () => {
      const result = await coordinator.claim({
        item_key: 'test:item-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.item_key).toBe('test:item-1');
        expect(result.item.state).toBe('claimed');
        expect(result.item.owner_instance_id).toBe(ownerId.instance_id);
        expect(result.item.owner_session_id).toBe(ownerId.session_id);
      }
    });

    it('应该设置 state 为 claimed', async () => {
      const result = await coordinator.claim({
        item_key: 'test:item-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.state).toBe('claimed');
      }
    });

    it('应该自动绑定 lease', async () => {
      const result = await coordinator.claim({
        item_key: 'test:item-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.lease_key).toBeDefined();
        expect(result.item.lease_key).toBe('test:item-3');
        
        // Verify lease exists and is active
        const lease = await leaseManager.getLease('test:item-3');
        expect(lease).toBeDefined();
        expect(lease!.status).toBe('active');
      }
    });

    it('应该初始化 version=1', async () => {
      const result = await coordinator.claim({
        item_key: 'test:item-4',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.version).toBe(1);
      }
    });

    it('应该设置 claimed_at 时间戳', async () => {
      const before = Date.now();
      const result = await coordinator.claim({
        item_key: 'test:item-5',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.claimed_at).toBeGreaterThanOrEqual(before - 100);
        expect(result.item.claimed_at).toBeLessThanOrEqual(before + 100);
      }
    });

    it('应该写入 item_claimed 事件到 log', async () => {
      await coordinator.claim({
        item_key: 'test:item-6',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'work_items', 'work_items_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      expect(lines.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(lines[0]);
      expect(event.type).toBe('item_claimed');
      expect(event.item_key).toBe('test:item-6');
      expect(event.data.state).toBe('claimed');
    });
  });

  describe('A2-3-2: Claim Conflict', () => {
    it('应该拒绝已被 claim 的 item', async () => {
      // First claim
      await coordinator.claim({
        item_key: 'test:conflict-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Second claim by same owner
      const result = await coordinator.claim({
        item_key: 'test:conflict-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ALREADY_CLAIMED');
      }
    });

    it('应该拒绝已被其他 owner claim 的 item', async () => {
      // First claim by owner1
      await coordinator.claim({
        item_key: 'test:conflict-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Second claim by owner2 (simulated)
      const result = await coordinator.claim({
        item_key: 'test:conflict-2',
        item_type: 'test',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ALREADY_CLAIMED');
      }
    });

    it('应该支持不同 item_key 的并发 claim', async () => {
      const result1 = await coordinator.claim({
        item_key: 'test:item-a',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result2 = await coordinator.claim({
        item_key: 'test:item-b',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('A2-3-3: Invalid State', () => {
    it('应该拒绝 completed 状态的 item claim', async () => {
      // Create and complete item
      const claimResult = await coordinator.claim({
        item_key: 'test:invalid-state-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      if (claimResult.success) {
        await coordinator.complete({
          item_key: 'test:invalid-state-1',
          owner_instance_id: ownerId.instance_id,
          owner_session_id: ownerId.session_id,
        });
      }

      // Try to claim again
      const result = await coordinator.claim({
        item_key: 'test:invalid-state-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });

    it('应该拒绝 failed 状态的 item claim', async () => {
      // Create and fail item
      await coordinator.claim({
        item_key: 'test:invalid-state-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.fail({
        item_key: 'test:invalid-state-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        error: 'test_error',
      });

      // Try to claim again
      const result = await coordinator.claim({
        item_key: 'test:invalid-state-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });

    it('应该拒绝 released 状态的 item claim', async () => {
      // Create and release item
      await coordinator.claim({
        item_key: 'test:invalid-state-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:invalid-state-3',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Try to claim again
      const result = await coordinator.claim({
        item_key: 'test:invalid-state-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });
  });

  describe('A2-3-4: Lease Coupling', () => {
    it('应该验证 lease acquire 成功才 claim 成功', async () => {
      // This test verifies that claim depends on lease acquire
      const result = await coordinator.claim({
        item_key: 'test:lease-coupling-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify lease exists
        const lease = await leaseManager.getLease('test:lease-coupling-1');
        expect(lease).toBeDefined();
        expect(lease!.status).toBe('active');
      }
    });

    it('应该使用 item_key 作为 lease_key (1:1 绑定)', async () => {
      const result = await coordinator.claim({
        item_key: 'test:lease-coupling-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.lease_key).toBe('test:lease-coupling-2');
        
        // Verify lease key matches item key
        const lease = await leaseManager.getLease('test:lease-coupling-2');
        expect(lease).toBeDefined();
      }
    });

    it('应该支持自定义 lease TTL', async () => {
      const result = await coordinator.claim({
        item_key: 'test:lease-coupling-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        lease_ttl_ms: 60000, // 60s
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const lease = await leaseManager.getLease('test:lease-coupling-3');
        expect(lease).toBeDefined();
        
        const ttl = lease!.expires_at - lease!.acquired_at;
        expect(ttl).toBeGreaterThanOrEqual(59000);
        expect(ttl).toBeLessThanOrEqual(61000);
      }
    });
  });
});
