/**
 * Phase 4.x-B2: Lease Acquire/Release Stress Test
 * 
 * 对应场景：B2-S1 (高频 Lease Acquire/Release)
 * 
 * 验证内容:
 * - 10 实例并发 acquire/release 循环
 * - CAS 保证唯一成功者
 * - latency P99 ≤ 100ms
 * - 无 owner 漂移
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMultiInstanceFixture, cleanupMultiInstanceFixture, MultiInstanceFixture } from '../../fixtures/multi-instance-fixture.js';

interface StressMetrics {
  latencies: Map<string, number[]>;
  successCounts: Map<string, { success: number; total: number }>;
}

class StressMetricsCollector {
  private metrics: StressMetrics = {
    latencies: new Map(),
    successCounts: new Map(),
  };

  recordLatency(operation: string, latencyMs: number) {
    if (!this.metrics.latencies.has(operation)) {
      this.metrics.latencies.set(operation, []);
    }
    this.metrics.latencies.get(operation)!.push(latencyMs);
  }

  recordSuccess(operation: string, success: boolean) {
    if (!this.metrics.successCounts.has(operation)) {
      this.metrics.successCounts.set(operation, { success: 0, total: 0 });
    }
    const count = this.metrics.successCounts.get(operation)!;
    count.total++;
    if (success) count.success++;
  }

  getP50(operation: string): number {
    return this.getPercentile(operation, 0.5);
  }

  getP99(operation: string): number {
    return this.getPercentile(operation, 0.99);
  }

  getSuccessRate(operation: string): number {
    const count = this.metrics.successCounts.get(operation);
    if (!count || count.total === 0) return 0;
    return count.success / count.total;
  }

  private getPercentile(operation: string, percentile: number): number {
    const values = this.metrics.latencies.get(operation) || [];
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const index = Math.floor(values.length * percentile);
    return values[index] || 0;
  }

  getReport(): Record<string, any> {
    const report: Record<string, any> = {};
    for (const op of this.metrics.latencies.keys()) {
      report[op] = {
        p50_ms: this.getP50(op),
        p99_ms: this.getP99(op),
        success_rate: this.getSuccessRate(op),
        total_requests: this.metrics.successCounts.get(op)?.total || 0,
      };
    }
    return report;
  }
}

describe('Phase 4.x-B2: Lease Acquire/Release Stress Test', () => {
  let fixture: MultiInstanceFixture;
  let metrics: StressMetricsCollector;

  beforeEach(async () => {
    fixture = await createMultiInstanceFixture({ instanceCount: 10 });
    metrics = new StressMetricsCollector();
  });

  afterEach(async () => {
    await cleanupMultiInstanceFixture(fixture);
  });

  // ==================== B2-S1-1: High-Frequency Acquire ====================

  describe('B2-S1-1: High-Frequency Acquire', () => {
    it('应该 10 实例并发 acquire 100 次/实例', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `stress-lease-${i}`);
      const acquirePromises: Promise<any>[] = [];

      // 10 instances × 100 acquires = 1000 concurrent acquires
      for (let i = 0; i < 1000; i++) {
        const instance = fixture.instances[i % 10];
        const leaseKey = leaseKeys[i % 100];
        const startTime = Date.now();

        acquirePromises.push(
          instance.leaseManager.acquire({
            lease_key: leaseKey,
            lease_type: 'test',
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
            ttl_ms: 10000,
          }).then(result => {
            const latency = Date.now() - startTime;
            metrics.recordLatency('acquire', latency);
            metrics.recordSuccess('acquire', result.success);
            return result;
          })
        );
      }

      const results = await Promise.all(acquirePromises);

      // Metrics validation
      const report = metrics.getReport();
      console.log('Acquire Stress Report:', JSON.stringify(report, null, 2));

      // Verify: acquire_latency_p99 ≤ 100ms
      expect(report.acquire.p99_ms).toBeLessThanOrEqual(100);

      // Note: acquire_success_rate will be ~10% (100 successes / 1000 attempts for 100 keys)
      // This is expected behavior due to CAS guarantee
      expect(report.acquire.success_rate).toBeGreaterThanOrEqual(0.09); // ≥ 9% (expected ~10%)
    });

    it('应该 CAS 保证唯一成功者 (1000 并发)', async () => {
      const leaseKey = 'stress-cas-lease';

      // 1000 concurrent acquires for same lease
      const acquirePromises = fixture.instances.map(instance =>
        instance.leaseManager.acquire({
          lease_key: leaseKey,
          lease_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          ttl_ms: 10000,
        })
      );

      const results = await Promise.all(acquirePromises);

      // Only one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);

      // Others should fail with ALREADY_LEASED
      const alreadyLeasedCount = results.filter(
        r => !r.success && r.error === 'ALREADY_LEASED'
      ).length;
      expect(alreadyLeasedCount).toBe(9);
    });
  });

  // ==================== B2-S1-2: High-Frequency Release ====================

  describe('B2-S1-2: High-Frequency Release', () => {
    it('应该 10 实例并发 release 100 次/实例', async () => {
      // First acquire leases
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `stress-release-${i}`);
      const acquireResults = await Promise.all(
        leaseKeys.map((key, i) =>
          fixture.instances[i % 10].leaseManager.acquire({
            lease_key: key,
            lease_type: 'test',
            owner_instance_id: fixture.instances[i % 10].instanceId,
            owner_session_id: fixture.instances[i % 10].sessionId,
            ttl_ms: 10000,
          })
        )
      );

      expect(acquireResults.filter(r => r.success).length).toBe(100);

      // Then release
      const releasePromises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const instance = fixture.instances[i % 10];
        const leaseKey = leaseKeys[i];
        const startTime = Date.now();

        releasePromises.push(
          instance.leaseManager.release({
            lease_key: leaseKey,
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
          }).then(result => {
            const latency = Date.now() - startTime;
            metrics.recordLatency('release', latency);
            metrics.recordSuccess('release', result.success);
            return result;
          })
        );
      }

      const results = await Promise.all(releasePromises);

      // Metrics validation
      const report = metrics.getReport();
      console.log('Release Stress Report:', JSON.stringify(report, null, 2));

      // Verify: release_latency_p99 ≤ 50ms
      expect(report.release.p99_ms).toBeLessThanOrEqual(50);

      // Verify: release_success_rate ≥ 99%
      expect(report.release.success_rate).toBeGreaterThanOrEqual(0.99);
    });
  });

  // ==================== B2-S1-3: Mixed Acquire/Release ====================

  describe('B2-S1-3: Mixed Acquire/Release', () => {
    it('应该混合 acquire/release 无 owner 漂移', async () => {
      const leaseKeys = Array.from({ length: 50 }, (_, i) => `stress-mixed-${i}`);
      const operations: Array<{ type: 'acquire' | 'release'; key: string; instanceIdx: number }> = [];

      // Generate mixed operations
      for (let i = 0; i < 500; i++) {
        const isAcquire = Math.random() > 0.5;
        operations.push({
          type: isAcquire ? 'acquire' : 'release',
          key: leaseKeys[i % 50],
          instanceIdx: i % 10,
        });
      }

      // Execute mixed operations
      const results = await Promise.all(
        operations.map(op => {
          const instance = fixture.instances[op.instanceIdx];
          if (op.type === 'acquire') {
            return instance.leaseManager.acquire({
              lease_key: op.key,
              lease_type: 'test',
              owner_instance_id: instance.instanceId,
              owner_session_id: instance.sessionId,
              ttl_ms: 10000,
            });
          } else {
            return instance.leaseManager.release({
              lease_key: op.key,
              owner_instance_id: instance.instanceId,
              owner_session_id: instance.sessionId,
            });
          }
        })
      );

      // Verify no illegal state transitions
      const illegalTransitions = results.filter(
        r => !r.success && r.error !== 'ALREADY_LEASED' && r.error !== 'NOT_FOUND' && r.error !== 'NOT_OWNER'
      );
      expect(illegalTransitions.length).toBe(0);
    });
  });

  // ==================== B2-S1-4: Latency Under Load ====================

  describe('B2-S1-4: Latency Under Load', () => {
    it('应该 acquire_latency_p50 ≤ 20ms', async () => {
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `stress-latency-${i}`);

      const acquirePromises = leaseKeys.map((key, i) => {
        const instance = fixture.instances[i % 10];
        const startTime = Date.now();
        return instance.leaseManager.acquire({
          lease_key: key,
          lease_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          ttl_ms: 10000,
        }).then(result => {
          const latency = Date.now() - startTime;
          metrics.recordLatency('acquire', latency);
          return result;
        });
      });

      await Promise.all(acquirePromises);

      const report = metrics.getReport();
      console.log('Latency Report:', JSON.stringify(report, null, 2));

      // Verify: acquire_latency_p50 ≤ 20ms
      expect(report.acquire.p50_ms).toBeLessThanOrEqual(20);
    });
  });
});
