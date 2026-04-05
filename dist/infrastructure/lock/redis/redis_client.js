"use strict";
/**
 * Redis Client
 * Phase 2E-4A - Redis 客户端封装
 *
 * 职责：
 * - 提供统一的 Redis 连接
 * - 支持连接池
 * - 提供基础操作封装
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisClient = void 0;
exports.createRedisClient = createRedisClient;
exports.getDefaultRedisConfig = getDefaultRedisConfig;
const ioredis_1 = __importDefault(require("ioredis"));
// ============================================================================
// Redis Client
// ============================================================================
class RedisClient {
    constructor(config) {
        this.config = config;
        this.client = new ioredis_1.default({
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db || 0,
            keyPrefix: config.keyPrefix || '',
            maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
            connectTimeout: config.connectTimeout || 10000,
            retryStrategy: (times) => {
                if (times > 3) {
                    return null; // 停止重试
                }
                return Math.min(times * 200, 2000); // 指数退避
            },
        });
        this.client.on('error', (err) => {
            console.error('[RedisClient] Error:', err);
        });
        this.client.on('connect', () => {
            console.log('[RedisClient] Connected to Redis');
        });
    }
    /**
     * 获取原生 Redis 客户端
     */
    getClient() {
        return this.client;
    }
    /**
     * 关闭连接
     */
    async disconnect() {
        await this.client.quit();
    }
    /**
     * 健康检查
     */
    async ping() {
        return await this.client.ping();
    }
    /**
     * 设置键值
     */
    async set(key, value, ttlMs) {
        if (ttlMs) {
            await this.client.setex(key, Math.ceil(ttlMs / 1000), value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    /**
     * 获取键值
     */
    async get(key) {
        return await this.client.get(key);
    }
    /**
     * 删除键
     */
    async del(key) {
        return await this.client.del(key);
    }
    /**
     * 检查键是否存在
     */
    async exists(key) {
        const result = await this.client.exists(key);
        return result === 1;
    }
    /**
     * 设置过期时间
     */
    async expire(key, ttlMs) {
        const result = await this.client.pexpire(key, ttlMs);
        return result === 1;
    }
    /**
     * 获取剩余 TTL
     */
    async ttl(key) {
        return await this.client.pttl(key);
    }
    /**
     * 原子性设置（如果不存在）
     */
    async setnx(key, value) {
        const result = await this.client.setnx(key, value);
        return result === 1;
    }
    /**
     * 原子性设置并返回旧值
     */
    async getSet(key, value) {
        return await this.client.getset(key, value);
    }
    /**
     * Lua 脚本执行
     */
    async eval(script, keys, args) {
        return await this.client.eval(script, keys.length, ...keys, ...args);
    }
}
exports.RedisClient = RedisClient;
// ============================================================================
// Factory Function
// ============================================================================
function createRedisClient(config) {
    return new RedisClient(config);
}
// ============================================================================
// 默认配置（从环境变量读取）
// ============================================================================
function getDefaultRedisConfig() {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'openclaw:',
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
    };
}
