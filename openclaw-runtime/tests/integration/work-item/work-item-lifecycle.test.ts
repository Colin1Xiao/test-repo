/**
 * Phase 4.x-A2-3: Work Item Lifecycle Tests
 * 
 * 验证规则:
 * - claimed/running 可 renew
 * - owner 不匹配时 renew 失败
 * - running -> completed 成功
 * - claimed/running -> failed 成功
 * - 终态后 lease 必须释放
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkItemCoordinator } from '../../../src/coordination/work_item_coordinator.js';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-3: Work Item Lifecycle', () => {
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

  describe('A2-3-5: Renew Success', () => {
    it('应该成功 renew claimed item', async () => {
      // Claim first
      const claimResult = await coordinator.claim({
        item_key: 'test:renew-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(claimResult.success).toBe(true);
      if (!claimResult.success) return;

      // Renew
      const renewResult = await coordinator.renew({
        item_key: 'test:renew-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(renewResult.success).toBe(true);
      if (renewResult.success) {
        expect(renewResult.item.state).toBe('claimed');
        expect(renewResult.lease).toBeDefined();
      }
    });

    it('应该递增 version', async () => {
      await coordinator.claim({
        item_key: 'test:renew-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const renewResult = await coordinator.renew({
        item_key: 'test:renew-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(renewResult.success).toBe(true);
      if (renewResult.success) {
        expect(renewResult.item.version).toBe(2);
      }
    });

    it('应该更新 lease expires_at', async () => {
      await coordinator.claim({
        item_key: 'test:renew-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const beforeRenew = Date.now();

      const renewResult = await coordinator.renew({
        item_key: 'test:renew-3',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        lease_ttl_ms: 30000,
      });

      expect(renewResult.success).toBe(true);
      if (renewResult.success) {
        expect(renewResult.lease.expires_at).toBeGreaterThanOrEqual(beforeRenew + 30000 - 100);
      }
    });

    it('应该写入 item_renewed 事件到 log', async () => {
      await coordinator.claim({
        item_key: 'test:renew-4',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.renew({
        item_key: 'test:renew-4',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'work_items', 'work_items_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const renewEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'item_renewed';
      });

      expect(renewEvents.length).toBe(1);
    });
  });

  describe('A2-3-6: Renew Failure', () => {
    it('应该拒绝 owner 不匹配的 renew', async () => {
      await coordinator.claim({
        item_key: 'test:renew-wrong-owner',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.renew({
        item_key: 'test:renew-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('OWNER_MISMATCH');
      }
    });

    it('应该拒绝 pending 状态的 item renew', async () => {
      // Item is pending, not claimed
      const result = await coordinator.renew({
        item_key: 'test:renew-pending',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });

    it('应该拒绝 completed 状态的 item renew', async () => {
      await coordinator.claim({
        item_key: 'test:renew-completed',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.complete({
        item_key: 'test:renew-completed',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.renew({
        item_key: 'test:renew-completed',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });
  });

  describe('A2-3-7: Complete Success', () => {
    it('应该成功 complete claimed item', async () => {
      await coordinator.claim({
        item_key: 'test:complete-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.complete({
        item_key: 'test:complete-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        result: { success: true },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.state).toBe('completed');
        expect(result.item.completed_at).toBeDefined();
      }
    });

    it('应该设置 completed_at 时间戳', async () => {
      await coordinator.claim({
        item_key: 'test:complete-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const before = Date.now();

      const result = await coordinator.complete({
        item_key: 'test:complete-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.completed_at).toBeGreaterThanOrEqual(before - 100);
        expect(result.item.completed_at).toBeLessThanOrEqual(before + 100);
      }
    });

    it('应该释放 lease', async () => {
      await coordinator.claim({
        item_key: 'test:complete-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.complete({
        item_key: 'test:complete-3',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Verify lease is released
      const lease = await leaseManager.getLease('test:complete-3');
      expect(lease!.status).toBe('released');
    });

    it('应该写入 item_completed 事件到 log', async () => {
      await coordinator.claim({
        item_key: 'test:complete-4',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.complete({
        item_key: 'test:complete-4',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'work_items', 'work_items_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const completeEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'item_completed';
      });

      expect(completeEvents.length).toBe(1);
    });
  });

  describe('A2-3-8: Fail Success', () => {
    it('应该成功 fail claimed item', async () => {
      await coordinator.claim({
        item_key: 'test:fail-1',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.fail({
        item_key: 'test:fail-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        error: 'test_error',
        retryable: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.state).toBe('failed');
        expect(result.item.failed_at).toBeDefined();
        expect(result.item.metadata?.error).toBe('test_error');
      }
    });

    it('应该设置 failed_at 时间戳', async () => {
      await coordinator.claim({
        item_key: 'test:fail-2',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const before = Date.now();

      const result = await coordinator.fail({
        item_key: 'test:fail-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        error: 'test_error',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.failed_at).toBeGreaterThanOrEqual(before - 100);
        expect(result.item.failed_at).toBeLessThanOrEqual(before + 100);
      }
    });

    it('应该释放 lease', async () => {
      await coordinator.claim({
        item_key: 'test:fail-3',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.fail({
        item_key: 'test:fail-3',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        error: 'test_error',
      });

      // Verify lease is released
      const lease = await leaseManager.getLease('test:fail-3');
      expect(lease!.status).toBe('released');
    });

    it('应该记录 error 和 retryable 标志', async () => {
      await coordinator.claim({
        item_key: 'test:fail-4',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.fail({
        item_key: 'test:fail-4',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        error: 'test_error',
        retryable: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.metadata?.error).toBe('test_error');
        expect(result.item.metadata?.retryable).toBe(true);
      }
    });
  });

  describe('A2-3-9: Complete/Fail Failure', () => {
    it('应该拒绝 owner 不匹配的 complete', async () => {
      await coordinator.claim({
        item_key: 'test:complete-wrong-owner',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.complete({
        item_key: 'test:complete-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('OWNER_MISMATCH');
      }
    });

    it('应该拒绝 owner 不匹配的 fail', async () => {
      await coordinator.claim({
        item_key: 'test:fail-wrong-owner',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.fail({
        item_key: 'test:fail-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
        error: 'test_error',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('OWNER_MISMATCH');
      }
    });

    it('应该拒绝 pending 状态的 item complete', async () => {
      const result = await coordinator.complete({
        item_key: 'test:complete-pending',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });

    it('应该拒绝 completed 状态的 item 再次 complete', async () => {
      await coordinator.claim({
        item_key: 'test:complete-twice',
        item_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await coordinator.complete({
        item_key: 'test:complete-twice',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await coordinator.complete({
        item_key: 'test:complete-twice',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_STATE');
      }
    });
  });
});
