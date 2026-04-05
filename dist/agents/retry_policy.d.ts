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
export declare enum RetryableErrorType {
    TIMEOUT = "timeout",
    RATE_LIMIT = "rate_limit",
    CONNECTION = "connection",
    SERVER_ERROR = "server_error",
    TRANSIENT = "transient",
    NOT_RETRYABLE = "not_retryable"
}
export declare class RetryPolicy {
    private config;
    constructor(config?: RetryPolicyConfig);
    /**
     * 判断错误是否可重试
     */
    isRetryable(error: any): boolean;
    /**
     * 分类错误类型
     */
    classifyError(error: any): RetryableErrorType;
    /**
     * 计算退避时间
     */
    calculateBackoff(attempt: number): number;
    /**
     * 获取重试上下文
     */
    getRetryContext(attempt: number, lastError?: Error): RetryContext;
    /**
     * 等待退避时间
     */
    backoff(attempt: number): Promise<void>;
}
/**
 * 执行带重试的函数
 *
 * @param fn - 要执行的函数
 * @param policy - 重试策略
 * @param options - 额外选项
 * @returns 函数执行结果
 */
export declare function executeWithRetry<T>(fn: () => Promise<T>, policy: RetryPolicy, options?: {
    timeoutMs?: number;
    onRetry?: (context: RetryContext) => void;
}): Promise<T>;
/**
 * 创建重试策略
 */
export declare function createRetryPolicy(config?: RetryPolicyConfig): RetryPolicy;
/**
 * 默认重试策略（2 次重试，指数退避）
 */
export declare const DEFAULT_RETRY_POLICY: RetryPolicy;
/**
 * 激进重试策略（5 次重试，适合不稳定环境）
 */
export declare const AGGRESSIVE_RETRY_POLICY: RetryPolicy;
/**
 * 保守重试策略（1 次重试，适合生产环境）
 */
export declare const CONSERVATIVE_RETRY_POLICY: RetryPolicy;
