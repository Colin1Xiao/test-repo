/**
 * Redis Client Interface
 * 
 * Phase 2E-4A: 并发控制层
 */

export interface RedisSetOptions {
  ex?: number;  // 过期时间 (秒)
  px?: number;  // 过期时间 (毫秒)
  nx?: boolean; // 仅当不存在时设置
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<void>;
  del(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<number>;
  eval(script: string, keys: number, ...args: string[]): Promise<any>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
