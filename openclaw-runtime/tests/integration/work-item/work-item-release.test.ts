/**
 * Phase 4.x-A2-3: Work Item Release Tests
 * 
 * 验证规则:
 * - claimed/running -> released 成功
 * - release 幂等行为
 * - owner 不匹配拒绝
 * - release 后 item 不再出现在 active 列表
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-3: Work Item Release', () => {
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

    leaseManager = new LeaseManager({
      dataDir,
      registry,
      autoCleanup: false,
    });
    await leaseManager.initialize();

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

  describe('A2-3-15: Release Success', () => {
    it('应该成功 release claimed item', async () => {
      await coordinator.claim({
        item_key: 'test:release-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.release({
        item_key: 'test:release-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.state).toBe('released');
        expect(result.item.released_at).toBeDefined();
      }
    });

    it('应该设置 released_at 时间戳', async () => {
      await coordinator.claim({
        item_key: 'test:release-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const before = Date.now();

      const result = await coordinator.release({
        item_key: 'test:release-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.released_at).toBeGreaterThanOrEqual(before - 100);
        expect(result.item.released_at).toBeLessThanOrEqual(before + 100);
      }
    });

    it('应该释放 lease', async () => {
      await coordinator.claim({
        item_key: 'test:release-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-3',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Verify lease is released
      const lease = await leaseManager.getLease('test:release-3');
      expect(lease!.status).toBe('released');
    });

    it('应该写入 item_released 事件到 log', async () => {
      await coordinator.claim({
        item_key: 'test:release-4',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-4',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'work_items', 'work_items_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const releaseEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'item_released';
      });

      expect(releaseEvents.length).toBe(1);
    });
  });

  describe('A2-3-16: Release Idempotency', () => {
    it('应该支持重复 release (幂等)', async () => {
      await coordinator.claim({
        item_key: 'test:release-idempotent',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // First release
      const result1 = await coordinator.release({
        item_key: 'test:release-idempotent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result1.success).toBe(true);

      // Second release (should be no-op)
      const result2 = await coordinator.release({
        item_key: 'test:release-idempotent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.already_released).toBe(true);
      }
    });

    it('应该保持 released 状态不变', async () => {
      await coordinator.claim({
        item_key: 'test:release-state',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-state',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-state',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const item = await coordinator.getItem('test:release-state');
      expect(item!.state).toBe('released');
    });
  });

  describe('A2-3-17: Release Failure', () => {
    it('应该拒绝 owner 不匹配的 release', async () => {
      await coordinator.claim({
        item_key: 'test:release-wrong-owner',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.release({
        item_key: 'test:release-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('OWNER_MISMATCH');
      }
    });

    it('应该拒绝 pending 状态的 item release', async () => {
      const result = await coordinator.release({
        item_key: 'test:release-pending',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });

    it('应该拒绝 completed 状态的 item release', async () => {
      await coordinator.claim({
        item_key: 'test:release-completed',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.complete({
        item_key: 'test:release-completed',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.release({
        item_key: 'test:release-completed',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });
  });

  describe('A2-3-18: Release Removes From Active List', () => {
    it('应该不返回 released item 到 active 列表', async () => {
      await coordinator.claim({
        item_key: 'test:release-active-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-active-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const activeItems = await coordinator.getActiveItems();
      const found = activeItems.find((i: any) => i.item_key === 'test:release-active-1');
      expect(found).toBeUndefined();
    });

    it('应该支持带 reason 的 release', async () => {
      await coordinator.claim({
        item_key: 'test:release-reason',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.release({
        item_key: 'test:release-reason',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        reason: 'user_requested',
      });

      // Read log to verify reason
      const logPath = join(dataDir, 'work_items', 'work_items_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      const event = JSON.parse(lines[lines.length - 1]);

      expect(event.data.reason).toBe('user_requested');
    });
  });
});
