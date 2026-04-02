/**
 * Verification Rules - 验证规则
 * 
 * 定义任务验证的检查规则。
 */

import { CheckItem, CheckStatus } from '../tools/meta/task_verify';

/** 验证规则 */
export interface VerificationRule {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description: string;
  /** 检查函数 */
  check: (context: VerificationContext) => CheckItem;
  /** 是否必需 */
  required: boolean;
}

/** 验证上下文 */
export interface VerificationContext {
  taskId?: string;
  hasCodeChanges: boolean;
  hasTestCommand: boolean;
  todoPending: number;
  outputEmpty: boolean;
  taskStatus: string;
  taskError?: string;
  highRiskOperations: number;
}

/** 默认验证规则 */
export const DEFAULT_RULES: VerificationRule[] = [
  {
    id: 'todo_complete',
    description: 'All todo items completed',
    check: (ctx) => ({
      item: 'Todo items completed',
      status: ctx.todoPending > 0 ? 'fail' : 'pass',
      note: ctx.todoPending > 0 ? `${ctx.todoPending} items pending` : 'All completed',
    }),
    required: true,
  },
  {
    id: 'output_exists',
    description: 'Task output log exists',
    check: (ctx) => ({
      item: 'Output log exists',
      status: ctx.outputEmpty ? 'warn' : 'pass',
      note: ctx.outputEmpty ? 'Task output is empty' : 'Output logged',
    }),
    required: false,
  },
  {
    id: 'task_status',
    description: 'Task status is completed',
    check: (ctx) => ({
      item: 'Task status',
      status: ctx.taskStatus === 'completed' ? 'pass' : ctx.taskStatus === 'failed' || ctx.taskStatus === 'cancelled' ? 'fail' : 'warn',
      note: `Status: ${ctx.taskStatus}${ctx.taskError ? ` - ${ctx.taskError}` : ''}`,
    }),
    required: true,
  },
  {
    id: 'code_test',
    description: 'Code changes have test command',
    check: (ctx) => {
      if (!ctx.hasCodeChanges) {
        return {
          item: 'Code changes have test command',
          status: 'pass',
          note: 'No code changes',
        };
      }
      return {
        item: 'Code changes have test command',
        status: ctx.hasTestCommand ? 'pass' : 'warn',
        note: ctx.hasTestCommand ? 'Test command found' : 'No test command detected',
      };
    },
    required: false,
  },
  {
    id: 'high_risk_approved',
    description: 'High-risk operations approved',
    check: (ctx) => ({
      item: 'High-risk operations approved',
      status: ctx.highRiskOperations > 0 ? 'warn' : 'pass',
      note: ctx.highRiskOperations > 0 ? `${ctx.highRiskOperations} high-risk operations` : 'No high-risk operations',
    }),
    required: false,
  },
];

/**
 * 执行验证
 */
export function verify(context: VerificationContext): {
  ok: boolean;
  checklist: CheckItem[];
  summary: string;
} {
  const checklist = DEFAULT_RULES.map(rule => rule.check(context));
  
  const passCount = checklist.filter(c => c.status === 'pass').length;
  const warnCount = checklist.filter(c => c.status === 'warn').length;
  const failCount = checklist.filter(c => c.status === 'fail').length;
  
  // 检查必需规则
  const requiredFails = DEFAULT_RULES
    .filter(r => r.required)
    .some(rule => {
      const check = rule.check(context);
      return check.status === 'fail';
    });
  
  const ok = !requiredFails;
  const summary = `Verification: ${passCount} pass, ${warnCount} warn, ${failCount} fail. ${ok ? 'Ready for delivery.' : 'Issues need attention.'}`;
  
  return { ok, checklist, summary };
}
