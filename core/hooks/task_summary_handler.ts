/**
 * TaskSummaryHandler - 任务摘要处理器
 * 
 * 监听任务完成事件，自动生成摘要。
 * 写入 summary.json 到任务目录。
 */

import { HookBus } from '../runtime/hook_bus';
import { TaskStore } from '../runtime/task_store';
import { TaskOutputStore } from '../runtime/task_output_store';
import * as fs from 'fs';
import * as path from 'path';

/** 配置 */
export interface TaskSummaryHandlerConfig {
  tasks?: TaskStore;
  outputStore?: TaskOutputStore;
  /** 输出存储根目录 */
  outputStoreRoot?: string;
}

/** 任务摘要 */
interface TaskSummary {
  taskId: string;
  type: string;
  description: string;
  status: string;
  sessionId: string;
  startedAt?: number;
  endedAt?: number;
  durationMs: number;
  outputSize: number;
  eventCount: number;
  error?: string;
  metadata: Record<string, any>;
}

/** 任务摘要处理器实现 */
export class TaskSummaryHandler {
  private tasks?: TaskStore;
  private outputStore: TaskOutputStore;

  constructor(hookBus: HookBus, config: TaskSummaryHandlerConfig = {}) {
    this.tasks = config.tasks;
    this.outputStore = new TaskOutputStore({ 
      rootDir: config.outputStoreRoot,
    });
    
    this.register(hookBus);
  }

  /**
   * 注册钩子处理器
   */
  private register(hookBus: HookBus): void {
    hookBus.on('task.status_changed', async (event) => {
      if (['completed', 'failed', 'cancelled'].includes(event.to)) {
        await this.generateSummary(event.taskId, event.to);
      }
    });
  }

  /**
   * 生成任务摘要
   */
  private async generateSummary(taskId: string, status: string): Promise<void> {
    // 获取任务信息
    const task = this.tasks?.get(taskId);
    if (!task) {
      console.warn(`[TaskSummary] Task not found: ${taskId}`);
      return;
    }
    
    // 计算时长
    const startedAt = task.startedAt ?? task.createdAt;
    const endedAt = task.endedAt ?? Date.now();
    const durationMs = endedAt - startedAt;
    
    // 获取输出大小
    let outputSize = 0;
    try {
      const output = this.outputStore.getOutput(taskId);
      outputSize = output.length;
    } catch {
      outputSize = 0;
    }
    
    // 获取事件数量
    let eventCount = 0;
    try {
      const events = this.outputStore.getEvents(taskId);
      eventCount = events.length;
    } catch {
      eventCount = 0;
    }
    
    // 创建摘要
    const summary: TaskSummary = {
      taskId,
      type: task.type,
      description: task.description,
      status,
      sessionId: task.sessionId,
      startedAt,
      endedAt,
      durationMs,
      outputSize,
      eventCount,
      error: task.error,
      metadata: task.metadata ?? {},
    };
    
    // 写入摘要文件
    try {
      this.outputStore.writeSummary(taskId, {
        durationMs,
        outputSize,
        eventCount,
        exitCode: status === 'completed' ? 0 : -1,
        error: task.error,
        metadata: summary,
      });
      
      console.log(
        `[TaskSummary] Generated for ${taskId}: ${status} in ${durationMs}ms`,
      );
    } catch (error) {
      console.error(`[TaskSummary] Failed to write summary for ${taskId}:`, error);
    }
  }
}
