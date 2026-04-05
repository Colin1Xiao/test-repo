/**
 * B3 Debug: Simple Fixture Test
 * 
 * 验证 long-running-fixture 能正常启动和关闭
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createLongRunningFixture, 
  cleanupLongRunningFixture,
  LongRunningFixture 
} from 'tests/fixtures/long-running-fixture.js';

describe('B3 Debug: Simple Fixture Test', () => {
  let fixture: LongRunningFixture;

  beforeEach(async () => {
    console.log('[B3-Debug] Creating fixture...');
    fixture = await createLongRunningFixture({
      instanceCount: 2,
      durationHours: 0.0083, // 30 seconds
      samplingIntervalMinutes: 0.167, // 10 seconds
      operationIntervalMs: 100,
    });
    console.log('[B3-Debug] Fixture created');
  });

  afterEach(async () => {
    console.log('[B3-Debug] Cleaning up fixture...');
    await cleanupLongRunningFixture(fixture);
    console.log('[B3-Debug] Fixture cleaned up');
  });

  it('应该能正常创建和清理 fixture', async () => {
    expect(fixture).toBeDefined();
    expect(fixture.config.instanceCount).toBe(2);
    console.log('[B3-Debug] Test passed');
  }, 30000);

  it('应该能采样一次指标', async () => {
    const metrics = await fixture.sampleMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.memory_heap_used_mb).toBeGreaterThan(0);
    console.log('[B3-Debug] Metrics sampled:', metrics.memory_heap_used_mb.toFixed(2), 'MB');
  }, 30000);

  it('应该能运行连续操作 5 秒后停止', async () => {
    fixture.isRunning = true;
    
    // Start operations in background
    const operationsPromise = fixture.runContinuousOperations();
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop
    await fixture.stop();
    
    // Wait for operations to finish
    await operationsPromise;
    
    console.log('[B3-Debug] Operations stopped');
  }, 30000);
});
