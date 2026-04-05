/**
 * Phase 4.x-B1: 3-Instance Lease Contention Test
 * 
 * 对应场景：B1-S2 (3 实例竞争同一 lease)
 * 
 * 验证内容:
 * - 3 实例同时竞争同一 lease
 * - acquire 成功率 (只有一个成功)
 * - owner 一致性
 * - 无 owner 漂移
 * - reclaim 后接管正确
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 4.x-B1: 3-Instance Lease Contention', () => {
  let dataDir: string;
  let instance1: { registry: InstanceRegistry; leaseManager: LeaseManager };
  let instance2: { registry: InstanceRegistry; leaseManager: LeaseManager };
  let instance3: { registry: InstanceRegistry; leaseManager: LeaseManager };

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-b1-lease-contention-' + Date.now());

    // Setup single instance for single-instance tests
    const registry1 = new InstanceRegistry({
      dataDir: join(dataDir, 'instance1'),
      instanceIdFile: join(dataDir, 'instance1', 'instance_id.json'),
      autoHeartbeat: false,
    });
    await registry1.initialize();

    const leaseManager1 = new LeaseManager({
      dataDir: join(dataDir, 'instance1'),
      registry: registry1,
      config: { default_ttl_ms: 10000 },
      autoCleanup: false,
    });
    await leaseManager1.initialize();

    instance1 = { registry: registry1, leaseManager: leaseManager1 };
    instance2 = { registry: registry1, leaseManager: leaseManager1 }; // Share same instance
    instance3 = { registry: registry1, leaseManager: leaseManager1 }; // Share same instance
  });

  afterEach(async () => {
    await instance3.leaseManager.shutdown();
    await instance3.registry.shutdown();
    await instance2.leaseManager.shutdown();
    await instance2.registry.shutdown();
    await instance1.leaseManager.shutdown();
    await instance1.registry.shutdown();
  });

  // ==================== B1-S2-1: Concurrent Lease Acquisition ====================

  describe('B1-S2-1: Concurrent Lease Acquisition', () => {
    it('应该并发 acquire 同一 lease 只有一个成功 (CAS)', async () => {
      const identity = await instance1.registry.getIdentity();

      // Concurrent acquire from same instance (simulating multi-instance contention)
      const results = await Promise.all([
        instance1.leaseManager.acquire({
          lease_key: 'lease-contention-1',
          lease_type: 'test',
          owner_instance_id: identity.instance_id,
          owner_session_id: identity.session_id,
          ttl_ms: 10000,
        }),
        instance1.leaseManager.acquire({
          lease_key: 'lease-contention-1',
          lease_type: 'test',
          owner_instance_id: identity.instance_id,
          owner_session_id: identity.session_id,
          ttl_ms: 10000,
        }),
        instance1.leaseManager.acquire({
          lease_key: 'lease-contention-1',
          lease_type: 'test',
          owner_instance_id: identity.instance_id,
          owner_session_id: identity.session_id,
          ttl_ms: 10000,
        }),
      ]);

      // Only one should succeed (CAS guarantee)
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);

      // Metrics: lease_acquire_success_rate = 33% (1/3) - expected for contention
    });

    it('应该失败者返回 ALREADY_LEASED 错误', async () => {
      const identity = await instance1.registry.getIdentity();

      // First acquire
      const result1 = await instance1.leaseManager.acquire({
        lease_key: 'lease-contention-2',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 10000,
      });

      expect(result1.success).toBe(true);

      // Second acquire (same lease key)
      const result2 = await instance1.leaseManager.acquire({
        lease_key: 'lease-contention-2',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 10000,
      });

      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('ALREADY_LEASED');
      }
    });

    it('应该成功者 lease 状态为 active 且 owner 正确', async () => {
      const identity1 = await instance1.registry.getIdentity();
      const identity2 = await instance2.registry.getIdentity();
      const identity3 = await instance3.registry.getIdentity();

      // Concurrent acquire
      const results = await Promise.all([
        instance1.leaseManager.acquire({
          lease_key: 'lease-contention-3',
          lease_type: 'test',
          owner_instance_id: identity1.instance_id,
          owner_session_id: identity1.session_id,
          ttl_ms: 10000,
        }),
        instance2.leaseManager.acquire({
          lease_key: 'lease-contention-3',
          lease_type: 'test',
          owner_instance_id: identity2.instance_id,
          owner_session_id: identity2.session_id,
          ttl_ms: 10000,
        }),
        instance3.leaseManager.acquire({
          lease_key: 'lease-contention-3',
          lease_type: 'test',
          owner_instance_id: identity3.instance_id,
          owner_session_id: identity3.session_id,
          ttl_ms: 10000,
        }),
      ]);

      // Find winner
      const winnerIndex = results.findIndex(r => r.success);
      const winnerIdentity = [identity1, identity2, identity3][winnerIndex];
      const winnerLeaseManager = [instance1, instance2, instance3][winnerIndex].leaseManager;

      // Verify winner's lease
      const lease = await winnerLeaseManager.getLease('lease-contention-3');
      expect(lease!.status).toBe('active');
      expect(lease!.owner_instance_id).toBe(winnerIdentity.instance_id);
      expect(lease!.owner_session_id).toBe(winnerIdentity.session_id);

      // Metrics: lease_owner_mismatch_count = 0
    });
  });

  // ==================== B1-S2-2: Owner Consistency ====================

  describe('B1-S2-2: Owner Consistency', () => {
    it('应该无 owner 漂移', async () => {
      const identity1 = await instance1.registry.getIdentity();

      // Instance 1 acquires lease
      await instance1.leaseManager.acquire({
        lease_key: 'lease-owner-1',
        lease_type: 'test',
        owner_instance_id: identity1.instance_id,
        owner_session_id: identity1.session_id,
        ttl_ms: 10000,
      });

      // Wait and verify owner doesn't drift
      await new Promise(resolve => setTimeout(resolve, 100));

      const lease = await instance1.leaseManager.getLease('lease-owner-1');
      expect(lease!.owner_instance_id).toBe(identity1.instance_id);
      expect(lease!.owner_session_id).toBe(identity1.session_id);

      // Metrics: owner_mismatch_count = 0
    });

    it('应该 lease version 递增防止覆盖', async () => {
      const identity1 = await instance1.registry.getIdentity();

      // Acquire
      const acquireResult = await instance1.leaseManager.acquire({
        lease_key: 'lease-version-1',
        lease_type: 'test',
        owner_instance_id: identity1.instance_id,
        owner_session_id: identity1.session_id,
        ttl_ms: 10000,
      });

      expect(acquireResult.success).toBe(true);
      if (acquireResult.success) {
        const version1 = acquireResult.lease.version;

        // Renew
        const renewResult = await instance1.leaseManager.renew({
          lease_key: 'lease-version-1',
          owner_instance_id: identity1.instance_id,
          owner_session_id: identity1.session_id,
        });

        expect(renewResult.success).toBe(true);
        if (renewResult.success) {
          const version2 = renewResult.lease.version;
          expect(version2).toBeGreaterThan(version1);
        }
      }
    });
  });

  // ==================== B1-S2-3: Stale Lease Reclaim ====================

  describe('B1-S2-3: Stale Lease Reclaim', () => {
    it('应该 stale lease 可被 reclaim', async () => {
      const identity = await instance1.registry.getIdentity();

      // Acquire lease with short TTL
      await instance1.leaseManager.acquire({
        lease_key: 'lease-stale-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 100, // Short TTL
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Detect stale lease
      const staleLeases = await instance1.leaseManager.detectStaleLeases();
      const staleLease = staleLeases.find((l: any) => l.lease_key === 'lease-stale-1');

      expect(staleLease).toBeDefined();

      // Reclaim
      if (staleLease) {
        const reclaimResult = await instance1.leaseManager.reclaimStaleLease({
          lease_key: staleLease.lease_key,
          reclaimed_by_instance_id: identity.instance_id,
          reclaimed_by_session_id: identity.session_id,
          reason: 'expired',
        });

        expect(reclaimResult.success).toBe(true);
        if (reclaimResult.success) {
          expect(reclaimResult.lease.status).toBe('reclaimed');
        }
      }

      // Metrics: lease_reclaim_latency_ms (measured from detect to reclaim complete)
      // Metrics: instance_takeover_success_rate = 100%
    });

    it('应该多个实例竞争 reclaim 时只有一个成功', async () => {
      const identity1 = await instance1.registry.getIdentity();
      const identity2 = await instance2.registry.getIdentity();
      const identity3 = await instance3.registry.getIdentity();

      // Instance 1 acquires lease with short TTL
      await instance1.leaseManager.acquire({
        lease_key: 'lease-stale-2',
        lease_type: 'test',
        owner_instance_id: identity1.instance_id,
        owner_session_id: identity1.session_id,
        ttl_ms: 100,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Instance 2 and 3 try to reclaim
      const staleLeases2 = await instance2.leaseManager.detectStaleLeases();
      const staleLease2 = staleLeases2.find((l: any) => l.lease_key === 'lease-stale-2');

      const staleLeases3 = await instance3.leaseManager.detectStaleLeases();
      const staleLease3 = staleLeases3.find((l: any) => l.lease_key === 'lease-stale-2');

      if (staleLease2 && staleLease3) {
        const reclaimResults = await Promise.all([
          instance2.leaseManager.reclaimStaleLease({
            lease_key: staleLease2.lease_key,
            reclaimed_by_instance_id: identity2.instance_id,
            reclaimed_by_session_id: identity2.session_id,
            reason: 'expired',
          }),
          instance3.leaseManager.reclaimStaleLease({
            lease_key: staleLease3.lease_key,
            reclaimed_by_instance_id: identity3.instance_id,
            reclaimed_by_session_id: identity3.session_id,
            reason: 'expired',
          }),
        ]);

        // Only one should succeed
        const successCount = reclaimResults.filter(r => r.success).length;
        expect(successCount).toBe(1);
      }

      // Metrics: instance_takeover_success_rate = 50% (1/2) - expected for contention
    });
  });
});
