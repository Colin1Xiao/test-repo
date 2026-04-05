/**
 * Phase 4.x-B1: 4-Instance Suppression Consistency Test
 * 
 * 对应场景：B1-S5 (4 实例 suppression 一致性验证)
 * 
 * 验证内容:
 * - 4 实例下 duplicate suppression 一致
 * - 相同 suppression key 不出现跨实例分裂
 * - decision 结果一致
 * - replay-safe 行为不漂移
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMultiInstanceFixture, cleanupMultiInstanceFixture, MultiInstanceFixture } from '../../fixtures/multi-instance-fixture.js';

describe('Phase 4.x-B1: 4-Instance Suppression Consistency', () => {
  let fixture: MultiInstanceFixture;

  beforeEach(async () => {
    // Create 4-instance fixture with shared storage
    fixture = await createMultiInstanceFixture({ instanceCount: 4 });
  });

  afterEach(async () => {
    await cleanupMultiInstanceFixture(fixture);
  });

  // ==================== B1-S5-1: Cross-Instance Suppression Consistency ====================

  describe('B1-S5-1: Cross-Instance Suppression Consistency', () => {
    it('应该 4 实例 evaluation 同一 correlation_id 只有一个 ALLOWED', async () => {
      const correlationId = 'test:consistency-1';

      // All 4 instances evaluate same correlation_id concurrently
      const results = await Promise.all(
        fixture.instances.map(instance =>
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          })
        )
      );

      // Only one should be ALLOWED (first_seen), rest should be SUPPRESSED
      const allowedCount = results.filter(r => r.decision === 'ALLOWED').length;
      const suppressedCount = results.filter(r => r.decision === 'SUPPRESSED').length;

      expect(allowedCount).toBe(1);
      expect(suppressedCount).toBe(3);

      // Metrics: suppression_hit_rate = 100% (3/3)
      // Metrics: cross_instance_inconsistency_count = 0
    });

    it('应该第一个 ALLOWED 的实例是 first_seen', async () => {
      const correlationId = 'test:first-seen-1';

      // Instance 1 evaluates first (sequential)
      const result1 = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(result1.decision).toBe('ALLOWED');
      expect(result1.reason).toBe('first_seen');

      // Instance 2 evaluates - should be SUPPRESSED (shared storage)
      const result2 = await fixture.instances[1].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(result2.decision).toBe('SUPPRESSED');
      expect(result2.reason).toBe('duplicate');
    });

    it('应该 suppression 记录在实例间一致', async () => {
      const correlationId = 'test:record-consistency-1';

      // Instance 1 evaluates first
      await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      // All instances should see the same suppression record (shared manager)
      const suppressionKey = 'test:claim:' + correlationId;

      const record1 = await fixture.instances[0].suppressionManager.getRecord(suppressionKey);
      const record2 = await fixture.instances[1].suppressionManager.getRecord(suppressionKey);
      const record3 = await fixture.instances[2].suppressionManager.getRecord(suppressionKey);
      const record4 = await fixture.instances[3].suppressionManager.getRecord(suppressionKey);

      // All should see the same record (shared manager)
      expect(record1).toBeDefined();
      expect(record1!.hit_count).toBe(record2!.hit_count);
      expect(record1!.hit_count).toBe(record3!.hit_count);
      expect(record1!.hit_count).toBe(record4!.hit_count);
    });
  });

  // ==================== B1-S5-2: Duplicate Suppression Across Instances ====================

  describe('B1-S5-2: Duplicate Suppression Across Instances', () => {
    it('应该重复请求被正确抑制 (共享存储)', async () => {
      const correlationId = 'test:duplicate-1';

      // Instance 1 evaluates first
      const result1 = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      expect(result1.decision).toBe('ALLOWED');

      // Instance 2 evaluates same correlation_id (shared storage)
      const result2 = await fixture.instances[1].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      // With shared storage, result2 should be SUPPRESSED
      expect(result2.decision).toBe('SUPPRESSED');
      expect(result2.reason).toBe('duplicate');
    });

    it('应该 suppression decision latency 在可接受范围', async () => {
      const correlationId = 'test:latency-1';

      const startTime = Date.now();
      await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });
      const latency = Date.now() - startTime;

      // Metrics: suppression_decision_latency_ms
      expect(latency).toBeLessThan(100); // Target: ≤ 100ms
    });
  });

  // ==================== B1-S5-3: Replay-Safe Behavior ====================

  describe('B1-S5-3: Replay-Safe Behavior', () => {
    it('应该 replay 模式绕过抑制', async () => {
      const correlationId = 'test:replay-1';

      // First evaluation
      await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      // Replay mode evaluation
      const replayResult = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
        replay_mode: true,
      });

      expect(replayResult.decision).toBe('ALLOWED');
      expect(replayResult.reason).toBe('replay_safe');
    });

    it('应该 replay 模式不增加 hit_count', async () => {
      const correlationId = 'test:replay-hitcount-1';

      // First evaluation
      await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      // Get initial hit_count
      const record1 = await fixture.instances[0].suppressionManager.getRecord('test:claim:' + correlationId);
      const initialHitCount = record1!.hit_count;

      // Replay mode evaluations (should not increase hit_count)
      for (let i = 0; i < 3; i++) {
        await fixture.instances[0].suppressionManager.evaluate({
          suppression_scope: 'test',
          action_type: 'claim',
          correlation_id: correlationId,
          replay_mode: true,
        });
      }

      // Verify hit_count unchanged
      const record2 = await fixture.instances[0].suppressionManager.getRecord('test:claim:' + correlationId);
      expect(record2).toBeDefined();
      expect(record2!.hit_count).toBe(initialHitCount);

      // Metrics: replay_conflict_count = 0
    });

    it('应该 replay-safe 行为不漂移', async () => {
      const correlationId = 'test:replay-stable-1';

      // Multiple replay evaluations
      for (let i = 0; i < 5; i++) {
        const result = await fixture.instances[0].suppressionManager.evaluate({
          suppression_scope: 'test',
          action_type: 'claim',
          correlation_id: correlationId,
          replay_mode: i % 2 === 0, // Alternate replay mode
        });

        if (i === 0) {
          expect(result.decision).toBe('ALLOWED');
          expect(result.reason).toBe('first_seen');
        } else if (i % 2 === 0) {
          expect(result.decision).toBe('ALLOWED');
          expect(result.reason).toBe('replay_safe');
        } else {
          expect(result.decision).toBe('SUPPRESSED');
        }
      }

      // Verify consistent behavior
      const record = await fixture.instances[0].suppressionManager.getRecord('test:claim:' + correlationId);
      expect(record!.hit_count).toBe(3); // 1 (first) + 2 (non-replay duplicates)
    });
  });

  // ==================== B1-S5-4: Cross-Instance Invariants ====================

  describe('B1-S5-4: Cross-Instance Invariants', () => {
    it('应该无跨实例分裂', async () => {
      const correlationId = 'test:no-split-1';

      // All instances evaluate concurrently
      const results = await Promise.all(
        fixture.instances.map(instance =>
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          })
        )
      );

      // Count ALLOWED decisions
      const allowedCount = results.filter(r => r.decision === 'ALLOWED').length;

      // With shared manager, only one should be ALLOWED
      expect(allowedCount).toBe(1);
    });

    it('应该 decision 结果一致 (同一实例内)', async () => {
      const correlationId = 'test:consistent-1';

      // Instance 1 evaluates multiple times
      const result1 = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      const result2 = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      const result3 = await fixture.instances[0].suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'claim',
        correlation_id: correlationId,
      });

      // First should be ALLOWED, rest should be SUPPRESSED
      expect(result1.decision).toBe('ALLOWED');
      expect(result2.decision).toBe('SUPPRESSED');
      expect(result3.decision).toBe('SUPPRESSED');

      // Metrics: cross_instance_inconsistency_count = 0 (within single instance)
    });
  });
});
