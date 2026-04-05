/**
 * Agent Teams / Subagents - HookBus 事件注册
 * 
 * 定义所有团队/子代理相关 Hook 事件
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SubagentTask,
  SubagentResult,
  TeamContext,
  MergedResult,
  BudgetSpec,
} from "./types";
import type {
  SubagentStartEvent,
  SubagentStopEvent,
  SubagentFailEvent,
  SubagentTimeoutEvent,
  SubagentHandoffEvent,
  SubagentBudgetExceededEvent,
} from "./subagent_runner";
import type {
  TeamCreateEvent,
  TeamCompleteEvent,
  TeamFailEvent,
  TeamCancelEvent,
  TeamMergeEvent,
} from "./team_orchestrator";

// ============================================================================
// 统一事件类型
// ============================================================================

/**
 * 所有 Agent Teams 相关的 Hook 事件
 */
export type AgentTeamHookEvent =
  | SubagentStartEvent
  | SubagentStopEvent
  | SubagentFailEvent
  | SubagentTimeoutEvent
  | SubagentHandoffEvent
  | SubagentBudgetExceededEvent
  | TeamCreateEvent
  | TeamCompleteEvent
  | TeamFailEvent
  | TeamCancelEvent
  | TeamMergeEvent;

/**
 * Hook 事件类型字符串
 */
export type AgentTeamHookType = AgentTeamHookEvent["type"];

// ============================================================================
// Hook 处理器接口
// ============================================================================

/**
 * Hook 处理器函数
 */
export type HookHandler<T extends AgentTeamHookEvent = AgentTeamHookEvent> = (
  event: T
) => Promise<void> | void;

/**
 * HookBus 接口（完整版）
 */
export interface IAgentTeamHookBus {
  on<T extends AgentTeamHookEvent>(
    type: T["type"],
    handler: HookHandler<T>
  ): void;
  
  off<T extends AgentTeamHookEvent>(
    type: T["type"],
    handler: HookHandler<T>
  ): void;
  
  emit(event: AgentTeamHookEvent): Promise<void>;
  
  clear(): void;
}

// ============================================================================
// HookBus 实现
// ============================================================================

export class AgentTeamHookBus implements IAgentTeamHookBus {
  private handlers: Map<string, Set<HookHandler>> = new Map();
  
  /**
   * 注册事件处理器
   */
  on<T extends AgentTeamHookEvent>(
    type: T["type"],
    handler: HookHandler<T>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as HookHandler);
  }
  
  /**
   * 注销事件处理器
   */
  off<T extends AgentTeamHookEvent>(
    type: T["type"],
    handler: HookHandler<T>
  ): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as HookHandler);
    }
  }
  
  /**
   * 触发事件
   */
  async emit(event: AgentTeamHookEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) {
      return;
    }
    
    // 并行执行所有处理器
    await Promise.all(
      Array.from(handlers).map(handler => {
        try {
          return handler(event);
        } catch (error) {
          console.error(`Hook handler error for ${event.type}:`, error);
          return Promise.resolve();
        }
      })
    );
  }
  
  /**
   * 清空所有处理器
   */
  clear(): void {
    this.handlers.clear();
  }
  
  /**
   * 获取注册的处理器数量
   */
  getHandlerCount(type?: string): number {
    if (type) {
      return this.handlers.get(type)?.size || 0;
    }
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }
}

// ============================================================================
// 内置 Hook 处理器
// ============================================================================

/**
 * 日志记录处理器
 */
export function createLoggingHandler(
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
  } = console
): HookHandler {
  return async (event: AgentTeamHookEvent) => {
    const meta = {
      timestamp: new Date(event.timestamp).toISOString(),
      teamId: "teamId" in event ? event.teamId : undefined,
      taskId: "taskId" in event ? event.taskId : undefined,
    };
    
    switch (event.type) {
      case "SubagentStart":
        logger.info(`[SubagentStart] ${event.agent} starting: ${event.goal}`, {
          ...meta,
          budget: event.budget,
        });
        break;
        
      case "SubagentStop":
        logger.info(`[SubagentStop] ${event.taskId} ${event.reason}`, {
          ...meta,
          hasResult: !!event.result,
        });
        break;
        
      case "SubagentFail":
        logger.warn(`[SubagentFail] ${event.taskId}: ${event.error.message}`, {
          ...meta,
          recoverable: event.recoverable,
        });
        break;
        
      case "SubagentTimeout":
        logger.warn(`[SubagentTimeout] ${event.taskId}: ${event.timeoutMs}ms`, {
          ...meta,
          turnsCompleted: event.turnsCompleted,
        });
        break;
        
      case "SubagentBudgetExceeded":
        logger.warn(
          `[SubagentBudgetExceeded] ${event.taskId}: ${event.budgetType} (${event.used}/${event.limit})`,
          meta
        );
        break;
        
      case "TeamCreate":
        logger.info(
          `[TeamCreate] ${event.teamId}: ${event.agents.length} agents`,
          {
            ...meta,
            agents: event.agents,
            budget: event.totalBudget,
          }
        );
        break;
        
      case "TeamComplete":
        logger.info(
          `[TeamComplete] ${event.teamId}: ${event.results.length} results, ${event.durationMs}ms`,
          {
            ...meta,
            summary: event.mergedResult.summary.slice(0, 100),
          }
        );
        break;
        
      case "TeamFail":
        logger.error(`[TeamFail] ${event.teamId}: ${event.reason}`, {
          ...meta,
          failedTasks: event.failedTasks,
        });
        break;
        
      case "TeamCancel":
        logger.info(`[TeamCancel] ${event.teamId}: ${event.reason}`, {
          ...meta,
          cancelledTasks: event.cancelledTasks,
        });
        break;
        
      case "TeamMerge":
        logger.info(
          `[TeamMerge] ${event.teamId}: ${event.resultsCount} results merged`,
          {
            ...meta,
            summaryLength: event.mergedSummary.length,
          }
        );
        break;
    }
  };
}

/**
 * 审计日志处理器（记录到文件/数据库）
 */
export function createAuditHandler(
  auditLog: (event: AgentTeamHookEvent) => Promise<void>
): HookHandler {
  return async (event: AgentTeamHookEvent) => {
    try {
      await auditLog(event);
    } catch (error) {
      console.error("Audit handler failed:", error);
    }
  };
}

/**
 * 通知处理器（发送 Telegram/Slack 等）
 */
export function createNotificationHandler(
  notifier: {
    send: (message: string, options?: { level?: "info" | "warn" | "error" }) => Promise<void>;
  }
): HookHandler {
  return async (event: AgentTeamHookEvent) => {
    // 只通知重要事件
    const notifyEvents: AgentTeamHookType[] = [
      "SubagentFail",
      "SubagentTimeout",
      "SubagentBudgetExceeded",
      "TeamFail",
    ];
    
    if (!notifyEvents.includes(event.type)) {
      return;
    }
    
    const messages: Record<string, string> = {
      SubagentFail: `❌ 子代理失败：${"taskId" in event ? event.taskId : "unknown"}`,
      SubagentTimeout: `⏰ 子代理超时：${"taskId" in event ? event.taskId : "unknown"}`,
      SubagentBudgetExceeded: `💸 预算超限：${"taskId" in event ? event.taskId : "unknown"}`,
      TeamFail: `🔴 团队执行失败：${event.teamId}`,
    };
    
    const levels: Record<string, "info" | "warn" | "error"> = {
      SubagentFail: "warn",
      SubagentTimeout: "warn",
      SubagentBudgetExceeded: "warn",
      TeamFail: "error",
    };
    
    const message = messages[event.type];
    if (message) {
      await notifier.send(message, { level: levels[event.type] });
    }
  };
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 HookBus 实例（带默认处理器）
 */
export function createAgentTeamHookBus(options?: {
  enableLogging?: boolean;
  enableAudit?: boolean;
  notifier?: { send: (msg: string, options?: { level?: string }) => Promise<void> };
}): IAgentTeamHookBus {
  const bus = new AgentTeamHookBus();
  
  if (options?.enableLogging) {
    bus.on("SubagentStart", createLoggingHandler() as HookHandler<SubagentStartEvent>);
    bus.on("SubagentStop", createLoggingHandler() as HookHandler<SubagentStopEvent>);
    bus.on("SubagentFail", createLoggingHandler() as HookHandler<SubagentFailEvent>);
    bus.on("TeamCreate", createLoggingHandler() as HookHandler<TeamCreateEvent>);
    bus.on("TeamComplete", createLoggingHandler() as HookHandler<TeamCompleteEvent>);
    bus.on("TeamFail", createLoggingHandler() as HookHandler<TeamFailEvent>);
  }
  
  return bus;
}

// ============================================================================
// 事件查询工具
// ============================================================================

/**
 * 检查事件是否是子代理事件
 */
export function isSubagentEvent(
  event: AgentTeamHookEvent
): event is
  | SubagentStartEvent
  | SubagentStopEvent
  | SubagentFailEvent
  | SubagentTimeoutEvent
  | SubagentHandoffEvent
  | SubagentBudgetExceededEvent {
  return event.type.startsWith("Subagent");
}

/**
 * 检查事件是否是团队事件
 */
export function isTeamEvent(
  event: AgentTeamHookEvent
): event is
  | TeamCreateEvent
  | TeamCompleteEvent
  | TeamFailEvent
  | TeamCancelEvent
  | TeamMergeEvent {
  return event.type.startsWith("Team");
}

/**
 * 检查事件是否是失败事件
 */
export function isFailureEvent(
  event: AgentTeamHookEvent
): boolean {
  return [
    "SubagentFail",
    "SubagentTimeout",
    "SubagentBudgetExceeded",
    "TeamFail",
  ].includes(event.type);
}

/**
 * 获取事件的团队 ID
 */
export function getTeamIdFromEvent(event: AgentTeamHookEvent): string {
  return event.teamId;
}

/**
 * 获取事件的任务 ID（如果是子代理事件）
 */
export function getTaskIdFromEvent(event: AgentTeamHookEvent): string | undefined {
  return "taskId" in event ? event.taskId : undefined;
}
