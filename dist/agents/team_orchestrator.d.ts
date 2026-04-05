/**
 * Agent Teams / Subagents - 团队编排器
 *
 * 核心调度器：创建团队、调度子代理、归并结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentTask, SubagentResult, TeamContext, BudgetSpec, MergedResult } from "./types";
import type { ITeamOrchestrator, CreateTeamParams, DelegateTaskParams, WaitForOptions } from "./types";
import type { ISubagentRunner } from "./subagent_runner";
import { IHookBus } from "./subagent_runner";
export type TeamHookEventType = "TeamCreate" | "TeamComplete" | "TeamFail" | "TeamCancel" | "TeamMerge";
export interface TeamHookEvent {
    type: TeamHookEventType;
    teamId: string;
    timestamp: number;
    [key: string]: unknown;
}
export interface TeamCreateEvent extends TeamHookEvent {
    type: "TeamCreate";
    parentTaskId: string;
    agents: string[];
    totalBudget: BudgetSpec;
}
export interface TeamCompleteEvent extends TeamHookEvent {
    type: "TeamComplete";
    results: SubagentResult[];
    mergedResult: MergedResult;
    durationMs: number;
}
export interface TeamFailEvent extends TeamHookEvent {
    type: "TeamFail";
    reason: string;
    failedTasks: string[];
}
export interface TeamCancelEvent extends TeamHookEvent {
    type: "TeamCancel";
    reason: string;
    cancelledTasks: string[];
}
export interface TeamMergeEvent extends TeamHookEvent {
    type: "TeamMerge";
    resultsCount: number;
    mergedSummary: string;
}
export declare class TeamOrchestrator implements ITeamOrchestrator {
    private teams;
    private runner;
    private hookBus;
    constructor(runner?: ISubagentRunner, hookBus?: IHookBus);
    /**
     * 创建子代理团队
     */
    createTeam(params: CreateTeamParams): Promise<TeamContext>;
    /**
     * 动态添加子任务到团队
     */
    delegateTask(params: DelegateTaskParams): Promise<SubagentTask>;
    /**
     * 等待团队所有子代理完成
     *
     * 支持：
     * - 串行执行（有依赖）
     * - 简单 fan-out（无依赖）
     * - 失败处理
     */
    waitForCompletion(teamId: string, options?: WaitForOptions): Promise<SubagentResult[]>;
    /**
     * 归并多个子代理结果
     */
    mergeResults(results: SubagentResult[]): Promise<MergedResult>;
    /**
     * 取消团队执行
     */
    cancelTeam(teamId: string, reason?: string): Promise<void>;
    /**
     * 获取团队状态
     */
    getTeamStatus(teamId: string): Promise<TeamContext>;
    /**
     * 执行单个任务
     */
    private executeTask;
    /**
     * 检查依赖是否已满足
     */
    private areDependenciesSatisfied;
    /**
     * 生成团队执行摘要
     */
    private generateSummary;
    /**
     * 生成唯一 ID
     */
    private generateId;
    /**
     * 触发 TeamFail Hook
     */
    private emitTeamFail;
    /**
     * 触发 TeamComplete Hook
     */
    private emitTeamComplete;
}
/**
 * 创建 TeamOrchestrator 实例
 */
export declare function createTeamOrchestrator(runner?: ISubagentRunner, hookBus?: IHookBus): ITeamOrchestrator;
/**
 * 创建并执行团队（便捷函数）
 */
export declare function runTeam(params: CreateTeamParams, runner?: ISubagentRunner, hookBus?: IHookBus): Promise<{
    context: TeamContext;
    results: SubagentResult[];
    merged: MergedResult;
}>;
