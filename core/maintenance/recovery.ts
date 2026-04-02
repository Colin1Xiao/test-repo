/**
 * Recovery - 任务恢复检查
 * 
 * 检查并恢复 orphaned tasks：
 * - 运行超过阈值的任务
 * - 状态不一致的任务
 * - 中断后未恢复的任务
 */

import { TaskStore, RuntimeTask, TaskStatus } from '../runtime/task_store';

/** 恢复配置 */
export interface RecoveryConfig {
  tasks?: TaskStore;
  /** 运行超时阈值（毫秒） */
  runningTimeoutMs?: number;
  /** 自动恢复 */
  autoRecover?: boolean;
}

/** 恢复结果 */
export interface RecoveryResult {
  /** 检查的任务数 */
  checked: number;
  /** 恢复的任务数 */
  recovered: number;
  /** 失败的任务数 */
  failed: number;
  /** 详情 */
  details: Array<{
    taskId: string;
    action: 'recovered' | 'failed' | 'skipped';
    reason: string;
  }>;
}

/** 任务恢复器 */
export class TaskRecovery {
  private tasks?: TaskStore;
  private runningTimeoutMs: number;
  private autoRecover: boolean;

  constructor(config: RecoveryConfig = {}) {
    this.tasks = config.tasks;
    this.runningTimeoutMs = config.runningTimeoutMs ?? 60 * 60 * 1000; // 1 小时
    this.autoRecover = config.autoRecover ?? false;
  }

  /**
   * 执行恢复检查
   */
  recover(): RecoveryResult {
    const result: RecoveryResult = {
      checked: 0,
      recovered: 0,
      failed: 0,
      details: [],
    };

    if (!this.tasks) {
      console.warn('[TaskRecovery] No TaskStore configured');
      return result;
    }

    const now = Date.now();
    const allTasks = this.tasks.list();

    for (const task of allTasks) {
      result.checked++;

      // 检查运行超时的任务
      if (task.status === 'running' && task.startedAt) {
        const elapsed = now - task.startedAt;
        
        if (elapsed > this.runningTimeoutMs) {
          // 运行超时
          if (this.autoRecover) {
            try {
              this.tasks.update(task.id, {
                status: 'failed',
                error: `Task timed out after ${Math.floor(elapsed / 60000)} minutes`,
              });
              
              result.recovered++;
              result.details.push({
                taskId: task.id,
                action: 'recovered',
                reason: `Timeout after ${elapsed}ms`,
              });
            } catch (error) {
              result.failed++;
              result.details.push({
                taskId: task.id,
                action: 'failed',
                reason: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          } else {
            result.details.push({
              taskId: task.id,
              action: 'skipped',
              reason: `Running for ${elapsed}ms (autoRecover disabled)`,
            });
          }
        }
      }

      // 检查状态不一致的任务
      if (this.isInconsistent(task)) {
        result.details.push({
          taskId: task.id,
          action: 'skipped',
          reason: 'Inconsistent state detected',
        });
      }
    }

    console.log(
      `[TaskRecovery] Checked: ${result.checked}, Recovered: ${result.recovered}, Failed: ${result.failed}`,
    );

    return result;
  }

  /**
   * 检查任务状态是否一致
   */
  private isInconsistent(task: RuntimeTask): boolean {
    // 检查 endedAt 是否存在但状态不是终态
    if (task.endedAt && !['completed', 'failed', 'cancelled'].includes(task.status)) {
      return true;
    }

    // 检查 startedAt 是否存在但状态是 created/queued
    if (task.startedAt && ['created', 'queued'].includes(task.status)) {
      return true;
    }

    return false;
  }

  /**
   * 恢复指定任务
   */
  recoverTask(taskId: string, newStatus: TaskStatus): boolean {
    if (!this.tasks) {
      return false;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    try {
      this.tasks.update(taskId, { status: newStatus });
      console.log(`[TaskRecovery] Recovered task ${taskId} to ${newStatus}`);
      return true;
    } catch (error) {
      console.error(`[TaskRecovery] Failed to recover task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * 获取 orphaned 任务列表
   */
  getOrphanedTasks(): RuntimeTask[] {
    if (!this.tasks) {
      return [];
    }

    const now = Date.now();
    const runningTasks = this.tasks.list({ statusIn: ['running'] });

    return runningTasks.filter(
      task => task.startedAt && now - task.startedAt > this.runningTimeoutMs,
    );
  }
}
