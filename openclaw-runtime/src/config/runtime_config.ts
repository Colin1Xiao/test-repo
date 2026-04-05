/**
 * Phase 3A-1: Runtime Configuration
 * 
 * 统一运行时配置读取层，支持环境分层和 Feature Flags。
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ==================== Types ====================

export type Environment = 'development' | 'staging' | 'production';

export type FallbackBehavior = 'reject' | 'allow' | 'queue' | 'buffer' | 'retry';

export interface RuntimeConfig {
  // 环境
  NODE_ENV: Environment;
  PORT: number;
  HOST: string;
  
  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_KEY_PREFIX: string;
  REDIS_CONNECTION_TIMEOUT: number;
  REDIS_RETRY_COUNT: number;
  
  // Persistence
  PERSISTENCE_PATH: string;
  AUDIT_LOG_PATH: string;
  AUDIT_LOG_LEVEL: string;
  AUDIT_RETENTION_DAYS: number;
  
  // Feature Flags - 环境策略
  STRICT_COORDINATION_REQUIRED: boolean;
  ALLOW_LOCK_FALLBACK: boolean;
  
  // Feature Flags - 功能开关
  ENABLE_REPLAY: boolean;
  ENABLE_RECOVERY_SCAN: boolean;
  ENABLE_DISTRIBUTED_LOCK: boolean;
  ENABLE_IDEMPOTENCY: boolean;
  ENABLE_POLICY_AUDIT: boolean;
  ENABLE_TIMELINE: boolean;
  ENABLE_MULTI_INSTANCE: boolean;
  ENABLE_ORPHAN_DETECTION: boolean;
  
  // Feature Flags - 安全开关
  SAFE_MODE: boolean;
  READ_ONLY_MODE: boolean;
  EMERGENCY_STOP: boolean;
  
  // Feature Flags - 降级路径
  FALLBACK_ON_REDIS_DOWN: FallbackBehavior;
  FALLBACK_ON_LOCK_FAIL: FallbackBehavior;
  FALLBACK_ON_AUDIT_FAIL: FallbackBehavior;
  LOCK_RETRY_COUNT: number;
  LOCK_RETRY_DELAY_MS: number;
  
  // 外部服务
  OKX_API_KEY: string | undefined;
  OKX_API_SECRET: string | undefined;
  OKX_PASSPHRASE: string | undefined;
  OKX_NETWORK: 'testnet' | 'mainnet';
  GITHUB_TOKEN: string | undefined;
  WEBHOOK_SECRET: string;
  
  // 日志与监控
  LOG_LEVEL: string;
  LOG_FORMAT: 'pretty' | 'json';
  METRICS_ENABLED: boolean;
  METRICS_PORT?: number;
  TRACING_ENABLED: boolean;
}

// ==================== Defaults ====================

const DEFAULTS = {
  PORT: 3000,
  HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 0,
  REDIS_CONNECTION_TIMEOUT: 5000,
  REDIS_RETRY_COUNT: 3,
  AUDIT_LOG_LEVEL: 'info' as const,
  AUDIT_RETENTION_DAYS: 30,
  
  // Feature Flags - 环境策略
  STRICT_COORDINATION_REQUIRED: false,
  ALLOW_LOCK_FALLBACK: true,
  
  // Feature Flags - 功能开关
  ENABLE_REPLAY: true,
  ENABLE_RECOVERY_SCAN: true,
  ENABLE_DISTRIBUTED_LOCK: false,
  ENABLE_IDEMPOTENCY: false,
  ENABLE_POLICY_AUDIT: true,
  ENABLE_TIMELINE: true,
  ENABLE_MULTI_INSTANCE: false,
  ENABLE_ORPHAN_DETECTION: false,
  
  // Feature Flags - 安全开关
  SAFE_MODE: false,
  READ_ONLY_MODE: false,
  EMERGENCY_STOP: false,
  
  // Feature Flags - 降级路径
  FALLBACK_ON_REDIS_DOWN: 'allow' as const,
  FALLBACK_ON_LOCK_FAIL: 'allow' as const,
  FALLBACK_ON_AUDIT_FAIL: 'allow' as const,
  LOCK_RETRY_COUNT: 3,
  LOCK_RETRY_DELAY_MS: 100,
  
  // 外部服务
  OKX_NETWORK: 'testnet' as const,
  
  // 日志与监控
  LOG_LEVEL: 'info' as const,
  LOG_FORMAT: 'pretty' as const,
  METRICS_ENABLED: false,
  TRACING_ENABLED: false,
} as const;

// ==================== Helpers ====================

function getEnv(key: string, defaultValue: string): string;
function getEnv(key: string, defaultValue: number): number;
function getEnv(key: string, defaultValue: boolean): boolean;
function getEnv(key: string, defaultValue: string | number | boolean): string | number | boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  
  // Type coercion based on defaultValue
  if (typeof defaultValue === 'boolean') {
    return value === 'true' || value === '1';
  }
  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return value;
}

function loadEnvFile(path: string): void {
  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    // File not found, skip
  }
}

// ==================== Load Configuration ====================

export function loadConfig(): RuntimeConfig {
  // Load env files in order
  const nodeEnv = (process.env.NODE_ENV || 'development') as Environment;
  
  loadEnvFile(join(process.cwd(), '.env.example'));
  loadEnvFile(join(process.cwd(), `.env.${nodeEnv}`));
  loadEnvFile(join(process.cwd(), `.env.${nodeEnv}.local`));
  loadEnvFile(join(process.cwd(), '.env.local'));
  
  // Build config from environment
  const config: RuntimeConfig = {
    NODE_ENV: getEnv('NODE_ENV', 'development') as Environment,
    PORT: getEnv('PORT', DEFAULTS.PORT),
    HOST: getEnv('HOST', DEFAULTS.HOST),
    
    REDIS_HOST: getEnv('REDIS_HOST', 'localhost'),
    REDIS_PORT: getEnv('REDIS_PORT', DEFAULTS.REDIS_PORT),
    REDIS_PASSWORD: getEnv('REDIS_PASSWORD', ''),
    REDIS_DB: getEnv('REDIS_DB', DEFAULTS.REDIS_DB),
    REDIS_KEY_PREFIX: getEnv('REDIS_KEY_PREFIX', `${nodeEnv}:`),
    REDIS_CONNECTION_TIMEOUT: getEnv('REDIS_CONNECTION_TIMEOUT', DEFAULTS.REDIS_CONNECTION_TIMEOUT),
    REDIS_RETRY_COUNT: getEnv('REDIS_RETRY_COUNT', DEFAULTS.REDIS_RETRY_COUNT),
    
    PERSISTENCE_PATH: getEnv('PERSISTENCE_PATH', './data'),
    AUDIT_LOG_PATH: getEnv('AUDIT_LOG_PATH', './logs'),
    AUDIT_LOG_LEVEL: getEnv('AUDIT_LOG_LEVEL', DEFAULTS.AUDIT_LOG_LEVEL),
    AUDIT_RETENTION_DAYS: getEnv('AUDIT_RETENTION_DAYS', DEFAULTS.AUDIT_RETENTION_DAYS),
    
    // Feature Flags - 环境策略
    STRICT_COORDINATION_REQUIRED: getEnv('STRICT_COORDINATION_REQUIRED', nodeEnv === 'production'),
    ALLOW_LOCK_FALLBACK: getEnv('ALLOW_LOCK_FALLBACK', nodeEnv !== 'production'),
    
    // Feature Flags - 功能开关
    ENABLE_REPLAY: getEnv('ENABLE_REPLAY', DEFAULTS.ENABLE_REPLAY),
    ENABLE_RECOVERY_SCAN: getEnv('ENABLE_RECOVERY_SCAN', DEFAULTS.ENABLE_RECOVERY_SCAN),
    ENABLE_DISTRIBUTED_LOCK: getEnv('ENABLE_DISTRIBUTED_LOCK', nodeEnv !== 'development'),
    ENABLE_IDEMPOTENCY: getEnv('ENABLE_IDEMPOTENCY', nodeEnv !== 'development'),
    ENABLE_POLICY_AUDIT: getEnv('ENABLE_POLICY_AUDIT', DEFAULTS.ENABLE_POLICY_AUDIT),
    ENABLE_TIMELINE: getEnv('ENABLE_TIMELINE', DEFAULTS.ENABLE_TIMELINE),
    ENABLE_MULTI_INSTANCE: getEnv('ENABLE_MULTI_INSTANCE', DEFAULTS.ENABLE_MULTI_INSTANCE),
    ENABLE_ORPHAN_DETECTION: getEnv('ENABLE_ORPHAN_DETECTION', DEFAULTS.ENABLE_ORPHAN_DETECTION),
    
    // Feature Flags - 安全开关
    SAFE_MODE: getEnv('SAFE_MODE', DEFAULTS.SAFE_MODE),
    READ_ONLY_MODE: getEnv('READ_ONLY_MODE', DEFAULTS.READ_ONLY_MODE),
    EMERGENCY_STOP: getEnv('EMERGENCY_STOP', DEFAULTS.EMERGENCY_STOP),
    
    // Feature Flags - 降级路径
    FALLBACK_ON_REDIS_DOWN: getEnv('FALLBACK_ON_REDIS_DOWN', DEFAULTS.FALLBACK_ON_REDIS_DOWN) as FallbackBehavior,
    FALLBACK_ON_LOCK_FAIL: getEnv('FALLBACK_ON_LOCK_FAIL', DEFAULTS.FALLBACK_ON_LOCK_FAIL) as FallbackBehavior,
    FALLBACK_ON_AUDIT_FAIL: getEnv('FALLBACK_ON_AUDIT_FAIL', DEFAULTS.FALLBACK_ON_AUDIT_FAIL) as FallbackBehavior,
    LOCK_RETRY_COUNT: getEnv('LOCK_RETRY_COUNT', DEFAULTS.LOCK_RETRY_COUNT),
    LOCK_RETRY_DELAY_MS: getEnv('LOCK_RETRY_DELAY_MS', DEFAULTS.LOCK_RETRY_DELAY_MS),
    
    // 外部服务
    OKX_API_KEY: getEnv('OKX_API_KEY', ''),
    OKX_API_SECRET: getEnv('OKX_API_SECRET', ''),
    OKX_PASSPHRASE: getEnv('OKX_PASSPHRASE', ''),
    OKX_NETWORK: getEnv('OKX_NETWORK', DEFAULTS.OKX_NETWORK) as 'testnet' | 'mainnet',
    GITHUB_TOKEN: getEnv('GITHUB_TOKEN', ''),
    WEBHOOK_SECRET: getEnv('WEBHOOK_SECRET', ''),
    
    // 日志与监控
    LOG_LEVEL: getEnv('LOG_LEVEL', DEFAULTS.LOG_LEVEL),
    LOG_FORMAT: getEnv('LOG_FORMAT', DEFAULTS.LOG_FORMAT) as 'pretty' | 'json',
    METRICS_ENABLED: getEnv('METRICS_ENABLED', DEFAULTS.METRICS_ENABLED),
    METRICS_PORT: getEnv('METRICS_PORT', 9090),
    TRACING_ENABLED: getEnv('TRACING_ENABLED', DEFAULTS.TRACING_ENABLED),
  };
  
  // Apply environment-specific overrides
  if (config.NODE_ENV === 'production') {
    config.STRICT_COORDINATION_REQUIRED = true;
    config.ALLOW_LOCK_FALLBACK = false;
  }
  
  // Safe mode overrides everything
  if (config.SAFE_MODE || config.READ_ONLY_MODE || config.EMERGENCY_STOP) {
    config.ENABLE_REPLAY = false;
    config.ENABLE_RECOVERY_SCAN = false;
    config.ENABLE_MULTI_INSTANCE = false;
  }
  
  return config;
}

// ==================== Singleton ====================

let _config: RuntimeConfig | null = null;

export function getConfig(): RuntimeConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function reloadConfig(): RuntimeConfig {
  _config = loadConfig();
  return _config;
}

// ==================== Coordination Decision ====================

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CoordinationDecision {
  requireRedis: boolean;
  requireLock: boolean;
  requireIdempotency: boolean;
  allowFallback: boolean;
  reason: string;
}

export function decideCoordination(
  routeName: string,
  riskLevel: RiskLevel,
  config: RuntimeConfig = getConfig()
): CoordinationDecision {
  const isProd = config.NODE_ENV === 'production';
  
  // 1. Safe mode - deny all
  if (config.SAFE_MODE || config.READ_ONLY_MODE || config.EMERGENCY_STOP) {
    return {
      requireRedis: false,
      requireLock: false,
      requireIdempotency: false,
      allowFallback: false,
      reason: 'SAFE_MODE_ACTIVE',
    };
  }
  
  // 2. Production + CRITICAL - strict requirement
  if (isProd && riskLevel === 'CRITICAL' && config.STRICT_COORDINATION_REQUIRED) {
    return {
      requireRedis: true,
      requireLock: config.ENABLE_DISTRIBUTED_LOCK,
      requireIdempotency: config.ENABLE_IDEMPOTENCY,
      allowFallback: false,
      reason: 'PROD_CRITICAL_REQUIREMENT',
    };
  }
  
  // 3. Staging + HIGH/CRITICAL - recommended
  if (config.NODE_ENV === 'staging' && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) {
    return {
      requireRedis: config.ENABLE_DISTRIBUTED_LOCK,
      requireLock: config.ENABLE_DISTRIBUTED_LOCK,
      requireIdempotency: config.ENABLE_IDEMPOTENCY,
      allowFallback: config.ALLOW_LOCK_FALLBACK,
      reason: 'STAGING_RECOMMENDATION',
    };
  }
  
  // 4. Dev / LOW risk - optional
  return {
    requireRedis: false,
    requireLock: config.ENABLE_DISTRIBUTED_LOCK,
    requireIdempotency: config.ENABLE_IDEMPOTENCY,
    allowFallback: config.ALLOW_LOCK_FALLBACK,
    reason: 'NORMAL_OPERATION',
  };
}
