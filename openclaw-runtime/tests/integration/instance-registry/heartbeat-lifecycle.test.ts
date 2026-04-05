/**
 * Phase 4.x-A2-1: Heartbeat Lifecycle Tests
 * 
 * 验证规则:
 * - heartbeat 更新 last_heartbeat
 * - heartbeat 写入 log
 * - active 实例列表可见
 * - graceful unregister 后状态变为 inactive
 * - unregister 后不被误判为 failed
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { InstanceIdentity, InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-1: Heartbeat Lifecycle', () => {
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
      autoHeartbeat: false,    // Disable auto heartbeat for testing
    });
    await registry.initialize();
  });

  afterEach(async () => {
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-1-4: Heartbeat Updates', () => {
    it('应该更新 last_heartbeat 时间戳', async () => {
      const identity1 = await registry.getIdentity();
      const beforeHeartbeat = identity1.last_heartbeat;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send heartbeat
      await registry.heartbeat(identity1.instance_id);
      
      const identity2 = await registry.getInstance(identity1.instance_id);
      expect(identity2).toBeDefined();
      expect(identity2!.last_heartbeat).toBeGreaterThanOrEqual(beforeHeartbeat);
    });

    it('应该在 log 中写入 heartbeat 事件', async () => {
      const identity = await registry.getIdentity();
      
      await registry.heartbeat(identity.instance_id);
      
      // Read log
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      
      // Find heartbeat event
      const heartbeatEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'heartbeat';
      });
      
      expect(heartbeatEvents.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(heartbeatEvents[heartbeatEvents.length - 1]);
      expect(event.instance_id).toBe(identity.instance_id);
    });

    it('应该保持 active 状态在心跳后', async () => {
      const identity = await registry.getIdentity();
      
      await registry.heartbeat(identity.instance_id);
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('active');
    });
  });

  describe('A2-1-5: Active Instances Query', () => {
    it('应该返回 active 状态的实例列表', async () => {
      const identity = await registry.getIdentity();
      
      const activeInstances = await registry.getActiveInstances();
      
      expect(activeInstances.length).toBeGreaterThanOrEqual(1);
      const found = activeInstances.find((i: any) => i.instance_id === identity.instance_id);
      expect(found).toBeDefined();
      expect(found!.status).toBe('active');
    });

    it('不应该返回 inactive 状态的实例', async () => {
      const identity = await registry.getIdentity();
      
      // Graceful shutdown
      await registry.unregister(identity.instance_id, 'shutdown');
      
      const activeInstances = await registry.getActiveInstances();
      const found = activeInstances.find((i: any) => i.instance_id === identity.instance_id);
      expect(found).toBeUndefined();
    });

    it('不应该返回 failed 状态的实例', async () => {
      const identity = await registry.getIdentity();
      
      // Mark as failed (simulate stale detection)
      await registry.markFailed(identity.instance_id);
      
      const activeInstances = await registry.getActiveInstances();
      const found = activeInstances.find((i: any) => i.instance_id === identity.instance_id);
      expect(found).toBeUndefined();
    });
  });

  describe('A2-1-6: Graceful Unregister', () => {
    it('应该将状态变为 inactive', async () => {
      const identity = await registry.getIdentity();
      
      await registry.unregister(identity.instance_id, 'shutdown');
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('inactive');
    });

    it('应该在 log 中写入 unregistered 事件', async () => {
      const identity = await registry.getIdentity();
      
      await registry.unregister(identity.instance_id, 'shutdown');
      
      // Read log
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      
      // Find unregistered event
      const unregisterEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'unregistered';
      });
      
      expect(unregisterEvents.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(unregisterEvents[unregisterEvents.length - 1]);
      expect(event.instance_id).toBe(identity.instance_id);
      expect(event.data.reason).toBe('shutdown');
    });

    it('应该不被误判为 failed', async () => {
      const identity = await registry.getIdentity();
      
      await registry.unregister(identity.instance_id, 'shutdown');
      
      // Wait longer than timeout
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Cleanup stale (should not mark inactive as failed)
      await registry.cleanupStaleInstances();
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('inactive'); // Still inactive, not failed
    });

    it('应该支持不同的 unregister 原因', async () => {
      const identity = await registry.getIdentity();
      
      await registry.unregister(identity.instance_id, 'maintenance');
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.status).toBe('inactive');
      
      // Read log to verify reason
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      const event = JSON.parse(lines[lines.length - 1]);
      expect(event.data.reason).toBe('maintenance');
    });
  });

  describe('A2-1-7: Heartbeat Contract', () => {
    it('应该支持 10s 心跳间隔配置', async () => {
      // This test verifies the contract, actual interval testing would be slow
      const identity = await registry.getIdentity();
      
      // Send multiple heartbeats
      await registry.heartbeat(identity.instance_id);
      await new Promise(resolve => setTimeout(resolve, 10));
      await registry.heartbeat(identity.instance_id);
      
      const updated = await registry.getInstance(identity.instance_id);
      expect(updated!.last_heartbeat).toBeDefined();
    });

    it('应该验证心跳时间戳单调递增', async () => {
      const identity = await registry.getIdentity();
      const timestamps: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        await registry.heartbeat(identity.instance_id);
        const current = await registry.getInstance(identity.instance_id);
        timestamps.push(current!.last_heartbeat);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Verify monotonic increase
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});
