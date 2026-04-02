/**
 * todo.read - 读取 Todo 列表
 * 
 * 读取当前会话/任务的 todo 列表。
 */

import { buildSkill } from '../../runtime/build_skill';
import { TodoList, TodoStatus } from './todo_write';

// 从 todo_write 导入存储
const todoStore: Map<string, TodoList> = new Map();

/** 输入 */
export type TodoReadInput = {
  /** 状态过滤 */
  status?: TodoStatus[];
  /** 仅未完成 */
  activeOnly?: boolean;
};

/** 输出 */
export type TodoReadOutput = {
  todoList: TodoList;
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  };
};

export const todoReadSkill = buildSkill<TodoReadInput, TodoReadOutput>({
  name: 'todo.read',
  description: 'Read current todo list',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'array' },
      activeOnly: { type: 'boolean' },
    },
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['todo', 'read', 'status', 'meta'],
  searchHint: '查看任务清单，了解进度',
  async handler(ctx, input): Promise<TodoReadOutput> {
    const key = `${ctx.sessionId}:${ctx.taskId ?? 'default'}`;
    let todoList = todoStore.get(key) ?? {
      sessionId: ctx.sessionId,
      taskId: ctx.taskId,
      items: [],
    };

    // 过滤
    let items = todoList.items;
    
    if (input.activeOnly) {
      items = items.filter(i => i.status !== 'completed');
    }
    
    if (input.status && input.status.length > 0) {
      items = items.filter(i => input.status!.includes(i.status));
    }

    todoList = { ...todoList, items };

    // 统计
    const summary = {
      total: todoList.items.length,
      pending: todoList.items.filter(i => i.status === 'pending').length,
      inProgress: todoList.items.filter(i => i.status === 'in_progress').length,
      completed: todoList.items.filter(i => i.status === 'completed').length,
      blocked: todoList.items.filter(i => i.status === 'blocked').length,
    };

    return { todoList, summary };
  },
});
