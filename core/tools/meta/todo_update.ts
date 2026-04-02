/**
 * todo.update - 更新 Todo 状态
 * 
 * 更新单个 todo 条目的状态。
 */

import { buildSkill } from '../../runtime/build_skill';
import { TodoList, TodoStatus } from './todo_write';

// 从 todo_write 导入存储
const todoStore: Map<string, TodoList> = new Map();

/** 输入 */
export type TodoUpdateInput = {
  /** Todo ID */
  todoId: string;
  /** 新状态 */
  status: TodoStatus;
};

/** 输出 */
export type TodoUpdateOutput = {
  success: boolean;
  todoId: string;
  newStatus: TodoStatus;
  message: string;
};

export const todoUpdateSkill = buildSkill<TodoUpdateInput, TodoUpdateOutput>({
  name: 'todo.update',
  description: 'Update todo item status',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      todoId: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['todoId', 'status'],
  },
  policy: {
    readOnly: false,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['todo', 'update', 'status', 'meta'],
  searchHint: '更新任务状态',
  async handler(ctx, input): Promise<TodoUpdateOutput> {
    const key = `${ctx.sessionId}:${ctx.taskId ?? 'default'}`;
    let todoList = todoStore.get(key) ?? {
      sessionId: ctx.sessionId,
      taskId: ctx.taskId,
      items: [],
    };

    const idx = todoList.items.findIndex(i => i.id === input.todoId);
    if (idx < 0) {
      return {
        success: false,
        todoId: input.todoId,
        newStatus: input.status,
        message: `Todo not found: ${input.todoId}`,
      };
    }

    const oldStatus = todoList.items[idx].status;
    todoList.items[idx] = {
      ...todoList.items[idx],
      status: input.status,
      updatedAt: Date.now(),
    };

    todoStore.set(key, todoList);

    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId,
        `✅ Todo: ${input.todoId} ${oldStatus} → ${input.status}\n`,
      );
    }

    return {
      success: true,
      todoId: input.todoId,
      newStatus: input.status,
      message: `Updated ${input.todoId}: ${oldStatus} → ${input.status}`,
    };
  },
});
