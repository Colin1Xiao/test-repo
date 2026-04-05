/**
 * Phase 4.x-B3: 12h Baseline Stability Test
 * 
 * 验证内容:
 * - 12 小时连续运行
 * - 基础稳定性验证
 * - 无 owner 漂移/无重复处理/无幽灵状态
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createLongRunningFixture, 
  cleanupLongRunningFixture, 
  runLongRunningTest,
  LongRunningFixture 
} from 'tests/fixtures/long-running-fixture.js';

describe('Phase 4.x-B3: 12h Baseline Stability Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    // CI mode: 30 seconds (0.0083h), Local: 12h
    const isCI = process.env.CI === 'true';
    fixture = await createLongRunningFixture({
      instanceCount: isCI ? 2 : 3,
      durationHours: isCI ? 0.0083 : 12, // 30s for CI, 12h for local
      samplingIntervalMinutes: isCI ? 0.167 : 30, // 10s for CI, 30m for local
      operationIntervalMs: isCI ? 100 : 1000,
      enableStormScenarios: false,
      enableInstanceFailover: false,
      timeoutBufferHours: isCI ? 0.05 : 2, // 3min buffer for CI
    });
  });

  afterEach(async () => {
    await cleanupLongRunningFixture(fixture);
  });

  it('应该 12h 运行无 owner 漂移', async () => {
    const report = await runLongRunningTest(fixture);

    console.log('12h Baseline Report:', {
      duration: report.actualDurationHours.toFixed(4) + 'h',
      samples: report.totalSamples,
      memory_growth: report.trends.memory_growth_mb_per_hour.toFixed(2) + 'MB/h',
      stable: report.trends.is_stable,
    });

    // Verify: no owner drift
    expect(report.verification.owner_drift_count).toBe(0);
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);

  it('应该 12h 运行无重复处理', async () => {
    const report = await runLongRunningTest(fixture);

    // Verify: no duplicate processing
    expect(report.verification.duplicate_process_count).toBe(0);
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);

  it('应该 12h 运行无幽灵状态', async () => {
    const report = await runLongRunningTest(fixture);

    // Verify: no ghost states
    // Note: This check requires complete lease-item lifecycle, skip in CI mode
    const isCI = process.env.CI === 'true';
    if (!isCI) {
      expect(report.verification.ghost_state_count).toBe(0);
    } else {
      console.log('CI mode: Skipping ghost state check (requires longer runtime)');
    }
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);

  it('应该 12h 内存增长 ≤ 50MB', async () => {
    const report = await runLongRunningTest(fixture);

    const totalMemoryGrowth = report.trends.memory_growth_mb_per_hour * report.actualDurationHours;

    console.log('Memory growth:', totalMemoryGrowth.toFixed(2) + 'MB');

    // Verify: memory growth ≤ 50MB over 12h
    expect(totalMemoryGrowth).toBeLessThanOrEqual(50);
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);

  it('应该 12h 性能退化 ≤ 10%', async () => {
    const report = await runLongRunningTest(fixture);

    console.log('Performance degradation:', report.trends.performance_degradation_percent.toFixed(1) + '%');

    // Verify: performance degradation ≤ 10%
    expect(Math.abs(report.trends.performance_degradation_percent)).toBeLessThanOrEqual(10);
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);

  it('应该整体稳定性验证通过', async () => {
    const report = await runLongRunningTest(fixture);

    console.log('Stability Report:', {
      passed: report.passed,
      is_stable: report.trends.is_stable,
      anomalies: report.anomalies.length,
      verification_passed: report.verification.passed,
      verification_errors: report.verification.errors,
      trends: report.trends,
    });

    // Verify: overall stability
    // Note: For CI mode (30s), we only check basic stability, not full verification
    // Full verification requires complete lease-item lifecycle which is tested in local/long runs
    const isCI = process.env.CI === 'true';
    if (isCI) {
      // CI mode: Check basic stability (memory/performance trends)
      expect(report.trends.is_stable).toBe(true);
      expect(report.anomalies.length).toBe(0);
      console.log('CI mode: Basic stability check passed');
    } else {
      // Local mode: Full verification including state consistency
      expect(report.passed).toBe(true);
      expect(report.trends.is_stable).toBe(true);
      expect(report.anomalies.length).toBe(0);
      expect(report.verification.passed).toBe(true);
    }
  }, process.env.CI ? 60000 : (12 + 2) * 60 * 60 * 1000);
});
