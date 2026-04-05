/**
 * Phase 4.x-B3: 48h Stale Cleanup Behavior Test
 * 
 * 验证内容:
 * - 48 小时连续运行
 * - Stale cleanup 行为验证
 * - Reclaim 成功率验证
 * - 实例故障模拟
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createLongRunningFixture, 
  cleanupLongRunningFixture, 
  runLongRunningTest,
  LongRunningFixture 
} from '../../fixtures/long-running-fixture.js';

describe('Phase 4.x-B3: 48h Stale Cleanup Behavior Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    fixture = await createLongRunningFixture({
      instanceCount: 3,
      durationHours: process.env.CI ? 0.4 : 48, // 24 minutes for CI, 48h for local
      samplingIntervalMinutes: process.env.CI ? 4 : 60,
      operationIntervalMs: process.env.CI ? 100 : 1000,
      enableStormScenarios: false,
      enableInstanceFailover: true,
      failoverIntervalHours: 12,
      timeoutBufferHours: 8,
    });
  });

  afterEach(async () => {
    await cleanupLongRunningFixture(fixture);
  });

  it('应该 stale cleanup 延迟 ≤ 1000ms', async () => {
    const report = await runLongRunningTest(fixture);

    // Note: stale_cleanup_latency_ms is tracked during failover scenarios
    // For now, verify it's within acceptable range
    const avgCleanupLatency = report.metrics.reduce((sum, m) => sum + m.stale_cleanup_latency_ms, 0) / report.metrics.length;

    console.log('48h Avg stale cleanup latency:', avgCleanupLatency.toFixed(2) + 'ms');

    // Verify: stale cleanup latency ≤ 1000ms
    expect(avgCleanupLatency).toBeLessThanOrEqual(1000);
  }, (48 + 8) * 60 * 60 * 1000); // 56h timeout

  it('应该 reclaim 成功率 ≥ 99%', async () => {
    const report = await runLongRunningTest(fixture);

    const totalReclaims = report.metrics.reduce((sum, m) => sum + m.reclaim_success_count + m.reclaim_fail_count, 0);
    const successReclaims = report.metrics.reduce((sum, m) => sum + m.reclaim_success_count, 0);

    const reclaimSuccessRate = totalReclaims > 0 ? successReclaims / totalReclaims : 1;

    console.log('48h Reclaim success rate:', (reclaimSuccessRate * 100).toFixed(1) + '%');

    // Verify: reclaim success rate ≥ 99%
    expect(reclaimSuccessRate).toBeGreaterThanOrEqual(0.99);
  }, (48 + 8) * 60 * 60 * 1000);

  it('应该 48h 运行无 owner 漂移', async () => {
    const report = await runLongRunningTest(fixture);

    // Verify: no owner drift during failover
    expect(report.verification.owner_drift_count).toBe(0);
  }, (48 + 8) * 60 * 60 * 1000);

  it('应该实例故障后状态一致', async () => {
    const report = await runLongRunningTest(fixture);

    // Verify: no state inconsistency after failover
    expect(report.verification.state_inconsistency_count).toBe(0);
  }, (48 + 8) * 60 * 60 * 1000);

  it('应该 cleanup 频率正常', async () => {
    const report = await runLongRunningTest(fixture);

    // Verify: cleanup occurred at expected intervals
    const cleanupEvents = report.metrics.filter(m => m.stale_cleanup_count > 0);
    
    console.log('48h Cleanup events:', cleanupEvents.length);

    // Should have at least some cleanup events during 48h with failover enabled
    expect(cleanupEvents.length).toBeGreaterThan(0);
  }, (48 + 8) * 60 * 60 * 1000);
});
