/**
 * Scheduler - 调度器
 *
 * 职责：
 * 1. dependency-aware scheduling
 * 2. priority scheduling
 * 3. fair scheduling
 * 4. budget-aware admission
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { QueueTask, ExecutionQueue } from './execution_queue';
import type { ConcurrencyLimiter } from './concurrency_limiter';
import type { BudgetGovernor } from './budget_governor';
/**
 * 调度器配置
 */
export interface SchedulerConfig {
    /** 调度间隔（毫秒） */
    scheduleIntervalMs?: number;
    /** 最大批处理大小 */
    maxBatchSize?: number;
    /** 公平调度权重 */
    fairnessWeight?: number;
    /** 优先级阈值 */
    priorityThreshold?: number;
}
/**
 * 调度决策
 */
export interface ScheduleDecision {
    /** 任务 ID */
    taskId: string;
    /** 是否允许执行 */
    admitted: boolean;
    /** 拒绝原因 */
    rejectReason?: string;
    /** 建议延迟（毫秒） */
    suggestedDelayMs?: number;
    /** 优先级 */
    priority: number;
}
/**
 * 调度统计
 */
export interface SchedulerStats {
    totalSchedules: number;
    totalAdmitted: number;
    totalRejected: number;
    totalDeferred: number;
    rejectedByReason: Record<string, number>;
    teamDistribution: Record<string, number>;
    roleDistribution: Record<string, number>;
    avgScheduleTimeMs: number;
}
/**
 * 团队公平性跟踪
 */
interface TeamFairnessTracker {
    lastScheduledAt: number;
    scheduledCount: number;
    waitingCount: number;
}
export declare class Scheduler {
    private config;
    private queue;
    private limiter;
    private budgetGovernor?;
    private teamTrackers;
    private stats;
    private scheduleTimer?;
    constructor(queue: ExecutionQueue, limiter: ConcurrencyLimiter, config?: SchedulerConfig, budgetGovernor?: BudgetGovernor);
    /**
     * 开始调度循环
     */
    start(): void;
    /**
     * 停止调度循环
     */
    stop(): void;
    /**
     * 单次调度决策
     */
    decide(task: QueueTask): ScheduleDecision;
    /**
     * 调度周期
     */
    private scheduleCycle;
    /**
     * 检查依赖
     */
    private checkDependencies;
    /**
     * 检查并发限制
     */
    private checkConcurrency;
    /**
     * 检查公平性
     */
    private checkFairness;
    /**
     * 创建调度决策
     */
    private createDecision;
    /**
     * 记录接纳
     */
    private recordAdmission;
    /**
     * 记录拒绝
     */
    private recordRejection;
    /**
     * 更新平均调度时间
     */
    private updateAvgScheduleTime;
    /**
     * 获取统计
     */
    getStats(): SchedulerStats;
    /**
     * 重置统计
     */
    resetStats(): void;
    /**
     * 获取团队公平性信息
     */
    getTeamFairness(teamId: string): TeamFairnessTracker | undefined;
}
/**
 * 创建调度器
 */
export declare function createScheduler(queue: ExecutionQueue, limiter: ConcurrencyLimiter, config?: SchedulerConfig, budgetGovernor?: BudgetGovernor): Scheduler;
export {};
