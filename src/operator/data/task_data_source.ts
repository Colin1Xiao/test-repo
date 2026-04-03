/**
 * Task Data Source
 * Phase 2A-1R′A - 真实任务数据源
 * 
 * 职责：
 * - 提供任务数据读取接口
 * - 支持 active / blocked / failed tasks 查询
 * - 支持按 ID 查询单个任务
 */

import type { TaskViewModel, TaskView, TaskStatus } from '../ux/control_types';

// ============================================================================
// 数据源接口
// ============================================================================

export interface TaskDataSource {
  /**
   * 获取任务视图
   */
  getTaskView(): Promise<TaskView>;
  
  /**
   * 获取活跃任务列表
   */
  getActiveTasks(limit?: number): Promise<TaskViewModel[]>;
  
  /**
   * 获取阻塞任务列表
   */
  getBlockedTasks(limit?: number): Promise<TaskViewModel[]>;
  
  /**
   * 获取失败任务列表
   */
  getFailedTasks(limit?: number): Promise<TaskViewModel[]>;
  
  /**
   * 按 ID 获取任务
   */
  getTaskById(taskId: string): Promise<TaskViewModel | null>;
  
  /**
   * 获取任务统计
   */
  getTaskSummary(): Promise<{
    total: number;
    active: number;
    blocked: number;
    failed: number;
    completed: number;
  }>;
}

// ============================================================================
// 配置
// ============================================================================

export interface TaskDataSourceConfig {
  /** 默认返回数量限制 */
  defaultLimit?: number;
  
  /** 数据刷新间隔（毫秒） */
  refreshIntervalMs?: number;
}

// ============================================================================
// 内存实现（用于测试/降级）
// ============================================================================

export class InMemoryTaskDataSource implements TaskDataSource {
  private config: Required<TaskDataSourceConfig>;
  private tasks: Map<string, TaskViewModel> = new Map();
  
  constructor(config: TaskDataSourceConfig = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? 50,
      refreshIntervalMs: config.refreshIntervalMs ?? 30000,
    };
  }
  
  async getTaskView(): Promise<TaskView> {
    const allTasks = Array.from(this.tasks.values());
    
    const activeTasks = allTasks.filter(t => t.status === 'running' || t.status === 'pending');
    const blockedTasks = allTasks.filter(t => t.status === 'blocked');
    const failedTasks = allTasks.filter(t => t.status === 'failed');
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    
    return {
      activeTasks: activeTasks.slice(0, this.config.defaultLimit),
      blockedTasks: blockedTasks.slice(0, this.config.defaultLimit),
      recentCompletedTasks: completedTasks
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, this.config.defaultLimit),
      failedTasks: failedTasks.slice(0, this.config.defaultLimit),
      totalTasks: this.tasks.size,
      timelineSummary: {
        last24h: completedTasks.filter(t => Date.now() - t.updatedAt < 24 * 60 * 60 * 1000).length,
        last7d: completedTasks.filter(t => Date.now() - t.updatedAt < 7 * 24 * 60 * 60 * 1000).length,
        successRate: completedTasks.length / Math.max(1, this.tasks.size),
      },
    };
  }
  
  async getActiveTasks(limit?: number): Promise<TaskViewModel[]> {
    const allTasks = Array.from(this.tasks.values());
    return allTasks
      .filter(t => t.status === 'running' || t.status === 'pending')
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getBlockedTasks(limit?: number): Promise<TaskViewModel[]> {
    const allTasks = Array.from(this.tasks.values());
    return allTasks
      .filter(t => t.status === 'blocked')
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getFailedTasks(limit?: number): Promise<TaskViewModel[]> {
    const allTasks = Array.from(this.tasks.values());
    return allTasks
      .filter(t => t.status === 'failed')
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getTaskById(taskId: string): Promise<TaskViewModel | null> {
    return this.tasks.get(taskId) || null;
  }
  
  async getTaskSummary(): Promise<{
    total: number;
    active: number;
    blocked: number;
    failed: number;
    completed: number;
  }> {
    const allTasks = Array.from(this.tasks.values());
    
    return {
      total: this.tasks.size,
      active: allTasks.filter(t => t.status === 'running' || t.status === 'pending').length,
      blocked: allTasks.filter(t => t.status === 'blocked').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
    };
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 添加测试任务
   */
  addTask(task: TaskViewModel): void {
    this.tasks.set(task.taskId, task);
  }
  
  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: TaskStatus): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = status;
    task.updatedAt = Date.now();
    this.tasks.set(taskId, task);
    return true;
  }
  
  /**
   * 清除所有任务
   */
  clear(): void {
    this.tasks.clear();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTaskDataSource(
  config?: TaskDataSourceConfig
): TaskDataSource {
  return new InMemoryTaskDataSource(config);
}
