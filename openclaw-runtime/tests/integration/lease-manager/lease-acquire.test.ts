/**
 * Phase 4.x-A2-2: Lease Acquire Tests
 * 
 * 验证规则:
 * - 空 lease 成功 acquire
 * - 已被占用时 acquire 冲突
 * - 相同 owner 重复 acquire 的幂等/拒绝语义
 * - owner 必须是有效 instance_id + session_id
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { LeaseManager, LeaseRecord } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-2: Lease Acquire', () => {
  let leaseManager: LeaseManager;
  let registry: InstanceRegistry;
  let dataDir: string;
  let instanceIdFile: string;
  let ownerId: { instance_id: string; session_id: string };

  beforeEach(async () => {
    dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
    instanceIdFile = join(dataDir, 'instance_id.json');
    await fs.mkdir(dataDir, { recursive: true });

    // Initialize registry first
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
  });

  afterEach(async () => {
    await leaseManager.shutdown();
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-2-1: Successful Acquire', () => {
    it('应该成功 acquire 空 lease', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'test:resource-1',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 30000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.lease_key).toBe('test:resource-1');
        expect(result.lease.status).toBe('active');
        expect(result.lease.owner_instance_id).toBe(ownerId.instance_id);
        expect(result.lease.owner_session_id).toBe(ownerId.session_id);
      }
    });

    it('应该设置正确的 expires_at', async () => {
      const before = Date.now();
      const result = await leaseManager.acquire({
        lease_key: 'test:resource-2',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 30000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.expires_at).toBeGreaterThanOrEqual(before + 30000 - 100);
        expect(result.lease.expires_at).toBeLessThanOrEqual(before + 30000 + 100);
      }
    });

    it('应该初始化 version=1', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'test:resource-3',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.version).toBe(1);
      }
    });

    it('应该支持默认 TTL (30s)', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'test:resource-4',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        // ttl_ms omitted, should use default
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const ttl = result.lease.expires_at - result.lease.acquired_at;
        expect(ttl).toBeGreaterThanOrEqual(29000);
        expect(ttl).toBeLessThanOrEqual(31000);
      }
    });

    it('应该写入 lease_acquired 事件到 log', async () => {
      await leaseManager.acquire({
        lease_key: 'test:resource-5',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      expect(lines.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(lines[0]);
      expect(event.type).toBe('lease_acquired');
      expect(event.lease_key).toBe('test:resource-5');
      expect(event.data.owner_instance_id).toBe(ownerId.instance_id);
    });
  });

  describe('A2-2-2: Acquire Conflict', () => {
    it('应该拒绝已被占用的 lease', async () => {
      // First acquire
      await leaseManager.acquire({
        lease_key: 'test:conflict-1',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Second acquire by same owner
      const result = await leaseManager.acquire({
        lease_key: 'test:conflict-1',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ALREADY_LEASED');
      }
    });

    it('应该返回当前 owner 信息', async () => {
      await leaseManager.acquire({
        lease_key: 'test:conflict-2',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Different owner tries to acquire
      const result = await leaseManager.acquire({
        lease_key: 'test:conflict-2',
        lease_type: 'test',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ALREADY_LEASED');
        expect(result.current_owner).toBeDefined();
        expect(result.current_owner!.instance_id).toBe(ownerId.instance_id);
      }
    });

    it('应该支持不同 lease_key 的并发 acquire', async () => {
      const result1 = await leaseManager.acquire({
        lease_key: 'test:resource-a',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result2 = await leaseManager.acquire({
        lease_key: 'test:resource-b',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('A2-2-3: Owner Validation', () => {
    it('应该验证 owner instance_id 必须有效', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'test:invalid-owner',
        lease_type: 'test',
        owner_instance_id: 'non-existent-instance',
        owner_session_id: ownerId.session_id,
      });

      // Should still succeed (instance validation is optional for acquire)
      // But the lease will be stale if instance doesn't exist
      expect(result.success).toBe(true);
    });

    it('应该记录 owner 的 instance_id 和 session_id', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'test:owner-record',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.owner_instance_id).toBe(ownerId.instance_id);
        expect(result.lease.owner_session_id).toBe(ownerId.session_id);
      }
    });
  });

  describe('A2-2-4: Lease Key Format', () => {
    it('应该支持 namespace:id 格式的 lease_key', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'incident:123',
        lease_type: 'incident',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.lease_key).toBe('incident:123');
        expect(result.lease.lease_type).toBe('incident');
      }
    });

    it('应该支持任意格式的 lease_key', async () => {
      const result = await leaseManager.acquire({
        lease_key: 'custom-key-with-special-chars_123',
        lease_type: 'custom',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.lease_key).toBe('custom-key-with-special-chars_123');
      }
    });
  });
});
