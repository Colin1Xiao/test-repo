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

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 任务状态
 */
export type QueueTaskStatus =
  | 'queued'       // 在队列中等待
  | 'leased'       // 已租出，准备执行
  | 'running'      // 执行中
  | 'completed'    // 完成
  | 'failed'       // 失败
  | 'cancelled'    // 被取消
  | 'dropped'      // 被丢弃（超时/淘汰）
  | 'expired';     // 已过期

/**
 * 队列任务
 */
export interface QueueTask {
  // 身份
  id: string;
  teamId: string;
  taskId: string;
  role: string;
  
  // 优先级
  priority: number;
  
  // 状态
  status: QueueTaskStatus;
  
  // 时间
  enqueuedAt: number;
  leasedAt?: number;
  startedAt?: number;
  completedAt?: number;
  
  // 超时
  timeoutMs?: number;
  expiresAt?: number;
  
  // 重试
  retryCount: number;
  maxRetries: number;
  
  // 数据
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
  // 当前状态
  queuedCount: number;
  leasedCount: number;
  runningCount: number;
  
  // 历史
  totalEnqueued: number;
  totalDequeued: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  totalDropped: number;
  totalExpired: number;
  
  // 性能
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

// ============================================================================
// 执行队列
// ============================================================================

export class ExecutionQueue {
  private config: Required<ExecutionQueueConfig>;
  
  // 任务存储
  private tasks: Map<string, QueueTask> = new Map();
  
  // 按状态索引
  private byStatus: Map<QueueTaskStatus, Set<string>> = new Map();
  
  // 按团队索引
  private byTeam: Map<string, Set<string>> = new Map();
  
  // 按角色索引
  private byRole: Map<string, Set<string>> = new Map();
  
  // 统计
  private stats: QueueStats = {
    queuedCount: 0,
    leasedCount: 0,
    runningCount: 0,
    totalEnqueued: 0,
    totalDequeued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalCancelled: 0,
    totalDropped: 0,
    totalExpired: 0,
    avgWaitTimeMs: 0,
    avgExecutionTimeMs: 0,
    p95WaitTimeMs: 0,
    p95ExecutionTimeMs: 0,
  };
  
  // 等待时间记录（用于 P95 计算）
  private waitTimes: number[] = [];
  private executionTimes: number[] = [];
  
  // 过期检查定时器
  private expiryTimer?: NodeJS.Timeout;
  
  constructor(config: ExecutionQueueConfig = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      defaultTimeoutMs: config.defaultTimeoutMs || 300000, // 5 分钟
      expiryCheckIntervalMs: config.expiryCheckIntervalMs || 10000, // 10 秒
      priorityWeight: config.priorityWeight || 1,
    };
    
    // 初始化状态索引
    const statuses: QueueTaskStatus[] = [
      'queued', 'leased', 'running', 'completed',
      'failed', 'cancelled', 'dropped', 'expired'
    ];
    
    for (const status of statuses) {
      this.byStatus.set(status, new Set());
    }
    
    // 启动过期检查
    this.startExpiryCheck();
  }
  
  /**
   * 入队
   */
  enqueue(task: Omit<QueueTask, 'id' | 'status' | 'enqueuedAt' | 'retryCount'>): QueueTask {
    // 检查队列容量
    const queuedCount = this.byStatus.get('queued')!.size;
    if (queuedCount >= this.config.maxQueueSize) {
      // 队列已满，丢弃最低优先级的任务
      this.dropLowestPriorityTask();
    }
    
    // 创建任务
    const queueTask: QueueTask = {
      ...task,
      id: task.taskId,
      status: 'queued',
      enqueuedAt: Date.now(),
      retryCount: 0,
      expiresAt: Date.now() + (task.timeoutMs || this.config.defaultTimeoutMs),
    };
    
    // 存储任务
    this.tasks.set(queueTask.id, queueTask);
    
    // 更新索引
    this.addToIndex(queueTask);
    
    // 更新统计
    this.stats.totalEnqueued++;
    this.stats.queuedCount = this.byStatus.get('queued')!.size;
    
    return queueTask;
  }
  
  /**
   * 出队
   */
  dequeue(options?: DequeueOptions): QueueTask | null {
    // 获取候选任务
    const candidates = this.getCandidates(options);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 按优先级排序（高优先级优先）
    candidates.sort((a, b) => {
      // 先按优先级
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      
      // 优先级相同，按等待时间（公平性）
      return a.enqueuedAt - b.enqueuedAt;
    });
    
    // 取出最高优先级的任务
    const task = candidates[0];
    this.updateStatus(task, 'leased');
    task.leasedAt = Date.now();
    
    // 更新统计
    this.stats.totalDequeued++;
    this.stats.leasedCount = this.byStatus.get('leased')!.size;
    
    // 记录等待时间
    const waitTime = task.leasedAt - task.enqueuedAt;
    this.recordWaitTime(waitTime);
    
    return task;
  }
  
  /**
   * 标记为运行中
   */
  markRunning(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'leased') {
      throw new Error(`Task ${taskId} not in leased status`);
    }
    
    this.updateStatus(task, 'running');
    task.startedAt = Date.now();
    
    this.stats.runningCount = this.byStatus.get('running')!.size;
  }
  
  /**
   * 标记为完成
   */
  markCompleted(taskId: string, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.updateStatus(task, 'completed');
    task.completedAt = Date.now();
    task.result = result;
    
    this.stats.totalCompleted++;
    this.stats.runningCount = this.byStatus.get('running')!.size;
    
    // 记录执行时间
    if (task.startedAt) {
      const execTime = task.completedAt - task.startedAt;
      this.recordExecutionTime(execTime);
    }
  }
  
  /**
   * 标记为失败
   */
  markFailed(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.updateStatus(task, 'failed');
    task.completedAt = Date.now();
    task.error = error;
    
    this.stats.totalFailed++;
    this.stats.runningCount = this.byStatus.get('running')!.size;
  }
  
  /**
   * 取消任务
   */
  cancel(taskId: string, reason?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return false;
    }
    
    this.updateStatus(task, 'cancelled');
    task.completedAt = Date.now();
    task.error = error ? new Error(`Cancelled: ${reason}`) : new Error('Cancelled');
    
    this.stats.totalCancelled++;
    this.updateCountStats();
    
    return true;
  }
  
  /**
   * 取消团队的所有任务
   */
  cancelTeam(teamId: string): number {
    const teamTasks = this.byTeam.get(teamId);
    if (!teamTasks) return 0;
    
    let cancelled = 0;
    
    for (const taskId of teamTasks) {
      if (this.cancel(taskId, `Team ${teamId} cancelled`)) {
        cancelled++;
      }
    }
    
    return cancelled;
  }
  
  /**
   * 获取任务
   */
  getTask(taskId: string): QueueTask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * 获取团队的任务
   */
  getTeamTasks(teamId: string): QueueTask[] {
    const taskIds = this.byTeam.get(teamId);
    if (!taskIds) return [];
    
    return Array.from(taskIds)
      .map(id => this.tasks.get(id))
      .filter((t): t is QueueTask => t !== undefined);
  }
  
  /**
   * 获取统计
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }
  
  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.byStatus.get('queued')!.size;
  }
  
  /**
   * 清理已完成/失败的任务
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const task of this.tasks.values()) {
      if (!task.completedAt) continue;
      
      const age = now - task.completedAt;
      if (age > maxAgeMs) {
        this.tasks.delete(task.id);
        this.removeFromIndex(task);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 停止过期检查
   */
  stop(): void {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 更新任务状态
   */
  private updateStatus(task: QueueTask, newStatus: QueueTaskStatus): void {
    this.removeFromStatusIndex(task);
    task.status = newStatus;
    this.addToStatusIndex(task);
  }
  
  /**
   * 添加到索引
   */
  private addToIndex(task: QueueTask): void {
    this.addToStatusIndex(task);
    
    // 团队索引
    if (!this.byTeam.has(task.teamId)) {
      this.byTeam.set(task.teamId, new Set());
    }
    this.byTeam.get(task.teamId)!.add(task.id);
    
    // 角色索引
    if (!this.byRole.has(task.role)) {
      this.byRole.set(task.role, new Set());
    }
    this.byRole.get(task.role)!.add(task.id);
  }
  
  /**
   * 从索引移除
   */
  private removeFromIndex(task: QueueTask): void {
    this.removeFromStatusIndex(task);
    
    this.byTeam.get(task.teamId)?.delete(task.id);
    this.byRole.get(task.role)?.delete(task.id);
  }
  
  /**
   * 添加到状态索引
   */
  private addToStatusIndex(task: QueueTask): void {
    this.byStatus.get(task.status)!.add(task.id);
  }
  
  /**
   * 从状态索引移除
   */
  private removeFromStatusIndex(task: QueueTask): void {
    this.byStatus.get(task.status)?.delete(task.id);
  }
  
  /**
   * 获取候选任务
   */
  private getCandidates(options?: DequeueOptions): QueueTask[] {
    const queuedIds = this.byStatus.get('queued')!;
    const candidates: QueueTask[] = [];
    
    for (const id of queuedIds) {
      const task = this.tasks.get(id);
      if (!task) continue;
      
      // 检查过期
      if (task.expiresAt && Date.now() > task.expiresAt) {
        this.expireTask(task);
        continue;
      }
      
      // 过滤
      if (options?.teamId && task.teamId !== options.teamId) continue;
      if (options?.role && task.role !== options.role) continue;
      if (options?.minPriority && task.priority < options.minPriority) continue;
      
      candidates.push(task);
    }
    
    return candidates;
  }
  
  /**
   * 丢弃最低优先级任务
   */
  private dropLowestPriorityTask(): void {
    const queuedIds = this.byStatus.get('queued')!;
    if (queuedIds.size === 0) return;
    
    let lowestPriorityTask: QueueTask | null = null;
    
    for (const id of queuedIds) {
      const task = this.tasks.get(id);
      if (!task) continue;
      
      if (!lowestPriorityTask || task.priority < lowestPriorityTask.priority) {
        lowestPriorityTask = task;
      }
    }
    
    if (lowestPriorityTask) {
      this.updateStatus(lowestPriorityTask, 'dropped');
      this.stats.totalDropped++;
      this.stats.queuedCount = this.byStatus.get('queued')!.size;
    }
  }
  
  /**
   * 使任务过期
   */
  private expireTask(task: QueueTask): void {
    this.updateStatus(task, 'expired');
    this.stats.totalExpired++;
    this.stats.queuedCount = this.byStatus.get('queued')!.size;
  }
  
  /**
   * 启动过期检查
   */
  private startExpiryCheck(): void {
    this.expiryTimer = setInterval(() => {
      const now = Date.now();
      
      for (const task of this.tasks.values()) {
        if (task.status === 'queued' && task.expiresAt && now > task.expiresAt) {
          this.expireTask(task);
        }
      }
    }, this.config.expiryCheckIntervalMs);
  }
  
  /**
   * 记录等待时间
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    
    // 保留最近 1000 个样本
    if (this.waitTimes.length > 1000) {
      this.waitTimes.shift();
    }
    
    // 更新统计
    this.stats.avgWaitTimeMs = this.calculateAverage(this.waitTimes);
    this.stats.p95WaitTimeMs = this.calculateP95(this.waitTimes);
  }
  
  /**
   * 记录执行时间
   */
  private recordExecutionTime(execTime: number): void {
    this.executionTimes.push(execTime);
    
    // 保留最近 1000 个样本
    if (this.executionTimes.length > 1000) {
      this.executionTimes.shift();
    }
    
    // 更新统计
    this.stats.avgExecutionTimeMs = this.calculateAverage(this.executionTimes);
    this.stats.p95ExecutionTimeMs = this.calculateP95(this.executionTimes);
  }
  
  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * 计算 P95
   */
  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    
    return sorted[Math.min(index, sorted.length - 1)];
  }
  
  /**
   * 更新计数统计
   */
  private updateCountStats(): void {
    this.stats.queuedCount = this.byStatus.get('queued')!.size;
    this.stats.leasedCount = this.byStatus.get('leased')!.size;
    this.stats.runningCount = this.byStatus.get('running')!.size;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建执行队列
 */
export function createExecutionQueue(config?: ExecutionQueueConfig): ExecutionQueue {
  return new ExecutionQueue(config);
}
