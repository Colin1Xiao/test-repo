/**
 * Phase 4.x-A2-1: Recovery and Replay Tests
 * 
 * 验证规则:
 * - snapshot + log replay 后恢复实例状态
 * - 旧数据兼容：缺省 session_id / 旧 schema 可处理
 * - crash 后 registry 状态正确恢复
 * - corrupted log / partial snapshot 容错
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-1: Recovery and Replay', () => {
  let dataDir: string;
  let instanceIdFile: string;

  afterEach(async () => {
    if (dataDir) {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  describe('A2-1-13: Snapshot Recovery', () => {
    it('应该从 snapshot 恢复实例状态', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create registry and register
      const registry1 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry1.initialize();
      const identity1 = await registry1.getIdentity();
      
      // Wait for snapshot
      await new Promise(resolve => setTimeout(resolve, 100));
      await registry1.shutdown();
      
      // Create new registry - should recover from snapshot
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      
      const activeInstances = await registry2.getActiveInstances();
      const recovered = activeInstances.find((i: any) => i.instance_id === identity1.instance_id);
      
      expect(recovered).toBeDefined();
      expect(recovered!.instance_id).toBe(identity1.instance_id);
    });

    it('应该 replay log 恢复增量事件', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create registry and register
      const registry1 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry1.initialize();
      const identity1 = await registry1.getIdentity();
      
      // Send heartbeat
      await registry1.heartbeat(identity1.instance_id);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Shutdown without snapshot
      await registry1.shutdown();
      
      // Create new registry - should replay log
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      
      const activeInstances = await registry2.getActiveInstances();
      const recovered = activeInstances.find((i: any) => i.instance_id === identity1.instance_id);
      
      expect(recovered).toBeDefined();
    });
  });

  describe('A2-1-14: Log Replay Order', () => {
    it('应该按时间戳顺序 replay 事件', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create registry and register
      const registry1 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry1.initialize();
      const identity1 = await registry1.getIdentity();
      
      // Send multiple heartbeats
      for (let i = 0; i < 5; i++) {
        await registry1.heartbeat(identity1.instance_id);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      await registry1.shutdown();
      
      // Recover and verify last_heartbeat is from latest event
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      
      const recovered = await registry2.getInstance(identity1.instance_id);
      expect(recovered).toBeDefined();
      
      // Read log to verify order
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      
      // Heartbeat events should be in order
      const heartbeatEvents = lines.filter(l => {
        const event = JSON.parse(l);
        return event.type === 'heartbeat';
      });
      
      expect(heartbeatEvents.length).toBe(5);
      
      // Verify timestamps are ordered
      let lastTimestamp = 0;
      for (const line of heartbeatEvents) {
        const event = JSON.parse(line);
        expect(event.timestamp).toBeGreaterThanOrEqual(lastTimestamp);
        lastTimestamp = event.timestamp;
      }
    });
  });

  describe('A2-1-15: Crash Recovery', () => {
    it('应该模拟 crash 后正确恢复', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create registry and register
      const registry1 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry1.initialize();
      const identity1 = await registry1.getIdentity();
      
      // Simulate crash (no graceful shutdown, just delete from memory)
      // Files remain on disk
      
      // Recover
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      
      const activeInstances = await registry2.getActiveInstances();
      const recovered = activeInstances.find((i: any) => i.instance_id === identity1.instance_id);
      
      expect(recovered).toBeDefined();
      expect(recovered!.instance_id).toBe(identity1.instance_id);
    });

    it('应该恢复 instance_id 持久化', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create registry and register
      const registry1 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry1.initialize();
      const identity1 = await registry1.getIdentity();
      
      // Simulate crash
      await fs.rm(join(dataDir, 'registry'), { recursive: true, force: true });
      
      // Recover - should restore from instance_id.json
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      const identity2 = await registry2.getIdentity();
      
      // instance_id should be the same
      expect(identity1.instance_id).toBe(identity2.instance_id);
      // session_id will be different (new session)
      expect(identity1.session_id).not.toBe(identity2.session_id);
    });
  });

  describe('A2-1-16: Backward Compatibility', () => {
    it('应该兼容缺省 session_id 的旧数据', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Create old format instance_id.json
      const oldFormat = {
        instance_id: 'test-instance-123',
        instance_name: 'old-worker',
        created_at: Date.now() - 86400000,
      };
      await fs.writeFile(instanceIdFile, JSON.stringify(oldFormat, null, 2));
      
      // Initialize
      const registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      const identity = await registry.getIdentity();
      
      // Should load old instance_id
      expect(identity.instance_id).toBe('test-instance-123');
      // Should generate new session_id
      expect(identity.session_id).toBeDefined();
    });

    it('应该兼容旧 schema 的 registry 数据', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      const registryDir = join(dataDir, 'registry');
      await fs.mkdir(registryDir, { recursive: true });
      
      // Create old format snapshot (without session_id)
      const oldSnapshot = {
        instances: {
          'test-instance-123': {
            instance_id: 'test-instance-123',
            instance_name: 'old-worker',
            last_heartbeat: Date.now() - 1000,
            status: 'active',
          },
        },
        last_snapshot_at: Date.now() - 1000,
      };
      await fs.writeFile(
        join(registryDir, 'instances_snapshot.json'),
        JSON.stringify(oldSnapshot, null, 2)
      );
      
      // Initialize
      const registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      
      const activeInstances = await registry.getActiveInstances();
      const recovered = activeInstances.find((i: any) => i.instance_id === 'test-instance-123');
      
      expect(recovered).toBeDefined();
      expect(recovered!.instance_id).toBe('test-instance-123');
    });
  });

  describe('A2-1-17: Error Tolerance', () => {
    it('应该处理 corrupted log 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      const registryDir = join(dataDir, 'registry');
      await fs.mkdir(registryDir, { recursive: true });
      
      // Create corrupted log
      await fs.writeFile(
        join(registryDir, 'instances_log.jsonl'),
        'invalid json line\n{"type":"registered","instance_id":"test"}\nanother invalid\n',
        'utf-8'
      );
      
      // Should not crash, should skip invalid lines
      const registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      
      // Should still work
      const identity = await registry.getIdentity();
      expect(identity).toBeDefined();
    });

    it('应该处理 partial snapshot 文件', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      const registryDir = join(dataDir, 'registry');
      await fs.mkdir(registryDir, { recursive: true });
      
      // Create partial/corrupted snapshot
      await fs.writeFile(
        join(registryDir, 'instances_snapshot.json'),
        '{"instances": {"test": {', // Incomplete JSON
        'utf-8'
      );
      
      // Should fallback to log replay or start fresh
      const registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      
      // Should still work
      const identity = await registry.getIdentity();
      expect(identity).toBeDefined();
    });

    it('应该处理 snapshot 存在但 log 损坏的情况', async () => {
      dataDir = join(TEST_DATA_DIR, 'registry-test-' + Date.now());
      instanceIdFile = join(dataDir, 'instance_id.json');
      await fs.mkdir(dataDir, { recursive: true });
      
      const registryDir = join(dataDir, 'registry');
      await fs.mkdir(registryDir, { recursive: true });
      
      // Create valid snapshot
      const snapshot = {
        instances: {
          'test-instance': {
            instance_id: 'test-instance',
            session_id: 'test-session',
            instance_name: 'test-worker',
            last_heartbeat: Date.now(),
            status: 'active',
            node_info: { hostname: 'test', pid: 123, started_at: Date.now() },
          },
        },
        last_snapshot_at: Date.now(),
      };
      await fs.writeFile(
        join(registryDir, 'instances_snapshot.json'),
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );
      
      // Create corrupted log
      await fs.writeFile(
        join(registryDir, 'instances_log.jsonl'),
        'invalid\ninvalid\n',
        'utf-8'
      );
      
      // Should recover from snapshot, skip corrupted log
      const registry = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry.initialize();
      
      const activeInstances = await registry.getActiveInstances();
      const recovered = activeInstances.find((i: any) => i.instance_id === 'test-instance');
      
      expect(recovered).toBeDefined();
    });
  });
});
