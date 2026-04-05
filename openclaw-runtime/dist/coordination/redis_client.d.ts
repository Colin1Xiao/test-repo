/**
 * Redis Client Interface
 *
 * Phase 2E-4A: 并发控制层
 */
export interface RedisSetOptions {
    ex?: number;
    px?: number;
    nx?: boolean;
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
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
}
//# sourceMappingURL=redis_client.d.ts.map