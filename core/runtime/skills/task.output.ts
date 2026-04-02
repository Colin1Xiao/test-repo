/**
 * task.output - 任务输出读取技能
 * 
 * 只读操作，不需要审批。
 * 读取任务的输出日志（支持 offset/limit）。
 */

import { buildSkill } from '../build_skill';
import { TaskOutputStore } from '../task_output_store';

export interface TaskOutputInput {
  /** 任务 ID */
  taskId: string;
  /** 偏移量 */
  offset?: number;
  /** 限制行数 */
  limit?: number;
  /** 读取最后 N 行（与 offset 互斥） */
  lastLines?: number;
}

export interface TaskOutputResult {
  taskId: string;
  output: string;
  lines: number;
  hasMore: boolean;
}

export const taskOutputSkill = buildSkill<TaskOutputInput, TaskOutputResult>({
  name: 'task.output',
  description: 'Read task output log',
  category: 'task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      offset: { type: 'number' },
      limit: { type: 'number' },
      lastLines: { type: 'number' },
    },
    required: ['taskId'],
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['task', 'output', 'log', 'read'],
  searchHint: '读取任务输出日志，查看执行结果',
  async handler(ctx, input) {
    // 创建输出存储（使用默认路径）
    const store = new TaskOutputStore();
    
    let output: string;
    let lines: number;
    let hasMore: boolean;
    
    if (input.lastLines) {
      // 读取最后 N 行
      output = store.getLastLines(input.taskId, input.lastLines);
      lines = input.lastLines;
      hasMore = false; // 最后 N 行无法判断是否有更多
    } else {
      // 读取指定范围
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 100;
      output = store.getOutput(input.taskId, offset, limit);
      lines = output.split('\n').length;
      hasMore = lines >= limit;
    }
    
    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId, 
        `📖 Read output for ${input.taskId}: ${lines} lines\n`
      );
    }
    
    return {
      taskId: input.taskId,
      output,
      lines,
      hasMore,
    };
  },
});
