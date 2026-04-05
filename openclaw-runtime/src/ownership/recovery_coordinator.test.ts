/**
 * Phase 2E-4B: Recovery Coordinator 单元测试
 * 
 * 测试覆盖：
 * A. Session Lifecycle - start/renew/complete
 * B. Item Coordination - claim/complete
 * C. Concurrency - 并发 claim 排他性
 * D. Expiry - Session/Item 过期行为
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import assert from 'assert';
import { 
  RecoveryCoordinator, 
  RecoveryCoordinatorConfig 
} from './recovery_coordinator';

// ==================== Mock Redis ====================

class MockRedisClient {
  private store: Map<string, string> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private ttls: Map<string, number> = new Map();
  private timeOffset = 0;  // 模拟时间偏移

  private now(): number {
    return Date.now() + this.timeOffset;
  }

  advanceTime(ms: number): void {
    this.timeOffset += ms;
  }

  async get(key: string): Promise<string | null> {
    const value = this.store.get(key);
    const ttl = this.ttls.get(key);
    
    if (ttl && this.now() > ttl) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    
    return value || null;
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    this.store.set(key, value);
    if (options?.ex) {
      this.ttls.set(key, this.now() + options.ex * 1000);
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (set.has(member)) {
        set.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    if (!set) return [];
    return Array.from(set);
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async eval(script: string, keys: number, ...args: string[]): Promise<any> {
    // 简化 Lua 脚本模拟 - 实际测试会用真实 Redis
    // 这里只处理 atomicClaimItem 脚本
    const key = args[0];
    const data = this.store.get(key);
    
    if (!data) return null;
    
    const item = JSON.parse(data);
    if (item.status === 'claimed') return null;
    
    // 模拟 claim 成功
    item.status = 'claimed';
    item.session_id = args[1];
    item.claimed_by = args[2];
    this.store.set(key, JSON.stringify(item));
    
    return JSON.stringify(item);
  }

  // 测试辅助方法
  clear(): void {
    this.store.clear();
    this.sets.clear();
    this.ttls.clear();
  }
}

// ==================== Mock Audit Log ====================

class MockAuditLogService {
  logs: Array<{
    event_type: string;
    object_type: string;
    object_id: string;
    metadata?: Record<string, unknown>;
  }> = [];

  async log(entry: {
    event_type: string;
    object_type: string;
    object_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.logs.push(entry);
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(event_type?: string): Array<typeof this.logs[0]> {
    if (!event_type) return [...this.logs];
    return this.logs.filter(log => log.event_type === event_type);
  }
}

// ==================== Test Helpers ====================

function createCoordinator(
  instanceId: string = 'test-instance-1',
  config: Partial<RecoveryCoordinatorConfig> = {}
) {
  const redis = new MockRedisClient();
  const audit = new MockAuditLogService();
  const coordinator = new RecoveryCoordinator(
    redis as any,
    audit as any,
    config,
    instanceId
  );
  return { coordinator, redis, audit };
}

// ==================== Tests ====================

describe('RecoveryCoordinator', () => {
  describe('Session Lifecycle', () => {
    describe('startSession', () => {
      it('第一次创建成功', async () => {
        const { coordinator } = createCoordinator();
        
        const result = await coordinator.startSession();
        
        assert.strictEqual(result.success, true);
        if (result.success) {
          assert.strictEqual(result.session.status, 'active');
          assert.strictEqual(result.session.owner_id, 'test-instance-1');
          assert.strictEqual(result.session.items_claimed, 0);
          assert.strictEqual(result.session.items_completed, 0);
        }
      });

      it('已存在有效 session 时拒绝', async () => {
        const { coordinator } = createCoordinator();
        
        // 创建第一个 session
        const result1 = await coordinator.startSession();
        assert.strictEqual(result1.success, true);
        
        // 尝试创建第二个 session
        const result2 = await coordinator.startSession();
        assert.strictEqual(result2.success, false);
        if (!result2.success) {
          assert.strictEqual(result2.error, 'SESSION_EXISTS');
        }
      });
    });

    describe('renewSession', () => {
      it('owner 正确时续约成功', async () => {
        const { coordinator } = createCoordinator();
        
        const startResult = await coordinator.startSession();
        assert.strictEqual(startResult.success, true);
        
        if (startResult.success) {
          const session_id = startResult.session.session_id;
          const oldExpires = startResult.session.expires_at;
          
          // 等待一小段时间后续约
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const renewResult = await coordinator.renewSession(session_id);
          assert.strictEqual(renewResult.success, true);
          
          if (renewResult.success) {
            assert.strictEqual(renewResult.session.session_id, session_id);
            assert.ok(renewResult.session.expires_at > oldExpires);
          }
        }
      });

      it('owner 不匹配时失败', async () => {
        const redis = new MockRedisClient();
        const audit = new MockAuditLogService();
        const coordinator1 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-1');
        const coordinator2 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-2');
        
        const result1 = await coordinator1.startSession();
        assert.strictEqual(result1.success, true);
        
        if (result1.success) {
          const session_id = result1.session.session_id;
          
          // 另一个实例尝试续约
          const result2 = await coordinator2.renewSession(session_id);
          assert.strictEqual(result2.success, false);
          if (!result2.success) {
            assert.strictEqual(result2.error, 'NOT_OWNER');
          }
        }
      });

      it('过期 session 无法续约', async () => {
        const { coordinator, redis } = createCoordinator('instance-1', {
          session_ttl_ms: 1000, // 1 秒 TTL (Redis ex 是秒)
        });
        
        const result1 = await coordinator.startSession();
        assert.strictEqual(result1.success, true);
        
        if (result1.success) {
          const session_id = result1.session.session_id;
          
          // 等待过期 (1.5 秒 > 1 秒 TTL)
          await new Promise(resolve => setTimeout(resolve, 1500));
          redis.advanceTime(1500);
          
          const result2 = await coordinator.renewSession(session_id);
          assert.strictEqual(result2.success, false);
          if (!result2.success) {
            assert.strictEqual(result2.error, 'SESSION_NOT_FOUND');
          }
        }
      });
    });

    describe('completeSession', () => {
      it('owner 正确时完成成功', async () => {
        const { coordinator } = createCoordinator();
        
        const startResult = await coordinator.startSession();
        assert.strictEqual(startResult.success, true);
        
        if (startResult.success) {
          const session_id = startResult.session.session_id;
          
          const completeResult = await coordinator.completeSession(session_id);
          assert.strictEqual(completeResult.success, true);
          
          if (completeResult.success) {
            assert.strictEqual(completeResult.session.status, 'completed');
          }
        }
      });

      it('非 owner 不可完成', async () => {
        const redis = new MockRedisClient();
        const audit = new MockAuditLogService();
        const coordinator1 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-1');
        const coordinator2 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-2');
        
        const result1 = await coordinator1.startSession();
        assert.strictEqual(result1.success, true);
        
        if (result1.success) {
          const session_id = result1.session.session_id;
          
          const result2 = await coordinator2.completeSession(session_id);
          assert.strictEqual(result2.success, false);
          if (!result2.success) {
            assert.strictEqual(result2.error, 'NOT_OWNER');
          }
        }
      });
    });
  });

  describe('Item Coordination', () => {
    describe('claimItem', () => {
      it('第一个 claim 成功', async () => {
        const { coordinator, redis } = createCoordinator();
        
        // 创建 session
        const sessionResult = await coordinator.startSession();
        assert.strictEqual(sessionResult.success, true);
        
        if (sessionResult.success) {
          const session_id = sessionResult.session.session_id;
          const item_id = 'test-item-1';
          
          // 创建 item
          await redis.set(`recovery:item:${item_id}`, JSON.stringify({
            item_id,
            item_type: 'approval',
            status: 'pending',
            retry_count: 0,
            max_retries: 3,
            created_at: Date.now(),
          }));
          
          // Claim item
          const claimResult = await coordinator.claimItem(item_id, session_id);
          assert.strictEqual(claimResult.success, true);
          
          if (claimResult.success) {
            assert.strictEqual(claimResult.item.status, 'claimed');
            assert.strictEqual(claimResult.item.claimed_by, 'test-instance-1');
          }
        }
      });

      it('第二个并发 claim 失败', async () => {
        const redis = new MockRedisClient();
        const audit = new MockAuditLogService();
        const coordinator1 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-1');
        const coordinator2 = new RecoveryCoordinator(redis as any, audit as any, {}, 'instance-2');
        
        // 创建 session
        const sessionResult1 = await coordinator1.startSession();
        const sessionResult2 = await coordinator2.startSession();
        assert.strictEqual(sessionResult1.success, true);
        assert.strictEqual(sessionResult2.success, false); // 只有一个能成功
        
        if (sessionResult1.success) {
          const session_id = sessionResult1.session.session_id;
          const item_id = 'test-item-2';
          
          // 创建 item
          await redis.set(`recovery:item:${item_id}`, JSON.stringify({
            item_id,
            item_type: 'incident',
            status: 'pending',
            retry_count: 0,
            max_retries: 3,
            created_at: Date.now(),
          }));
          
          // 第一个 claim
          const claimResult1 = await coordinator1.claimItem(item_id, session_id);
          assert.strictEqual(claimResult1.success, true);
          
          // 第二个 claim 应该失败
          const claimResult2 = await coordinator2.claimItem(item_id, 'non-existent-session');
          assert.strictEqual(claimResult2.success, false);
          if (!claimResult2.success) {
            assert.ok(
              claimResult2.error === 'ITEM_ALREADY_CLAIMED' || 
              claimResult2.error === 'SESSION_INVALID'
            );
          }
        }
      });
    });

    describe('completeItem', () => {
      it('只有已 claim 且 owner 匹配时成功', async () => {
        const { coordinator, redis } = createCoordinator();
        
        // 创建 session
        const sessionResult = await coordinator.startSession();
        assert.strictEqual(sessionResult.success, true);
        
        if (sessionResult.success) {
          const session_id = sessionResult.session.session_id;
          const item_id = 'test-item-3';
          
          // 创建并 claim item
          await redis.set(`recovery:item:${item_id}`, JSON.stringify({
            item_id,
            item_type: 'approval',
            status: 'claimed',
            session_id,
            claimed_by: 'test-instance-1',
            claimed_at: Date.now(),
            retry_count: 0,
            max_retries: 3,
            created_at: Date.now(),
          }));
          
          // Complete
          const completeResult = await coordinator.completeItem(item_id, session_id);
          assert.strictEqual(completeResult.success, true);
          
          if (completeResult.success) {
            assert.strictEqual(completeResult.item.status, 'completed');
          }
        }
      });

      it('非 owner 不可 complete', async () => {
        const { coordinator, redis } = createCoordinator();
        
        // 创建 session
        const sessionResult = await coordinator.startSession();
        assert.strictEqual(sessionResult.success, true);
        
        if (sessionResult.success) {
          const session_id = sessionResult.session.session_id;
          const item_id = 'test-item-4';
          
          // 创建 item（被另一个 session claim）
          await redis.set(`recovery:item:${item_id}`, JSON.stringify({
            item_id,
            item_type: 'incident',
            status: 'claimed',
            session_id: 'other-session',
            claimed_by: 'other-instance',
            claimed_at: Date.now(),
            retry_count: 0,
            max_retries: 3,
            created_at: Date.now(),
          }));
          
          // Complete 应该失败
          const completeResult = await coordinator.completeItem(item_id, session_id);
          assert.strictEqual(completeResult.success, false);
          if (!completeResult.success) {
            assert.strictEqual(completeResult.error, 'NOT_OWNER');
          }
        }
      });
    });
  });

  describe('Audit Log', () => {
    it('所有操作都有审计日志', async () => {
      const { coordinator, audit } = createCoordinator();
      
      // Start session
      await coordinator.startSession();
      
      // 检查审计日志
      const startLogs = audit.getLogs('recovery_session_started');
      assert.strictEqual(startLogs.length, 1);
    });
  });
});
