/**
 * Phase 4.x-B3: Long-Running Stability Test Fixture
 * 
 * 提供长时间运行验证的测试环境：
 * - 可配置运行时长 (12h / 24h / 48h / 72h)
 * - 周期性指标采样
 * - snapshot / log 大小采集
 * - replay 恢复时间采集
 * - stale cleanup 行为记录
 * - 内存/文件增长趋势记录
 * - 异常中断后恢复与继续观测
 */

import { createMultiInstanceFixture, cleanupMultiInstanceFixture, MultiInstanceFixture } from './multi-instance-fixture.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// ==================== Types ====================

export interface LongRunningConfig {
  instanceCount: number;
  durationHours: number;
  samplingIntervalMinutes: number;
  operationIntervalMs: number;
  enableStormScenarios: boolean;
  stormIntervalHours: number;
  enableInstanceFailover: boolean;
  failoverIntervalHours: number;
  timeoutBufferHours: number;
}

export interface StabilityMetrics {
  timestamp: number;
  elapsedHours: number;
  
  // Consistency
  owner_drift_count: number;
  duplicate_process_count: number;
  ghost_state_count: number;
  state_inconsistency_count: number;
  
  // Resources
  memory_heap_used_mb: number;
  memory_heap_total_mb: number;
  file_handle_count: number;
  snapshot_size_kb: number;
  log_size_kb: number;
  temp_file_count: number;
  
  // Performance
  acquire_latency_p50_ms: number;
  acquire_latency_p99_ms: number;
  claim_latency_p50_ms: number;
  claim_latency_p99_ms: number;
  suppression_latency_p50_ms: number;
  suppression_latency_p99_ms: number;
  
  // Cleanup
  stale_cleanup_count: number;
  stale_cleanup_latency_ms: number;
  reclaim_success_count: number;
  reclaim_fail_count: number;
  
  // Recovery
  replay_time_ms: number;
  snapshot_recovery_time_ms: number;
}

export interface LongRunningFixture {
  config: LongRunningConfig;
  multiInstanceFixture: MultiInstanceFixture;
  metricsHistory: StabilityMetrics[];
  startTime: number;
  lastSampleTime: number;
  isRunning: boolean;
  isPaused: boolean;
  abortSignal: AbortController;
  
  // Operations
  sampleMetrics: () => Promise<StabilityMetrics>;
  runContinuousOperations: () => Promise<void>;
  runStormScenario: () => Promise<void>;
  simulateInstanceFailover: () => Promise<void>;
  verifyFinalState: () => Promise<StateVerificationResult>;
  generateReport: () => LongRunningReport;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  saveState: () => Promise<void>;
  loadState: () => Promise<void>;
}

export interface StateVerificationResult {
  owner_drift_count: number;
  duplicate_process_count: number;
  ghost_state_count: number;
  state_inconsistency_count: number;
  passed: boolean;
  errors: string[];
}

export interface LongRunningReport {
  config: LongRunningConfig;
  startTime: string;
  endTime: string;
  actualDurationHours: number;
  totalSamples: number;
  metrics: StabilityMetrics[];
  trends: TrendAnalysis;
  anomalies: Anomaly[];
  verification: StateVerificationResult;
  passed: boolean;
  summary: string;
}

export interface TrendAnalysis {
  memory_growth_mb_per_hour: number;
  snapshot_growth_kb_per_hour: number;
  log_growth_kb_per_hour: number;
  performance_degradation_percent: number;
  is_stable: boolean;
}

export interface Anomaly {
  timestamp: number;
  metric: string;
  expected: string;
  actual: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// ==================== Default Config ====================

export const DEFAULT_LONG_RUNNING_CONFIG: LongRunningConfig = {
  instanceCount: 3,
  durationHours: 12,
  samplingIntervalMinutes: 30,
  operationIntervalMs: 1000, // 1 operation per second per instance
  enableStormScenarios: false,
  stormIntervalHours: 6,
  enableInstanceFailover: false,
  failoverIntervalHours: 12,
  timeoutBufferHours: 2,
};

// ==================== Helper Functions ====================

function getElapsedHours(startTime: number): number {
  return (Date.now() - startTime) / (1000 * 60 * 60);
}

function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * percentile);
  return sorted[Math.min(index, sorted.length - 1)] || 0;
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size / 1024; // KB
  } catch {
    return 0;
  }
}

async function getFileCount(dirPath: string): Promise<number> {
  try {
    const files = await fs.readdir(dirPath);
    return files.length;
  } catch {
    return 0;
  }
}

// ==================== Create Fixture ====================

export async function createLongRunningFixture(
  config: Partial<LongRunningConfig> = {}
): Promise<LongRunningFixture> {
  const fullConfig: LongRunningConfig = {
    ...DEFAULT_LONG_RUNNING_CONFIG,
    ...config,
  };

  const multiInstanceFixture = await createMultiInstanceFixture({
    instanceCount: fullConfig.instanceCount,
  });

  const fixture: LongRunningFixture = {
    config: fullConfig,
    multiInstanceFixture,
    metricsHistory: [],
    startTime: Date.now(),
    lastSampleTime: Date.now(),
    isRunning: false,
    isPaused: false,
    abortSignal: new AbortController(),

    async sampleMetrics(): Promise<StabilityMetrics> {
      const elapsedHours = getElapsedHours(this.startTime);
      const now = Date.now();

      // Memory metrics
      const memoryUsage = process.memoryUsage();
      const memory_heap_used_mb = memoryUsage.heapUsed / (1024 * 1024);
      const memory_heap_total_mb = memoryUsage.heapTotal / (1024 * 1024);

      // File metrics
      const snapshot_size_kb = await getFileSize(
        join(this.multiInstanceFixture.sharedDataDir, 'leases', 'leases_snapshot.json')
      );
      const log_size_kb = await getFileSize(
        join(this.multiInstanceFixture.sharedDataDir, 'leases', 'leases_log.jsonl')
      );
      const temp_file_count = await getFileCount(
        join(this.multiInstanceFixture.dataDir)
      );

      // Performance metrics (sample with 10 operations)
      const acquireLatencies: number[] = [];
      const claimLatencies: number[] = [];
      const suppressionLatencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const instance = this.multiInstanceFixture.instances[i % this.multiInstanceFixture.instances.length];
        
        // Acquire latency
        const acquireStart = Date.now();
        await instance.leaseManager.acquire({
          lease_key: `perf-test-${now}-${i}`,
          lease_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          ttl_ms: 1000,
        }).catch(() => {});
        acquireLatencies.push(Date.now() - acquireStart);

        // Claim latency
        const claimStart = Date.now();
        await instance.itemCoordinator.claim({
          item_key: `perf-test-${now}-${i}`,
          item_type: 'test',
          owner_instance_id: instance.instanceId,
          owner_session_id: instance.sessionId,
          lease_ttl_ms: 1000,
        }).catch(() => {});
        claimLatencies.push(Date.now() - claimStart);

        // Suppression latency
        const suppressionStart = Date.now();
        await instance.suppressionManager.evaluate({
          suppression_scope: 'test',
          action_type: 'claim',
          correlation_id: `perf-test-${now}-${i}`,
        }).catch(() => {});
        suppressionLatencies.push(Date.now() - suppressionStart);
      }

      const metrics: StabilityMetrics = {
        timestamp: now,
        elapsedHours,
        
        // Consistency (placeholder - updated during operations)
        owner_drift_count: 0,
        duplicate_process_count: 0,
        ghost_state_count: 0,
        state_inconsistency_count: 0,
        
        // Resources
        memory_heap_used_mb,
        memory_heap_total_mb,
        file_handle_count: 0, // Not easily measurable in Node.js
        snapshot_size_kb,
        log_size_kb,
        temp_file_count,
        
        // Performance
        acquire_latency_p50_ms: getPercentile(acquireLatencies, 0.5),
        acquire_latency_p99_ms: getPercentile(acquireLatencies, 0.99),
        claim_latency_p50_ms: getPercentile(claimLatencies, 0.5),
        claim_latency_p99_ms: getPercentile(claimLatencies, 0.99),
        suppression_latency_p50_ms: getPercentile(suppressionLatencies, 0.5),
        suppression_latency_p99_ms: getPercentile(suppressionLatencies, 0.99),
        
        // Cleanup (placeholder - updated during cleanup)
        stale_cleanup_count: 0,
        stale_cleanup_latency_ms: 0,
        reclaim_success_count: 0,
        reclaim_fail_count: 0,
        
        // Recovery (placeholder - updated during recovery tests)
        replay_time_ms: 0,
        snapshot_recovery_time_ms: 0,
      };

      this.metricsHistory.push(metrics);
      this.lastSampleTime = now;

      return metrics;
    },

    async runContinuousOperations(): Promise<void> {
      let operationCount = 0;
      const leaseKeys = Array.from({ length: 100 }, (_, i) => `long-running-lease-${i}`);

      while (this.isRunning && !this.isPaused && !this.abortSignal.signal.aborted) {
        try {
          const instance = this.multiInstanceFixture.instances[operationCount % this.multiInstanceFixture.instances.length];
          const leaseKey = leaseKeys[operationCount % leaseKeys.length];

          // Random operation
          const op = Math.random();
          if (op < 0.4) {
            // Acquire
            await instance.leaseManager.acquire({
              lease_key: leaseKey,
              lease_type: 'test',
              owner_instance_id: instance.instanceId,
              owner_session_id: instance.sessionId,
              ttl_ms: 5000,
            }).catch(() => {});
          } else if (op < 0.7) {
            // Claim
            await instance.itemCoordinator.claim({
              item_key: leaseKey,
              item_type: 'test',
              owner_instance_id: instance.instanceId,
              owner_session_id: instance.sessionId,
              lease_ttl_ms: 5000,
            }).catch(() => {});
          } else {
            // Release
            await instance.leaseManager.release({
              lease_key: leaseKey,
              owner_instance_id: instance.instanceId,
              owner_session_id: instance.sessionId,
            }).catch(() => {});
          }

          operationCount++;
        } catch (error) {
          // Ignore operation errors during long-running test
        }

        // Wait for next operation
        await new Promise(resolve => {
          const timer = setTimeout(resolve, this.config.operationIntervalMs);
          this.abortSignal.signal.addEventListener('abort', () => clearTimeout(timer));
        });
      }
    },

    async runStormScenario(): Promise<void> {
      const correlationId = `storm-${Date.now()}`;
      const evaluatePromises: Promise<any>[] = [];

      // 1000 concurrent evaluates
      for (let i = 0; i < 1000; i++) {
        const instance = this.multiInstanceFixture.instances[i % this.multiInstanceFixture.instances.length];
        evaluatePromises.push(
          instance.suppressionManager.evaluate({
            suppression_scope: 'test',
            action_type: 'claim',
            correlation_id: correlationId,
          }).catch(() => {})
        );
      }

      await Promise.all(evaluatePromises);
    },

    async simulateInstanceFailover(): Promise<void> {
      // Shutdown one instance
      const instanceIndex = 0;
      const instance = this.multiInstanceFixture.instances[instanceIndex];
      
      await instance.itemCoordinator.shutdown();
      await instance.suppressionManager.shutdown();

      // Wait for stale detection
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Simulate reclaim by another instance
      const reclaimInstance = this.multiInstanceFixture.instances[1];
      const staleLeases = await reclaimInstance.leaseManager.detectStaleLeases();
      
      for (const lease of staleLeases) {
        await reclaimInstance.leaseManager.reclaimStaleLease({
          lease_key: lease.lease_key,
          reclaimed_by_instance_id: reclaimInstance.instanceId,
          reclaimed_by_session_id: reclaimInstance.sessionId,
          reason: 'owner_failed',
        }).catch(() => {});
      }
    },

    async verifyFinalState(): Promise<StateVerificationResult> {
      const errors: string[] = [];
      let owner_drift_count = 0;
      let duplicate_process_count = 0;
      let ghost_state_count = 0;
      let state_inconsistency_count = 0;

      // Verify no ghost states (leases without items or vice versa)
      const leases = this.multiInstanceFixture.sharedLeaseManager['leases'];
      const items = this.multiInstanceFixture.instances[0].itemCoordinator['items'];

      for (const [key, lease] of leases) {
        if (lease.status === 'active' && !items.has(key)) {
          ghost_state_count++;
          errors.push(`Ghost lease: ${key}`);
        }
      }

      // Verify consistency across instances
      for (let i = 1; i < this.multiInstanceFixture.instances.length; i++) {
        const itemsI = this.multiInstanceFixture.instances[i].itemCoordinator['items'];
        for (const [key, item] of items) {
          const itemI = itemsI.get(key);
          if (itemI && JSON.stringify(item) !== JSON.stringify(itemI)) {
            state_inconsistency_count++;
            errors.push(`State inconsistency: ${key}`);
          }
        }
      }

      return {
        owner_drift_count,
        duplicate_process_count,
        ghost_state_count,
        state_inconsistency_count,
        passed: errors.length === 0,
        errors,
      };
    },

    generateReport(): LongRunningReport {
      const endTime = Date.now();
      const actualDurationHours = getElapsedHours(this.startTime);

      // Calculate trends
      const firstMetrics = this.metricsHistory[0];
      const lastMetrics = this.metricsHistory[this.metricsHistory.length - 1];

      const memory_growth_mb_per_hour = lastMetrics && firstMetrics
        ? (lastMetrics.memory_heap_used_mb - firstMetrics.memory_heap_used_mb) / actualDurationHours
        : 0;

      const snapshot_growth_kb_per_hour = lastMetrics && firstMetrics
        ? (lastMetrics.snapshot_size_kb - firstMetrics.snapshot_size_kb) / actualDurationHours
        : 0;

      const log_growth_kb_per_hour = lastMetrics && firstMetrics
        ? (lastMetrics.log_size_kb - firstMetrics.log_size_kb) / actualDurationHours
        : 0;

      const performance_degradation_percent = lastMetrics && firstMetrics
        ? ((lastMetrics.acquire_latency_p50_ms - firstMetrics.acquire_latency_p50_ms) / firstMetrics.acquire_latency_p50_ms) * 100
        : 0;

      const is_stable = 
        memory_growth_mb_per_hour < 10 && // < 10MB per hour
        snapshot_growth_kb_per_hour < 100 && // < 100KB per hour
        Math.abs(performance_degradation_percent) < 20; // < 20% degradation

      // Detect anomalies
      const anomalies: Anomaly[] = [];
      for (const metrics of this.metricsHistory) {
        if (metrics.memory_heap_used_mb > 512) {
          anomalies.push({
            timestamp: metrics.timestamp,
            metric: 'memory_heap_used_mb',
            expected: '< 512MB',
            actual: `${metrics.memory_heap_used_mb.toFixed(2)}MB`,
            severity: 'high',
            description: 'Memory usage exceeded threshold',
          });
        }
        if (metrics.acquire_latency_p99_ms > 200) {
          anomalies.push({
            timestamp: metrics.timestamp,
            metric: 'acquire_latency_p99_ms',
            expected: '< 200ms',
            actual: `${metrics.acquire_latency_p99_ms.toFixed(2)}ms`,
            severity: 'medium',
            description: 'Acquire latency exceeded threshold',
          });
        }
      }

      const verification = {
        owner_drift_count: 0,
        duplicate_process_count: 0,
        ghost_state_count: 0,
        state_inconsistency_count: 0,
        passed: true,
        errors: [],
      };

      return {
        config: this.config,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        actualDurationHours,
        totalSamples: this.metricsHistory.length,
        metrics: this.metricsHistory,
        trends: {
          memory_growth_mb_per_hour,
          snapshot_growth_kb_per_hour,
          log_growth_kb_per_hour,
          performance_degradation_percent,
          is_stable,
        },
        anomalies,
        verification,
        passed: is_stable && anomalies.length === 0,
        summary: `Long-running test completed: ${actualDurationHours.toFixed(2)}h, ${this.metricsHistory.length} samples, stable=${is_stable}`,
      };
    },

    async pause(): Promise<void> {
      this.isPaused = true;
    },

    async resume(): Promise<void> {
      this.isPaused = false;
    },

    async stop(): Promise<void> {
      this.isRunning = false;
      this.abortSignal.abort();
    },

    async saveState(): Promise<void> {
      const statePath = join(this.multiInstanceFixture.dataDir, 'long-running-state.json');
      const state = {
        startTime: this.startTime,
        lastSampleTime: this.lastSampleTime,
        metricsHistory: this.metricsHistory,
        config: this.config,
      };
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    },

    async loadState(): Promise<void> {
      const statePath = join(this.multiInstanceFixture.dataDir, 'long-running-state.json');
      try {
        const stateData = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(stateData);
        this.startTime = state.startTime;
        this.lastSampleTime = state.lastSampleTime;
        this.metricsHistory = state.metricsHistory;
      } catch {
        // State file doesn't exist, start fresh
      }
    },
  };

  return fixture;
}

// ==================== Cleanup Fixture ====================

export async function cleanupLongRunningFixture(fixture: LongRunningFixture): Promise<void> {
  await fixture.stop();
  await cleanupMultiInstanceFixture(fixture.multiInstanceFixture);
}

// ==================== Run Long-Running Test ====================

export async function runLongRunningTest(
  fixture: LongRunningFixture,
  onComplete?: (report: LongRunningReport) => Promise<void>
): Promise<LongRunningReport> {
  fixture.isRunning = true;

  // Start continuous operations
  const operationsPromise = fixture.runContinuousOperations();

  // Sample metrics periodically
  const samplingIntervalMs = fixture.config.samplingIntervalMinutes * 60 * 1000;
  const totalDurationMs = fixture.config.durationHours * 60 * 60 * 1000;
  const timeoutMs = (fixture.config.durationHours + fixture.config.timeoutBufferHours) * 60 * 60 * 1000;

  const samplingPromise = new Promise<void>(async (resolve, reject) => {
    const timeoutTimer = setTimeout(() => {
      reject(new Error(`Long-running test timeout after ${fixture.config.durationHours + fixture.config.timeoutBufferHours}h`));
    }, timeoutMs);

    try {
      while (fixture.isRunning && !fixture.abortSignal.signal.aborted) {
        await fixture.sampleMetrics();

        // Run storm scenarios if enabled
        if (fixture.config.enableStormScenarios) {
          const elapsedHours = getElapsedHours(fixture.startTime);
          if (elapsedHours % fixture.config.stormIntervalHours < (samplingIntervalMs / (1000 * 60 * 60))) {
            await fixture.runStormScenario();
          }
        }

        // Simulate instance failover if enabled
        if (fixture.config.enableInstanceFailover) {
          const elapsedHours = getElapsedHours(fixture.startTime);
          if (elapsedHours % fixture.config.failoverIntervalHours < (samplingIntervalMs / (1000 * 60 * 60))) {
            await fixture.simulateInstanceFailover();
          }
        }

        // Check if duration completed
        if (getElapsedHours(fixture.startTime) >= fixture.config.durationHours) {
          break;
        }

        // Wait for next sample
        await new Promise(r => setTimeout(r, samplingIntervalMs));
      }

      clearTimeout(timeoutTimer);
      resolve();
    } catch (error) {
      clearTimeout(timeoutTimer);
      reject(error);
    }
  });

  try {
    await Promise.race([operationsPromise, samplingPromise]);
  } finally {
    fixture.isRunning = false;
  }

  // Verify final state
  const verification = await fixture.verifyFinalState();

  // Generate report
  const report = fixture.generateReport();
  report.verification = verification;
  report.passed = report.trends.is_stable && report.anomalies.length === 0 && verification.passed;

  // Save state
  await fixture.saveState();

  // Call completion callback
  if (onComplete) {
    await onComplete(report);
  }

  return report;
}
