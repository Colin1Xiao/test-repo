/**
 * TaskStore - 任务存储与管理
 * 
 * 提供任务的 CRUD、输出追加、列表查询等能力。
 * 支持持久化（JSON 文件）和内存缓存。
 */

import { RuntimeTask, TaskType, TaskStatus, createTask, isValidTransition } from './task_model';

/** 任务过滤器 */
export type TaskFilter = Partial<RuntimeTask> & {
  statusIn?: TaskStatus[];
  typeIn?: TaskType[];
  createdAfter?: number;
  createdBefore?: number;
};

/** TaskStore 接口 */
export interface ITaskStore {
  /** 创建任务 */
  create(task: Omit<RuntimeTask, 'id' | 'createdAt' | 'status'> & { type: TaskType }): RuntimeTask;
  /** 获取任务 */
  get(taskId: string): RuntimeTask | undefined;
  /** 列出任务 */
  list(filter?: TaskFilter): RuntimeTask[];
  /** 更新任务 */
  update(taskId: string, patch: Partial<RuntimeTask>): void;
  /** 追加输出 */
  appendOutput(taskId: string, chunk: string): void;
  /** 读取输出 */
  getOutput(taskId: string, offset?: number, limit?: number): string;
  /** 取消任务 */
  cancel(taskId: string): Promise<void>;
}

/** 配置 */
export type TaskStoreConfig = {
  /** 持久化文件路径 */
  persistPath?: string;
  /** 内存缓存最大任务数 */
  maxCacheSize?: number;
  /** 自动持久化间隔（毫秒） */
  persistIntervalMs?: number;
};

/** 任务存储实现 */
export class TaskStore implements ITaskStore {
  private tasks: Map<string, RuntimeTask> = new Map();
  private outputs: Map<string, string[]> = new Map();
  private persistPath?: string;
  private maxCacheSize: number;

  constructor(config: TaskStoreConfig = {}) {
    this.persistPath = config.persistPath;
    this.maxCacheSize = config.maxCacheSize ?? 1000;
    
    // 启动时加载持久化数据
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  /**
   * 创建任务
   */
  create(
    taskDef: Omit<RuntimeTask, 'id' | 'createdAt' | 'status'> & { type: TaskType },
  ): RuntimeTask {
    const task = createTask(
      taskDef.type,
      taskDef.sessionId,
      taskDef.agentId,
      taskDef.workspaceRoot,
      taskDef.description,
      taskDef.parentTaskId,
    );
    
    this.tasks.set(task.id, task);
    this.outputs.set(task.id, []);
    
    // 触发 hook（待实现）
    // this.emit({ type: 'task.created', taskId: task.id, taskType: task.type });
    
    this.persist();
    return task;
  }

  /**
   * 获取任务
   */
  get(taskId: string): RuntimeTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 列出任务（支持过滤）
   */
  list(filter?: TaskFilter): RuntimeTask[] {
    let result = Array.from(this.tasks.values());
    
    if (filter) {
      if (filter.statusIn) {
        result = result.filter(t => filter.statusIn!.includes(t.status));
      }
      if (filter.typeIn) {
        result = result.filter(t => filter.typeIn!.includes(t.type));
      }
      if (filter.createdAfter) {
        result = result.filter(t => t.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        result = result.filter(t => t.createdAt <= filter.createdBefore!);
      }
      // 其他字段过滤
      Object.keys(filter).forEach(key => {
        if (!['statusIn', 'typeIn', 'createdAfter', 'createdBefore'].includes(key)) {
          const value = (filter as any)[key];
          if (value !== undefined) {
            result = result.filter(t => (t as any)[key] === value);
          }
        }
      });
    }
    
    // 按创建时间倒序
    result.sort((a, b) => b.createdAt - a.createdAt);
    
    return result;
  }

  /**
   * 更新任务
   */
  update(taskId: string, patch: Partial<RuntimeTask>): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // 验证状态转换
    if (patch.status && !isValidTransition(task.status, patch.status)) {
      throw new Error(`Invalid state transition: ${task.status} → ${patch.status}`);
    }
    
    // 设置时间戳
    if (patch.status === 'running' && !task.startedAt) {
      patch.startedAt = Date.now();
    }
    if (['completed', 'failed', 'cancelled'].includes(patch.status!) && !task.endedAt) {
      patch.endedAt = Date.now();
    }
    
    Object.assign(task, patch);
    this.tasks.set(taskId, task);
    this.persist();
  }

  /**
   * 追加输出
   */
  appendOutput(taskId: string, chunk: string): void {
    const outputs = this.outputs.get(taskId) ?? [];
    outputs.push(chunk);
    this.outputs.set(taskId, outputs);
    
    // 限制输出大小
    while (outputs.length > 1000) {
      outputs.shift();
    }
  }

  /**
   * 读取输出
   */
  getOutput(taskId: string, offset: number = 0, limit: number = 100): string {
    const outputs = this.outputs.get(taskId) ?? [];
    return outputs.slice(offset, offset + limit).join('');
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return; // 已经结束
    }
    
    this.update(taskId, { status: 'cancelled' });
  }

  /**
   * 持久化到磁盘
   */
  private persist(): void {
    if (!this.persistPath) {
      return;
    }
    
    // 简化实现：实际应使用 fs.writeFile
    // fs.writeFileSync(this.persistPath, JSON.stringify({
    //   tasks: Array.from(this.tasks.values()),
    //   lastUpdated: Date.now(),
    // }, null, 2));
  }

  /**
   * 从磁盘加载
   */
  private loadFromDisk(): void {
    if (!this.persistPath) {
      return;
    }
    
    // 简化实现：实际应使用 fs.readFile
    // const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
    // data.tasks.forEach((task: RuntimeTask) => {
    //   this.tasks.set(task.id, task);
    //   this.outputs.set(task.id, []);
    // });
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
  } {
    const byStatus: Record<TaskStatus, number> = {
      created: 0, queued: 0, running: 0,
      waiting_approval: 0, waiting_input: 0,
      completed: 0, failed: 0, cancelled: 0,
    };
    const byType: Record<TaskType, number> = {
      exec: 0, agent: 0, workflow: 0,
      approval: 0, mcp: 0, verify: 0,
    };
    
    this.tasks.forEach(task => {
      byStatus[task.status]++;
      byType[task.type]++;
    });
    
    return {
      total: this.tasks.size,
      byStatus,
      byType,
    };
  }
}
