/**
 * Phase 3A-1: Runtime Configuration
 *
 * 统一运行时配置读取层，支持环境分层和 Feature Flags。
 */
export type Environment = 'development' | 'staging' | 'production';
export type FallbackBehavior = 'reject' | 'allow' | 'queue' | 'buffer' | 'retry';
export interface RuntimeConfig {
    NODE_ENV: Environment;
    PORT: number;
    HOST: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_PASSWORD?: string;
    REDIS_DB: number;
    REDIS_KEY_PREFIX: string;
    REDIS_CONNECTION_TIMEOUT: number;
    REDIS_RETRY_COUNT: number;
    PERSISTENCE_PATH: string;
    AUDIT_LOG_PATH: string;
    AUDIT_LOG_LEVEL: string;
    AUDIT_RETENTION_DAYS: number;
    STRICT_COORDINATION_REQUIRED: boolean;
    ALLOW_LOCK_FALLBACK: boolean;
    ENABLE_REPLAY: boolean;
    ENABLE_RECOVERY_SCAN: boolean;
    ENABLE_DISTRIBUTED_LOCK: boolean;
    ENABLE_IDEMPOTENCY: boolean;
    ENABLE_POLICY_AUDIT: boolean;
    ENABLE_TIMELINE: boolean;
    ENABLE_MULTI_INSTANCE: boolean;
    ENABLE_ORPHAN_DETECTION: boolean;
    SAFE_MODE: boolean;
    READ_ONLY_MODE: boolean;
    EMERGENCY_STOP: boolean;
    FALLBACK_ON_REDIS_DOWN: FallbackBehavior;
    FALLBACK_ON_LOCK_FAIL: FallbackBehavior;
    FALLBACK_ON_AUDIT_FAIL: FallbackBehavior;
    LOCK_RETRY_COUNT: number;
    LOCK_RETRY_DELAY_MS: number;
    OKX_API_KEY: string | undefined;
    OKX_API_SECRET: string | undefined;
    OKX_PASSPHRASE: string | undefined;
    OKX_NETWORK: 'testnet' | 'mainnet';
    GITHUB_TOKEN: string | undefined;
    WEBHOOK_SECRET: string;
    LOG_LEVEL: string;
    LOG_FORMAT: 'pretty' | 'json';
    METRICS_ENABLED: boolean;
    METRICS_PORT?: number;
    TRACING_ENABLED: boolean;
}
export declare function loadConfig(): RuntimeConfig;
export declare function getConfig(): RuntimeConfig;
export declare function reloadConfig(): RuntimeConfig;
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface CoordinationDecision {
    requireRedis: boolean;
    requireLock: boolean;
    requireIdempotency: boolean;
    allowFallback: boolean;
    reason: string;
}
export declare function decideCoordination(routeName: string, riskLevel: RiskLevel, config?: RuntimeConfig): CoordinationDecision;
//# sourceMappingURL=runtime_config.d.ts.map