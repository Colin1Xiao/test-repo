/**
 * CLI Router
 * Phase 2A-1 - CLI 命令解析层
 * 
 * 职责：将 CLI 文本命令解析为 OperatorCommand
 */

import type {
  OperatorActorContext,
  OperatorCommand,
  OperatorActionType,
  OperatorTargetType,
  OperatorSurface,
} from "../types/surface_types";

export interface CliContext {
  actor: OperatorActorContext;
}

export interface CliRouter {
  /**
   * 解析 CLI 原始输入为 OperatorCommand
   * @param rawInput - 原始命令行输入，如 "oc approve apv_123"
   * @param context - CLI 上下文（包含 actor 信息）
   * @returns 标准化 OperatorCommand
   */
  parse(rawInput: string, context: CliContext): OperatorCommand;
}

// ============================================================================
// CLI 命令词典
// ============================================================================

/**
 * 一级命令词典
 */
const VIEW_COMMANDS = [
  "status",
  "dashboard",
  "tasks",
  "approvals",
  "incidents",
  "agents",
  "inbox",
  "interventions",
  "history",
];

const OPEN_COMMAND = "open";

const CONTROL_COMMANDS = [
  "approve",
  "reject",
  "escalate",
  "ack",
  "recover",
  "replay",
  "retry",
  "cancel",
  "pause",
  "resume",
  "inspect",
];

const HITL_COMMANDS = ["confirm", "dismiss", "snooze"];

const NAV_COMMANDS = ["workspace", "back", "refresh"];

// ============================================================================
// 命令映射配置
// ============================================================================

interface CommandPattern {
  commandType: OperatorActionType;
  targetType?: OperatorTargetType;
  minArgs: number;
  maxArgs: number;
  argNames?: string[];
}

const COMMAND_PATTERNS: Record<string, CommandPattern> = {
  // 视图命令
  status: { commandType: "view_dashboard", targetType: "dashboard", minArgs: 0, maxArgs: 0 },
  dashboard: { commandType: "view_dashboard", targetType: "dashboard", minArgs: 0, maxArgs: 0 },
  tasks: { commandType: "view_tasks", targetType: "task", minArgs: 0, maxArgs: 0 },
  approvals: { commandType: "view_approvals", targetType: "approval", minArgs: 0, maxArgs: 0 },
  incidents: { commandType: "view_incidents", targetType: "incident", minArgs: 0, maxArgs: 0 },
  agents: { commandType: "view_agents", targetType: "agent", minArgs: 0, maxArgs: 0 },
  inbox: { commandType: "view_inbox", targetType: "inbox", minArgs: 0, maxArgs: 0 },
  interventions: { commandType: "view_interventions", targetType: "intervention", minArgs: 0, maxArgs: 0 },
  history: { commandType: "view_history", targetType: "history", minArgs: 0, maxArgs: 0 },

  // 打开详情
  "open task": { commandType: "open_item", targetType: "task", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "open approval": { commandType: "open_item", targetType: "approval", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "open incident": { commandType: "open_item", targetType: "incident", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "open agent": { commandType: "open_item", targetType: "agent", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "open intervention": { commandType: "open_item", targetType: "intervention", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },

  // 控制命令
  approve: { commandType: "approve", targetType: "approval", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  reject: { commandType: "reject", targetType: "approval", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "escalate approval": { commandType: "escalate", targetType: "approval", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "ack incident": { commandType: "ack_incident", targetType: "incident", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "recover incident": { commandType: "request_recovery", targetType: "incident", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "replay incident": { commandType: "request_replay", targetType: "incident", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "retry task": { commandType: "retry_task", targetType: "task", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "cancel task": { commandType: "cancel_task", targetType: "task", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "pause task": { commandType: "pause_task", targetType: "task", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "resume task": { commandType: "resume_task", targetType: "task", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "pause agent": { commandType: "pause_agent", targetType: "agent", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "resume agent": { commandType: "resume_agent", targetType: "agent", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "inspect agent": { commandType: "inspect_agent", targetType: "agent", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },

  // HITL 命令
  confirm: { commandType: "confirm_action", targetType: "unknown", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "dismiss intervention": { commandType: "dismiss_intervention", targetType: "intervention", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  "snooze intervention": { commandType: "snooze_intervention", targetType: "intervention", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },

  // 导航命令
  "workspace switch": { commandType: "switch_workspace", targetType: "workspace", minArgs: 1, maxArgs: 1, argNames: ["targetId"] },
  back: { commandType: "go_back", targetType: "unknown", minArgs: 0, maxArgs: 0 },
  refresh: { commandType: "refresh", targetType: "unknown", minArgs: 0, maxArgs: 0 },
};

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultCliRouter implements CliRouter {
  parse(rawInput: string, context: CliContext): OperatorCommand {
    // 移除 "oc " 前缀
    const input = rawInput.trim().replace(/^oc\s+/, "");
    const parts = input.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      // 空命令，默认返回 dashboard
      return this.buildCommand("view_dashboard", "dashboard", undefined, context, rawInput);
    }

    // 尝试匹配多词命令（如 "open task", "workspace switch"）
    for (let i = 2; i >= 1; i--) {
      const prefix = parts.slice(0, i).join(" ");
      if (COMMAND_PATTERNS[prefix]) {
        const pattern = COMMAND_PATTERNS[prefix];
        const args = parts.slice(i);
        
        if (args.length < pattern.minArgs) {
          throw new Error(`Command "${prefix}" requires at least ${pattern.minArgs} argument(s)`);
        }

        const targetId = args[0];
        const params: Record<string, unknown> = {};
        if (pattern.argNames) {
          pattern.argNames.forEach((name, idx) => {
            if (args[idx]) {
              params[name] = args[idx];
            }
          });
        }

        return this.buildCommand(
          pattern.commandType,
          pattern.targetType,
          targetId,
          context,
          rawInput,
          params
        );
      }
    }

    // 尝试匹配单词命令
    const firstWord = parts[0];
    if (COMMAND_PATTERNS[firstWord]) {
      const pattern = COMMAND_PATTERNS[firstWord];
      const args = parts.slice(1);

      if (args.length < pattern.minArgs) {
        throw new Error(`Command "${firstWord}" requires at least ${pattern.minArgs} argument(s)`);
      }

      const targetId = args[0];
      const params: Record<string, unknown> = {};
      if (pattern.argNames) {
        pattern.argNames.forEach((name, idx) => {
          if (args[idx]) {
            params[name] = args[idx];
          }
        });
      }

      return this.buildCommand(
        pattern.commandType,
        pattern.targetType,
        targetId,
        context,
        rawInput,
        params
      );
    }

    throw new Error(`Unknown command: ${firstWord}`);
  }

  private buildCommand(
    commandType: OperatorActionType,
    targetType: OperatorTargetType | undefined,
    targetId: string | undefined,
    context: CliContext,
    rawInput: string,
    params?: Record<string, unknown>
  ): OperatorCommand {
    return {
      id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      surface: "cli" as OperatorSurface,
      commandType,
      targetType,
      targetId,
      params,
      actor: context.actor,
      issuedAt: Date.now(),
      rawInput,
    };
  }
}
