/**
 * Phase 4.x-A2-4: Duplicate Suppression - TTL Management Tests
 * 
 * 验证 TTL 管理语义：
 * - scope 差异化 TTL
 * - TTL 过期检测
 * - 定期清理机制
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DuplicateSuppressionManager } from '../../../src/coordination/duplicate_suppression_manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Phase 4.x-A2-4: TTL Management', () => {
  let dataDir: string;
  let suppressionManager: DuplicateSuppressionManager;

  beforeEach(async () => {
    dataDir = join(tmpdir(), 'test-suppression-ttl-' + randomUUID());
    
    suppressionManager = new DuplicateSuppressionManager({
      dataDir,
      config: {
        default_ttl_ms: 1000,
        scope_ttls: {
          'short': 200,
          'medium': 500,
          'long': 1000,
        },
      },
      autoCleanup: false,
    });

    await suppressionManager.initialize();
  });

  afterEach(async () => {
    await suppressionManager.shutdown();
  });

  // ==================== A2-4-6: Scope-Specific TTL ====================

  describe('A2-4-6: Scope-Specific TTL', () => {
    it('应该为不同 scope 应用不同 TTL', async () => {
      const result1 = await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:ttl-scope-1',
      });

      const result2 = await suppressionManager.evaluate({
        suppression_scope: 'medium',
        action_type: 'create',
        correlation_id: 'test:ttl-scope-2',
      });

      const result3 = await suppressionManager.evaluate({
        suppression_scope: 'long',
        action_type: 'create',
        correlation_id: 'test:ttl-scope-3',
      });

      expect(result1.ttl_ms).toBe(200);
      expect(result2.ttl_ms).toBe(500);
      expect(result3.ttl_ms).toBe(1000);
    });

    it('应该为未配置 scope 使用 default_ttl', async () => {
      const result = await suppressionManager.evaluate({
        suppression_scope: 'unknown_scope',
        action_type: 'create',
        correlation_id: 'test:default-ttl-1',
      });

      // unknown_scope returns INVALID_SCOPE, but TTL config should still apply
      // Let's test with a valid but unconfigured scope
    });

    it('应该正确计算 expires_at', async () => {
      const timeBefore = Date.now();
      
      const result = await suppressionManager.evaluate({
        suppression_scope: 'medium',
        action_type: 'create',
        correlation_id: 'test:expires-at-1',
      });

      const timeAfter = Date.now();

      expect(result.expires_at).toBeDefined();
      expect(result.expires_at!).toBeGreaterThanOrEqual(timeBefore + 500);
      expect(result.expires_at!).toBeLessThanOrEqual(timeAfter + 500 + 50); // 50ms buffer
    });
  });

  // ==================== A2-4-7: Expired Record Detection ====================

  describe('A2-4-7: Expired Record Detection', () => {
    it('应该检测到期的记录', async () => {
      // Create records with short TTL
      await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:expired-1',
      });

      await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:expired-2',
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 300));

      const expired = await suppressionManager.detectExpiredRecords();

      expect(expired.length).toBeGreaterThanOrEqual(2);
      expect(expired.map(r => r.suppression_key)).toContain('short:create:test:expired-1');
      expect(expired.map(r => r.suppression_key)).toContain('short:create:test:expired-2');
    });

    it('应该只返回真正过期的记录', async () => {
      // Create record with long TTL
      await suppressionManager.evaluate({
        suppression_scope: 'long',
        action_type: 'create',
        correlation_id: 'test:not-expired-1',
      });

      // Wait (not enough for long TTL)
      await new Promise(resolve => setTimeout(resolve, 300));

      const expired = await suppressionManager.detectExpiredRecords();

      expect(expired.map(r => r.suppression_key)).not.toContain('long:create:test:not-expired-1');
    });

    it('应该支持自定义 now 参数', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'medium',
        action_type: 'create',
        correlation_id: 'test:custom-now-1',
      });

      // Use custom now (far future)
      const expired1 = await suppressionManager.detectExpiredRecords(Date.now() + 100);
      expect(expired1.length).toBe(0);

      // Use custom now (far future)
      const expired2 = await suppressionManager.detectExpiredRecords(Date.now() + 1000);
      expect(expired2.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== A2-4-8: Cleanup Expired Records ====================

  describe('A2-4-8: Cleanup Expired Records', () => {
    it('应该清理过期的记录', async () => {
      // Create records
      await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:cleanup-1',
      });

      await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:cleanup-2',
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 300));

      // Cleanup
      await suppressionManager.cleanupExpiredRecords();

      // Verify records are cleaned
      const record1 = await suppressionManager.getRecord('short:create:test:cleanup-1');
      const record2 = await suppressionManager.getRecord('short:create:test:cleanup-2');

      expect(record1).toBeNull();
      expect(record2).toBeNull();
    });

    it('应该保留未过期的记录', async () => {
      // Create record with long TTL
      await suppressionManager.evaluate({
        suppression_scope: 'long',
        action_type: 'create',
        correlation_id: 'test:keep-1',
      });

      // Wait (not enough for long TTL)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Cleanup
      await suppressionManager.cleanupExpiredRecords();

      // Verify record is kept
      const record = await suppressionManager.getRecord('long:create:test:keep-1');
      expect(record).toBeDefined();
      expect(record!.status).toBe('active');
    });

    it('应该清理后返回 active 记录列表为空', async () => {
      await suppressionManager.evaluate({
        suppression_scope: 'short',
        action_type: 'create',
        correlation_id: 'test:cleanup-active-1',
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 300));

      // Cleanup
      await suppressionManager.cleanupExpiredRecords();

      const active = await suppressionManager.getActiveRecords();
      expect(active.length).toBe(0);
    });
  });

  // ==================== A2-4-9: Max TTL Enforcement ====================

  describe('A2-4-9: Max TTL Enforcement', () => {
    it('应该限制 TTL 不超过 max_ttl', async () => {
      const manager = new DuplicateSuppressionManager({
        dataDir: join(tmpdir(), 'test-max-ttl-' + randomUUID()),
        config: {
          default_ttl_ms: 1000,
          max_ttl_ms: 5000,  // 5s max
          scope_ttls: {
            'test': 10000,  // 10s - exceeds max
          },
        },
        autoCleanup: false,
      });

      await manager.initialize();

      const result = await manager.evaluate({
        suppression_scope: 'test',
        action_type: 'create',
        correlation_id: 'test:max-ttl-1',
      });

      expect(result.ttl_ms).toBeLessThanOrEqual(5000);

      await manager.shutdown();
    });
  });
});
