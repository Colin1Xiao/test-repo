/**
 * Task Center
 * Phase 2A-2B - 任务中心聚合
 * 
 * 职责：
 * - 聚合 blocked tasks
 * - 聚合 failed tasks
 * - 聚合 high-priority active tasks
 * - 输出 InboxItem 列表
 */

import type { InboxItem, InboxSeverity, InboxItemStatus } from '../types/inbox_types';
import type { TaskDataSource } from '../data/task_data_source';

// ============================================================================
// 配置
// ============================================================================

export interface TaskCenterConfig {
  /** 返回数量限制 */
  limit?: number;
}

// ============================================================================
// 任务中心
// ============================================================================

export class TaskCenter {
  private config: Required<TaskCenterConfig>;
  private taskDataSource: TaskDataSource;
  
  constructor(
    taskDataSource: TaskDataSource,
    config: TaskCenterConfig = {}
  ) {
    this.config = {
      limit: config.limit ?? 50,
    };
    
    this.taskDataSource = taskDataSource;
  }
  
  /**
   * 获取任务 Inbox 项
   */
  async getInboxItems(workspaceId?: string): Promise<InboxItem[]> {
    const taskView = await this.taskDataSource.getTaskView();
    const now = Date.now();
    
    const items: InboxItem[] = [];
    
    // 阻塞任务
    for (const task of taskView.blockedTasks.slice(0, this.config.limit)) {
      const severity = this.calculateSeverity(task);
      const ageMs = now - task.createdAt;
      
      items.push({
        id: `task_${task.taskId}`,
        itemType: 'task',
        sourceId: task.taskId,
        workspaceId,
        title: `阻塞任务：${task.title || task.taskId}`,
        summary: task.blockedReason || '原因未知',
        severity,
        status: 'blocked',
        owner: task.ownerAgent,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        ageMs,
        suggestedActions: ['retry_task', 'cancel_task', 'open'],
        metadata: {
          priority: task.priority,
          blockedReason: task.blockedReason,
          nextAction: task.nextAction,
          retryCount: task.retryCount,
        },
      });
    }
    
    // 失败任务
    for (const task of taskView.failedTasks.slice(0, this.config.limit)) {
      const severity: InboxSeverity = task.priority === 'critical' ? 'critical' : 
                                       task.priority === 'high' ? 'high' : 'medium';
      const ageMs = now - task.createdAt;
      
      items.push({
        id: `task_${task.taskId}`,
        itemType: 'task',
        sourceId: task.taskId,
        workspaceId,
        title: `失败任务：${task.title || task.taskId}`,
        summary: `重试 ${task.retryCount || 0} 次`,
        severity,
        status: 'failed',
        owner: task.ownerAgent,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        ageMs,
        suggestedActions: ['retry_task', 'cancel_task', 'open'],
        metadata: {
          priority: task.priority,
          retryCount: task.retryCount,
          durationMs: task.durationMs,
        },
      });
    }
    
    // 高优先级活跃任务
    const highPriorityActive = taskView.activeTasks
      .filter(t => t.priority === 'critical' || t.priority === 'high')
      .slice(0, 10);
    
    for (const task of highPriorityActive) {
      const severity: InboxSeverity = task.priority === 'critical' ? 'critical' : 'high';
      const ageMs = now - task.createdAt;
      
      items.push({
        id: `task_${task.taskId}`,
        itemType: 'task',
        sourceId: task.taskId,
        workspaceId,
        title: `高优任务：${task.title || task.taskId}`,
        summary: task.nextAction || `进度：${task.progress || 0}%`,
        severity,
        status: 'active',
        owner: task.ownerAgent,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        ageMs,
        suggestedActions: ['open'],
        metadata: {
          priority: task.priority,
          progress: task.progress,
          nextAction: task.nextAction,
        },
      });
    }
    
    // 去重并按严重级别排序
    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex(i => i.sourceId === item.sourceId)
    );
    
    return uniqueItems.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return (b.ageMs || 0) - (a.ageMs || 0);
    });
  }
  
  /**
   * 获取摘要
   */
  async getSummary(workspaceId?: string): Promise<{
    blockedTasks: number;
    failedTasks: number;
    highPriorityActive: number;
  }> {
    const taskView = await this.taskDataSource.getTaskView();
    
    const highPriorityActive = taskView.activeTasks.filter(
      t => t.priority === 'critical' || t.priority === 'high'
    ).length;
    
    return {
      blockedTasks: taskView.blockedTasks.length,
      failedTasks: taskView.failedTasks.length,
      highPriorityActive,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private calculateSeverity(task: any): InboxSeverity {
    // 优先级决定严重级别
    if (task.priority === 'critical') return 'critical';
    if (task.priority === 'high') return 'high';
    if (task.priority === 'medium') return 'medium';
    return 'low';
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTaskCenter(
  taskDataSource: TaskDataSource,
  config?: TaskCenterConfig
): TaskCenter {
  return new TaskCenter(taskDataSource, config);
}
