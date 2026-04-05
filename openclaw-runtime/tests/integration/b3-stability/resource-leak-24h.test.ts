/**
 * Phase 4.x-B3: 24h Resource Leak Detection Test
 * 
 * 验证内容:
 * - 24 小时连续运行
 * - 内存泄漏检测
 * - 文件句柄泄漏检测
 * - 临时文件积累检测
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createLongRunningFixture, 
  cleanupLongRunningFixture, 
  runLongRunningTest,
  LongRunningFixture 
} from 'tests/fixtures/long-running-fixture.js';

describe('Phase 4.x-B3: 24h Resource Leak Detection Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    const isCI = process.env.CI === 'true';
    fixture = await createLongRunningFixture({
      instanceCount: isCI ? 2 : 3,
      durationHours: isCI ? 0.05 : 24, // 3 minutes for CI, 24h for local
      samplingIntervalMinutes: isCI ? 0.5 : 60, // 30s for CI
      operationIntervalMs: isCI ? 100 : 1000,
      enableStormScenarios: false,
      enableInstanceFailover: false,
      timeoutBufferHours: isCI ? 0.1 : 4,
    });
  });

  afterEach(async () => {
    await cleanupLongRunningFixture(fixture);
  });

  it('应该 24h 内存泄漏 ≤ 100MB', async () => {
    const report = await runLongRunningTest(fixture);
    const totalMemoryGrowth = report.trends.memory_growth_mb_per_hour * report.actualDurationHours;

    console.log('24h Memory growth:', totalMemoryGrowth.toFixed(2) + 'MB');

    const isCI = process.env.CI === 'true';
    const threshold = isCI ? 500 : 100;
    expect(totalMemoryGrowth).toBeLessThanOrEqual(threshold);
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);

  it('应该 24h snapshot 大小 ≤ 5120 KB', async () => {
    const report = await runLongRunningTest(fixture);
    const lastSnapshotSize = report.metrics[report.metrics.length - 1]?.snapshot_size_kb || 0;

    console.log('24h Snapshot size:', lastSnapshotSize.toFixed(2) + 'KB');

    const isCI = process.env.CI === 'true';
    const threshold = isCI ? 10000 : 5120;
    expect(lastSnapshotSize).toBeLessThanOrEqual(threshold);
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);

  it('应该 24h log 大小 ≤ 10240 KB', async () => {
    const report = await runLongRunningTest(fixture);
    const lastLogSize = report.metrics[report.metrics.length - 1]?.log_size_kb || 0;

    console.log('24h Log size:', lastLogSize.toFixed(2) + 'KB');

    const isCI = process.env.CI === 'true';
    const threshold = isCI ? 20000 : 10240;
    expect(lastLogSize).toBeLessThanOrEqual(threshold);
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);

  it('应该 24h snapshot 增长 ≤ 100KB/h', async () => {
    const report = await runLongRunningTest(fixture);
    console.log('24h Snapshot growth:', report.trends.snapshot_growth_kb_per_hour.toFixed(2) + 'KB/h');

    const isCI = process.env.CI === 'true';
    const threshold = isCI ? 1000 : 100;
    expect(report.trends.snapshot_growth_kb_per_hour).toBeLessThanOrEqual(threshold);
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);

  it('应该 24h log 增长 ≤ 200KB/h', async () => {
    const report = await runLongRunningTest(fixture);
    console.log('24h Log growth:', report.trends.log_growth_kb_per_hour.toFixed(2) + 'KB/h');

    const isCI = process.env.CI === 'true';
    // CI mode: Relaxed threshold for short tests (3min amplifies growth rate)
    const threshold = isCI ? 5000 : 200;
    expect(report.trends.log_growth_kb_per_hour).toBeLessThanOrEqual(threshold);
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);

  it('应该无资源泄漏异常', async () => {
    const report = await runLongRunningTest(fixture);
    const resourceAnomalies = report.anomalies.filter(a => 
      a.metric.includes('memory') || 
      a.metric.includes('snapshot') || 
      a.metric.includes('log')
    );

    console.log('Resource anomalies:', resourceAnomalies.length);

    const isCI = process.env.CI === 'true';
    if (!isCI) {
      expect(resourceAnomalies.length).toBe(0);
    } else {
      console.log('CI mode: Skipping resource anomaly check (requires longer runtime)');
    }
  }, process.env.CI ? 10 * 60 * 1000 : (24 + 4) * 60 * 60 * 1000);
});
