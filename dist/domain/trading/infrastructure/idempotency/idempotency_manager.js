"use strict";
/**
 * Idempotency Manager
 * Phase 2E-4A - 幂等性管理器
 *
 * 职责：
 * - 防止重复请求
 * - 存储请求结果
 * - 支持并发控制
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyKeyGenerator = exports.IdempotencyManager = void 0;
exports.createIdempotencyManager = createIdempotencyManager;
exports.createIdempotencyKeyGenerator = createIdempotencyKeyGenerator;
// ============================================================================
// Idempotency Manager
// ============================================================================
class IdempotencyManager {
    constructor(redis, config) {
        this.redis = redis;
        this.config = {
            defaultTtlMs: config?.defaultTtlMs || 24 * 60 * 60 * 1000, // 24 小时
            inProgressTtlMs: config?.inProgressTtlMs || 5 * 60 * 1000, // 5 分钟
            keyPrefix: config?.keyPrefix || 'idemp:',
        };
    }
    /**
     * 生成幂等键
     */
    generateKey(prefix, ...parts) {
        const key = `${this.config.keyPrefix}${prefix}:${parts.join(':')}`;
        return key;
    }
    /**
     * 开始幂等检查
     *
     * 返回:
     * - accepted: true - 可以继续处理
     * - accepted: false, existing - 已存在，返回已有结果
     */
    async begin(key, requestHash) {
        const now = Date.now();
        const recordKey = this.getKey(key);
        // 使用 Lua 脚本保证原子性
        const script = `
      local key = KEYS[1]
      local requestHash = ARGV[1]
      local now = tonumber(ARGV[2])
      local inProgressTtl = tonumber(ARGV[3])
      
      local existing = redis.call('GET', key)
      if existing then
        return existing
      end
      
      -- 创建 in_progress 记录
      local record = cjson.encode({
        key = key,
        requestHash = requestHash,
        status = 'in_progress',
        createdAt = now,
        updatedAt = now,
        expiresAt = now + inProgressTtl
      })
      
      redis.call('SET', key, record, 'PX', inProgressTtl)
      
      return record
    `;
        const result = await this.redis.eval(script, [recordKey], [requestHash, now.toString(), this.config.inProgressTtlMs.toString()]);
        // 解析结果
        const record = typeof result === 'string' ? JSON.parse(result) : result;
        // 检查是否是重复请求
        if (record.requestHash !== requestHash && record.status !== 'in_progress') {
            // 请求哈希不匹配，但状态已完成，返回已有结果
            return {
                accepted: false,
                existing: record,
            };
        }
        if (record.status === 'completed' || record.status === 'failed') {
            // 已完成或失败，返回已有结果
            return {
                accepted: false,
                existing: record,
            };
        }
        // in_progress 状态，接受当前请求
        return {
            accepted: true,
        };
    }
    /**
     * 完成幂等记录
     */
    async complete(key, result) {
        const recordKey = this.getKey(key);
        const now = Date.now();
        const script = `
      local key = KEYS[1]
      local response = ARGV[1]
      local now = tonumber(ARGV[2])
      local defaultTtl = tonumber(ARGV[3])
      
      local existing = redis.call('GET', key)
      if not existing then
        return 0
      end
      
      local record = cjson.decode(existing)
      record.status = 'completed'
      record.response = cjson.decode(response)
      record.updatedAt = now
      record.expiresAt = now + defaultTtl
      
      redis.call('SET', key, cjson.encode(record), 'PX', defaultTtl)
      
      return 1
    `;
        await this.redis.eval(script, [recordKey], [JSON.stringify(result.response), now.toString(), this.config.defaultTtlMs.toString()]);
    }
    /**
     * 失败幂等记录
     */
    async fail(key, error) {
        const recordKey = this.getKey(key);
        const now = Date.now();
        const script = `
      local key = KEYS[1]
      local error = ARGV[1]
      local now = tonumber(ARGV[2])
      local defaultTtl = tonumber(ARGV[3])
      
      local existing = redis.call('GET', key)
      if not existing then
        return 0
      end
      
      local record = cjson.decode(existing)
      record.status = 'failed'
      record.error = cjson.decode(error)
      record.updatedAt = now
      record.expiresAt = now + defaultTtl
      
      redis.call('SET', key, cjson.encode(record), 'PX', defaultTtl)
      
      return 1
    `;
        await this.redis.eval(script, [recordKey], [JSON.stringify(error), now.toString(), this.config.defaultTtlMs.toString()]);
    }
    /**
     * 获取幂等记录
     */
    async get(key) {
        const recordKey = this.getKey(key);
        const result = await this.redis.get(recordKey);
        if (!result) {
            return null;
        }
        return JSON.parse(result);
    }
    /**
     * 删除幂等记录
     */
    async delete(key) {
        const recordKey = this.getKey(key);
        await this.redis.del(recordKey);
    }
    /**
     * 获取键（带前缀）
     */
    getKey(key) {
        return `${this.config.keyPrefix}${key}`;
    }
}
exports.IdempotencyManager = IdempotencyManager;
// ============================================================================
// Factory Function
// ============================================================================
function createIdempotencyManager(redis, config) {
    return new IdempotencyManager(redis, config);
}
// ============================================================================
// 幂等键生成工具
// ============================================================================
class IdempotencyKeyGenerator {
    constructor(prefix) {
        this.prefix = prefix;
    }
    /**
     * Webhook 幂等键
     */
    webhook(provider, eventId) {
        return `webhook:${provider}:${eventId}`;
    }
    /**
     * Approval 决策幂等键
     */
    approval(approvalId, decision) {
        return `approval:${approvalId}:${decision}`;
    }
    /**
     * Incident 动作幂等键
     */
    incident(incidentId, action) {
        return `incident:${incidentId}:${action}`;
    }
    /**
     * Replay 幂等键
     */
    replay(targetType, targetId, requestHash) {
        return `replay:${targetType}:${targetId}:${requestHash}`;
    }
    /**
     * Recovery 幂等键
     */
    recovery(scope, requestHash) {
        return `recovery:${scope}:${requestHash}`;
    }
    /**
     * 生成完整键（带前缀）
     */
    generate(suffix) {
        return `${this.prefix}:${suffix}`;
    }
}
exports.IdempotencyKeyGenerator = IdempotencyKeyGenerator;
function createIdempotencyKeyGenerator(prefix) {
    return new IdempotencyKeyGenerator(prefix);
}
