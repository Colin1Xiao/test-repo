/**
 * Phase 4.x-A2-2: Stale Lease Detection & Reclaim Tests
 * 
 * 验证规则:
 * - 过期 lease 可被 detect
 * - owner instance 已 failed/inactive 时可被 detect
 * - reclaim stale lease 成功
 * - reclaim 不越界到 A2-3 语义
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-2: Stale Lease Detection & Reclaim', () => {
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
      heartbeatConfig: {
        interval_ms: 100,
        timeout_ms: 300,
        grace_period_ms: 100,
        max_clock_drift_ms: 50,
      },
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
      config: {
        default_ttl_ms: 100,
        max_ttl_ms: 1000,
        renew_grace_period_ms: 50,
        stale_cleanup_interval_ms: 50,
      },
    });
    await leaseManager.initialize();
  });

  afterEach(async () => {
    await leaseManager.shutdown();
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-2-10: Stale Detection by Expiration', () => {
    it('应该 detect 过期的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:stale-expired',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const staleLeases = await leaseManager.detectStaleLeases();

      expect(staleLeases.length).toBeGreaterThanOrEqual(1);
      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-expired');
      expect(found).toBeDefined();
    });

    it('应该不 detect 未过期的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:stale-active',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 500,
      });

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));

      const staleLeases = await leaseManager.detectStaleLeases();

      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-active');
      expect(found).toBeUndefined();
    });

    it('应该使用双重验证 (expires_at + owner status)', async () => {
      // Lease not expired but owner failed
      await leaseManager.acquire({
        lease_key: 'test:stale-owner-failed',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000, // Long TTL
      });

      // Mark owner as failed
      await registry.markFailed(ownerId.instance_id);

      const staleLeases = await leaseManager.detectStaleLeases();

      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-owner-failed');
      expect(found).toBeDefined();
    });
  });

  describe('A2-2-11: Stale Detection by Owner Status', () => {
    it('应该 detect owner instance failed 的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:stale-owner-failed-2',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000,
      });

      // Mark owner as failed
      await registry.markFailed(ownerId.instance_id);

      const staleLeases = await leaseManager.detectStaleLeases();

      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-owner-failed-2');
      expect(found).toBeDefined();
    });

    it('应该 detect owner instance inactive 的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:stale-owner-inactive',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000,
      });

      // Mark owner as inactive
      await registry.unregister(ownerId.instance_id, 'shutdown');

      const staleLeases = await leaseManager.detectStaleLeases();

      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-owner-inactive');
      expect(found).toBeDefined();
    });

    it('应该不 detect owner active 的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:stale-owner-active',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000,
      });

      // Owner is still active
      const staleLeases = await leaseManager.detectStaleLeases();

      const found = staleLeases.find((l: any) => l.lease_key === 'test:stale-owner-active');
      expect(found).toBeUndefined();
    });
  });

  describe('A2-2-12: Reclaim Success', () => {
    it('应该成功 reclaim 过期的 lease', async () => {
      // Create expired lease
      await leaseManager.acquire({
        lease_key: 'test:reclaim-expired',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reclaim by different owner
      const result = await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-expired',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
        reason: 'expired',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.status).toBe('reclaimed');
        expect(result.lease.owner_instance_id).toBe('new-instance');
        expect(result.lease.owner_session_id).toBe('new-session');
      }
    });

    it('应该成功 reclaim owner failed 的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:reclaim-owner-failed',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000,
      });

      // Mark owner as failed
      await registry.markFailed(ownerId.instance_id);

      // Reclaim
      const result = await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-owner-failed',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
        reason: 'owner_failed',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.lease.status).toBe('reclaimed');
      }
    });

    it('应该写入 lease_reclaimed 事件到 log', async () => {
      await leaseManager.acquire({
        lease_key: 'test:reclaim-log',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-log',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
      });

      // Read log
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      const reclaimEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'lease_reclaimed';
      });

      expect(reclaimEvents.length).toBe(1);
      const event = JSON.parse(reclaimEvents[0]);
      expect(event.lease_key).toBe('test:reclaim-log');
      expect(event.data.reason).toBe('expired');
    });
  });

  describe('A2-2-13: Reclaim Failure', () => {
    it('应该拒绝 reclaim 未过期的 lease', async () => {
      await leaseManager.acquire({
        lease_key: 'test:reclaim-active',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 5000,
      });

      const result = await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-active',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_STALE');
      }
    });

    it('应该拒绝 reclaim 不存在的 lease', async () => {
      const result = await leaseManager.reclaimStaleLease({
        lease_key: 'test:non-existent',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });
  });

  describe('A2-2-14: Reclaim Boundary', () => {
    it('应该只负责 reclaim，不负责 work item 重分配', async () => {
      // This test verifies boundary - reclaim should only change lease ownership
      await leaseManager.acquire({
        lease_key: 'test:reclaim-boundary',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-boundary',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify only lease ownership changed
        expect(result.lease.status).toBe('reclaimed');
        expect(result.lease.owner_instance_id).toBe('new-instance');
        // No work item operations should have occurred
      }
    });

    it('应该支持 reclaim 原因记录', async () => {
      await leaseManager.acquire({
        lease_key: 'test:reclaim-reason',
        lease_type: 'test',
        owner_instance_id: ownerId.instance_id,
        owner_session_id: ownerId.session_id,
        ttl_ms: 50,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await leaseManager.reclaimStaleLease({
        lease_key: 'test:reclaim-reason',
        reclaimed_by_instance_id: 'new-instance',
        reclaimed_by_session_id: 'new-session',
        reason: 'custom_reason',
      });

      // Read log to verify reason
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      const event = JSON.parse(lines[lines.length - 1]);

      expect(event.data.reason).toBe('custom_reason');
    });
  });
});
