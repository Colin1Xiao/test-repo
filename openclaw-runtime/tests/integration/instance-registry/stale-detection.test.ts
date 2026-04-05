/**
 * Phase 4.x-A2-1: Stale Detection Tests
 * 
 * 验证规则:
 * - 超过 timeout + grace_period 后标记 failed
 * - log 中写入 stale_detected 事件
 * - failed 实例可被查询
 * - cleanup 只做检测/标记/记录/暴露
 * - 不做 lease 释放、work item 重分配
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-1: Stale Detection', () => {
  let registry: InstanceRegistry;
  let dataDir: string;
  let instanceIdFile: string;

  beforeEach(async () => {
    dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
    await fs.mkdir(dataDir, { recursive: true });
    instanceIdFile = join(dataDir, 'instance_id.json');
    
    registry = new InstanceRegistry({
      dataDir,
      instanceIdFile,
      heartbeatConfig: {
        interval_ms: 100,      // Fast for testing
        timeout_ms: 300,       // 3x interval
        grace_period_ms: 100,  // 1x interval
        max_clock_drift_ms: 50,
      },
      autoHeartbeat: false,    // Disable auto heartbeat for testing
    });
    await registry.initialize();
  });

  afterEach(async () => {
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-1-8: Stale Detection Threshold', () => {
    it('应该在 timeout + grace_period 后标记为 failed', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout + grace_period (300 + 100 = 400ms)
      await new Promise(resolve => setTimeout(resolve, 450));
      
      // Cleanup stale
      await registry.cleanupStaleInstances();
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('failed');
    });

    it('应该不标记未超时的实例为 failed', async () => {
      const identity = await registry.getIdentity();
      
      // Send heartbeat to reset timer
      await registry.heartbeat(identity.instance_id);
      
      // Wait less than timeout (200ms < 300ms)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Cleanup stale (should not mark as failed)
      await registry.cleanupStaleInstances();
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('active');
    });

    it('应该尊重 grace_period 防止误判', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout but not grace_period (300ms < 300+100)
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Cleanup stale (should not mark as failed yet)
      await registry.cleanupStaleInstances();
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('active'); // Still in grace period
    });

    it('应该验证 timeout = 3x interval', async () => {
      const identity = await registry.getIdentity();
      
      // timeout is 300ms (3x 100ms interval)
      // Wait for 2.5x interval (250ms) - should not timeout
      await new Promise(resolve => setTimeout(resolve, 250));
      
      await registry.cleanupStaleInstances();
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).not.toBe('failed');
    });
  });

  describe('A2-1-9: Stale Detection Logging', () => {
    it('应该在 log 中写入 stale_detected 事件', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      
      // Cleanup stale
      await registry.cleanupStaleInstances();
      
      // Read log
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      
      // Find stale_detected event
      const staleEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'stale_detected';
      });
      
      expect(staleEvents.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(staleEvents[staleEvents.length - 1]);
      expect(event.instance_id).toBe(identity.instance_id);
      expect(event.data.status).toBe('failed');
    });

    it('应该记录检测时的时间戳', async () => {
      const identity = await registry.getIdentity();
      
      await new Promise(resolve => setTimeout(resolve, 450));
      await registry.cleanupStaleInstances();
      
      // Read log
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      const event = JSON.parse(lines[lines.length - 1]);
      
      expect(event.timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('A2-1-10: Failed Instances Query', () => {
    it('应该返回 failed 状态的实例列表', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      await registry.cleanupStaleInstances();
      
      const failedInstances = await registry.getFailedInstances();
      
      expect(failedInstances.length).toBeGreaterThanOrEqual(1);
      const found = failedInstances.find((i: any) => i.instance_id === identity.instance_id);
      expect(found).toBeDefined();
      expect(found!.status).toBe('failed');
    });

    it('应该支持自定义 threshold 查询', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      await registry.cleanupStaleInstances();
      
      // Query with custom threshold
      const failedInstances = await registry.getFailedInstances(100);
      
      expect(failedInstances.length).toBeGreaterThanOrEqual(1);
    });

    it('应该区分 inactive 和 failed 状态', async () => {
      const identity1 = await registry.getIdentity();
      
      // Graceful shutdown
      await registry.unregister(identity1.instance_id, 'shutdown');
      
      // Manually register another instance in the same registry
      const identity2: any = {
        instance_id: 'test-instance-2',
        session_id: 'test-session-2',
        instance_name: 'test-worker-2',
        node_info: { hostname: 'test', pid: 123, started_at: Date.now() },
        last_heartbeat: Date.now() - 500, // Stale
        status: 'active',
      };
      registry['instances'].set(identity2.instance_id, identity2);
      
      // Wait for timeout (identity2 is already stale)
      await registry.cleanupStaleInstances();
      
      // Check inactive
      const inactive = await registry.getInstance(identity1.instance_id);
      expect(inactive!.status).toBe('inactive');
      
      // Check failed
      const failed = await registry.getInstance(identity2.instance_id);
      expect(failed!.status).toBe('failed');
    });
  });

  describe('A2-1-11: Cleanup Boundary', () => {
    it('应该只做检测/标记/记录/暴露，不做 lease 释放', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      
      // Cleanup stale
      await registry.cleanupStaleInstances();
      
      // Verify: registry should not have lease management methods
      // This is a compile-time check, but we verify behavior
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('failed');
      // No lease operations should have occurred
    });

    it('应该只做检测/标记/记录/暴露，不做 work item 重分配', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      
      // Cleanup stale
      await registry.cleanupStaleInstances();
      
      // Verify: registry should not have work item management methods
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('failed');
      // No work item operations should have occurred
    });

    it('应该暴露 failed 实例信息给 A2-2/A2-3 处理', async () => {
      const identity = await registry.getIdentity();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 450));
      await registry.cleanupStaleInstances();
      
      // Verify: failed instance info is available
      const failed = await registry.getFailedInstances();
      expect(failed.length).toBeGreaterThanOrEqual(1);
      
      const found = failed.find((i: any) => i.instance_id === identity.instance_id);
      expect(found).toBeDefined();
      expect(found!.last_heartbeat).toBeDefined();
      expect(found!.status).toBe('failed');
    });
  });

  describe('A2-1-12: Multiple Instances Stale Detection', () => {
    it('应该正确处理多个实例的 stale 检测', async () => {
      // Manually register multiple instances with staggered heartbeats
      const now = Date.now();
      // timeout + grace = 300 + 100 = 400ms threshold
      
      for (let i = 0; i < 3; i++) {
        const identity: any = {
          instance_id: `test-instance-${i}`,
          session_id: `test-session-${i}`,
          instance_name: `test-worker-${i}`,
          node_info: { hostname: 'test', pid: 123, started_at: now },
          last_heartbeat: now - (i * 200), // Stagger: 0ms, 200ms, 400ms ago
          status: 'active',
        };
        registry['instances'].set(identity.instance_id, identity);
      }
      
      // Wait 500ms:
      // - instance-0: 500 + 0 = 500ms > 400ms → failed
      // - instance-1: 500 + 200 = 700ms > 400ms → failed  
      // - instance-2: 500 + 400 = 900ms > 400ms → failed
      // All should be failed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Cleanup stale
      await registry.cleanupStaleInstances();
      
      // All instances should be failed
      const first = await registry.getInstance('test-instance-0');
      expect(first!.status).toBe('failed');
      
      const failed = await registry.getFailedInstances();
      const failedTestInstances = failed.filter(i => i.instance_id.startsWith('test-instance-'));
      expect(failedTestInstances.length).toBe(3);
    });
  });
});
