/**
 * Phase 4.x-A2-1: Instance Registration Tests
 * 
 * 验证规则:
 * - 启动时自动注册
 * - instance_id 稳定 (重启不变)
 * - session_id 每次启动变化
 * - log 中写入 registered 事件
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { InstanceIdentity, InstanceRegistry } from '../../../src/coordination/instance_registry.js';
import { TEST_DATA_DIR } from '../../setup/jest.setup.js';

describe('Phase 4.x-A2-1: Instance Registration', () => {
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
    });
    await registry.initialize();
  });

  afterEach(async () => {
    await registry.shutdown();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  describe('A2-1-1: Initial Registration', () => {
    it('应该在启动时自动注册实例', async () => {
      const identity = await registry.getIdentity();
      
      expect(identity).toBeDefined();
      expect(identity.instance_id).toBeDefined();
      expect(identity.session_id).toBeDefined();
      expect(identity.status).toBe('active');
    });

    it('应该生成 instance_id (节点级 UUID)', async () => {
      const identity1 = await registry.getIdentity();
      
      // Simulate restart - create new registry with same dataDir
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      const identity2 = await registry2.getIdentity();
      
      // instance_id should be the same (node-level)
      expect(identity1.instance_id).toBe(identity2.instance_id);
    });

    it('应该每次启动生成不同的 session_id (进程级 UUID)', async () => {
      const identity1 = await registry.getIdentity();
      
      // Simulate restart
      await registry.shutdown();
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      const identity2 = await registry2.getIdentity();
      
      // session_id should be different (session-level)
      expect(identity1.session_id).not.toBe(identity2.session_id);
    });

    it('应该持久化 instance_id 到文件', async () => {
      const identity1 = await registry.getIdentity();
      
      // Read from file
      const fileContent = await fs.readFile(instanceIdFile, 'utf-8');
      const saved = JSON.parse(fileContent);
      
      expect(saved.instance_id).toBe(identity1.instance_id);
      expect(saved.instance_name).toBe(identity1.instance_name);
    });

    it('应该在 log 中写入 registered 事件', async () => {
      const identity = await registry.getIdentity();
      
      // Read log
      const logPath = join(dataDir, 'registry', 'instances_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);
      
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const event = JSON.parse(lines[0]);
      
      expect(event.type).toBe('registered');
      expect(event.instance_id).toBe(identity.instance_id);
      expect(event.data.instance_id).toBe(identity.instance_id);
      expect(event.data.session_id).toBe(identity.session_id);
    });
  });

  describe('A2-1-2: Instance Identity Structure', () => {
    it('应该包含 instance_id 和 session_id 双标识', async () => {
      const identity = await registry.getIdentity();
      
      expect(identity.instance_id).toBeDefined();
      expect(identity.session_id).toBeDefined();
      expect(identity.instance_id).not.toBe(identity.session_id);
    });

    it('应该包含 node_info (hostname, pid, started_at)', async () => {
      const identity = await registry.getIdentity();
      
      expect(identity.node_info).toBeDefined();
      expect(identity.node_info.hostname).toBeDefined();
      expect(identity.node_info.pid).toBeGreaterThan(0);
      expect(identity.node_info.started_at).toBeGreaterThan(0);
    });

    it('应该包含 instance_name (环境变量或自动生成)', async () => {
      const identity = await registry.getIdentity();
      
      expect(identity.instance_name).toBeDefined();
      expect(identity.instance_name.length).toBeGreaterThan(0);
    });

    it('应该初始化 status 为 active', async () => {
      const identity = await registry.getIdentity();
      expect(identity.status).toBe('active');
    });
  });

  describe('A2-1-3: Backward Compatibility', () => {
    it('应该兼容旧的 instance_id 文件格式', async () => {
      // Create old format file (without session_id support)
      const oldFormat = {
        instance_id: randomUUID(),
        instance_name: 'old-worker',
        created_at: Date.now() - 86400000, // 1 day ago
      };
      await fs.writeFile(instanceIdFile, JSON.stringify(oldFormat, null, 2));
      
      // Initialize with old file
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      const identity = await registry2.getIdentity();
      
      // Should load old instance_id
      expect(identity.instance_id).toBe(oldFormat.instance_id);
      expect(identity.instance_name).toBe('old-worker');
      // Should add new fields
      expect(identity.session_id).toBeDefined();
    });

    it('应该在 instance_id 文件损坏时生成新的', async () => {
      // Create corrupted file
      await fs.writeFile(instanceIdFile, 'invalid json');
      
      // Should not crash, should generate new identity
      const registry2 = new InstanceRegistry({ dataDir, instanceIdFile, autoHeartbeat: false });
      await registry2.initialize();
      const identity = await registry2.getIdentity();
      
      expect(identity.instance_id).toBeDefined();
    });
  });
});
