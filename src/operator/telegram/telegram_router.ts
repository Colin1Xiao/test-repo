/**
 * Telegram Router
 * Phase 2A-1 - Telegram 消息/回调解析层
 * 
 * 职责：
 * - 解析 Telegram 文本消息为 OperatorCommand
 * - 解析 Telegram callback 数据为 OperatorCommand
 */

import type {
  OperatorCommand,
  OperatorActionType,
  OperatorTargetType,
  OperatorSurface,
  OperatorActorContext,
} from "../types/surface_types";

export interface TelegramMessageContext {
  chatId: string;
  userId?: string;
  text?: string;
  username?: string;
}

export interface TelegramCallbackContext {
  chatId: string;
  userId?: string;
  callbackData: string;
  username?: string;
}

export interface TelegramRouter {
  /**
   * 解析 Telegram 文本消息
   * @param input - 消息上下文
   * @returns OperatorCommand
   */
  parseMessage(input: TelegramMessageContext): OperatorCommand;

  /**
   * 解析 Telegram callback 回调
   * @param input - 回调上下文
   * @returns OperatorCommand
   */
  parseCallback(input: TelegramCallbackContext): OperatorCommand;
}

// ============================================================================
// Telegram 命令映射
// ============================================================================

const TELEGRAM_COMMAND_MAP: Record<string, OperatorActionType> = {
  "/status": "view_dashboard",
  "/dashboard": "view_dashboard",
  "/tasks": "view_tasks",
  "/approvals": "view_approvals",
  "/incidents": "view_incidents",
  "/agents": "view_agents",
  "/inbox": "view_inbox",
  "/interventions": "view_interventions",
  "/history": "view_history",
  "/approve": "approve",
  "/reject": "reject",
  "/ack": "ack_incident",
  "/retry": "retry_task",
  "/workspace": "switch_workspace",
  "/refresh": "refresh",
};

const TARGET_TYPE_MAP: Record<string, OperatorTargetType> = {
  task: "task",
  approval: "approval",
  incident: "incident",
  agent: "agent",
  intervention: "intervention",
  workspace: "workspace",
};

// ============================================================================
// Callback 数据格式
// oc:<actionType>:<targetType>:<targetId>
// oc:<actionType>:<targetType>:<targetId>:<workspaceId>
// ============================================================================

function parseCallbackData(callbackData: string): {
  actionType?: OperatorActionType;
  targetType?: OperatorTargetType;
  targetId?: string;
  workspaceId?: string;
} {
  const parts = callbackData.split(":");
  
  if (parts[0] !== "oc" || parts.length < 4) {
    return {};
  }

  const [, actionType, targetType, targetId, workspaceId] = parts;

  return {
    actionType: actionType as OperatorActionType,
    targetType: TARGET_TYPE_MAP[targetType],
    targetId,
    workspaceId,
  };
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultTelegramRouter implements TelegramRouter {
  parseMessage(input: TelegramMessageContext): OperatorCommand {
    const text = (input.text || "").trim();
    
    if (!text) {
      throw new Error("Empty message");
    }

    // 解析命令
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();

    const actionType = TELEGRAM_COMMAND_MAP[command];
    if (!actionType) {
      throw new Error(`Unknown command: ${command}`);
    }

    // 提取参数
    let targetId: string | undefined;
    let targetType: OperatorTargetType | undefined;

    // 简单参数解析：/approve <id>, /retry <taskId>
    if (parts.length > 1) {
      targetId = parts[1];
      
      // 根据命令推断 targetType
      if (actionType === "approve" || actionType === "reject") {
        targetType = "approval";
      } else if (actionType === "ack_incident") {
        targetType = "incident";
      } else if (actionType === "retry_task") {
        targetType = "task";
      } else if (actionType === "switch_workspace") {
        targetType = "workspace";
      }
    }

    return this.buildCommand(actionType, targetType, targetId, input);
  }

  parseCallback(input: TelegramCallbackContext): OperatorCommand {
    const parsed = parseCallbackData(input.callbackData);

    if (!parsed.actionType) {
      throw new Error(`Invalid callback data: ${input.callbackData}`);
    }

    const actor: OperatorActorContext = {
      surface: "telegram",
      chatId: input.chatId,
      userId: input.userId,
      workspaceId: parsed.workspaceId,
    };

    return {
      id: `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      surface: "telegram",
      commandType: parsed.actionType,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      actor,
      issuedAt: Date.now(),
      rawInput: input.callbackData,
    };
  }

  private buildCommand(
    actionType: OperatorActionType,
    targetType: OperatorTargetType | undefined,
    targetId: string | undefined,
    input: TelegramMessageContext
  ): OperatorCommand {
    const actor: OperatorActorContext = {
      surface: "telegram",
      chatId: input.chatId,
      userId: input.userId,
      username: input.username,
    };

    return {
      id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      surface: "telegram",
      commandType: actionType,
      targetType,
      targetId,
      actor,
      issuedAt: Date.now(),
      rawInput: input.text,
    };
  }
}
