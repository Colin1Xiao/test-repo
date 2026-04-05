/**
 * Timeout Guard - 超时守卫
 *
 * 职责：
 * 1. 包装模型调用 promise
 * 2. 超时后标记 subagent timeout
 * 3. 触发 HookBus
 * 4. 写 TaskStore
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 超时守卫配置
 */
export interface TimeoutGuardConfig {
    /** 超时时间（毫秒） */
    timeoutMs: number;
    /** 超时错误消息 */
    timeoutMessage?: string;
    /** 是否在超时时取消底层 promise */
    cancelOnTimeout?: boolean;
}
/**
 * 超时结果
 */
export interface TimeoutResult<T> {
    /** 是否超时 */
    timedOut: boolean;
    /** 结果（如果未超时） */
    result?: T;
    /** 错误（如果超时或失败） */
    error?: Error;
    /** 执行耗时 */
    durationMs: number;
}
export declare class TimeoutGuard {
    private timeoutMs;
    private timeoutMessage;
    private cancelOnTimeout;
    private startTime?;
    private timedOut;
    private abortController?;
    constructor(config: TimeoutGuardConfig | number);
    /**
     * 开始计时
     */
    start(): void;
    /**
     * 检查是否已超时
     */
    isTimedOut(): boolean;
    /**
     * 获取剩余时间（毫秒）
     */
    getRemainingTime(): number;
    /**
     * 获取已用时间（毫秒）
     */
    getElapsedTime(): number;
    /**
     * 获取中止信号
     */
    getAbortSignal(): AbortSignal | undefined;
    /**
     * 执行带超时的函数
     */
    execute<T>(fn: () => Promise<T>): Promise<TimeoutResult<T>>;
    /**
     * 包装 Promise 带超时
     */
    wrap<T>(promise: Promise<T>): Promise<T>;
    /**
     * 重置守卫
     */
    reset(): void;
}
/**
 * 超时错误类
 */
export declare class TimeoutError extends Error {
    timeoutMs: number;
    elapsedMs: number;
    constructor(timeoutMs: number, elapsedMs?: number);
}
/**
 * 执行带超时
 */
export declare function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, options?: {
    timeoutMessage?: string;
    cancelOnTimeout?: boolean;
}): Promise<T>;
/**
 * 包装 Promise 带超时
 */
export declare function timeoutPromise<T>(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T>;
/**
 * 延迟执行（可被中止）
 */
export declare function delay(ms: number, signal?: AbortSignal): Promise<void>;
