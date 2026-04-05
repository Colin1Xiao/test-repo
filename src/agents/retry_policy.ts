/**
 * Retry Policy - 重试策略
 * 
 * 职责：
 * 1. maxRetries 配置
 * 2. retryable error classification
 * 3. exponential backoff 或固定退避
 * 4. timeout retry 可开关
 * 5. provider error / transient error 分类
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 重试策略配置
 */
export interface RetryPolicyConfig {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 初始退避时间（毫秒） */
  initialBackoffMs?: number;
  
  /** 退避乘数（指数退避） */
  backoffMultiplier?: number;
  
  /** 最大退避时间（毫秒） */
  maxBackoffMs?: number;
  
  /** 是否重试超时错误 */
  retryTimeout?: boolean;
  
  /** 是否重试速率限制错误 */
  retryRateLimit?: boolean;
}

/**
 * 重试上下文
 */
export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  lastError?: Error;
  backoffMs: number;
}

/**
 * 可重试错误类型
 */
export enum RetryableErrorType {
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  CONNECTION = 'connection',
  SERVER_ERROR = 'server_error',
  TRANSIENT = 'transient',
  NOT_RETRYABLE = 'not_retryable',
}

// ============================================================================
// 重试策略
// ============================================================================

export class RetryPolicy {
  private config: Required<RetryPolicyConfig>;
  
  constructor(config: RetryPolicyConfig = { maxRetries: 3 }) {
    this.config = {
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs || 1000,
      backoffMultiplier: config.backoffMultiplier || 2,
      maxBackoffMs: config.maxBackoffMs || 30000,
      retryTimeout: config.retryTimeout ?? false,
      retryRateLimit: config.retryRateLimit ?? true,
    };
  }
  
  /**
   * 判断错误是否可重试
   */
  isRetryable(error: any): boolean {
    if (!error) return false;
    
    const message = (error.message || '').toLowerCase();
    const type = (error.type || '').toLowerCase();
    
    // 检查错误类型
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case RetryableErrorType.TIMEOUT:
        return this.config.retryTimeout;
      case RetryableErrorType.RATE_LIMIT:
        return this.config.retryRateLimit;
      case RetryableErrorType.CONNECTION:
      case RetryableErrorType.SERVER_ERROR:
      case RetryableErrorType.TRANSIENT:
        return true;
      default:
        return false;
    }
  }
  
  /**
   * 分类错误类型
   */
  classifyError(error: any): RetryableErrorType {
    if (!error) return RetryableErrorType.NOT_RETRYABLE;
    
    const message = (error.message || '').toLowerCase();
    const type = (error.type || '').toLowerCase();
    const status = error.status || error.statusCode;
    
    // 超时
    if (message.includes('timeout') || type.includes('timeout')) {
      return RetryableErrorType.TIMEOUT;
    }
    
    // 速率限制
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      status === 429
    ) {
      return RetryableErrorType.RATE_LIMIT;
    }
    
    // 连接错误
    if (
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('fetch') ||
      type.includes('connection')
    ) {
      return RetryableErrorType.CONNECTION;
    }
    
    // 服务器错误
    if (status >= 500 && status < 600) {
      return RetryableErrorType.SERVER_ERROR;
    }
    
    // 瞬时错误
    if (
      message.includes('transient') ||
      message.includes('temporary') ||
      message.includes('retry')
    ) {
      return RetryableErrorType.TRANSIENT;
    }
    
    return RetryableErrorType.NOT_RETRYABLE;
  }
  
  /**
   * 计算退避时间
   */
  calculateBackoff(attempt: number): number {
    const backoff = this.config.initialBackoffMs * 
                    Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    return Math.min(backoff, this.config.maxBackoffMs);
  }
  
  /**
   * 获取重试上下文
   */
  getRetryContext(attempt: number, lastError?: Error): RetryContext {
    return {
      attempt,
      maxAttempts: this.config.maxRetries + 1,
      lastError,
      backoffMs: this.calculateBackoff(attempt),
    };
  }
  
  /**
   * 等待退避时间
   */
  async backoff(attempt: number): Promise<void> {
    const backoffMs = this.calculateBackoff(attempt);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
  }
}

// ============================================================================
// 执行带重试的函数
// ============================================================================

/**
 * 执行带重试的函数
 * 
 * @param fn - 要执行的函数
 * @param policy - 重试策略
 * @param options - 额外选项
 * @returns 函数执行结果
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  options?: {
    timeoutMs?: number;
    onRetry?: (context: RetryContext) => void;
  }
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= policy.config.maxRetries + 1; attempt++) {
    try {
      // 执行函数
      return await fn();
      
    } catch (error) {
      lastError = error;
      
      // 判断是否可重试
      if (!policy.isRetryable(error)) {
        throw error;
      }
      
      // 达到最大重试次数
      if (attempt >= policy.config.maxRetries + 1) {
        throw error;
      }
      
      // 触发重试回调
      const context = policy.getRetryContext(attempt, error as Error);
      options?.onRetry?.(context);
      
      // 等待退避时间
      await policy.backoff(attempt);
    }
  }
  
  throw lastError;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建重试策略
 */
export function createRetryPolicy(config?: RetryPolicyConfig): RetryPolicy {
  return new RetryPolicy(config);
}

/**
 * 默认重试策略（2 次重试，指数退避）
 */
export const DEFAULT_RETRY_POLICY = new RetryPolicy({
  maxRetries: 2,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 10000,
  retryTimeout: false,
  retryRateLimit: true,
});

/**
 * 激进重试策略（5 次重试，适合不稳定环境）
 */
export const AGGRESSIVE_RETRY_POLICY = new RetryPolicy({
  maxRetries: 5,
  initialBackoffMs: 500,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  retryTimeout: true,
  retryRateLimit: true,
});

/**
 * 保守重试策略（1 次重试，适合生产环境）
 */
export const CONSERVATIVE_RETRY_POLICY = new RetryPolicy({
  maxRetries: 1,
  initialBackoffMs: 2000,
  backoffMultiplier: 1,
  maxBackoffMs: 5000,
  retryTimeout: false,
  retryRateLimit: true,
});
