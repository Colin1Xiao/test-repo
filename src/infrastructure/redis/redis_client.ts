/**
 * Redis Client
 * Phase 2E-4A - Redis 客户端封装
 * 
 * 职责：
 * - 提供统一的 Redis 连接
 * - 支持连接池
 * - 提供基础操作封装
 */

import Redis from 'ioredis';

// ============================================================================
// 配置
// ============================================================================

export interface RedisClientConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
}

// ============================================================================
// Redis Client
// ============================================================================

export class RedisClient {
  private client: Redis;
  private config: RedisClientConfig;

  constructor(config: RedisClientConfig) {
    this.config = config;
    
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || '',
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      connectTimeout: config.connectTimeout || 10000,
      retryStrategy: (times: number) => {
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
  getClient(): Redis {
    return this.client;
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * 健康检查
   */
  async ping(): Promise<string> {
    return await this.client.ping();
  }

  /**
   * 设置键值
   */
  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      await this.client.setex(key, Math.ceil(ttlMs / 1000), value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * 获取键值
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.client.pexpire(key, ttlMs);
    return result === 1;
  }

  /**
   * 获取剩余 TTL（毫秒）
   */
  async pttl(key: string): Promise<number> {
    return await this.client.pttl(key);
  }

  /**
   * 获取剩余 TTL（秒）
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * 原子性设置（如果不存在）
   */
  async setnx(key: string, value: string): Promise<boolean> {
    const result = await this.client.setnx(key, value);
    return result === 1;
  }

  /**
   * 原子性设置并返回旧值
   */
  async getSet(key: string, value: string): Promise<string | null> {
    return await this.client.getset(key, value);
  }

  /**
   * Lua 脚本执行
   */
  async eval(script: string, keys: string[], args: any[]): Promise<any> {
    return await this.client.eval(script, keys.length, ...keys, ...args);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRedisClient(config: RedisClientConfig): RedisClient {
  return new RedisClient(config);
}

// ============================================================================
// 默认配置（从环境变量读取）
// ============================================================================

export function getDefaultRedisConfig(): RedisClientConfig {
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
