/**
 * Phase 4.x-A2-2: Lease Recovery & Replay Tests
 * 
 * 验证规则:
 * - snapshot + log replay 恢复 lease 状态
 * - 旧数据兼容
 * - 部分损坏日志容错
 * - reclaim/release/renew 后恢复一致
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { LeaseManager } from '../../../src/coordination/lease_manager.js';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-2: Lease Recovery & Replay', () => {
  let dataDir: string;
  let instanceIdFile: string;
  let registry: InstanceRegistry;

  afterEach(async () => {
    if (dataDir) {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  describe('A2-2-15: Snapshot Recovery', () => {
    it('应该从 snapshot 恢复 lease 状态', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      // Create registry and lease manager
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      const leaseManager1 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager1.initialize();

      // Acquire lease
      await leaseManager1.acquire({
        lease_key: 'test:recovery-1',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Wait for snapshot
      await new Promise(resolve => setTimeout(resolve, 100));
      await leaseManager1.shutdown();
      await registry.shutdown();

      // Create new lease manager - should recover from snapshot
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager2 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager2.initialize();

      const lease = await leaseManager2.getLease('test:recovery-1');
      expect(lease).toBeDefined();
      expect(lease!.status).toBe('active');
    });

    it('应该 replay log 恢复增量事件', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      const leaseManager1 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager1.initialize();

      // Acquire lease
      await leaseManager1.acquire({
        lease_key: 'test:recovery-2',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Renew lease
      await leaseManager1.renew({
        lease_key: 'test:recovery-2',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Shutdown without snapshot
      await leaseManager1.shutdown();
      await registry.shutdown();

      // Recover - should replay log
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager2 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager2.initialize();

      const lease = await leaseManager2.getLease('test:recovery-2');
      expect(lease).toBeDefined();
      expect(lease!.version).toBe(2); // Initial + 1 renew
    });
  });

  describe('A2-2-16: Log Replay Order', () => {
    it('应该按时间戳顺序 replay 事件', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      const leaseManager1 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager1.initialize();

      // Acquire
      await leaseManager1.acquire({
        lease_key: 'test:recovery-order',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Renew multiple times
      for (let i = 0; i < 3; i++) {
        await leaseManager1.renew({
          lease_key: 'test:recovery-order',
          owner_instance_id: identity.instance_id,
          owner_session_id: identity.session_id,
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await leaseManager1.shutdown();
      await registry.shutdown();

      // Recover
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager2 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager2.initialize();

      const lease = await leaseManager2.getLease('test:recovery-order');
      expect(lease).toBeDefined();
      expect(lease!.version).toBe(4); // Initial + 3 renewals

      // Read log to verify order
      const logPath = join(dataDir, 'leases', 'leases_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      // Events should be in order
      let lastTimestamp = 0;
      for (const line of lines) {
        const event = JSON.parse(line);
        expect(event.timestamp).toBeGreaterThanOrEqual(lastTimestamp);
        lastTimestamp = event.timestamp;
      }
    });
  });

  describe('A2-2-17: Backward Compatibility', () => {
    it('应该兼容旧 lease 格式', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const leasesDir = join(dataDir, 'leases');
      await fs.mkdir(leasesDir, { recursive: true });

      // Create old format snapshot (without session_id)
      const oldSnapshot = {
        leases: {
          'test:old-format': {
            lease_key: 'test:old-format',
            lease_type: 'test',
            owner_instance_id: 'old-instance',
            acquired_at: Date.now() - 1000,
            expires_at: Date.now() + 5000,
            version: 1,
            status: 'active',
          },
        },
        last_snapshot_at: Date.now() - 1000,
      };
      await fs.writeFile(
        join(leasesDir, 'leases_snapshot.json'),
        JSON.stringify(oldSnapshot, null, 2)
      );

      // Initialize
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      const lease = await leaseManager.getLease('test:old-format');
      expect(lease).toBeDefined();
      expect(lease!.lease_key).toBe('test:old-format');
    });
  });

  describe('A2-2-18: Error Tolerance', () => {
    it('应该处理 corrupted log 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const leasesDir = join(dataDir, 'leases');
      await fs.mkdir(leasesDir, { recursive: true });

      // Create corrupted log
      await fs.writeFile(
        join(leasesDir, 'leases_log.jsonl'),
        'invalid json line\n{"type":"lease_acquired","lease_key":"test"}\nanother invalid\n',
        'utf-8'
      );

      // Should not crash, should skip invalid lines
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      // Should still work
      const identity = await registry.getIdentity();
      const result = await leaseManager.acquire({
        lease_key: 'test:new-lease',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(result.success).toBe(true);
    });

    it('应该处理 partial snapshot 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      const leasesDir = join(dataDir, 'leases');
      await fs.mkdir(leasesDir, { recursive: true });

      // Create partial/corrupted snapshot
      await fs.writeFile(
        join(leasesDir, 'leases_snapshot.json'),
        '{"leases": {"test": {', // Incomplete JSON
        'utf-8'
      );

      // Should fallback to log replay or start fresh
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager.initialize();

      // Should still work
      const identity = await registry.getIdentity();
      const result = await leaseManager.acquire({
        lease_key: 'test:new-lease',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      expect(result.success).toBe(true);
    });

    it('应该处理 release/renew 后恢复一致', async () => {
      dataDir = join(TEST_DATA_DIR, 'lease-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });

      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();

      const leaseManager1 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager1.initialize();

      // Acquire
      await leaseManager1.acquire({
        lease_key: 'test:recovery-state',
        lease_type: 'test',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      // Release
      await leaseManager1.release({
        lease_key: 'test:recovery-state',
        owner_instance_id: identity.instance_id,
        owner_session_id: identity.session_id,
      });

      await leaseManager1.shutdown();
      await registry.shutdown();

      // Recover
      registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();

      const leaseManager2 = new LeaseManager({ dataDir, registry, autoCleanup: false });
      await leaseManager2.initialize();

      const lease = await leaseManager2.getLease('test:recovery-state');
      expect(lease).toBeDefined();
      expect(lease!.status).toBe('released');
    });
  });
});
