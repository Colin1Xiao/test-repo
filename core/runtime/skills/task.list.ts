/**
 * task.list - 任务列表技能
 * 
 * 只读操作，不需要审批。
 * 列出当前会话或所有任务。
 */

import { buildSkill } from '../build_skill';

export interface TaskListInput {
  /** 会话 ID 过滤 */
  sessionId?: string;
  /** 状态过滤 */
  status?: string[];
  /** 类型过滤 */
  type?: string[];
  /** 最大返回数量 */
  limit?: number;
  /** 仅未完成的任务 */
  activeOnly?: boolean;
}

export interface TaskListOutput {
  id: string;
  type: string;
  status: string;
  description: string;
  createdAt: number;
  sessionId: string;
}

export const taskListSkill = buildSkill<TaskListInput, TaskListOutput[]>({
  name: 'task.list',
  description: 'List tasks with optional filters',
  category: 'task',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      status: { type: 'array' },
      type: { type: 'array' },
      limit: { type: 'number' },
      activeOnly: { type: 'boolean' },
    },
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['task', 'list', 'status'],
  searchHint: '列出任务，查看执行状态/进度',
  async handler(ctx, input) {
    // 构建过滤器
    const filter: any = {};
    
    if (input.sessionId) {
      filter.sessionId = input.sessionId;
    } else {
      // 默认当前会话
      filter.sessionId = ctx.sessionId;
    }
    
    if (input.status) {
      filter.statusIn = input.status;
    }
    
    if (input.type) {
      filter.typeIn = input.type;
    }
    
    if (input.activeOnly) {
      filter.statusIn = ['created', 'queued', 'running', 'waiting_approval', 'waiting_input'];
    }
    
    // 查询任务
    const tasks = ctx.tasks.list(filter);
    
    // 限制数量
    const limit = input.limit ?? 50;
    const limited = tasks.slice(0, limit);
    
    // 格式化输出
    const output: TaskListOutput[] = limited.map(task => ({
      id: task.id,
      type: task.type,
      status: task.status,
      description: task.description,
      createdAt: task.createdAt,
      sessionId: task.sessionId,
    }));
    
    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId, 
        `📋 List tasks: ${output.length} results (filter: ${JSON.stringify(filter)})\n`
      );
    }
    
    return output;
  },
});
