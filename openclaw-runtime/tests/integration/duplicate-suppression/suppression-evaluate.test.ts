/**
 * Phase 4.x-A2-4: Duplicate Suppression - Evaluate Tests
 * 
 * 验证去重评估核心语义：
 * - 首次出现 → ALLOWED
 * - 重复出现 → SUPPRESSED
 * - TTL 过期 → ALLOWED
 * - 未知 scope → INVALID_SCOPE
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Phase 4.x-A2-4: Duplicate Suppression', () => {
  let dataDir: string;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-suppression-' + randomUUID());
    
    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 1000,  // 1s for fast tests
        scope_ttls: {
          'test': 500,  // 500ms
          'alert_ingest': 300,
        },
      },
      autoCleanup: false,
    });

    await suppressionManager.initialize();
  });

  afterEach(async () => {
    await suppressionManager.shutdown();
  });

  // ==================== A2-4-1: First Seen ====================

  describe('A2-4-1: First Seen', () => {
    it('应该允许首次出现的 action', async () => {
      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:first-seen-1',
      });

      expect(result.decision).toBe('ALLOWED');
      expect(result.reason).toBe('first_seen');
      expect(result.ttl_ms).toBe(500);
      expect(result.expires_at).toBeDefined();
    });

    it('应该为不同 scope 返回不同 TTL', async () => {
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: 'test:ttl-1',
      });

      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:ttl-2',
      });

      expect(result1.ttl_ms).toBe(300);
      expect(result2.ttl_ms).toBe(500);
    });

    it('应该为相同 correlation_id 但不同 fingerprint 返回 ALLOWED', async () => {
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:fingerprint-1',
        fingerprint: 'hash-abc',
      });

      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:fingerprint-1',
        fingerprint: 'hash-xyz',
      });

      expect(result1.decision).toBe('ALLOWED');
      expect(result2.decision).toBe('ALLOWED');
    });
  });

  // ==================== A2-4-2: Duplicate Detection ====================

  describe('A2-4-2: Duplicate Detection', () => {
    it('应该抑制重复的 action', async () => {
      // First evaluation
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:duplicate-1',
      });

      expect(result1.decision).toBe('ALLOWED');

      // Second evaluation (duplicate)
      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:duplicate-1',
      });

      expect(result2.decision).toBe('SUPPRESSED');
      expect(result2.reason).toBe('duplicate');
      expect(result2.record).toBeDefined();
      expect(result2.record!.hit_count).toBe(2);
    });

    it('应该增加 hit_count', async () => {
      // Evaluate 5 times
      for (let i = 0; i < 5; i++) {
        const result = await suppressionManager.evaluate({
          suppression_scope: 'test',
          action_type: 'create',
          correlation_id: 'test:hit-count-1',
        });

        if (i === 0) {
          expect(result.decision).toBe('ALLOWED');
        } else {
          expect(result.decision).toBe('SUPPRESSED');
          expect(result.record!.hit_count).toBe(i + 1);
        }
      }
    });

    it('应该区分不同 scope 的重复', async () => {
      // Scope 1
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:scope-isolation-1',
      });

      // Scope 2 (same correlation_id, different scope)
      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:scope-isolation-1',
      });

      // Scope 3 (same correlation_id, different scope)
      const result3 = await suppressionManager.evaluate({
        suppression_scope: 'alert_ingest',
        action_type: 'create',
        correlation_id: 'test:scope-isolation-1',
      });

      expect(result2.decision).toBe('SUPPRESSED');
      expect(result3.decision).toBe('ALLOWED'); // Different scope
    });

    it('应该区分不同 action_type 的重复', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:action-isolation-1',
      });

      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:action-isolation-1',
      });

      expect(result.decision).toBe('ALLOWED'); // Different action_type
    });
  });

  // ==================== A2-4-3: TTL Expiration ====================

  describe('A2-4-3: TTL Expiration', () => {
    it('应该允许 TTL 过期后的 action', async () => {
      // First evaluation
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:ttl-expire-1',
      });

      // Wait for TTL to expire (500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Second evaluation (after TTL)
      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:ttl-expire-1',
      });

      expect(result.decision).toBe('ALLOWED');
      expect(result.reason).toBe('window_expired');
    });

    it('应该在 TTL 内保持抑制', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:ttl-active-1',
      });

      // Wait but not enough for TTL to expire (300ms < 500ms)
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:ttl-active-1',
      });

      expect(result.decision).toBe('SUPPRESSED');
    });

    it('应该更新 last_seen_at 当重复出现', async () => {
      const time1 = Date.now();
      
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:last-seen-1',
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:last-seen-1',
      });

      const record = await suppressionManager.getRecord('test:create:test:last-seen-1');
      expect(record).toBeDefined();
      expect(record!.last_seen_at).toBeGreaterThanOrEqual(time1 + 200);
    });
  });

  // ==================== A2-4-4: Invalid Scope ====================

  describe('A2-4-4: Invalid Scope', () => {
    it('应该拒绝空 scope', async () => {
      const result = await suppressionManager.evaluate({
        suppression_scope: '',
        action_type: 'create',
        correlation_id: 'test:invalid-scope-1',
      });

      expect(result.decision).toBe('INVALID_SCOPE');
      expect(result.reason).toBe('unknown_scope');
    });

    it('应该允许所有显式定义的 scope', async () => {
      const scopes = [
        'alert_ingest',
        'webhook_ingest',
        'incident_transition',
        'work_item_claim',
        'recovery_scan',
        'replay_run',
        'connector_sync',
        'global',
      ];

      for (const scope of scopes) {
        const result = await suppressionManager.evaluate({
          suppression_scope: scope,
          action_type: 'create',
          correlation_id: `test:scope-${scope}-1`,
        });

        expect(result.decision).toBe('ALLOWED');
      }
    });
  });

  // ==================== A2-4-5: Suppression Key Generation ====================

  describe('A2-4-5: Suppression Key Generation', () => {
    it('应该生成正确的 suppression key', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:key-gen-1',
      });

      const record = await suppressionManager.getRecord('test:create:test:key-gen-1');
      expect(record).toBeDefined();
      expect(record!.suppression_key).toBe('test:create:test:key-gen-1');
    });

    it('应该包含 fingerprint 在 key 中', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'update',
        correlation_id: 'test:key-gen-2',
        fingerprint: 'hash-abc',
      });

      const record = await suppressionManager.getRecord('test:update:test:key-gen-2:hash-abc');
      expect(record).toBeDefined();
    });

    it('应该处理缺失的 correlation_id', async () => {
      const result = await suppressionManager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        // No correlation_id
      });

      // Should still work with just scope + action
      expect(result.decision).toBe('ALLOWED');
    });
  });
});
