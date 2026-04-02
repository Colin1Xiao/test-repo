/**
 * TaskOutputStore - 任务输出持久化存储
 * 
 * 每个任务落盘到 ~/.openclaw/runtime/tasks/<task-id>/
 * 包含：
 * - task.json - 任务元数据
 * - output.log - 标准输出日志
 * - events.jsonl - 事件流（每行一个 JSON）
 * - summary.json - 任务结束时写入摘要
 * 
 * 支持：
 * - 追加输出
 * - offset 读取
 * - 最后 N 行读取
 * - 按任务 ID 查询
 */

import { RuntimeTask, TaskStatus } from './task_model';
import { RuntimeEvent } from './hook_types';
import * as fs from 'fs';
import * as path from 'path';

/** 配置 */
export interface TaskOutputStoreConfig {
  /** 根目录，默认 ~/.openclaw/runtime/tasks */
  rootDir?: string;
  /** 自动创建目录 */
  autoCreate?: boolean;
}

/** 任务输出存储实现 */
export class TaskOutputStore {
  private rootDir: string;

  constructor(config: TaskOutputStoreConfig = {}) {
    this.rootDir = config.rootDir ?? path.join(
      process.env.HOME ?? '~',
      '.openclaw',
      'runtime',
      'tasks',
    );
    
    if (config.autoCreate !== false) {
      this.ensureRootDir();
    }
  }

  /**
   * 确保根目录存在
   */
  private ensureRootDir(): void {
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  /**
   * 获取任务目录
   */
  getTaskDir(taskId: string): string {
    return path.join(this.rootDir, taskId);
  }

  /**
   * 初始化任务存储（创建目录和文件）
   */
  initTask(task: RuntimeTask): void {
    const taskDir = this.getTaskDir(task.id);
    
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    
    // 写入 task.json
    const taskPath = path.join(taskDir, 'task.json');
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
    
    // 创建空的 output.log
    const outputPath = path.join(taskDir, 'output.log');
    fs.writeFileSync(outputPath, '');
    
    // 创建空的 events.jsonl
    const eventsPath = path.join(taskDir, 'events.jsonl');
    fs.writeFileSync(eventsPath, '');
  }

  /**
   * 追加输出到日志
   */
  appendOutput(taskId: string, chunk: string): void {
    const outputPath = path.join(this.getTaskDir(taskId), 'output.log');
    fs.appendFileSync(outputPath, chunk);
  }

  /**
   * 追加事件到事件流
   */
  appendEvent(taskId: string, event: RuntimeEvent): void {
    const eventsPath = path.join(this.getTaskDir(taskId), 'events.jsonl');
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(eventsPath, line);
  }

  /**
   * 读取输出（支持 offset 和 limit）
   */
  getOutput(taskId: string, offset: number = 0, limit: number = 100): string {
    const outputPath = path.join(this.getTaskDir(taskId), 'output.log');
    
    if (!fs.existsSync(outputPath)) {
      return '';
    }
    
    const content = fs.readFileSync(outputPath, 'utf-8');
    const lines = content.split('\n');
    
    return lines.slice(offset, offset + limit).join('\n');
  }

  /**
   * 读取最后 N 行输出
   */
  getLastLines(taskId: string, lines: number = 50): string {
    const outputPath = path.join(this.getTaskDir(taskId), 'output.log');
    
    if (!fs.existsSync(outputPath)) {
      return '';
    }
    
    const content = fs.readFileSync(outputPath, 'utf-8');
    const allLines = content.split('\n');
    
    return allLines.slice(-lines).join('\n');
  }

  /**
   * 读取任务元数据
   */
  getTask(taskId: string): RuntimeTask | null {
    const taskPath = path.join(this.getTaskDir(taskId), 'task.json');
    
    if (!fs.existsSync(taskPath)) {
      return null;
    }
    
    return JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
  }

  /**
   * 更新任务元数据
   */
  updateTask(taskId: string, patch: Partial<RuntimeTask>): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    Object.assign(task, patch);
    
    const taskPath = path.join(this.getTaskDir(taskId), 'task.json');
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
  }

  /**
   * 写入任务摘要（任务结束时）
   */
  writeSummary(taskId: string, summary: {
    durationMs: number;
    outputSize: number;
    eventCount: number;
    exitCode?: number;
    error?: string;
    metadata?: Record<string, any>;
  }): void {
    const summaryPath = path.join(this.getTaskDir(taskId), 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }

  /**
   * 列出所有任务 ID
   */
  listTaskIds(options?: { 
    statusIn?: TaskStatus[];
    createdAfter?: number;
    createdBefore?: number;
  }): string[] {
    if (!fs.existsSync(this.rootDir)) {
      return [];
    }
    
    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });
    const taskIds: string[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const taskId = entry.name;
      const task = this.getTask(taskId);
      if (!task) continue;
      
      // 过滤
      if (options?.statusIn && !options.statusIn.includes(task.status)) continue;
      if (options?.createdAfter && task.createdAt < options.createdAfter) continue;
      if (options?.createdBefore && task.createdAt > options.createdBefore) continue;
      
      taskIds.push(taskId);
    }
    
    return taskIds;
  }

  /**
   * 读取事件流
   */
  getEvents(taskId: string, limit: number = 100): RuntimeEvent[] {
    const eventsPath = path.join(this.getTaskDir(taskId), 'events.jsonl');
    
    if (!fs.existsSync(eventsPath)) {
      return [];
    }
    
    const content = fs.readFileSync(eventsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    return lines
      .slice(-limit)
      .map(line => JSON.parse(line));
  }

  /**
   * 删除任务存储
   */
  deleteTask(taskId: string): void {
    const taskDir = this.getTaskDir(taskId);
    
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    totalTasks: number;
    totalOutputSize: number;
    oldestTask?: number;
    newestTask?: number;
  } {
    const taskIds = this.listTaskIds();
    let totalOutputSize = 0;
    let oldestTask: number | undefined;
    let newestTask: number | undefined;
    
    for (const taskId of taskIds) {
      const task = this.getTask(taskId);
      if (!task) continue;
      
      // 统计输出大小
      const outputPath = path.join(this.getTaskDir(taskId), 'output.log');
      if (fs.existsSync(outputPath)) {
        totalOutputSize += fs.statSync(outputPath).size;
      }
      
      // 统计时间范围
      if (oldestTask === undefined || task.createdAt < oldestTask) {
        oldestTask = task.createdAt;
      }
      if (newestTask === undefined || task.createdAt > newestTask) {
        newestTask = task.createdAt;
      }
    }
    
    return {
      totalTasks: taskIds.length,
      totalOutputSize,
      oldestTask,
      newestTask,
    };
  }

  /**
   * 清理旧任务（按时间）
   */
  cleanupOlderThan(days: number): number {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const taskIds = this.listTaskIds({ createdBefore: cutoff });
    
    for (const taskId of taskIds) {
      this.deleteTask(taskId);
    }
    
    return taskIds.length;
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例：任务执行过程中使用
 * 
 * const store = new TaskOutputStore({ autoCreate: true });
 * 
 * // 创建任务时初始化存储
 * const task = taskStore.create({...});
 * store.initTask(task);
 * 
 * // 执行中追加输出
 * store.appendOutput(task.id, 'Installing dependencies...\n');
 * 
 * // 发送事件
 * store.appendEvent(task.id, {
 *   type: 'tool.after',
 *   tool: 'exec.run',
 *   ok: true,
 *   timestamp: Date.now(),
 * });
 * 
 * // 任务结束时写入摘要
 * store.writeSummary(task.id, {
 *   durationMs: 5234,
 *   outputSize: 1024,
 *   eventCount: 15,
 *   exitCode: 0,
 * });
 * 
 * // 读取最后 50 行输出（用于 Telegram 展示）
 * const lastLines = store.getLastLines(task.id, 50);
 */
