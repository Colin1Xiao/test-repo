/**
 * Task View - 任务视图
 * 
 * 职责：
 * 1. 从 TaskStore / AuditLog 生成任务视图
 * 2. 显示 active / blocked / completed / failed
 * 3. 支持过滤、排序、时间线摘要
 * 4. 暴露与 task 相关的基础动作
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  TaskViewModel,
  TaskView,
  TaskStatus,
  ViewFilter,
  ViewSort,
  ControlAction,
  ControlActionResult,
} from './control_types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 任务数据源
 */
export interface TaskDataSource {
  /** 获取任务列表 */
  listTasks(filter?: any): Promise<any[]>;
  
  /** 获取任务详情 */
  getTask(taskId: string): Promise<any>;
  
  /** 取消任务 */
  cancelTask(taskId: string, reason?: string): Promise<void>;
  
  /** 重试任务 */
  retryTask(taskId: string): Promise<void>;
  
  /** 暂停任务 */
  pauseTask(taskId: string): Promise<void>;
}

/**
 * 审计数据源
 */
export interface AuditDataSource {
  /** 查询审计事件 */
  queryAuditEvents(query: any): Promise<any[]>;
  
  /** 获取任务审计轨迹 */
  getTaskAuditTrail(taskId: string): Promise<any[]>;
}

/**
 * 任务视图构建器配置
 */
export interface TaskViewBuilderConfig {
  /** 最大活跃任务数 */
  maxActiveTasks?: number;
  
  /** 最大阻塞任务数 */
  maxBlockedTasks?: number;
  
  /** 最近完成任务数 */
  recentCompletedCount?: number;
  
  /** 时间窗口（毫秒） */
  timeWindowMs?: number;
}

// ============================================================================
// 任务视图构建器
// ============================================================================

export class TaskViewBuilder {
  private config: Required<TaskViewBuilderConfig>;
  private taskDataSource: TaskDataSource;
  private auditDataSource?: AuditDataSource;
  
  constructor(
    taskDataSource: TaskDataSource,
    auditDataSource?: AuditDataSource,
    config: TaskViewBuilderConfig = {}
  ) {
    this.config = {
      maxActiveTasks: config.maxActiveTasks ?? 50,
      maxBlockedTasks: config.maxBlockedTasks ?? 20,
      recentCompletedCount: config.recentCompletedCount ?? 20,
      timeWindowMs: config.timeWindowMs ?? 24 * 60 * 60 * 1000, // 24 小时
    };
    this.taskDataSource = taskDataSource;
    this.auditDataSource = auditDataSource;
  }
  
  /**
   * 构建任务视图
   */
  async buildTaskView(
    filter?: ViewFilter,
    sort?: ViewSort
  ): Promise<TaskView> {
    // 获取任务数据
    const tasks = await this.taskDataSource.listTasks(filter);
    
    // 转换为视图模型
    const viewModels = tasks.map(task => this.taskToViewModel(task));
    
    // 分类任务
    const activeTasks = viewModels.filter(t => t.status === 'running' || t.status === 'pending');
    const blockedTasks = viewModels.filter(t => t.status === 'blocked');
    const completedTasks = viewModels.filter(t => t.status === 'completed');
    const failedTasks = viewModels.filter(t => t.status === 'failed');
    
    // 排序
    if (sort) {
      this.sortTasks(activeTasks, sort);
      this.sortTasks(blockedTasks, sort);
      this.sortTasks(completedTasks, sort);
      this.sortTasks(failedTasks, sort);
    }
    
    // 限制数量
    const limitedActiveTasks = activeTasks.slice(0, this.config.maxActiveTasks);
    const limitedBlockedTasks = blockedTasks.slice(0, this.config.maxBlockedTasks);
    const limitedCompletedTasks = completedTasks.slice(0, this.config.recentCompletedCount);
    const limitedFailedTasks = failedTasks.slice(0, this.config.recentCompletedCount);
    
    // 构建时间线摘要
    const timelineSummary = await this.buildTimelineSummary();
    
    return {
      activeTasks: limitedActiveTasks,
      blockedTasks: limitedBlockedTasks,
      recentCompletedTasks: limitedCompletedTasks,
      failedTasks: limitedFailedTasks,
      totalTasks: viewModels.length,
      timelineSummary,
    };
  }
  
  /**
   * 列出活跃任务
   */
  async listActiveTasks(filter?: ViewFilter): Promise<TaskViewModel[]> {
    const view = await this.buildTaskView(filter);
    return view.activeTasks;
  }
  
  /**
   * 列出阻塞任务
   */
  async listBlockedTasks(filter?: ViewFilter): Promise<TaskViewModel[]> {
    const view = await this.buildTaskView(filter);
    return view.blockedTasks;
  }
  
  /**
   * 列出最近完成的任务
   */
  async listRecentCompletedTasks(filter?: ViewFilter): Promise<TaskViewModel[]> {
    const view = await this.buildTaskView(filter);
    return view.recentCompletedTasks;
  }
  
  /**
   * 构建任务时间线摘要
   */
  async buildTaskTimelineSummary(taskId: string): Promise<{
    events: Array<{
      timestamp: number;
      event: string;
      status?: string;
    }>;
    durationMs?: number;
    retryCount?: number;
  }> {
    if (!this.auditDataSource) {
      return { events: [] };
    }
    
    const auditTrail = await this.auditDataSource.getTaskAuditTrail(taskId);
    
    const events = auditTrail.map(event => ({
      timestamp: event.timestamp,
      event: event.eventType,
      status: event.severity,
    }));
    
    // 计算耗时
    const startTime = events[0]?.timestamp;
    const endTime = events[events.length - 1]?.timestamp;
    const durationMs = startTime && endTime ? endTime - startTime : undefined;
    
    // 计算重试次数
    const retryCount = events.filter(e => e.event === 'task.replayed').length;
    
    return { events, durationMs, retryCount };
  }
  
  /**
   * 取消任务
   */
  async cancelTask(taskId: string, reason?: string): Promise<ControlActionResult> {
    try {
      await this.taskDataSource.cancelTask(taskId, reason);
      
      return {
        success: true,
        actionType: 'cancel_task',
        targetId: taskId,
        message: `Task ${taskId} cancelled`,
        nextActions: ['retry_task'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'cancel_task',
        targetId: taskId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 重试任务
   */
  async retryTask(taskId: string): Promise<ControlActionResult> {
    try {
      await this.taskDataSource.retryTask(taskId);
      
      return {
        success: true,
        actionType: 'retry_task',
        targetId: taskId,
        message: `Task ${taskId} retry requested`,
        nextActions: ['pause_task', 'cancel_task'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'retry_task',
        targetId: taskId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 暂停任务
   */
  async pauseTask(taskId: string): Promise<ControlActionResult> {
    try {
      await this.taskDataSource.pauseTask(taskId);
      
      return {
        success: true,
        actionType: 'pause_task',
        targetId: taskId,
        message: `Task ${taskId} paused`,
        nextActions: ['resume_task', 'cancel_task'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'pause_task',
        targetId: taskId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 任务转换为视图模型
   */
  private taskToViewModel(task: any): TaskViewModel {
    const status = this.normalizeTaskStatus(task.status);
    
    return {
      taskId: task.id,
      title: task.description || task.id,
      status,
      priority: task.priority || 'medium',
      risk: task.riskLevel || 'medium',
      ownerAgent: task.agentId || 'unknown',
      createdAt: task.createdAt || Date.now(),
      updatedAt: task.updatedAt || Date.now(),
      blockedReason: status === 'blocked' ? task.blockedReason : undefined,
      nextAction: this.determineNextAction(task),
      progress: task.progress,
      retryCount: task.retryCount || 0,
      durationMs: task.durationMs,
    };
  }
  
  /**
   * 规范化任务状态
   */
  private normalizeTaskStatus(status: string): TaskStatus {
    const validStatuses: TaskStatus[] = [
      'pending', 'running', 'completed', 'failed', 'blocked', 'cancelled', 'paused'
    ];
    
    if (validStatuses.includes(status as TaskStatus)) {
      return status as TaskStatus;
    }
    
    return 'pending';
  }
  
  /**
   * 确定下一步行动
   */
  private determineNextAction(task: any): string | undefined {
    switch (task.status) {
      case 'pending':
        return 'Waiting to start';
      case 'running':
        return 'In progress';
      case 'blocked':
        return `Unblock: ${task.blockedReason || 'unknown reason'}`;
      case 'failed':
        return 'Retry or cancel';
      case 'completed':
        return 'Review results';
      case 'cancelled':
        return 'Task cancelled';
      case 'paused':
        return 'Resume or cancel';
      default:
        return undefined;
    }
  }
  
  /**
   * 排序任务
   */
  private sortTasks(tasks: TaskViewModel[], sort: ViewSort): void {
    tasks.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sort.field) {
        case 'createdAt':
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case 'updatedAt':
          aVal = a.updatedAt;
          bVal = b.updatedAt;
          break;
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          aVal = priorityOrder[a.priority] ?? 99;
          bVal = priorityOrder[b.priority] ?? 99;
          break;
        case 'risk':
          const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          aVal = riskOrder[a.risk] ?? 99;
          bVal = riskOrder[b.risk] ?? 99;
          break;
        default:
          aVal = a[sort.field];
          bVal = b[sort.field];
      }
      
      if (sort.direction === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  }
  
  /**
   * 构建时间线摘要
   */
  private async buildTimelineSummary(): Promise<TaskView['timelineSummary']> {
    if (!this.auditDataSource) {
      return undefined;
    }
    
    const now = Date.now();
    const last24hStart = now - 24 * 60 * 60 * 1000;
    const last7dStart = now - 7 * 24 * 60 * 60 * 1000;
    
    // 获取审计事件
    const events = await this.auditDataSource.queryAuditEvents({
      entityType: 'task',
      startTime: last7dStart,
    });
    
    const last24h = events.filter(e => e.timestamp >= last24hStart).length;
    const last7d = events.length;
    
    // 计算成功率
    const completedEvents = events.filter(e => e.eventType === 'task.completed');
    const failedEvents = events.filter(e => e.eventType === 'task.failed');
    const totalDecided = completedEvents.length + failedEvents.length;
    const successRate = totalDecided > 0 ? completedEvents.length / totalDecided : 1;
    
    return {
      last24h,
      last7d,
      successRate,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建任务视图构建器
 */
export function createTaskViewBuilder(
  taskDataSource: TaskDataSource,
  auditDataSource?: AuditDataSource,
  config?: TaskViewBuilderConfig
): TaskViewBuilder {
  return new TaskViewBuilder(taskDataSource, auditDataSource, config);
}

/**
 * 快速构建任务视图
 */
export async function buildTaskView(
  taskDataSource: TaskDataSource,
  auditDataSource?: AuditDataSource,
  filter?: ViewFilter,
  sort?: ViewSort
): Promise<TaskView> {
  const builder = new TaskViewBuilder(taskDataSource, auditDataSource);
  return await builder.buildTaskView(filter, sort);
}
