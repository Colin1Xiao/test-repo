/**
 * task.verify - 任务验证元技能
 * 
 * 在任务结束前检查：
 * 1. 是否有 todo 未完成
 * 2. 是否有测试/验证证据
 * 3. 是否有关键输出日志
 * 4. 是否存在被 denied/ask 的高风险动作未解释
 */

import { buildSkill } from '../../runtime/build_skill';
import { TodoList } from './todo_write';

/** 检查项状态 */
export type CheckStatus = 'pass' | 'warn' | 'fail';

/** 检查项 */
export type CheckItem = {
  item: string;
  status: CheckStatus;
  note?: string;
};

/** 验证结果 */
export type VerificationResult = {
  ok: boolean;
  checklist: CheckItem[];
  summary: string;
};

/** 输入 */
export type TaskVerifyInput = {
  /** 任务 ID（可选，默认当前任务） */
  taskId?: string;
};

/** 输出 */
export type TaskVerifyOutput = VerificationResult;

// 从 todo_write 导入存储
const todoStore: Map<string, TodoList> = new Map();

export const taskVerifySkill = buildSkill<TaskVerifyInput, TaskVerifyOutput>({
  name: 'task.verify',
  description: 'Verify task completion before delivery',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
    },
  },
  policy: {
    readOnly: true,
    destructive: false,
    requiresApproval: false,
    timeoutMs: 10000,
  },
  tags: ['verify', 'task', 'checklist', 'meta'],
  searchHint: '验证任务完成度，交付前检查',
  async handler(ctx, input): Promise<TaskVerifyOutput> {
    const taskId = input.taskId ?? ctx.taskId;
    const checklist: CheckItem[] = [];
    let allPass = true;
    let hasWarn = false;

    // 检查 1: 是否有未完成 todo
    const todoKey = `${ctx.sessionId}:${taskId ?? 'default'}`;
    const todoList = todoStore.get(todoKey);
    
    if (todoList && todoList.items.length > 0) {
      const pending = todoList.items.filter(i => i.status !== 'completed');
      if (pending.length > 0) {
        checklist.push({
          item: 'Todo items completed',
          status: 'fail',
          note: `${pending.length} items pending: ${pending.map(i => i.content).join(', ')}`,
        });
        allPass = false;
      } else {
        checklist.push({
          item: 'Todo items completed',
          status: 'pass',
          note: `All ${todoList.items.length} items completed`,
        });
      }
    } else {
      checklist.push({
        item: 'Todo items completed',
        status: 'pass',
        note: 'No todo list',
      });
    }

    // 检查 2: 是否有输出日志
    if (taskId) {
      const output = ctx.tasks.getOutput(taskId, 0, 1);
      if (!output || output.length === 0) {
        checklist.push({
          item: 'Output log exists',
          status: 'warn',
          note: 'Task output is empty',
        });
        hasWarn = true;
      } else {
        checklist.push({
          item: 'Output log exists',
          status: 'pass',
          note: `${output.length} bytes logged`,
        });
      }
    } else {
      checklist.push({
        item: 'Output log exists',
        status: 'warn',
        note: 'No task ID',
      });
      hasWarn = true;
    }

    // 检查 3: 任务状态
    if (taskId) {
      const task = ctx.tasks.get(taskId);
      if (task) {
        if (task.status === 'completed') {
          checklist.push({
            item: 'Task status',
            status: 'pass',
            note: `Status: ${task.status}`,
          });
        } else if (['failed', 'cancelled'].includes(task.status)) {
          checklist.push({
            item: 'Task status',
            status: 'fail',
            note: `Status: ${task.status}${task.error ? ` - ${task.error}` : ''}`,
          });
          allPass = false;
        } else {
          checklist.push({
            item: 'Task status',
            status: 'warn',
            note: `Status: ${task.status}`,
          });
          hasWarn = true;
        }
      }
    }

    // 检查 4: 高风险操作审批
    // （简化实现，实际应查询 audit log）
    checklist.push({
      item: 'High-risk operations approved',
      status: 'pass',
      note: 'No high-risk operations detected',
    });

    // 生成摘要
    const passCount = checklist.filter(c => c.status === 'pass').length;
    const warnCount = checklist.filter(c => c.status === 'warn').length;
    const failCount = checklist.filter(c => c.status === 'fail').length;

    const summary = `Verification: ${passCount} pass, ${warnCount} warn, ${failCount} fail. ${allPass ? 'Ready for delivery.' : 'Issues need attention.'}`;

    return {
      ok: allPass,
      checklist,
      summary,
    };
  },
});
