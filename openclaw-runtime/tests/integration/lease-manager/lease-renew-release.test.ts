/**
 * Phase 4.x-A2-2: Lease Renew & Release Tests
 * 
 * 验证规则:
 * - owner 匹配时 renew 成功
 * - owner 不匹配时 renew 失败
 * - 过期 lease renew 失败
 * - release 幂等性
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-2: Lease Renew & Release', () => {
  let leaseManager: LeaseManager;
  let registry: InstanceRegistry;
  let dataDir: string;
  let instanceIdFile: string;
  let ownerId: { instance_id: string; session_id: string };

  beforeEach(async () => {
    dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
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
  });

  afterEach(async () => {
    await leaseManager.shutdown();
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-2-5: Renew Success', () => {
    it('应该成功 renew 未过期的 lease', async () => {
      // Acquire first
      const acquireResult = await leaseManager.acquire({
        lease_key: 'test:renew-1',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 30000,
      });

      expect(acquireResult.success).toBe(true);
      if (!acquireResult.success) return;

      const beforeRenew = Date.now();

      // Renew
      const renewResult = await leaseManager.renew({
        lease_key: 'test:renew-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 30000,
      });

      expect(renewResult.success).toBe(true);
      if (renewResult.success) {
        expect(renewResult.lease.lease_key).toBe('test:renew-1');
        expect(renewResult.lease.expires_at).toBeGreaterThanOrEqual(beforeRenew + 30000 - 100);
        expect(renewResult.lease.renewed_at).toBeGreaterThanOrEqual(beforeRenew - 100);
      }
    });

    it('应该递增 version', async () => {
      await leaseManager.acquire({
        lease_key: 'test:renew-2',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const renewResult = await leaseManager.renew({
        lease_key: 'test:renew-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(renewResult.success).toBe(true);
      if (renewResult.success) {
        expect(renewResult.lease.version).toBe(2);
      }
    });

    it('应该支持多次 renew', async () => {
      await leaseManager.acquire({
        lease_key: 'test:renew-3',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Renew 3 times
      for (let i = 0; i < 3; i++) {
        const result = await leaseManager.renew({
          lease_key: 'test:renew-3',
          owner_instance_id: ownerId.instance_id,
          owner_session_id: ownerId.session_id,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.lease.version).toBe(i + 2); // 1 (initial) + i + 1
        }
      }
    });

    it('应该写入 lease_renewed 事件到 log', async () => {
      await leaseManager.acquire({
        lease_key: 'test:renew-4',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await leaseManager.renew({
        lease_key: 'test:renew-4',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const renewEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'lease_renewed';
      });

      expect(renewEvents.length).toBe(1);
      const event = JSON.parse(renewEvents[0]);
      expect(event.lease_key).toBe('test:renew-4');
    });
  });

  describe('A2-2-6: Renew Failure', () => {
    it('应该拒绝 owner 不匹配的 renew', async () => {
      await leaseManager.acquire({
        lease_key: 'test:renew-wrong-owner',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await leaseManager.renew({
        lease_key: 'test:renew-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_OWNER');
      }
    });

    it('应该拒绝过期的 lease renew', async () => {
      // Acquire with short TTL
      await leaseManager.acquire({
        lease_key: 'test:renew-expired',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await leaseManager.renew({
        lease_key: 'test:renew-expired',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('EXPIRED');
      }
    });

    it('应该拒绝不存在的 lease renew', async () => {
      const result = await leaseManager.renew({
        lease_key: 'test:non-existent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });
  });

  describe('A2-2-7: Release Success', () => {
    it('应该成功 release lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:release-1',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await leaseManager.release({
        lease_key: 'test:release-1',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.already_released).toBeUndefined(); // First release
      }

      // Verify lease status
      const lease = await leaseManager.getLease('test:release-1');
      expect(lease!.status).toBe('released');
    });

    it('应该写入 lease_released 事件到 log', async () => {
      await leaseManager.acquire({
        lease_key: 'test:release-2',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await leaseManager.release({
        lease_key: 'test:release-2',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // Read log
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const releaseEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'lease_released';
      });

      expect(releaseEvents.length).toBe(1);
    });
  });

  describe('A2-2-8: Release Idempotency', () => {
    it('应该支持重复 release (幂等)', async () => {
      await leaseManager.acquire({
        lease_key: 'test:release-idempotent',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      // First release
      const result1 = await leaseManager.release({
        lease_key: 'test:release-idempotent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result1.success).toBe(true);

      // Second release (should be no-op)
      const result2 = await leaseManager.release({
        lease_key: 'test:release-idempotent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.already_released).toBe(true);
      }
    });

    it('应该保持 released 状态不变', async () => {
      await leaseManager.acquire({
        lease_key: 'test:release-state',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await leaseManager.release({
        lease_key: 'test:release-state',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      await leaseManager.release({
        lease_key: 'test:release-state',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const lease = await leaseManager.getLease('test:release-state');
      expect(lease!.status).toBe('released');
    });
  });

  describe('A2-2-9: Release Failure', () => {
    it('应该拒绝 owner 不匹配的 release', async () => {
      await leaseManager.acquire({
        lease_key: 'test:release-wrong-owner',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      const result = await leaseManager.release({
        lease_key: 'test:release-wrong-owner',
        owner_instance_id: 'different-instance',
        owner_session_id: 'different-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_OWNER');
      }
    });

    it('应该拒绝不存在的 lease release', async () => {
      const result = await leaseManager.release({
        lease_key: 'test:non-existent',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });
  });
});
