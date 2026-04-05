/**
 * Agent Teams / Subagents - 状态机
 *
 * 所有状态变化必须通过此模块，禁止直接修改 task.status
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentTask, SubagentStatus, TeamContext, TeamStatus } from "./types";
/**
 * 子代理任务状态转换表
 *
 * 定义合法的状态转换路径
 */
export declare const SUBAGENT_STATE_TRANSITIONS: Record<SubagentStatus, SubagentStatus[]>;
/**
 * 团队状态转换表
 */
export declare const TEAM_STATE_TRANSITIONS: Record<TeamStatus, TeamStatus[]>;
/**
 * 检查子代理状态转换是否合法
 */
export declare function canTransitionSubagent(from: SubagentStatus, to: SubagentStatus): boolean;
/**
 * 检查团队状态转换是否合法
 */
export declare function canTransitionTeam(from: TeamStatus, to: TeamStatus): boolean;
/**
 * 获取所有合法的下一个状态
 */
export declare function getNextStates(status: SubagentStatus): SubagentStatus[];
/**
 * 检查状态是否为终态
 */
export declare function isTerminalState(status: SubagentStatus): boolean;
/**
 * 检查状态是否为终态（团队）
 */
export declare function isTerminalTeamState(status: TeamStatus): boolean;
/**
 * 获取团队所有合法的下一个状态
 */
export declare function getNextTeamStates(status: TeamStatus): TeamStatus[];
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
export declare function transitionSubagent(task: SubagentTask, to: SubagentStatus, meta?: Partial<TransitionMeta>): TransitionResult;
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
export declare function transitionTeam(context: TeamContext, to: TeamStatus, meta?: Partial<TransitionMeta>): TeamTransitionResult;
/**
 * 启动任务（queued → running）
 */
export declare function startTask(task: SubagentTask): TransitionResult;
/**
 * 完成任务（running → done）
 */
export declare function completeTask(task: SubagentTask): TransitionResult;
/**
 * 失败任务（running → failed）
 */
export declare function failTask(task: SubagentTask, error: string, recoverable?: boolean): TransitionResult;
/**
 * 超时任务（running → timeout）
 */
export declare function timeoutTask(task: SubagentTask, timeoutMs: number, turnsCompleted: number): TransitionResult;
/**
 * 预算超限任务（running → budget_exceeded）
 */
export declare function budgetExceededTask(task: SubagentTask, budgetType: "turns" | "tokens" | "timeout", limit: number, used: number): TransitionResult;
/**
 * 取消任务（任意状态 → cancelled）
 */
export declare function cancelTask(task: SubagentTask, reason?: string): TransitionResult;
/**
 * 重试任务（failed/timeout → queued）
 */
export declare function retryTask(task: SubagentTask): TransitionResult;
/**
 * 完成团队（active → completed）
 */
export declare function completeTeam(context: TeamContext): TeamTransitionResult;
/**
 * 失败团队（active → failed）
 */
export declare function failTeam(context: TeamContext, reason: string): TeamTransitionResult;
/**
 * 取消团队（active → cancelled）
 */
export declare function cancelTeam(context: TeamContext, reason?: string): TeamTransitionResult;
/**
 * 获取任务运行时长（毫秒）
 */
export declare function getTaskDuration(task: SubagentTask): number | undefined;
/**
 * 获取团队运行时长（毫秒）
 */
export declare function getTeamDuration(context: TeamContext): number | undefined;
/**
 * 检查任务是否可重试
 */
export declare function isRetryable(task: SubagentTask): boolean;
/**
 * 检查任务是否正在运行
 */
export declare function isRunning(task: SubagentTask): boolean;
/**
 * 检查任务是否已完成（终态）
 */
export declare function isComplete(task: SubagentTask): boolean;
/**
 * 检查团队是否已完成（终态）
 */
export declare function isTeamComplete(context: TeamContext): boolean;
/**
 * 获取所有活跃（非终态）任务
 */
export declare function getActiveTasks(tasks: SubagentTask[]): SubagentTask[];
/**
 * 获取所有成功完成的任务
 */
export declare function getSuccessfulTasks(tasks: SubagentTask[]): SubagentTask[];
/**
 * 获取所有失败的任务
 */
export declare function getFailedTasks(tasks: SubagentTask[]): SubagentTask[];
