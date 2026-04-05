/**
 * Phase 4.x-A2-5: Batch I - Instance + Lease Integration (Simplified)
 * 
 * 验证 A2-1 (Instance Registry) + A2-2 (Lease Manager) 集成：
 * - instance identity 正常时 lease 正常
 * - lease TTL 过期后可 detect
 * - Instance-Lease 一致性不变式
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Phase 4.x-A2-5: Batch I - Instance + Lease Integration', () => {
  let dataDir: string;
  let instanceRegistry: InstanceRegistry;
  let leaseManager: LeaseManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-a2-5-instance-lease-' + Date.now());

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
        default_ttl_ms: 200, // Short TTL for tests
      },
      autoCleanup: false,
    });
    await leaseManager.initialize();
  });

  afterEach(async () => {
    await leaseManager.shutdown();
    await instanceRegistry.shutdown();
  });

  // ==================== A2-5-9: Instance Identity → Lease Normal ====================

  describe('A2-5-9: Instance Identity → Lease Normal', () => {
    it('应该 instance identity 正常时 lease acquire 成功', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease
      const leaseResult = await leaseManager.acquire({
        lease_key: 'test:active-lease-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 1000,
      });

      expect(leaseResult.success).toBe(true);
      if (leaseResult.success) {
        expect(leaseResult.lease.owner_instance_id).toBe(identity.instance_id);
      }
    });

    it('应该 instance identity 正常时 lease renew 成功', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease
      await leaseManager.acquire({
        lease_key: 'test:active-renew-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 1000,
      });

      // Renew lease
      const renewResult = await leaseManager.renew({
        lease_key: 'test:active-renew-1',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(renewResult.success).toBe(true);
    });

    it('应该 instance identity 正常时 lease release 成功', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease
      await leaseManager.acquire({
        lease_key: 'test:active-release-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 1000,
      });

      // Release lease
      const releaseResult = await leaseManager.release({
        lease_key: 'test:active-release-1',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(releaseResult.success).toBe(true);

      // Verify lease status
      const lease = await leaseManager.getLease('test:active-release-1');
      expect(lease!.status).toBe('released');
    });
  });

  // ==================== A2-5-10: Lease TTL Expiry → Detect ====================

  describe('A2-5-10: Lease TTL Expiry → Detect', () => {
    it('应该 lease TTL 过期后可 detect', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease with short TTL
      await leaseManager.acquire({
        lease_key: 'test:ttl-expire-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 100,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Detect stale leases
      const staleLeases = await leaseManager.detectStaleLeases();

      expect(staleLeases.length).toBeGreaterThanOrEqual(1);
      expect(staleLeases.map((l: any) => l.lease_key)).toContain('test:ttl-expire-1');
    });

    it('应该 lease TTL 未过期时不可 detect', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease with long TTL
      await leaseManager.acquire({
        lease_key: 'test:ttl-active-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 10000,
      });

      // Detect stale leases (should be empty)
      const staleLeases = await leaseManager.detectStaleLeases();

      expect(staleLeases.map((l: any) => l.lease_key)).not.toContain('test:ttl-active-1');
    });
  });

  // ==================== A2-5-11: Cross-Layer Invariant ====================

  describe('A2-5-11: Cross-Layer Invariant - Instance-Lease Consistency', () => {
    it('应该验证 active lease 的 owner instance_id 与 identity 一致', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease
      await leaseManager.acquire({
        lease_key: 'test:invariant-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 1000,
      });

      // Get lease
      const lease = await leaseManager.getLease('test:invariant-1');
      expect(lease!.status).toBe('active');
      expect(lease!.owner_instance_id).toBe(identity.instance_id);
      expect(lease!.owner_session_id).toBe(identity.session_id);
    });

    it('应该验证 lease 释放后 status 正确', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire and release
      await leaseManager.acquire({
        lease_key: 'test:invariant-2',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 1000,
      });

      await leaseManager.release({
        lease_key: 'test:invariant-2',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Verify
      const lease = await leaseManager.getLease('test:invariant-2');
      expect(lease!.status).toBe('released');
    });

    it('应该验证 reclaimed lease status 正确', async () => {
      const identity = await instanceRegistry.getIdentity();

      // Acquire lease with short TTL
      await leaseManager.acquire({
        lease_key: 'test:invariant-reclaim-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
        ttl_ms: 100,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Detect and reclaim
      const staleLeases = await leaseManager.detectStaleLeases();
      const staleLease = staleLeases.find((l: any) => l.lease_key === 'test:invariant-reclaim-1');
      
      if (staleLease) {
        const reclaimResult = await leaseManager.reclaimStaleLease({
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
    });
  });
});
