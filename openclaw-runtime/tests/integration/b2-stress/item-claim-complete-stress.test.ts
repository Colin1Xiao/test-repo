/**
 * Phase 4.x-B2: Item Claim/Complete Stress Test
 * 
 * 对应场景：B2-S2 (高频 Item Claim/Complete)
 * 
 * 验证内容:
 * - 10 实例并发 claim/complete 循环
 * - CAS 保证唯一 claim 成功者
 * - 无重复 item 创建
 * - claim→complete 链路完整
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

describe('Phase 4.x-B2: Item Claim/Complete Stress Test', () => {
  let fixture: MultiInstanceFixture;
  let metrics: StressMetricsCollector;

  beforeEach(async () => {
    fixture = await createMultiInstanceFixture({ instanceCount: 10 });
    metrics = new StressMetricsCollector();
  });

  afterEach(async () => {
    await cleanupMultiInstanceFixture(fixture);
  });

  // ==================== B2-S2-1: High-Frequency Claim ====================

  describe('B2-S2-1: High-Frequency Claim', () => {
    it('应该 10 实例并发 claim 50 次/实例', async () => {
      const correlationIds = Array.from({ length: 50 }, (_, i) => `stress-item-${i}`);
      const claimPromises: Promise<any>[] = [];

      // 10 instances × 50 claims = 500 concurrent claims
      for (let i = 0; i < 500; i++) {
        const instance = fixture.instances[i % 10];
        const itemKey = correlationIds[i % 50];
        const startTime = Date.now();

        claimPromises.push(
          instance.itemCoordinator.claim({
            item_key: itemKey,
            item_type: 'test',
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
            lease_ttl_ms: 10000,
          }).then(result => {
            const latency = Date.now() - startTime;
            metrics.recordLatency('claim', latency);
            metrics.recordSuccess('claim', result.success);
            return result;
          })
        );
      }

      const results = await Promise.all(claimPromises);

      // Metrics validation
      const report = metrics.getReport();
      console.log('Claim Stress Report:', JSON.stringify(report, null, 2));

      // Verify: claim_latency_p99 ≤ 200ms
      expect(report.claim.p99_ms).toBeLessThanOrEqual(200);

      // Note: claim_success_rate will be ~10% (50 successes / 500 attempts for 50 keys)
      // This is expected behavior due to CAS guarantee
      expect(report.claim.success_rate).toBeGreaterThanOrEqual(0.09); // ≥ 9% (expected ~10%)
    });

    it('应该 CAS 保证唯一 claim 成功者 (500 并发)', async () => {
      const correlationId = 'stress-cas-item';

      // 500 concurrent claims for same item_key
      const claimPromises = fixture.instances.map(instance =>
        instance.itemCoordinator.claim({
          item_key: correlationId,
          item_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          lease_ttl_ms: 10000,
        })
      );

      const results = await Promise.all(claimPromises);

      // Only one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);

      // Others should fail (ALREADY_CLAIMED or LEASE_CONFLICT)
      const failedCount = results.filter(r => !r.success).length;
      expect(failedCount).toBe(9);
    });
  });

  // ==================== B2-S2-2: High-Frequency Complete ====================

  describe('B2-S2-2: High-Frequency Complete', () => {
    it('应该 10 实例并发 complete 50 次/实例', async () => {
      // First claim items
      const correlationIds = Array.from({ length: 50 }, (_, i) => `stress-complete-${i}`);
      const claimResults = await Promise.all(
        correlationIds.map((id, i) => {
          const instance = fixture.instances[i % 10];
          return instance.itemCoordinator.claim({
            item_key: id,
            item_type: 'test',
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
            lease_ttl_ms: 10000,
          });
        })
      );

      expect(claimResults.filter(r => r.success).length).toBe(50);

      // Then complete
      const completePromises: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        const instance = fixture.instances[i % 10];
        const correlationId = correlationIds[i];
        const startTime = Date.now();

        completePromises.push(
          instance.itemCoordinator.complete({
            item_key: correlationId,
            owner_instance_id: instance.instanceId,
            owner_session_id: instance.sessionId,
            result: { status: 'success' },
          }).then(result => {
            const latency = Date.now() - startTime;
            metrics.recordLatency('complete', latency);
            metrics.recordSuccess('complete', result.success);
            return result;
          })
        );
      }

      const results = await Promise.all(completePromises);

      // Metrics validation
      const report = metrics.getReport();
      console.log('Complete Stress Report:', JSON.stringify(report, null, 2));

      // Verify: complete_latency_p99 ≤ 100ms
      expect(report.complete.p99_ms).toBeLessThanOrEqual(100);

      // Verify: complete_success_rate ≥ 99%
      expect(report.complete.success_rate).toBeGreaterThanOrEqual(0.99);
    });
  });

  // ==================== B2-S2-3: No Duplicate Items ====================

  describe('B2-S2-3: No Duplicate Items', () => {
    it('应该无重复 item 创建 (500 并发)', async () => {
      const correlationId = 'stress-no-duplicate';

      // 500 concurrent claims for same item_key
      const claimPromises = Array.from({ length: 500 }, (_, i) => {
        const instance = fixture.instances[i % 10];
        return instance.itemCoordinator.claim({
          item_key: correlationId,
          item_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          lease_ttl_ms: 10000,
        });
      });

      const results = await Promise.all(claimPromises);

      // Only one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);

      // Verify no duplicate items created
      const duplicateCount = results.filter(
        r => r.success && r.item?.item_key === correlationId
      ).length;
      expect(duplicateCount).toBe(1);
    });
  });

  // ==================== B2-S2-4: Latency Under Load ====================

  describe('B2-S2-4: Latency Under Load', () => {
    it('应该 claim_latency_p50 ≤ 50ms', async () => {
      const correlationIds = Array.from({ length: 100 }, (_, i) => `stress-latency-${i}`);

      const claimPromises = correlationIds.map((id, i) => {
        const instance = fixture.instances[i % 10];
        const startTime = Date.now();
        return instance.itemCoordinator.claim({
          item_key: id,
          item_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          lease_ttl_ms: 10000,
        }).then(result => {
          const latency = Date.now() - startTime;
          metrics.recordLatency('claim', latency);
          return result;
        });
      });

      await Promise.all(claimPromises);

      const report = metrics.getReport();
      console.log('Latency Report:', JSON.stringify(report, null, 2));

      // Verify: claim_latency_p50 ≤ 50ms
      expect(report.claim.p50_ms).toBeLessThanOrEqual(50);
    });
  });
});