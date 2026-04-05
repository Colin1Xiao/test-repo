/**
 * Concurrency Limiter - 并发限制器
 *
 * 职责：
 * 1. 控制同时运行的 subagent 数量
 * 2. 三层限制：global / per-team / per-role
 * 3. 资源获取/释放
 * 4. 等待队列管理
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 并发限制配置
 */
export interface ConcurrencyConfig {
    /** 全局最大并发数 */
    maxGlobalConcurrency: number;
    /** 单团队最大并发数 */
    maxTeamConcurrency?: number;
    /** 单角色最大并发数 */
    maxRoleConcurrency?: Record<string, number>;
}
/**
 * 资源许可
 */
export interface ConcurrencyPermit {
    /** 团队 ID */
    teamId: string;
    /** 角色 */
    role: string;
    /** 获取时间 */
    acquiredAt: number;
    /** 释放函数 */
    release: () => void;
}
/**
 * 等待队列项
 */
export interface WaitQueueItem {
    teamId: string;
    role: string;
    priority: number;
    enqueuedAt: number;
    resolve: (permit: ConcurrencyPermit) => void;
    reject: (error: Error) => void;
    timeoutMs?: number;
}
/**
 * 并发统计
 */
export interface ConcurrencyStats {
    currentGlobal: number;
    currentByTeam: Record<string, number>;
    currentByRole: Record<string, number>;
    maxGlobal: number;
    maxByTeam: Record<string, number>;
    maxByRole: Record<string, number>;
    waitingCount: number;
    avgWaitTimeMs: number;
    totalAcquired: number;
    totalReleased: number;
    totalRejected: number;
}
export declare class ConcurrencyLimiter {
    private config;
    private globalCount;
    private teamCounts;
    private roleCounts;
    private waitQueue;
    private stats;
    constructor(config: ConcurrencyConfig);
    /**
     * 获取并发许可
     *
     * @param teamId - 团队 ID
     * @param role - 角色
     * @param options - 选项
     * @returns 许可（包含释放函数）
     */
    acquire(teamId: string, role: string, options?: {
        priority?: number;
        timeoutMs?: number;
    }): Promise<ConcurrencyPermit>;
    /**
     * 检查是否可获取许可
     */
    canAcquire(teamId: string, role: string): boolean;
    /**
     * 执行获取
     */
    private doAcquire;
    /**
     * 释放许可
     */
    release(permit: ConcurrencyPermit): void;
    /**
     * 处理等待队列
     */
    private processWaitQueue;
    /**
     * 更新平均等待时间
     */
    private updateAvgWaitTime;
    /**
     * 获取统计信息
     */
    getStats(): ConcurrencyStats;
    /**
     * 获取当前全局并发数
     */
    getCurrentGlobal(): number;
    /**
     * 获取团队当前并发数
     */
    getCurrentTeamConcurrency(teamId: string): number;
    /**
     * 获取角色当前并发数
     */
    getCurrentRoleConcurrency(role: string): number;
    /**
     * 获取等待队列长度
     */
    getWaitQueueLength(): number;
    /**
     * 取消团队的等待项
     */
    cancelTeamWaits(teamId: string): void;
    /**
     * 重置统计
     */
    resetStats(): void;
}
/**
 * 创建并发限制器
 */
export declare function createConcurrencyLimiter(config: ConcurrencyConfig): ConcurrencyLimiter;
/**
 * 默认配置（适合中等规模系统）
 */
export declare const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig;
/**
 * 保守配置（适合生产环境）
 */
export declare const CONSERVATIVE_CONCURRENCY_CONFIG: ConcurrencyConfig;
/**
 * 激进配置（适合开发/测试）
 */
export declare const AGGRESSIVE_CONCURRENCY_CONFIG: ConcurrencyConfig;
