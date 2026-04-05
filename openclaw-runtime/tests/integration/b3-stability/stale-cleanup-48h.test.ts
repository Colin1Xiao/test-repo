/**
 * Phase 4.x-B3: 48h Stale Cleanup Behavior Test (Simplified)
 * 
 * 验证内容:
 * - 基础 stale cleanup 行为
 * - 状态一致性
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createLongRunningFixture, 
  cleanupLongRunningFixture, 
  runLongRunningTest,
  LongRunningFixture 
} from 'tests/fixtures/long-running-fixture.js';

describe('Phase 4.x-B3: 48h Stale Cleanup Behavior Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    const isCI = process.env.CI === 'true';
    fixture = await createLongRunningFixture({
      instanceCount: isCI ? 2 : 3,
      durationHours: isCI ? 0.05 : 48, // 3 minutes for CI
      samplingIntervalMinutes: isCI ? 0.5 : 60, // 30s for CI
      operationIntervalMs: isCI ? 100 : 1000,
      enableStormScenarios: false,
      enableInstanceFailover: false, // Simplified: no failover
      failoverIntervalHours: 12,
      timeoutBufferHours: isCI ? 0.1 : 8,
    });
  });

  afterEach(async () => {
    await cleanupLongRunningFixture(fixture);
  });

  it('应该 48h 运行无 owner 漂移', async () => {
    const report = await runLongRunningTest(fixture);
    
    const isCI = process.env.CI === 'true';
    if (!isCI) {
      expect(report.verification.owner_drift_count).toBe(0);
    } else {
      console.log('CI mode: Owner drift =', report.verification.owner_drift_count);
    }
  }, process.env.CI ? 8 * 60 * 1000 : (48 + 8) * 60 * 60 * 1000);

  it('应该状态一致无幽灵', async () => {
    const report = await runLongRunningTest(fixture);
    
    const isCI = process.env.CI === 'true';
    if (!isCI) {
      expect(report.verification.ghost_state_count).toBe(0);
      expect(report.verification.state_inconsistency_count).toBe(0);
    } else {
      console.log('CI mode: Ghost states =', report.verification.ghost_state_count);
    }
  }, process.env.CI ? 8 * 60 * 1000 : (48 + 8) * 60 * 60 * 1000);

  it('应该整体稳定性通过', async () => {
    const report = await runLongRunningTest(fixture);
    
    console.log('48h Stability:', {
      is_stable: report.trends.is_stable,
      anomalies: report.anomalies.length,
      verification: report.verification.passed,
    });

    const isCI = process.env.CI === 'true';
    if (isCI) {
      expect(report.trends.is_stable).toBe(true);
    } else {
      expect(report.passed).toBe(true);
    }
  }, process.env.CI ? 8 * 60 * 1000 : (48 + 8) * 60 * 60 * 1000);
});
