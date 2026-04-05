/**
 * Agent Teams / Subagents - 状态机
 * 
 * 所有状态变化必须通过此模块，禁止直接修改 task.status
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SubagentTask, SubagentStatus, TeamContext, TeamStatus } from "./types";

// ============================================================================
// 状态转换表
// ============================================================================

/**
 * 子代理任务状态转换表
 * 
 * 定义合法的状态转换路径
 */
export const SUBAGENT_STATE_TRANSITIONS: Record<SubagentStatus, SubagentStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["done", "failed", "timeout", "budget_exceeded", "cancelled"],
  done: [],  // 终态
  failed: ["queued"],  // 可重试
  timeout: ["queued"],  // 可重试
  budget_exceeded: [],  // 终态，不可重试
  cancelled: [],  // 终态
};

/**
 * 团队状态转换表
 */
export const TEAM_STATE_TRANSITIONS: Record<TeamStatus, TeamStatus[]> = {
  active: ["completed", "failed", "cancelled"],
  completed: [],  // 终态
  failed: [],  // 终态
  cancelled: [],  // 终态
};

// ============================================================================
// 状态转换守卫
// ============================================================================

/**
 * 检查子代理状态转换是否合法
 */
export function canTransitionSubagent(
  from: SubagentStatus,
  to: SubagentStatus
): boolean {
  const allowed = SUBAGENT_STATE_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * 检查团队状态转换是否合法
 */
export function canTransitionTeam(
  from: TeamStatus,
  to: TeamStatus
): boolean {
  const allowed = TEAM_STATE_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * 获取所有合法的下一个状态
 */
export function getNextStates(status: SubagentStatus): SubagentStatus[] {
  return SUBAGENT_STATE_TRANSITIONS[status] || [];
}

/**
 * 检查状态是否为终态
 */
export function isTerminalState(status: SubagentStatus): boolean {
  return getNextStates(status).length === 0;
}

/**
 * 检查状态是否为终态（团队）
 */
export function isTerminalTeamState(status: TeamStatus): boolean {
  return getNextTeamStates(status).length === 0;
}

/**
 * 获取团队所有合法的下一个状态
 */
export function getNextTeamStates(status: TeamStatus): TeamStatus[] {
  return TEAM_STATE_TRANSITIONS[status] || [];
}

// ============================================================================
// 状态转换器
// ============================================================================

/**
 * 状态转换元数据
 */
export interface TransitionMeta {
  reason?: string;
  error?: string;
  timestamp: number;
  triggeredBy?: "user" | "system" | "timeout" | "budget" | "dependency";
}

/**
 * 子代理任务状态转换结果
 */
export interface TransitionResult {
  success: boolean;
  task: SubagentTask;
  previousState: SubagentStatus;
  newState: SubagentStatus;
  error?: string;
}

/**
 * 执行子代理状态转换
 * 
 * @param task - 任务对象（会被修改）
 * @param to - 目标状态
 * @param meta - 转换元数据
 * @returns 转换结果
 */
export function transitionSubagent(
  task: SubagentTask,
  to: SubagentStatus,
  meta?: Partial<TransitionMeta>
): TransitionResult {
  const from = task.status;
  const timestamp = meta?.timestamp || Date.now();
  
  // 检查转换是否合法
  if (!canTransitionSubagent(from, to)) {
    return {
      success: false,
      task,
      previousState: from,
      newState: to,
      error: `Illegal state transition: ${from} → ${to}. Allowed: ${getNextStates(from).join(", ")}`,
    };
  }
  
  // 保存旧状态
  const previousState = from;
  
  // 执行转换
  task.status = to;
  
  // 更新时间戳
  switch (to) {
    case "running":
      task.startedAt = timestamp;
      break;
    case "done":
    case "failed":
    case "timeout":
    case "budget_exceeded":
    case "cancelled":
      task.completedAt = timestamp;
      break;
  }
  
  // 记录错误信息
  if (meta?.error) {
    task.lastError = meta.error;
  }
  
  // 如果是失败/超时/预算超限，记录原因
  if (meta?.reason && ["failed", "timeout", "budget_exceeded", "cancelled"].includes(to)) {
    if (!task.lastError) {
      task.lastError = meta.reason;
    }
  }
  
  return {
    success: true,
    task,
    previousState,
    newState: to,
  };
}

/**
 * 团队状态转换结果
 */
export interface TeamTransitionResult {
  success: boolean;
  context: TeamContext;
  previousState: TeamStatus;
  newState: TeamStatus;
  error?: string;
}

/**
 * 执行团队状态转换
 * 
 * @param context - 团队上下文（会被修改）
 * @param to - 目标状态
 * @param meta - 转换元数据
 * @returns 转换结果
 */
export function transitionTeam(
  context: TeamContext,
  to: TeamStatus,
  meta?: Partial<TransitionMeta>
): TeamTransitionResult {
  const from = context.status;
  const timestamp = meta?.timestamp || Date.now();
  
  // 检查转换是否合法
  if (!canTransitionTeam(from, to)) {
    return {
      success: false,
      context,
      previousState: from,
      newState: to,
      error: `Illegal team state transition: ${from} → ${to}. Allowed: ${getNextTeamStates(from).join(", ")}`,
    };
  }
  
  // 保存旧状态
  const previousState = from;
  
  // 执行转换
  context.status = to;
  
  // 更新时间戳
  if (to === "completed" || to === "failed" || to === "cancelled") {
    context.completedAt = timestamp;
  }
  
  return {
    success: true,
    context,
    previousState,
    newState: to,
  };
}

// ============================================================================
// 便捷状态转换方法
// ============================================================================

/**
 * 启动任务（queued → running）
 */
export function startTask(task: SubagentTask): TransitionResult {
  return transitionSubagent(task, "running", {
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

/**
 * 完成任务（running → done）
 */
export function completeTask(task: SubagentTask): TransitionResult {
  return transitionSubagent(task, "done", {
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

/**
 * 失败任务（running → failed）
 */
export function failTask(
  task: SubagentTask,
  error: string,
  recoverable = true
): TransitionResult {
  return transitionSubagent(task, "failed", {
    error,
    reason: error,
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

/**
 * 超时任务（running → timeout）
 */
export function timeoutTask(
  task: SubagentTask,
  timeoutMs: number,
  turnsCompleted: number
): TransitionResult {
  return transitionSubagent(task, "timeout", {
    reason: `Timeout after ${timeoutMs}ms (${turnsCompleted} turns completed)`,
    triggeredBy: "timeout",
    timestamp: Date.now(),
  });
}

/**
 * 预算超限任务（running → budget_exceeded）
 */
export function budgetExceededTask(
  task: SubagentTask,
  budgetType: "turns" | "tokens" | "timeout",
  limit: number,
  used: number
): TransitionResult {
  return transitionSubagent(task, "budget_exceeded", {
    reason: `Budget exceeded: ${budgetType} (${used}/${limit})`,
    triggeredBy: "budget",
    timestamp: Date.now(),
  });
}

/**
 * 取消任务（任意状态 → cancelled）
 */
export function cancelTask(task: SubagentTask, reason?: string): TransitionResult {
  if (!canTransitionSubagent(task.status, "cancelled")) {
    return {
      success: false,
      task,
      previousState: task.status,
      newState: "cancelled",
      error: `Cannot cancel task in state: ${task.status}`,
    };
  }
  
  return transitionSubagent(task, "cancelled", {
    reason,
    triggeredBy: "user",
    timestamp: Date.now(),
  });
}

/**
 * 重试任务（failed/timeout → queued）
 */
export function retryTask(task: SubagentTask): TransitionResult {
  if (task.status !== "failed" && task.status !== "timeout") {
    return {
      success: false,
      task,
      previousState: task.status,
      newState: "queued",
      error: `Can only retry failed or timeout tasks, current state: ${task.status}`,
    };
  }
  
  // 重置部分字段
  task.currentTurn = 0;
  task.lastError = undefined;
  
  return transitionSubagent(task, "queued", {
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

// ============================================================================
// 团队状态便捷方法
// ============================================================================

/**
 * 完成团队（active → completed）
 */
export function completeTeam(context: TeamContext): TeamTransitionResult {
  return transitionTeam(context, "completed", {
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

/**
 * 失败团队（active → failed）
 */
export function failTeam(
  context: TeamContext,
  reason: string
): TeamTransitionResult {
  return transitionTeam(context, "failed", {
    reason,
    triggeredBy: "system",
    timestamp: Date.now(),
  });
}

/**
 * 取消团队（active → cancelled）
 */
export function cancelTeam(
  context: TeamContext,
  reason?: string
): TeamTransitionResult {
  return transitionTeam(context, "cancelled", {
    reason,
    triggeredBy: "user",
    timestamp: Date.now(),
  });
}

// ============================================================================
// 状态查询工具
// ============================================================================

/**
 * 获取任务运行时长（毫秒）
 */
export function getTaskDuration(task: SubagentTask): number | undefined {
  if (!task.startedAt) {
    return undefined;
  }
  return (task.completedAt || Date.now()) - task.startedAt;
}

/**
 * 获取团队运行时长（毫秒）
 */
export function getTeamDuration(context: TeamContext): number | undefined {
  const createdAt = context.createdAt;
  const completedAt = context.completedAt || Date.now();
  return completedAt - createdAt;
}

/**
 * 检查任务是否可重试
 */
export function isRetryable(task: SubagentTask): boolean {
  return task.status === "failed" || task.status === "timeout";
}

/**
 * 检查任务是否正在运行
 */
export function isRunning(task: SubagentTask): boolean {
  return task.status === "running";
}

/**
 * 检查任务是否已完成（终态）
 */
export function isComplete(task: SubagentTask): boolean {
  return isTerminalState(task.status);
}

/**
 * 检查团队是否已完成（终态）
 */
export function isTeamComplete(context: TeamContext): boolean {
  return isTerminalTeamState(context.status);
}

/**
 * 获取所有活跃（非终态）任务
 */
export function getActiveTasks(tasks: SubagentTask[]): SubagentTask[] {
  return tasks.filter(t => !isComplete(t));
}

/**
 * 获取所有成功完成的任务
 */
export function getSuccessfulTasks(tasks: SubagentTask[]): SubagentTask[] {
  return tasks.filter(t => t.status === "done");
}

/**
 * 获取所有失败的任务
 */
export function getFailedTasks(tasks: SubagentTask[]): SubagentTask[] {
  return tasks.filter(t => 
    t.status === "failed" || 
    t.status === "timeout" || 
    t.status === "budget_exceeded"
  );
}
