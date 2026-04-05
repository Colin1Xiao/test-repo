/**
 * Distributed Lock
 * Phase 2E-4A - 分布式锁
 * 
 * 职责：
 * - 提供排他锁
 * - 支持 lease 机制
 * - 自动过期
 */

import type { RedisClient } from '../redis/redis_client';

// ============================================================================
// 类型定义
// ============================================================================

export interface LockAcquireResult {
  acquired: boolean;
  ownerId?: string;
  expiresAt?: number;
  message?: string;
}

export interface LockRecord {
  resourceKey: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface LockConfig {
  defaultTtlMs: number;
  retryIntervalMs: number;
  maxRetries: number;
  keyPrefix: string;
}

// ============================================================================
// Distributed Lock
// ============================================================================

export class DistributedLock {
  private redis: RedisClient;
  private config: LockConfig;

  constructor(redis: RedisClient, config?: Partial<LockConfig>) {
    this.redis = redis;
    this.config = {
      defaultTtlMs: config?.defaultTtlMs || 30 * 1000, // 30 秒
      retryIntervalMs: config?.retryIntervalMs || 100, // 100ms
      maxRetries: config?.maxRetries || 3,
      keyPrefix: config?.keyPrefix || 'lock:',
    };
  }

  /**
   * 获取锁
   * 使用 Redis SET NX PX 原子命令
   */
  async acquire(resourceKey: string, ownerId: string, ttlMs?: number): Promise<LockAcquireResult> {
    const lockKey = this.getLockKey(resourceKey);
    const ttl = ttlMs || this.config.defaultTtlMs;
    const now = Date.now();

    // 使用 SET NX PX 原子命令获取锁
    const client = this.redis.getClient();
    const result = await client.set(lockKey, ownerId, 'PX', ttl, 'NX');

    if (result === 'OK') {
      // 成功获取锁
      return {
        acquired: true,
        ownerId,
        expiresAt: now + ttl,
        message: 'Lock acquired',
      };
    } else {
      // 锁已被其他实例持有
      const currentOwner = await client.get(lockKey);
      const pttl = await client.pttl(lockKey);
      
      return {
        acquired: false,
        ownerId: currentOwner || undefined,
        expiresAt: pttl > 0 ? now + pttl : undefined,
        message: 'Lock already held',
      };
    }
  }

  /**
   * 尝试获取锁（带重试）
   */
  async tryAcquire(
    resourceKey: string,
    ownerId: string,
    ttlMs?: number
  ): Promise<LockAcquireResult> {
    let lastResult: LockAcquireResult | null = null;
    
    for (let i = 0; i < this.config.maxRetries; i++) {
      lastResult = await this.acquire(resourceKey, ownerId, ttlMs);
      
      if (lastResult.acquired) {
        return lastResult;
      }

      if (i < this.config.maxRetries - 1) {
        await this.sleep(this.config.retryIntervalMs);
      }
    }

    return lastResult || { acquired: false, message: 'Max retries exceeded' };
  }

  /**
   * 释放锁
   * 使用 Lua 脚本保证原子性，只有 owner 才能释放
   */
  async release(resourceKey: string, ownerId: string): Promise<boolean> {
    const lockKey = this.getLockKey(resourceKey);

    // 使用 Lua 脚本保证原子性
    // 现在存储的是 ownerId 字符串，不是 JSON 记录
    const script = `
      local key = KEYS[1]
      local ownerId = ARGV[1]
      
      local existing = redis.call('GET', key)
      if not existing or existing ~= ownerId then
        return 0
      end
      
      redis.call('DEL', key)
      return 1
    `;

    const result = await this.redis.eval(script, [lockKey], [ownerId]);
    return result === 1;
  }

  /**
   * 续期锁
   * 只有 owner 才能续约
   */
  async renew(resourceKey: string, ownerId: string, ttlMs?: number): Promise<boolean> {
    const lockKey = this.getLockKey(resourceKey);
    const ttl = ttlMs || this.config.defaultTtlMs;

    // 使用 Lua 脚本保证原子性
    // 现在存储的是 ownerId 字符串，不是 JSON 记录
    const script = `
      local key = KEYS[1]
      local ownerId = ARGV[1]
      local ttl = tonumber(ARGV[2])
      
      local existing = redis.call('GET', key)
      if not existing or existing ~= ownerId then
        return 0
      end
      
      redis.call('SETEX', key, ttl / 1000, ownerId)
      return 1
    `;

    const result = await this.redis.eval(
      script,
      [lockKey],
      [ownerId, ttl.toString()]
    );

    return result === 1;
  }

  /**
   * 获取锁信息
   * 现在存储的是 ownerId 字符串
   */
  async get(resourceKey: string): Promise<{ ownerId: string; expiresAt: number } | null> {
    const lockKey = this.getLockKey(resourceKey);
    const ownerId = await this.redis.get(lockKey);
    const remainingTtl = await this.redis.pttl(lockKey);

    if (!ownerId) {
      return null;
    }

    return {
      ownerId,
      expiresAt: remainingTtl > 0 ? Date.now() + remainingTtl : Date.now() + this.config.defaultTtlMs,
    };
  }

  /**
   * 检查是否持有锁
   */
  async isHeld(resourceKey: string, ownerId: string): Promise<boolean> {
    const lock = await this.get(resourceKey);
    
    if (!lock) {
      return false;
    }

    return lock.ownerId === ownerId && lock.expiresAt > Date.now();
  }

  /**
   * 获取锁键（带前缀）
   */
  private getLockKey(resourceKey: string): string {
    return `${this.config.keyPrefix}${resourceKey}`;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDistributedLock(
  redis: RedisClient,
  config?: Partial<LockConfig>
): DistributedLock {
  return new DistributedLock(redis, config);
}

// ============================================================================
// 锁键生成工具
// ============================================================================

export class LockKeyGenerator {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * Approval 锁键
   */
  approval(approvalId: string): string {
    return `approval:${approvalId}`;
  }

  /**
   * Incident 锁键
   */
  incident(incidentId: string): string {
    return `incident:${incidentId}`;
  }

  /**
   * Replay 锁键
   */
  replay(jobId: string): string {
    return `replay:${jobId}`;
  }

  /**
   * Recovery 锁键
   */
  recovery(sessionId: string): string {
    return `recovery:${sessionId}`;
  }

  /**
   * Webhook 锁键
   */
  webhook(provider: string, eventId: string): string {
    return `webhook:${provider}:${eventId}`;
  }

  /**
   * 生成完整键（带前缀）
   */
  generate(suffix: string): string {
    return `${this.prefix}:${suffix}`;
  }
}

export function createLockKeyGenerator(prefix: string): LockKeyGenerator {
  return new LockKeyGenerator(prefix);
}
