/**
 * todo.write - 任务拆解元技能
 * 
 * 把复杂任务拆成明确步骤，标记进行中与完成态。
 * 在结束时提示是否缺少验证步骤。
 */

import { buildSkill } from '../../runtime/build_skill';

/** Todo 状态 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** Todo 条目 */
export type TodoItem = {
  id: string;
  content: string;
  status: TodoStatus;
  priority?: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
};

/** Todo 列表 */
export type TodoList = {
  sessionId: string;
  taskId?: string;
  items: TodoItem[];
};

/** 输入：创建/更新 todo */
export type TodoWriteInput = {
  /** 操作类型 */
  action: 'create' | 'update' | 'clear';
  /** Todo 条目（create/update 时需要） */
  items?: Array<{
    id?: string;
    content: string;
    status?: TodoStatus;
    priority?: 'low' | 'medium' | 'high';
  }>;
  /** 更新状态（update 时需要） */
  status?: TodoStatus;
};

/** 输出 */
export type TodoWriteOutput = {
  success: boolean;
  todoList: TodoList;
  message: string;
};

// 内存存储（实际应持久化）
const todoStore: Map<string, TodoList> = new Map();

export const todoWriteSkill = buildSkill<TodoWriteInput, TodoWriteOutput>({
  name: 'todo.write',
  description: 'Create, update, or clear todo list for complex tasks',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      items: { type: 'array' },
      status: { type: 'string' },
    },
  },
  policy: {
    readOnly: false,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 5000,
  },
  tags: ['todo', 'task', 'planning', 'meta'],
  searchHint: '创建任务清单，拆解复杂任务，跟踪进度',
  async handler(ctx, input): Promise<TodoWriteOutput> {
    const key = `${ctx.sessionId}:${ctx.taskId ?? 'default'}`;
    let todoList = todoStore.get(key) ?? {
      sessionId: ctx.sessionId,
      taskId: ctx.taskId,
      items: [],
    };

    switch (input.action) {
      case 'create': {
        if (!input.items || input.items.length === 0) {
          throw new Error('Items required for create action');
        }
        
        const now = Date.now();
        const newItems: TodoItem[] = input.items.map(item => ({
          id: item.id ?? `todo_${now}_${Math.random().toString(36).substring(2, 6)}`,
          content: item.content,
          status: item.status ?? 'pending',
          priority: item.priority ?? 'medium',
          createdAt: now,
          updatedAt: now,
        }));
        
        todoList.items = [...todoList.items, ...newItems];
        break;
      }

      case 'update': {
        if (!input.items || !input.status) {
          throw new Error('Items and status required for update action');
        }
        
        for (const update of input.items) {
          const idx = todoList.items.findIndex(i => i.id === update.id);
          if (idx >= 0) {
            todoList.items[idx] = {
              ...todoList.items[idx],
              status: update.status ?? todoList.items[idx].status,
              updatedAt: Date.now(),
            };
          }
        }
        break;
      }

      case 'clear': {
        todoList.items = [];
        break;
      }
    }

    todoStore.set(key, todoList);

    // 记录到任务日志
    if (ctx.taskId) {
      ctx.tasks.appendOutput(
        ctx.taskId,
        `📝 Todo: ${input.action} - ${todoList.items.length} items\n`,
      );
    }

    return {
      success: true,
      todoList,
      message: `Todo ${input.action}d: ${todoList.items.length} items`,
    };
  },
});
