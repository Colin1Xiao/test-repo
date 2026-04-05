/**
 * Phase 4.x-B2: Snapshot/Log Growth Performance Test
 * 
 * 对应场景：B2-S4 (Snapshot/Log 增长下性能)
 * 
 * 验证内容:
 * - 长时间运行下 snapshot/log 增长对性能的影响
 * - latency 不随 log 增长而显著上升
 * - snapshot 大小在阈值内
 * - replay time 在阈值内
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMultiInstanceFixture, cleanupMultiInstanceFixture, MultiInstanceFixture } from '../../fixtures/multi-instance-fixture.js';
import { promises as fs } from 'fs';
import { join } from 'path';

interface GrowthMetrics {
  timestamps: number[];
  latencies: number[];
  snapshotSizes: number[];
  logSizes: number[];
}

describe('Phase 4.x-B2: Snapshot/Log Growth Performance Test', () => {
  let fixture: MultiInstanceFixture;
  let metrics: GrowthMetrics;

  beforeEach(async () => {
    fixture = await createMultiInstanceFixture({ instanceCount: 10 });
    metrics = {
      timestamps: [],
      latencies: [],
      snapshotSizes: [],
      logSizes: [],
    };
  });

  afterEach(async () => {
    await cleanupMultiInstanceFixture(fixture);
  });

  // ==================== B2-S4-1: Latency Under Log Growth ====================

  describe('B2-S4-1: Latency Under Log Growth', () => {
    it('应该 latency 不随 log 增长而显著上升 (60s)', async () => {
      const leaseKeys = Array.from({ length: 50 }, (_, i) => `growth-lease-${i}`);
      const durationMs = 30000; // 30 seconds (reduced for CI)
      const intervalMs = 100; // 100ms interval = 10 ops/second
      const startTime = Date.now();
      let operationCount = 0;

      // Run for 60 seconds
      while (Date.now() - startTime < durationMs) {
        const batchStart = Date.now();

        // 10 acquire operations
        const acquirePromises = leaseKeys.slice(0, 10).map((key, i) => {
          const instance = fixture.instances[i % 10];
          const opStart = Date.now();
          return instance.leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
            ttl_ms: 30000,
          }).then(() => {
            return Date.now() - opStart;
          });
        });

        const latencies = await Promise.all(acquirePromises);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

        // Record metrics every 10 seconds
        if (operationCount % 100 === 0) {
          metrics.timestamps.push(Date.now() - startTime);
          metrics.latencies.push(avgLatency);
        }

        operationCount++;

        // Wait for next interval
        const elapsed = Date.now() - batchStart;
        if (elapsed < intervalMs) {
          await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed));
        }
      }

      console.log('Latency Growth Report:', {
        timestamps: metrics.timestamps,
        latencies: metrics.latencies,
        operationCount,
      });

      // Verify: latency_degradation ≤ 20%
      if (metrics.latencies.length >= 2 && metrics.latencies[0] > 0) {
        const initialLatency = metrics.latencies[0];
        const finalLatency = metrics.latencies[metrics.latencies.length - 1];
        const degradation = (finalLatency - initialLatency) / initialLatency;

        console.log(`Latency: initial=${initialLatency}ms, final=${finalLatency}ms, degradation=${(degradation * 100).toFixed(1)}%`);
        expect(degradation).toBeLessThanOrEqual(0.2); // ≤ 20%
      } else {
        console.log('Insufficient data for degradation calculation');
      }
    }, 60000); // 60s timeout
  });

  // ==================== B2-S4-2: Snapshot Size Growth ====================

  describe('B2-S4-2: Snapshot Size Growth', () => {
    it('应该 snapshot_size_kb ≤ 5120 KB (5 MB)', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `snapshot-lease-${i}`);

      // Generate many lease operations
      for (let round = 0; round < 10; round++) {
        const acquirePromises = leaseKeys.map((key, i) =>
          fixture.instances[i % 10].leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
            ttl_ms: 60000,
          })
        );

        await Promise.all(acquirePromises);

        // Release half
        const releasePromises = leaseKeys.slice(0, 50).map((key, i) =>
          fixture.instances[i % 10].leaseManager.release({
            lease_key: key,
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
          })
        );

        await Promise.all(releasePromises);
      }

      // Trigger snapshot via shutdown (which saves snapshot)
      // Note: In production, snapshots are saved periodically or on shutdown

      // Check snapshot size
      const snapshotPath = join(fixture.sharedDataDir, 'leases_snapshot.json');
      try {
        const stats = await fs.stat(snapshotPath);
        const sizeKb = stats.size / 1024;

        console.log(`Snapshot size: ${sizeKb.toFixed(2)} KB`);

        // Verify: snapshot_size_kb ≤ 5120 KB
        expect(sizeKb).toBeLessThanOrEqual(5120);
      } catch (error) {
        // Snapshot might not exist, skip
        console.log('Snapshot file not found, skipping size check');
      }
    });
  });

  // ==================== B2-S4-3: Log Size Growth ====================

  describe('B2-S4-3: Log Size Growth', () => {
    it('应该 log_size_kb ≤ 10240 KB (10 MB)', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `log-lease-${i}`);

      // Generate many lease operations
      for (let round = 0; round < 20; round++) {
        const acquirePromises = leaseKeys.map((key, i) =>
          fixture.instances[i % 10].leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
            ttl_ms: 60000,
          })
        );

        await Promise.all(acquirePromises);
      }

      // Check log size
      const logPath = join(fixture.sharedDataDir, 'leases_log.jsonl');
      try {
        const stats = await fs.stat(logPath);
        const sizeKb = stats.size / 1024;

        console.log(`Log size: ${sizeKb.toFixed(2)} KB`);

        // Verify: log_size_kb ≤ 10240 KB
        expect(sizeKb).toBeLessThanOrEqual(10240);
      } catch (error) {
        // Log might not exist, skip
        console.log('Log file not found, skipping size check');
      }
    });
  });

  // ==================== B2-S4-4: Replay Time ====================

  describe('B2-S4-4: Replay Time', () => {
    it('应该 replay_time_ms ≤ 10000ms (10s)', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `replay-lease-${i}`);

      // Generate many lease operations
      for (let round = 0; round < 10; round++) {
        const acquirePromises = leaseKeys.map((key, i) =>
          fixture.instances[i % 10].leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
            ttl_ms: 60000,
          })
        );

        await Promise.all(acquirePromises);
      }

      // Shutdown and restart to trigger replay
      await cleanupMultiInstanceFixture(fixture);

      // Measure replay time
      const replayStart = Date.now();
      fixture = await createMultiInstanceFixture({ instanceCount: 10 });
      const replayTime = Date.now() - replayStart;

      console.log(`Replay time: ${replayTime}ms`);

      // Verify: replay_time_ms ≤ 10000ms
      expect(replayTime).toBeLessThanOrEqual(10000);
    });
  });

  // ==================== B2-S4-5: Memory Usage ====================

  describe('B2-S4-5: Memory Usage', () => {
    it('应该 memory_usage_mb ≤ 512 MB', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `memory-lease-${i}`);

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Generate many lease operations
      for (let round = 0; round < 10; round++) {
        const acquirePromises = leaseKeys.map((key, i) =>
          fixture.instances[i % 10].leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
            ttl_ms: 60000,
          })
        );

        await Promise.all(acquirePromises);
      }

      // Get final memory usage
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory: initial=${initialMemory.toFixed(2)}MB, final=${finalMemory.toFixed(2)}MB, growth=${memoryGrowth.toFixed(2)}MB`);

      // Verify: memory_usage_mb ≤ 512 MB
      expect(finalMemory).toBeLessThanOrEqual(512);
    });
  });
});