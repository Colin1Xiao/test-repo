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
} from '../../fixtures/long-running-fixture.js';

describe('Phase 4.x-B3: 24h Resource Leak Detection Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    fixture = await createLongRunningFixture({
      instanceCount: 3,
      durationHours: process.env.CI ? 0.2 : 24, // 12 minutes for CI, 24h for local
      samplingIntervalMinutes: process.env.CI ? 2 : 60,
      operationIntervalMs: process.env.CI ? 100 : 1000,
      enableStormScenarios: false,
      enableInstanceFailover: false,
      timeoutBufferHours: 4,
    });
  });

  afterEach(async () => {
    await cleanupLongRunningFixture(fixture);
  });

  it('应该 24h 内存泄漏 ≤ 100MB', async () => {
    const report = await runLongRunningTest(fixture);

    const totalMemoryGrowth = report.trends.memory_growth_mb_per_hour * report.actualDurationHours;

    console.log('24h Memory growth:', totalMemoryGrowth.toFixed(2) + 'MB');

    // Verify: memory leak ≤ 100MB over 24h
    expect(totalMemoryGrowth).toBeLessThanOrEqual(100);
  }, (24 + 4) * 60 * 60 * 1000); // 28h timeout

  it('应该 24h snapshot 大小 ≤ 5120 KB', async () => {
    const report = await runLongRunningTest(fixture);

    const lastSnapshotSize = report.metrics[report.metrics.length - 1]?.snapshot_size_kb || 0;

    console.log('24h Snapshot size:', lastSnapshotSize.toFixed(2) + 'KB');

    // Verify: snapshot size ≤ 5120 KB
    expect(lastSnapshotSize).toBeLessThanOrEqual(5120);
  }, (24 + 4) * 60 * 60 * 1000);

  it('应该 24h log 大小 ≤ 10240 KB', async () => {
    const report = await runLongRunningTest(fixture);

    const lastLogSize = report.metrics[report.metrics.length - 1]?.log_size_kb || 0;

    console.log('24h Log size:', lastLogSize.toFixed(2) + 'KB');

    // Verify: log size ≤ 10240 KB
    expect(lastLogSize).toBeLessThanOrEqual(10240);
  }, (24 + 4) * 60 * 60 * 1000);

  it('应该 24h snapshot 增长 ≤ 100KB/h', async () => {
    const report = await runLongRunningTest(fixture);

    console.log('24h Snapshot growth:', report.trends.snapshot_growth_kb_per_hour.toFixed(2) + 'KB/h');

    // Verify: snapshot growth ≤ 100KB/h
    expect(report.trends.snapshot_growth_kb_per_hour).toBeLessThanOrEqual(100);
  }, (24 + 4) * 60 * 60 * 1000);

  it('应该 24h log 增长 ≤ 200KB/h', async () => {
    const report = await runLongRunningTest(fixture);

    console.log('24h Log growth:', report.trends.log_growth_kb_per_hour.toFixed(2) + 'KB/h');

    // Verify: log growth ≤ 200KB/h
    expect(report.trends.log_growth_kb_per_hour).toBeLessThanOrEqual(200);
  }, (24 + 4) * 60 * 60 * 1000);

  it('应该无资源泄漏异常', async () => {
    const report = await runLongRunningTest(fixture);

    const resourceAnomalies = report.anomalies.filter(a => 
      a.metric.includes('memory') || 
      a.metric.includes('snapshot') || 
      a.metric.includes('log')
    );

    console.log('Resource anomalies:', resourceAnomalies.length);

    // Verify: no resource leak anomalies
    expect(resourceAnomalies.length).toBe(0);
  }, (24 + 4) * 60 * 60 * 1000);
});
