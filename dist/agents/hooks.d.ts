/**
 * Agent Teams / Subagents - HookBus 事件注册
 *
 * 定义所有团队/子代理相关 Hook 事件
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentStartEvent, SubagentStopEvent, SubagentFailEvent, SubagentTimeoutEvent, SubagentHandoffEvent, SubagentBudgetExceededEvent } from "./subagent_runner";
import type { TeamCreateEvent, TeamCompleteEvent, TeamFailEvent, TeamCancelEvent, TeamMergeEvent } from "./team_orchestrator";
/**
 * 所有 Agent Teams 相关的 Hook 事件
 */
export type AgentTeamHookEvent = SubagentStartEvent | SubagentStopEvent | SubagentFailEvent | SubagentTimeoutEvent | SubagentHandoffEvent | SubagentBudgetExceededEvent | TeamCreateEvent | TeamCompleteEvent | TeamFailEvent | TeamCancelEvent | TeamMergeEvent;
/**
 * Hook 事件类型字符串
 */
export type AgentTeamHookType = AgentTeamHookEvent["type"];
/**
 * Hook 处理器函数
 */
export type HookHandler<T extends AgentTeamHookEvent = AgentTeamHookEvent> = (event: T) => Promise<void> | void;
/**
 * HookBus 接口（完整版）
 */
export interface IAgentTeamHookBus {
    on<T extends AgentTeamHookEvent>(type: T["type"], handler: HookHandler<T>): void;
    off<T extends AgentTeamHookEvent>(type: T["type"], handler: HookHandler<T>): void;
    emit(event: AgentTeamHookEvent): Promise<void>;
    clear(): void;
}
export declare class AgentTeamHookBus implements IAgentTeamHookBus {
    private handlers;
    /**
     * 注册事件处理器
     */
    on<T extends AgentTeamHookEvent>(type: T["type"], handler: HookHandler<T>): void;
    /**
     * 注销事件处理器
     */
    off<T extends AgentTeamHookEvent>(type: T["type"], handler: HookHandler<T>): void;
    /**
     * 触发事件
     */
    emit(event: AgentTeamHookEvent): Promise<void>;
    /**
     * 清空所有处理器
     */
    clear(): void;
    /**
     * 获取注册的处理器数量
     */
    getHandlerCount(type?: string): number;
}
/**
 * 日志记录处理器
 */
export declare function createLoggingHandler(logger?: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
}): HookHandler;
/**
 * 审计日志处理器（记录到文件/数据库）
 */
export declare function createAuditHandler(auditLog: (event: AgentTeamHookEvent) => Promise<void>): HookHandler;
/**
 * 通知处理器（发送 Telegram/Slack 等）
 */
export declare function createNotificationHandler(notifier: {
    send: (message: string, options?: {
        level?: "info" | "warn" | "error";
    }) => Promise<void>;
}): HookHandler;
/**
 * 创建 HookBus 实例（带默认处理器）
 */
export declare function createAgentTeamHookBus(options?: {
    enableLogging?: boolean;
    enableAudit?: boolean;
    notifier?: {
        send: (msg: string, options?: {
            level?: string;
        }) => Promise<void>;
    };
}): IAgentTeamHookBus;
/**
 * 检查事件是否是子代理事件
 */
export declare function isSubagentEvent(event: AgentTeamHookEvent): event is SubagentStartEvent | SubagentStopEvent | SubagentFailEvent | SubagentTimeoutEvent | SubagentHandoffEvent | SubagentBudgetExceededEvent;
/**
 * 检查事件是否是团队事件
 */
export declare function isTeamEvent(event: AgentTeamHookEvent): event is TeamCreateEvent | TeamCompleteEvent | TeamFailEvent | TeamCancelEvent | TeamMergeEvent;
/**
 * 检查事件是否是失败事件
 */
export declare function isFailureEvent(event: AgentTeamHookEvent): boolean;
/**
 * 获取事件的团队 ID
 */
export declare function getTeamIdFromEvent(event: AgentTeamHookEvent): string;
/**
 * 获取事件的任务 ID（如果是子代理事件）
 */
export declare function getTaskIdFromEvent(event: AgentTeamHookEvent): string | undefined;
