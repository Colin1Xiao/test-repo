/**
 * Phase 4.x-A2-4: Duplicate Suppression - Persistence & Recovery Tests
 * 
 * 验证持久化与恢复语义：
 * - snapshot + log replay
 * - 崩溃恢复
 * - corrupted log 容错
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';

describe('Phase 4.x-A2-4: Persistence & Recovery', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-suppression-recovery-' + randomUUID());
  });

  // ==================== A2-4-14: Snapshot Recovery ====================

  describe('A2-4-14: Snapshot Recovery', () => {
    it('应该从 snapshot 恢复 suppression 记录', async () => {
      // Create manager and add records
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: {
          default_ttl_ms: 10000,
        },
        autoCleanup: false,
      });

      await manager1.initialize();

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:snapshot-recovery-1',
      });

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:snapshot-recovery-2',
      });

      // Force snapshot
      await manager1.saveSnapshot();

      await manager1.shutdown();

      // Create new manager (should recover from snapshot)
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: {
          default_ttl_ms: 10000,
        },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record1 = await manager2.getRecord('test:create:test:snapshot-recovery-1');
      const record2 = await manager2.getRecord('test:update:test:snapshot-recovery-2');

      expect(record1).toBeDefined();
      expect(record2).toBeDefined();

      await manager2.shutdown();
    });

    it('应该恢复 hit_count', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      // Create record with multiple hits
      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:hitcount-recovery-1',
      });

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:hitcount-recovery-1',
      });

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:hitcount-recovery-1',
      });

      await manager1.saveSnapshot();
      await manager1.shutdown();

      // Recover
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record = await manager2.getRecord('test:create:test:hitcount-recovery-1');
      expect(record!.hit_count).toBe(3);

      await manager2.shutdown();
    });
  });

  // ==================== A2-4-15: Log Replay ====================

  describe('A2-4-15: Log Replay', () => {
    it('应该从 log replay 恢复 suppression 记录', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:log-replay-1',
      });

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:log-replay-1',
      });

      // Don't save snapshot, rely on log
      await manager1.shutdown();

      // Recover from log
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record = await manager2.getRecord('test:create:test:log-replay-1');
      expect(record).toBeDefined();
      expect(record!.hit_count).toBe(2);

      await manager2.shutdown();
    });

    it('应该合并 snapshot + log replay', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      // Create initial records
      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:merge-recovery-1',
      });

      await manager1.saveSnapshot();

      // Add more records after snapshot
      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:merge-recovery-2',
      });

      await manager1.shutdown();

      // Recover (snapshot + log)
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record1 = await manager2.getRecord('test:create:test:merge-recovery-1');
      const record2 = await manager2.getRecord('test:update:test:merge-recovery-2');

      expect(record1).toBeDefined();
      expect(record2).toBeDefined();

      await manager2.shutdown();
    });
  });

  // ==================== A2-4-16: Corrupted Log Tolerance ====================

  describe('A2-4-16: Corrupted Log Tolerance', () => {
    it('应该跳过 corrupted log lines', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:corrupt-1',
      });

      await manager1.shutdown();

      // Corrupt the log file
      const logPath = join(dataDir, 'suppression', 'suppression_log.jsonl');
      const content = await fs.readFile(logPath, 'utf-8');
      const corrupted = content + '\n{ invalid json\n';
      await fs.writeFile(logPath, corrupted, 'utf-8');

      // Should still recover valid records
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record = await manager2.getRecord('test:create:test:corrupt-1');
      expect(record).toBeDefined();

      await manager2.shutdown();
    });

    it('应该处理缺失的 log 文件', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();
      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:missing-log-1',
      });
      await manager1.shutdown();

      // Delete log file (only if exists)
      const logPath = join(dataDir, 'suppression', 'suppression_log.jsonl');
      try {
        await fs.unlink(logPath);
      } catch (error) {
        // File doesn't exist, that's ok
      }

      // Should initialize without log
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();
      await manager2.shutdown();
    });

    it('应该处理缺失的 snapshot 文件', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();
      await manager1.saveSnapshot();
      await manager1.shutdown();

      // Delete snapshot file
      const snapshotPath = join(dataDir, 'suppression', 'suppression_snapshot.json');
      await fs.unlink(snapshotPath);

      // Should initialize without snapshot
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();
      await manager2.shutdown();
    });
  });

  // ==================== A2-4-17: Status Recovery ====================

  describe('A2-4-17: Status Recovery', () => {
    it('应该恢复记录的 status', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:status-recovery-1',
      });

      await manager1.saveSnapshot();
      await manager1.shutdown();

      // Recover
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record = await manager2.getRecord('test:create:test:status-recovery-1');
      expect(record!.status).toBe('active');

      await manager2.shutdown();
    });

    it('应该恢复 version', async () => {
      const manager1 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager1.initialize();

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:version-recovery-1',
      });

      await manager1.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:version-recovery-1',
      });

      await manager1.saveSnapshot();
      await manager1.shutdown();

      // Recover
      const manager2 = new DuplicateSuppressionManager({
        dataDir,
        config: { default_ttl_ms: 10000 },
        autoCleanup: false,
      });

      await manager2.initialize();

      const record = await manager2.getRecord('test:create:test:version-recovery-1');
      expect(record!.version).toBeGreaterThanOrEqual(1);

      await manager2.shutdown();
    });
  });
});
