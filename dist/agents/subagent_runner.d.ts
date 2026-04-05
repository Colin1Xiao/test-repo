/**
 * Agent Teams / Subagents - 子代理执行器
 *
 * 最小可运行版本：支持 mock 执行 + 预算跟踪 + Hook 触发
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentTask, SubagentResult, TeamContext, BudgetSpec } from "./types";
export type HookEventType = "SubagentStart" | "SubagentStop" | "SubagentFail" | "SubagentTimeout" | "SubagentHandoff" | "SubagentBudgetExceeded";
export interface HookEvent {
    type: HookEventType;
    taskId: string;
    teamId: string;
    timestamp: number;
    [key: string]: unknown;
}
export interface SubagentStartEvent extends HookEvent {
    type: "SubagentStart";
    agent: string;
    goal: string;
    budget: BudgetSpec;
}
export interface SubagentStopEvent extends HookEvent {
    type: "SubagentStop";
    reason: "completed" | "cancelled" | "failed";
    result?: SubagentResult;
}
export interface SubagentFailEvent extends HookEvent {
    type: "SubagentFail";
    error: {
        type: string;
        message: string;
    };
    recoverable: boolean;
}
export interface SubagentTimeoutEvent extends HookEvent {
    type: "SubagentTimeout";
    timeoutMs: number;
    turnsCompleted: number;
}
export interface SubagentHandoffEvent extends HookEvent {
    type: "SubagentHandoff";
    fromTaskId: string;
    toTaskId: string;
    context: Record<string, unknown>;
}
export interface SubagentBudgetExceededEvent extends HookEvent {
    type: "SubagentBudgetExceeded";
    budgetType: "turns" | "tokens" | "timeout";
    limit: number;
    used: number;
}
export interface IHookBus {
    emit(event: HookEvent): Promise<void>;
}
/**
 * 空 HookBus（用于无 Hook 环境）
 */
export declare class NoOpHookBus implements IHookBus {
    emit(_event: HookEvent): Promise<void>;
}
export interface ISubagentRunner {
    run(task: SubagentTask, context: TeamContext): Promise<SubagentResult>;
    stop(taskId: string, reason?: string): Promise<void>;
    getStatus(taskId: string): Promise<SubagentTask>;
}
export declare class SubagentRunner implements ISubagentRunner {
    private tasks;
    private hookBus;
    constructor(hookBus?: IHookBus);
    /**
     * 运行子代理任务
     *
     * @param task - 子任务定义
     * @param context - 团队上下文
     * @returns 执行结果
     */
    run(task: SubagentTask, context: TeamContext): Promise<SubagentResult>;
    /**
     * 停止子代理
     */
    stop(taskId: string, reason?: string): Promise<void>;
    /**
     * 获取任务状态
     */
    getStatus(taskId: string): Promise<SubagentTask>;
    /**
     * 执行角色任务（mock 版本）
     *
     * 第一版先用简单 mock，后续替换为真实模型调用
     */
    private executeRole;
    /**
     * 检查预算
     */
    private checkBudget;
    /**
     * 创建错误结果
     */
    private createErrorResult;
    private emitStart;
    private emitStop;
    private emitFail;
    private emitTimeout;
    private emitBudgetExceeded;
    /**
     * 工具方法：休眠
     */
    private sleep;
}
/**
 * 创建 SubagentRunner 实例
 */
export declare function createSubagentRunner(hookBus?: IHookBus): ISubagentRunner;
