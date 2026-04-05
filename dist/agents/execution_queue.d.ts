/**
 * Execution Queue - 执行队列
 *
 * 职责：
 * 1. 任务入队/出队
 * 2. 排序（优先级 + 公平性）
 * 3. 超时淘汰
 * 4. 队列取消
 * 5. 队列统计
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 任务状态
 */
export type QueueTaskStatus = 'queued' | 'leased' | 'running' | 'completed' | 'failed' | 'cancelled' | 'dropped' | 'expired';
/**
 * 队列任务
 */
export interface QueueTask {
    id: string;
    teamId: string;
    taskId: string;
    role: string;
    priority: number;
    status: QueueTaskStatus;
    enqueuedAt: number;
    leasedAt?: number;
    startedAt?: number;
    completedAt?: number;
    timeoutMs?: number;
    expiresAt?: number;
    retryCount: number;
    maxRetries: number;
    data?: unknown;
    result?: unknown;
    error?: Error;
}
/**
 * 队列配置
 */
export interface ExecutionQueueConfig {
    /** 队列最大容量 */
    maxQueueSize?: number;
    /** 默认超时时间（毫秒） */
    defaultTimeoutMs?: number;
    /** 任务过期检查间隔（毫秒） */
    expiryCheckIntervalMs?: number;
    /** 优先级权重（数字越大优先级越高） */
    priorityWeight?: number;
}
/**
 * 队列统计
 */
export interface QueueStats {
    queuedCount: number;
    leasedCount: number;
    runningCount: number;
    totalEnqueued: number;
    totalDequeued: number;
    totalCompleted: number;
    totalFailed: number;
    totalCancelled: number;
    totalDropped: number;
    totalExpired: number;
    avgWaitTimeMs: number;
    avgExecutionTimeMs: number;
    p95WaitTimeMs: number;
    p95ExecutionTimeMs: number;
}
/**
 * 出队选项
 */
export interface DequeueOptions {
    /** 团队 ID 过滤 */
    teamId?: string;
    /** 角色过滤 */
    role?: string;
    /** 最低优先级 */
    minPriority?: number;
}
export declare class ExecutionQueue {
    private config;
    private tasks;
    private byStatus;
    private byTeam;
    private byRole;
    private stats;
    private waitTimes;
    private executionTimes;
    private expiryTimer?;
    constructor(config?: ExecutionQueueConfig);
    /**
     * 入队
     */
    enqueue(task: Omit<QueueTask, 'id' | 'status' | 'enqueuedAt' | 'retryCount'>): QueueTask;
    /**
     * 出队
     */
    dequeue(options?: DequeueOptions): QueueTask | null;
    /**
     * 标记为运行中
     */
    markRunning(taskId: string): void;
    /**
     * 标记为完成
     */
    markCompleted(taskId: string, result?: unknown): void;
    /**
     * 标记为失败
     */
    markFailed(taskId: string, error: Error): void;
    /**
     * 取消任务
     */
    cancel(taskId: string, reason?: string): boolean;
    /**
     * 取消团队的所有任务
     */
    cancelTeam(teamId: string): number;
    /**
     * 获取任务
     */
    getTask(taskId: string): QueueTask | undefined;
    /**
     * 获取团队的任务
     */
    getTeamTasks(teamId: string): QueueTask[];
    /**
     * 获取统计
     */
    getStats(): QueueStats;
    /**
     * 获取队列长度
     */
    getQueueLength(): number;
    /**
     * 清理已完成/失败的任务
     */
    cleanup(maxAgeMs?: number): number;
    /**
     * 停止过期检查
     */
    stop(): void;
    /**
     * 更新任务状态
     */
    private updateStatus;
    /**
     * 添加到索引
     */
    private addToIndex;
    /**
     * 从索引移除
     */
    private removeFromIndex;
    /**
     * 添加到状态索引
     */
    private addToStatusIndex;
    /**
     * 从状态索引移除
     */
    private removeFromStatusIndex;
    /**
     * 获取候选任务
     */
    private getCandidates;
    /**
     * 丢弃最低优先级任务
     */
    private dropLowestPriorityTask;
    /**
     * 使任务过期
     */
    private expireTask;
    /**
     * 启动过期检查
     */
    private startExpiryCheck;
    /**
     * 记录等待时间
     */
    private recordWaitTime;
    /**
     * 记录执行时间
     */
    private recordExecutionTime;
    /**
     * 计算平均值
     */
    private calculateAverage;
    /**
     * 计算 P95
     */
    private calculateP95;
    /**
     * 更新计数统计
     */
    private updateCountStats;
}
/**
 * 创建执行队列
 */
export declare function createExecutionQueue(config?: ExecutionQueueConfig): ExecutionQueue;
