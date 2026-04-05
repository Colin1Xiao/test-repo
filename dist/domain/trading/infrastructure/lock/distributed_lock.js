"use strict";
/**
 * Distributed Lock
 * Phase 2E-4A - 分布式锁
 *
 * 职责：
 * - 提供排他锁
 * - 支持 lease 机制
 * - 自动过期
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockKeyGenerator = exports.DistributedLock = void 0;
exports.createDistributedLock = createDistributedLock;
exports.createLockKeyGenerator = createLockKeyGenerator;
// ============================================================================
// Distributed Lock
// ============================================================================
class DistributedLock {
    constructor(redis, config) {
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
    async acquire(resourceKey, ownerId, ttlMs) {
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
        }
        else {
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
    async tryAcquire(resourceKey, ownerId, ttlMs) {
        let lastResult = null;
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
    async release(resourceKey, ownerId) {
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
    async renew(resourceKey, ownerId, ttlMs) {
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
        const result = await this.redis.eval(script, [lockKey], [ownerId, ttl.toString()]);
        return result === 1;
    }
    /**
     * 获取锁信息
     * 现在存储的是 ownerId 字符串
     */
    async get(resourceKey) {
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
    async isHeld(resourceKey, ownerId) {
        const lock = await this.get(resourceKey);
        if (!lock) {
            return false;
        }
        return lock.ownerId === ownerId && lock.expiresAt > Date.now();
    }
    /**
     * 获取锁键（带前缀）
     */
    getLockKey(resourceKey) {
        return `${this.config.keyPrefix}${resourceKey}`;
    }
    /**
     * 睡眠
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.DistributedLock = DistributedLock;
// ============================================================================
// Factory Function
// ============================================================================
function createDistributedLock(redis, config) {
    return new DistributedLock(redis, config);
}
// ============================================================================
// 锁键生成工具
// ============================================================================
class LockKeyGenerator {
    constructor(prefix) {
        this.prefix = prefix;
    }
    /**
     * Approval 锁键
     */
    approval(approvalId) {
        return `approval:${approvalId}`;
    }
    /**
     * Incident 锁键
     */
    incident(incidentId) {
        return `incident:${incidentId}`;
    }
    /**
     * Replay 锁键
     */
    replay(jobId) {
        return `replay:${jobId}`;
    }
    /**
     * Recovery 锁键
     */
    recovery(sessionId) {
        return `recovery:${sessionId}`;
    }
    /**
     * Webhook 锁键
     */
    webhook(provider, eventId) {
        return `webhook:${provider}:${eventId}`;
    }
    /**
     * 生成完整键（带前缀）
     */
    generate(suffix) {
        return `${this.prefix}:${suffix}`;
    }
}
exports.LockKeyGenerator = LockKeyGenerator;
function createLockKeyGenerator(prefix) {
    return new LockKeyGenerator(prefix);
}
