/**
 * Operator Command Dispatch
 * Phase 2A-1 - 命令分发层
 * 
 * 职责：
 * - 接受统一 OperatorCommand
 * - 映射到：view action / control action / hitl action / navigation action
 * - 返回 OperatorCommandResult
 */

import type {
  DispatchContext,
  OperatorCommand,
  OperatorCommandResult,
} from "../types/surface_types";

export interface OperatorCommandDispatch {
  /**
   * 分发命令到对应处理器
   * @param command - 标准化命令对象
   * @param context - 分发上下文（包含 actor、navigation 状态等）
   * @returns 命令执行结果
   */
  dispatch(
    command: OperatorCommand,
    context?: DispatchContext
  ): Promise<OperatorCommandResult>;
}

// ============================================================================
// 命令处理器分类
// ============================================================================

export type CommandHandlerCategory =
  | "view"
  | "control"
  | "hitl"
  | "navigation";

// ============================================================================
// 命令映射表 (Registry)
// ============================================================================

/**
 * 命令映射配置
 * commandType -> { category, targetType, handler }
 */
export interface CommandMapping {
  category: CommandHandlerCategory;
  targetType: string;
  handler: string;
  returnsUpdatedView: boolean;
  returnsActionResult: boolean;
}

export const COMMAND_REGISTRY: Record<string, CommandMapping> = {
  // View 类
  view_dashboard: {
    category: "view",
    targetType: "dashboard",
    handler: "surfaceService.getDashboardView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_tasks: {
    category: "view",
    targetType: "task",
    handler: "surfaceService.getTaskView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_approvals: {
    category: "view",
    targetType: "approval",
    handler: "surfaceService.getApprovalView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_incidents: {
    category: "view",
    targetType: "incident",
    handler: "surfaceService.getIncidentView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_agents: {
    category: "view",
    targetType: "agent",
    handler: "surfaceService.getAgentView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_inbox: {
    category: "view",
    targetType: "inbox",
    handler: "surfaceService.getInboxView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_interventions: {
    category: "view",
    targetType: "intervention",
    handler: "surfaceService.getInterventionView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  view_history: {
    category: "view",
    targetType: "history",
    handler: "surfaceService.getHistoryView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  open_item: {
    category: "view",
    targetType: "any",
    handler: "surfaceService.getItemDetailView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  refresh: {
    category: "view",
    targetType: "current",
    handler: "surfaceService.getView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },

  // Control 类
  approve: {
    category: "control",
    targetType: "approval",
    handler: "control/hitl approve flow",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  reject: {
    category: "control",
    targetType: "approval",
    handler: "control/hitl reject flow",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  escalate: {
    category: "control",
    targetType: "approval/incident/intervention",
    handler: "hitl escalation flow",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  ack_incident: {
    category: "control",
    targetType: "incident",
    handler: "incident workflow ack",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  request_recovery: {
    category: "control",
    targetType: "incident",
    handler: "recovery engine",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  request_replay: {
    category: "control",
    targetType: "incident/task",
    handler: "replay engine",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  retry_task: {
    category: "control",
    targetType: "task",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  cancel_task: {
    category: "control",
    targetType: "task",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  pause_task: {
    category: "control",
    targetType: "task",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  resume_task: {
    category: "control",
    targetType: "task",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  pause_agent: {
    category: "control",
    targetType: "agent",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  resume_agent: {
    category: "control",
    targetType: "agent",
    handler: "control surface",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  inspect_agent: {
    category: "control",
    targetType: "agent",
    handler: "surfaceService.getItemDetailView()",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },

  // HITL 类
  confirm_action: {
    category: "hitl",
    targetType: "unknown",
    handler: "confirmation manager",
    returnsUpdatedView: false,
    returnsActionResult: true,
  },
  dismiss_intervention: {
    category: "hitl",
    targetType: "intervention",
    handler: "human loop service",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },
  snooze_intervention: {
    category: "hitl",
    targetType: "intervention",
    handler: "human loop service",
    returnsUpdatedView: true,
    returnsActionResult: true,
  },

  // Navigation 类
  switch_workspace: {
    category: "navigation",
    targetType: "workspace",
    handler: "workspace switcher",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
  go_back: {
    category: "navigation",
    targetType: "unknown",
    handler: "navigation service",
    returnsUpdatedView: true,
    returnsActionResult: false,
  },
};

// ============================================================================
// 2A-1 最小命令集 (首批实现)
// ============================================================================

export const PHASE_2A1_MINIMAL_COMMANDS: string[] = [
  // 视图 (5)
  "view_dashboard",
  "view_tasks",
  "view_approvals",
  "view_incidents",
  "view_inbox",
  // 动作 (5)
  "approve",
  "reject",
  "ack_incident",
  "retry_task",
  "pause_agent",
  // 辅助 (2)
  "switch_workspace",
  "refresh",
];
