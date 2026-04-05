/**
 * Circuit Breaker - 熔断器
 *
 * 职责：
 * 1. closed（正常）
 * 2. open（熔断）
 * 3. half-open（半开）
 * 4. provider 报错率高时短路
 * 5. 某类角色异常率过高时暂停调度
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 熔断器状态
 */
export type CircuitState = 'closed' | 'open' | 'half_open';
/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
    /** 失败率阈值（百分比） */
    failureThreshold?: number;
    /** 超时阈值（百分比） */
    timeoutThreshold?: number;
    /** 最小调用次数（达到后才开始计算失败率） */
    minCalls?: number;
    /** 熔断持续时间（毫秒） */
    openDurationMs?: number;
    /** 半开状态最大调用次数 */
    halfOpenMaxCalls?: number;
    /** 半开状态成功次数阈值（达到后关闭熔断） */
    halfOpenSuccessThreshold?: number;
}
/**
 * 熔断器统计
 */
export interface CircuitBreakerStats {
    state: CircuitState;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    timedOutCalls: number;
    failureRate: number;
    timeoutRate: number;
    lastFailureAt?: number;
    lastSuccessAt?: number;
    openedAt?: number;
    halfOpenedAt?: number;
    totalOpens: number;
    totalCloses: number;
    totalHalfOpens: number;
}
export declare class CircuitBreaker {
    private config;
    private state;
    private calls;
    private halfOpenCalls;
    private halfOpenSuccesses;
    private stats;
    constructor(config?: CircuitBreakerConfig);
    /**
     * 执行受保护的函数
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * 记录成功
     */
    recordSuccess(): void;
    /**
     * 记录失败
     */
    recordFailure(isTimeout?: boolean): void;
    /**
     * 获取当前状态
     */
    getState(): CircuitState;
    /**
     * 获取统计
     */
    getStats(): CircuitBreakerStats;
    /**
     * 手动打开熔断
     */
    open(): void;
    /**
     * 手动关闭熔断
     */
    close(): void;
    /**
     * 重置熔断器
     */
    reset(): void;
    /**
     * 检查状态
     */
    private checkState;
    /**
     * 切换到半开状态
     */
    private halfOpen;
    /**
     * 修剪旧的调用记录
     */
    private pruneOldCalls;
    /**
     * 更新失败率
     */
    private updateRates;
}
export declare class CircuitBreakerManager {
    private breakers;
    /**
     * 获取或创建熔断器
     */
    getOrCreate(key: string, config?: CircuitBreakerConfig): CircuitBreaker;
    /**
     * 获取所有熔断器状态
     */
    getAllStates(): Record<string, CircuitState>;
    /**
     * 获取所有统计
     */
    getAllStats(): Record<string, CircuitBreakerStats>;
    /**
     * 重置所有熔断器
     */
    resetAll(): void;
    /**
     * 移除熔断器
     */
    remove(key: string): void;
}
/**
 * 创建熔断器
 */
export declare function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker;
/**
 * 创建熔断器管理器
 */
export declare function createCircuitBreakerManager(): CircuitBreakerManager;
