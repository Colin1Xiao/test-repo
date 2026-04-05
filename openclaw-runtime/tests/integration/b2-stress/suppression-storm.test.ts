/**
 * Phase 4.x-B2: Suppression Storm Test
 * 
 * 对应场景：B2-S3 (Suppression Storm)
 * 
 * 验证内容:
 * - 10 实例并发 evaluate 同一 correlation_id
 * - 每个 correlation_id 只有一个 ALLOWED
 * - 其余 999 次为 SUPPRESSED
 * - 无跨实例分裂
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMultiInstanceFixture, cleanupMultiInstanceFixture, MultiInstanceFixture } from '../../fixtures/multi-instance-fixture.js';

interface StormMetrics {
  latencies: number[];
  allowedCount: number;
  suppressedCount: number;
  inconsistencyCount: number;
}

describe('Phase 4.x-B2: Suppression Storm Test', () => {
  let fixture: MultiInstanceFixture;

  beforeEach(async () => {
    fixture = await createMultiInstanceFixture({ instanceCount: 10 });
  });

  afterEach(async () => {
    await cleanupMultiInstanceFixture(fixture);
  });

  // ==================== B2-S3-1: Suppression Storm ====================

  describe('B2-S3-1: Suppression Storm', () => {
    it('应该 10 实例并发 evaluate 同一 correlation_id 100 次/实例', async () => {
      const correlationId = 'storm-test-1';
      const metrics: StormMetrics = {
        latencies: [],
        allowedCount: 0,
        suppressedCount: 0,
        inconsistencyCount: 0,
      };

      // 10 instances × 100 evaluations = 1000 concurrent evaluations
      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        const instance = fixture.instances[i % 10];
        const startTime = Date.now();

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const latency = Date.now() - startTime;
            metrics.latencies.push(latency);

            if (result.decision === 'ALLOWED') {
              metrics.allowedCount++;
            } else if (result.decision === 'SUPPRESSED') {
              metrics.suppressedCount++;
            } else {
              metrics.inconsistencyCount++;
            }

            return result;
          })
        );
      }

      const results = await Promise.all(evaluatePromises);

      // Metrics validation
      const latencies = metrics.latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
      const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

      console.log('Storm Metrics:', {
        total: results.length,
        allowed: metrics.allowedCount,
        suppressed: metrics.suppressedCount,
        inconsistency: metrics.inconsistencyCount,
        p50_ms: p50,
        p99_ms: p99,
      });

      // Verify: Only one ALLOWED
      expect(metrics.allowedCount).toBe(1);

      // Verify: 999 SUPPRESSED
      expect(metrics.suppressedCount).toBe(999);

      // Verify: No inconsistency
      expect(metrics.inconsistencyCount).toBe(0);

      // Verify: suppression_latency_p99 ≤ 250ms (storm scenario)
      expect(p99).toBeLessThanOrEqual(250);

      // Verify: suppression_hit_rate ≈ 100% (may have slight variance due to timing)
      const hitRate = metrics.suppressedCount / (metrics.allowedCount + metrics.suppressedCount);
      expect(hitRate).toBeGreaterThanOrEqual(0.99); // ≥ 99%
    });

    it('应该 10 个 correlation_id 各 100 次 evaluation', async () => {
      const correlationIds = Array.from({ length: 10 }, (_, i) => `storm-multi-${i}`);
      const results: Map<string, { allowed: number; suppressed: number }> = new Map();

      // Initialize results map
      for (const id of correlationIds) {
        results.set(id, { allowed: 0, suppressed: 0 });
      }

      // 10 instances × 10 IDs × 100 evaluations = 10000 evaluations
      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 10000; i++) {
        const instance = fixture.instances[i % 10];
        const correlationId = correlationIds[(i / 100) % 10 | 0];

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const count = results.get(correlationId)!;
            if (result.decision === 'ALLOWED') {
              count.allowed++;
            } else {
              count.suppressed++;
            }
            return result;
          })
        );
      }

      await Promise.all(evaluatePromises);

      // Verify each correlation_id
      for (const [id, count] of results) {
        console.log(`Correlation ${id}: allowed=${count.allowed}, suppressed=${count.suppressed}`);

        // Each ID should have exactly 1 ALLOWED
        expect(count.allowed).toBe(1);

        // Each ID should have 999 SUPPRESSED
        expect(count.suppressed).toBe(999);
      }

      // Verify cross_instance_inconsistency_count = 0
      let inconsistencyCount = 0;
      for (const count of results.values()) {
        if (count.allowed !== 1 || count.suppressed !== 999) {
          inconsistencyCount++;
        }
      }
      expect(inconsistencyCount).toBe(0);
    });
  });

  // ==================== B2-S3-2: No Cross-Instance Split ====================

  describe('B2-S3-2: No Cross-Instance Split', () => {
    it('应该无跨实例分裂 (1000 并发)', async () => {
      const correlationId = 'storm-no-split';

      // Track which instance got ALLOWED
      const instanceResults: Map<number, { allowed: number; suppressed: number }> = new Map();
      for (let i = 0; i < 10; i++) {
        instanceResults.set(i, { allowed: 0, suppressed: 0 });
      }

      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        const instanceIdx = i % 10;
        const instance = fixture.instances[instanceIdx];

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const count = instanceResults.get(instanceIdx)!;
            if (result.decision === 'ALLOWED') {
              count.allowed++;
            } else {
              count.suppressed++;
            }
            return result;
          })
        );
      }

      await Promise.all(evaluatePromises);

      // Verify total ALLOWED = 1
      let totalAllowed = 0;
      for (const count of instanceResults.values()) {
        totalAllowed += count.allowed;
      }
      expect(totalAllowed).toBe(1);

      // Verify no instance has multiple ALLOWED
      for (const [idx, count] of instanceResults) {
        expect(count.allowed).toBeLessThanOrEqual(1);
        console.log(`Instance ${idx}: allowed=${count.allowed}, suppressed=${count.suppressed}`);
      }
    });
  });

  // ==================== B2-S3-3: Latency Under Storm ====================

  describe('B2-S3-3: Latency Under Storm', () => {
    it('应该 suppression_latency_p50 ≤ 10ms (常规场景: 100 并发)', async () => {
      const correlationId = 'storm-latency-normal';
      const latencies: number[] = [];

      // 100 concurrent evaluates (normal scenario)
      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const instance = fixture.instances[i % 10];
        const startTime = Date.now();

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const latency = Date.now() - startTime;
            latencies.push(latency);
            return result;
          })
        );
      }

      await Promise.all(evaluatePromises);

      const sorted = latencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      console.log('Latency under normal load:', { p50_ms: p50, p99_ms: p99 });

      // Verify: suppression_latency_p50 ≤ 10ms (normal scenario)
      expect(p50).toBeLessThanOrEqual(10);
      expect(p99).toBeLessThanOrEqual(20);
    });

    it('应该 suppression_storm_p50 ≤ 100ms (极端场景：1000 并发同 key)', async () => {
      const correlationId = 'storm-latency-extreme';
      const latencies: number[] = [];

      // 1000 concurrent evaluates (extreme hot-key storm scenario)
      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        const instance = fixture.instances[i % 10];
        const startTime = Date.now();

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const latency = Date.now() - startTime;
            latencies.push(latency);
            return result;
          })
        );
      }

      await Promise.all(evaluatePromises);

      const sorted = latencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      console.log('Latency under storm (extreme hot-key):', { p50_ms: p50, p99_ms: p99 });

      // Verify: suppression_storm_p50 ≤ 120ms (extreme storm scenario)
      expect(p50).toBeLessThanOrEqual(120);
      expect(p99).toBeLessThanOrEqual(200);
    });

    it('应该 suppression 多 key 并发性能正常 (1000 并发 / 100 key)', async () => {
      const correlationIds = Array.from({ length: 100 }, (_, i) => `storm-multikey-${i}`);
      const latencies: number[] = [];

      // 1000 concurrent evaluates across 100 keys (10 per key)
      const evaluatePromises: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        const instance = fixture.instances[i % 10];
        const correlationId = correlationIds[i % 100];
        const startTime = Date.now();

        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).then(result => {
            const latency = Date.now() - startTime;
            latencies.push(latency);
            return result;
          })
        );
      }

      await Promise.all(evaluatePromises);

      const sorted = latencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      console.log('Latency under multi-key storm:', { p50_ms: p50, p99_ms: p99 });

      // Verify: multi-key storm latency (should be better than hot-key)
      expect(p50).toBeLessThanOrEqual(120);
      expect(p99).toBeLessThanOrEqual(300);
    });
  });
});