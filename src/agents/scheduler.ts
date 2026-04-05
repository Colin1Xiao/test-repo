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

// ============================================================================
// 类型定义
// ============================================================================

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
  // 调度次数
  totalSchedules: number;
  totalAdmitted: number;
  totalRejected: number;
  totalDeferred: number;
  
  // 拒绝原因分布
  rejectedByReason: Record<string, number>;
  
  // 公平性
  teamDistribution: Record<string, number>;
  roleDistribution: Record<string, number>;
  
  // 性能
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

// ============================================================================
// 调度器
// ============================================================================

export class Scheduler {
  private config: Required<SchedulerConfig>;
  private queue: ExecutionQueue;
  private limiter: ConcurrencyLimiter;
  private budgetGovernor?: BudgetGovernor;
  
  // 公平性跟踪
  private teamTrackers: Map<string, TeamFairnessTracker> = new Map();
  
  // 统计
  private stats: SchedulerStats = {
    totalSchedules: 0,
    totalAdmitted: 0,
    totalRejected: 0,
    totalDeferred: 0,
    rejectedByReason: {},
    teamDistribution: {},
    roleDistribution: {},
    avgScheduleTimeMs: 0,
  };
  
  // 调度定时器
  private scheduleTimer?: NodeJS.Timeout;
  
  constructor(
    queue: ExecutionQueue,
    limiter: ConcurrencyLimiter,
    config?: SchedulerConfig,
    budgetGovernor?: BudgetGovernor
  ) {
    this.config = {
      scheduleIntervalMs: config?.scheduleIntervalMs || 100,
      maxBatchSize: config?.maxBatchSize || 10,
      fairnessWeight: config?.fairnessWeight || 0.3,
      priorityThreshold: config?.priorityThreshold || 0,
    };
    
    this.queue = queue;
    this.limiter = limiter;
    this.budgetGovernor = budgetGovernor;
  }
  
  /**
   * 开始调度循环
   */
  start(): void {
    this.scheduleTimer = setInterval(() => {
      this.scheduleCycle();
    }, this.config.scheduleIntervalMs);
  }
  
  /**
   * 停止调度循环
   */
  stop(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = undefined;
    }
  }
  
  /**
   * 单次调度决策
   */
  decide(task: QueueTask): ScheduleDecision {
    const startTime = Date.now();
    
    // Step 1: 检查依赖
    const dependencyCheck = this.checkDependencies(task);
    if (!dependencyCheck.satisfied) {
      return this.createDecision(task.id, false, dependencyCheck.reason, undefined, task.priority);
    }
    
    // Step 2: 检查预算
    if (this.budgetGovernor) {
      const budgetCheck = this.budgetGovernor.checkAdmission(task.teamId, task.role);
      if (!budgetCheck.admitted) {
        this.recordRejection('budget_exceeded');
        return this.createDecision(task.id, false, 'Budget exceeded', undefined, task.priority);
      }
    }
    
    // Step 3: 检查并发限制
    const concurrencyCheck = this.checkConcurrency(task);
    if (!concurrencyCheck.available) {
      this.recordRejection('concurrency_limit');
      return this.createDecision(
        task.id,
        false,
        'Concurrency limit reached',
        concurrencyCheck.suggestedDelayMs,
        task.priority
      );
    }
    
    // Step 4: 公平性检查
    const fairnessCheck = this.checkFairness(task);
    if (!fairnessCheck.admitted) {
      this.recordRejection('fairness_defer');
      return this.createDecision(
        task.id,
        false,
        'Deferred for fairness',
        fairnessCheck.suggestedDelayMs,
        task.priority
      );
    }
    
    // 允许执行
    this.recordAdmission(task);
    return this.createDecision(task.id, true, undefined, undefined, task.priority);
  }
  
  /**
   * 调度周期
   */
  private scheduleCycle(): void {
    const startTime = Date.now();
    
    let admitted = 0;
    
    // 批处理
    for (let i = 0; i < this.config.maxBatchSize; i++) {
      // 从队列获取候选任务
      const task = this.queue.dequeue();
      
      if (!task) {
        break; // 队列为空
      }
      
      // 做出调度决策
      const decision = this.decide(task);
      
      if (decision.admitted) {
        // 允许执行
        this.queue.markRunning(task.id);
        admitted++;
      } else {
        // 拒绝/延迟
        if (decision.suggestedDelayMs) {
          // 延迟后重新入队
          setTimeout(() => {
            if (this.queue.getTask(task.id)?.status === 'leased') {
              // 任务还在 leased 状态，重新入队
              // 实际应该有更复杂的状态恢复逻辑
            }
          }, decision.suggestedDelayMs);
        }
        
        this.stats.totalDeferred++;
      }
    }
    
    // 更新统计
    this.stats.totalSchedules++;
    this.stats.totalAdmitted += admitted;
    
    const scheduleTime = Date.now() - startTime;
    this.updateAvgScheduleTime(scheduleTime);
  }
  
  /**
   * 检查依赖
   */
  private checkDependencies(task: QueueTask): { satisfied: boolean; reason?: string } {
    // 获取团队任务
    const teamTasks = this.queue.getTeamTasks(task.teamId);
    
    // 简单依赖检查：同一团队中是否有未完成的前置任务
    // 实际应该根据 task.dependsOn 字段检查
    
    // 这里简化处理：如果团队中有 running 的任务，且当前任务是 verifier 类型
    // 则等待其他任务完成
    if (task.role === 'verify_agent') {
      const runningTasks = teamTasks.filter(
        t => t.status === 'running' || t.status === 'leased'
      );
      
      if (runningTasks.length > 0) {
        return {
          satisfied: false,
          reason: `Waiting for ${runningTasks.length} tasks to complete before verification`,
        };
      }
    }
    
    return { satisfied: true };
  }
  
  /**
   * 检查并发限制
   */
  private checkConcurrency(task: QueueTask): { available: boolean; suggestedDelayMs?: number } {
    const canAcquire = this.limiter.canAcquire(task.teamId, task.role);
    
    if (!canAcquire) {
      // 计算建议延迟
      const currentConcurrency = this.limiter.getCurrentGlobal();
      const maxConcurrency = this.limiter.getStats().maxGlobal;
      
      // 基于当前并发比例计算延迟
      const utilization = currentConcurrency / maxConcurrency;
      const baseDelay = 100;
      const suggestedDelay = Math.floor(baseDelay * utilization * 10);
      
      return {
        available: false,
        suggestedDelayMs: Math.min(suggestedDelay, 5000), // 最多 5 秒
      };
    }
    
    return { available: true };
  }
  
  /**
   * 检查公平性
   */
  private checkFairness(task: QueueTask): { admitted: boolean; suggestedDelayMs?: number } {
    // 获取团队跟踪器
    let tracker = this.teamTrackers.get(task.teamId);
    
    if (!tracker) {
      tracker = {
        lastScheduledAt: 0,
        scheduledCount: 0,
        waitingCount: 0,
      };
      this.teamTrackers.set(task.teamId, tracker);
    }
    
    const now = Date.now();
    
    // 计算团队权重（基于最近调度次数）
    const teamWeight = 1 / (1 + tracker.scheduledCount);
    
    // 计算所有团队平均调度次数
    const allTrackers = Array.from(this.teamTrackers.values());
    const avgScheduled = allTrackers.reduce((sum, t) => sum + t.scheduledCount, 0) / allTrackers.length;
    
    // 如果该团队调度次数远高于平均，延迟
    if (tracker.scheduledCount > avgScheduled * 2 && tracker.scheduledCount > 3) {
      // 计算延迟时间
      const timeSinceLastSchedule = now - tracker.lastScheduledAt;
      const minInterval = 1000; // 最少 1 秒间隔
      
      if (timeSinceLastSchedule < minInterval) {
        return {
          admitted: false,
          suggestedDelayMs: minInterval - timeSinceLastSchedule,
        };
      }
    }
    
    return { admitted: true };
  }
  
  /**
   * 创建调度决策
   */
  private createDecision(
    taskId: string,
    admitted: boolean,
    rejectReason?: string,
    suggestedDelayMs?: number,
    priority?: number
  ): ScheduleDecision {
    return {
      taskId,
      admitted,
      rejectReason,
      suggestedDelayMs,
      priority: priority || 0,
    };
  }
  
  /**
   * 记录接纳
   */
  private recordAdmission(task: QueueTask): void {
    // 更新团队跟踪器
    const tracker = this.teamTrackers.get(task.teamId);
    if (tracker) {
      tracker.lastScheduledAt = Date.now();
      tracker.scheduledCount++;
    }
    
    // 更新统计
    this.stats.teamDistribution[task.teamId] = 
      (this.stats.teamDistribution[task.teamId] || 0) + 1;
    
    this.stats.roleDistribution[task.role] = 
      (this.stats.roleDistribution[task.role] || 0) + 1;
  }
  
  /**
   * 记录拒绝
   */
  private recordRejection(reason: string): void {
    this.stats.totalRejected++;
    this.stats.rejectedByReason[reason] = 
      (this.stats.rejectedByReason[reason] || 0) + 1;
  }
  
  /**
   * 更新平均调度时间
   */
  private updateAvgScheduleTime(timeMs: number): void {
    const total = this.stats.totalSchedules;
    const oldAvg = this.stats.avgScheduleTimeMs;
    
    this.stats.avgScheduleTimeMs = ((oldAvg * (total - 1)) + timeMs) / total;
  }
  
  /**
   * 获取统计
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }
  
  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalSchedules: 0,
      totalAdmitted: 0,
      totalRejected: 0,
      totalDeferred: 0,
      rejectedByReason: {},
      teamDistribution: {},
      roleDistribution: {},
      avgScheduleTimeMs: 0,
    };
  }
  
  /**
   * 获取团队公平性信息
   */
  getTeamFairness(teamId: string): TeamFairnessTracker | undefined {
    return this.teamTrackers.get(teamId);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建调度器
 */
export function createScheduler(
  queue: ExecutionQueue,
  limiter: ConcurrencyLimiter,
  config?: SchedulerConfig,
  budgetGovernor?: BudgetGovernor
): Scheduler {
  return new Scheduler(queue, limiter, config, budgetGovernor);
}
