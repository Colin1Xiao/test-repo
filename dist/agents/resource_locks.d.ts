/**
 * Resource Locks - 资源锁管理
 *
 * 职责：
 * 1. exclusive lock（写锁）
 * 2. shared lock（读锁）
 * 3. lease timeout
 * 4. deadlock avoidance（简单顺序规则）
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 锁类型
 */
export type LockType = 'exclusive' | 'shared';
/**
 * 锁状态
 */
export type LockStatus = 'acquired' | 'waiting' | 'released' | 'expired' | 'failed';
/**
 * 资源锁
 */
export interface ResourceLock {
    id: string;
    resourceKey: string;
    lockType: LockType;
    ownerId: string;
    teamId: string;
    status: LockStatus;
    acquiredAt: number;
    expiresAt: number;
    leasedAt?: number;
    waitQueue: Array<{
        ownerId: string;
        teamId: string;
        lockType: LockType;
        enqueuedAt: number;
        resolve: (lock: ResourceLock) => void;
        reject: (error: Error) => void;
    }>;
}
/**
 * 锁配置
 */
export interface ResourceLocksConfig {
    /** 默认租约时间（毫秒） */
    defaultLeaseMs?: number;
    /** 最大租约时间（毫秒） */
    maxLeaseMs?: number;
    /** 锁过期检查间隔（毫秒） */
    expiryCheckIntervalMs?: number;
    /** 死锁检测启用 */
    enableDeadlockDetection?: boolean;
}
/**
 * 锁统计
 */
export interface LockStats {
    activeLocks: number;
    exclusiveLocks: number;
    sharedLocks: number;
    waitingCount: number;
    totalAcquired: number;
    totalReleased: number;
    totalExpired: number;
    totalFailed: number;
    avgWaitTimeMs: number;
    avgHoldTimeMs: number;
    deadlockDetected: number;
}
export declare class ResourceLocks {
    private config;
    private locks;
    private waitQueues;
    private ownerLocks;
    private stats;
    private waitTimes;
    private holdTimes;
    private expiryTimer?;
    constructor(config?: ResourceLocksConfig);
    /**
     * 获取锁
     */
    acquire(resourceKey: string, ownerId: string, teamId: string, lockType?: LockType, options?: {
        timeoutMs?: number;
        leaseMs?: number;
    }): Promise<ResourceLock>;
    /**
     * 释放锁
     */
    release(lockId: string): Promise<boolean>;
    /**
     * 续租锁
     */
    renew(lockId: string, additionalMs?: number): Promise<boolean>;
    /**
     * 获取锁
     */
    getLock(lockId: string): ResourceLock | undefined;
    /**
     * 获取资源的锁
     */
    getResourceLock(resourceKey: string): ResourceLock | undefined;
    /**
     * 获取持有者的所有锁
     */
    getOwnerLocks(ownerId: string): ResourceLock[];
    /**
     * 获取统计
     */
    getStats(): LockStats;
    /**
     * 停止过期检查
     */
    stop(): void;
    /**
     * 检查是否可获取锁
     */
    private canAcquire;
    /**
     * 执行获取锁
     */
    private doAcquire;
    /**
     * 处理等待队列
     */
    private processWaitQueue;
    /**
     * 检查是否会导致死锁
     */
    private wouldCauseDeadlock;
    /**
     * 启动过期检查
     */
    private startExpiryCheck;
    /**
     * 更新活跃锁统计
     */
    private updateActiveLocks;
    /**
     * 获取总等待数
     */
    private getTotalWaitingCount;
    /**
     * 记录等待时间
     */
    private recordWaitTime;
    /**
     * 记录持有时间
     */
    private recordHoldTime;
    /**
     * 计算平均值
     */
    private calculateAverage;
}
/**
 * 创建资源锁管理器
 */
export declare function createResourceLocks(config?: ResourceLocksConfig): ResourceLocks;
/**
 * 资源键生成器
 */
export declare class ResourceKeyBuilder {
    /**
     * 生成 worktree 锁键
     */
    static worktree(path: string): string;
    /**
     * 生成 repo 锁键
     */
    static repo(path: string): string;
    /**
     * 生成 artifact 锁键
     */
    static artifact(namespace: string, id: string): string;
    /**
     * 生成 patch 锁键
     */
    static patch(fileId: string): string;
}
