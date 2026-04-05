/**
 * Phase 4.x-A2-4: Duplicate Suppression - Replay Safe Mode Tests
 * 
 * 验证 replay 安全模式语义：
 * - replay_mode=true 绕过 TTL
 * - replay 模式返回 REPLAY_SAFE_ALLOWED
 * - replay 模式不增加 hit_count
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Phase 4.x-A2-4: Replay Safe Mode', () => {
  let dataDir: string;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-suppression-replay-' + randomUUID());
    
    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 1000,
        scope_ttls: {
          'test': 500,
          'replay_run': 1000,
        },
        replay_safe_mode: true,
      },
      autoCleanup: false,
    });

    await suppressionManager.initialize();
  });

  afterEach(async () => {
    await suppressionManager.shutdown();
  });

  // ==================== A2-4-10: Replay Mode Bypass ====================

  describe('A2-4-10: Replay Mode Bypass', () => {
    it('应该允许 replay 模式绕过抑制', async () => {
      // Normal evaluation
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-bypass-1',
      });

      expect(result1.decision).toBe('ALLOWED');

      // Second evaluation (would be suppressed)
      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-bypass-1',
      });

      expect(result2.decision).toBe('SUPPRESSED');

      // Replay mode evaluation (bypass suppression)
      const result3 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-bypass-1',
        replay_mode: true,
      });

      expect(result3.decision).toBe('ALLOWED');
      expect(result3.reason).toBe('replay_safe');
    });

    it('应该在 replay 模式不增加 hit_count', async () => {
      // Normal evaluation
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-hit-count-1',
      });

      // Duplicate (hit_count = 2)
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-hit-count-1',
      });

      // Replay mode (should not increase hit_count)
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-hit-count-1',
        replay_mode: true,
      });

      const record = await suppressionManager.getRecord('test:create:test:replay-hit-count-1');
      expect(record!.hit_count).toBe(2); // Not 3
    });

    it('应该在 replay 模式不更新 last_seen_at', async () => {
      const timeBefore = Date.now();

      // Normal evaluation
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-last-seen-1',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Replay mode
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-last-seen-1',
        replay_mode: true,
      });

      const record = await suppressionManager.getRecord('test:create:test:replay-last-seen-1');
      expect(record!.last_seen_at).toBeLessThan(timeBefore + 100);
    });
  });

  // ==================== A2-4-11: Replay Run Scope ====================

  describe('A2-4-11: Replay Run Scope', () => {
    it('应该为 replay_run scope 使用长 TTL', async () => {
      const result = await suppressionManager.evaluate({
        suppression_scope: 'replay_run',
        action_type: 'execute',
        correlation_id: 'test:replay-run-ttl-1',
      });

      expect(result.ttl_ms).toBe(1000);
    });

    it('应该允许 replay_run 的重复执行', async () => {
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'replay_run',
        action_type: 'execute',
        correlation_id: 'test:replay-run-1',
      });

      expect(result1.decision).toBe('ALLOWED');

      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'replay_run',
        action_type: 'execute',
        correlation_id: 'test:replay-run-1',
        replay_mode: true,
      });

      expect(result2.decision).toBe('ALLOWED');
      expect(result2.reason).toBe('replay_safe');
    });
  });

  // ==================== A2-4-12: Replay Mode Disabled ====================

  describe('A2-4-12: Replay Mode Disabled', () => {
    it('应该在 replay_safe_mode=false 时不绕过抑制', async () => {
      const manager = new DuplicateSuppressionManager({
        dataDir: join(tmpdir(), 'test-replay-disabled-' + randomUUID()),
        config: {
          default_ttl_ms: 1000,
          replay_safe_mode: false,
        },
        autoCleanup: false,
      });

      await manager.initialize();

      // First evaluation
      const result1 = await manager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-disabled-1',
      });

      expect(result1.decision).toBe('ALLOWED');

      // Replay mode (should still be suppressed)
      const result2 = await manager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-disabled-1',
        replay_mode: true,
      });

      expect(result2.decision).toBe('SUPPRESSED');

      await manager.shutdown();
    });
  });

  // ==================== A2-4-13: Replay After TTL Expiration ====================

  describe('A2-4-13: Replay After TTL Expiration', () => {
    it('应该在 TTL 过期后允许 replay', async () => {
      // Normal evaluation
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-expire-1',
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      // Replay mode after TTL
      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:replay-expire-1',
        replay_mode: true,
      });

      expect(result.decision).toBe('ALLOWED');
      expect(result.reason).toBe('window_expired'); // TTL expired, not replay_safe
    });
  });
});
