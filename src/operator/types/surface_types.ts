/**
 * Operator Surface 类型定义
 * Phase 2A-1 - 核心类型层
 */

// ============================================================================
// 基础枚举类型
// ============================================================================

export type OperatorSurface = "cli" | "telegram" | "web";

export type OperatorViewKind =
  | "dashboard"
  | "tasks"
  | "approvals"
  | "incidents"
  | "agents"
  | "inbox"
  | "interventions"
  | "history"
  | "item_detail";

export type OperatorMode =
  | "summary"
  | "detail"
  | "operator"
  | "management"
  | "incident"
  | "approval_focus"
  | "agent_focus";

export type OperatorActionType =
  | "view_dashboard"
  | "view_tasks"
  | "view_approvals"
  | "view_incidents"
  | "view_agents"
  | "view_inbox"
  | "view_interventions"
  | "view_history"
  | "open_item"
  | "switch_workspace"
  | "approve"
  | "reject"
  | "escalate"
  | "ack_incident"
  | "request_recovery"
  | "request_replay"
  | "retry_task"
  | "cancel_task"
  | "pause_task"
  | "resume_task"
  | "pause_agent"
  | "resume_agent"
  | "inspect_agent"
  | "confirm_action"
  | "dismiss_intervention"
  | "snooze_intervention"
  | "go_back"
  | "refresh";

export type OperatorTargetType =
  | "dashboard"
  | "task"
  | "approval"
  | "incident"
  | "agent"
  | "intervention"
  | "workspace"
  | "history"
  | "inbox"
  | "unknown";

export type OperatorConfirmationState =
  | "none"
  | "pending"
  | "confirmed"
  | "cancelled";

// ============================================================================
// 上下文与状态
// ============================================================================

export interface OperatorNavigationState {
  workspaceId?: string;
  sessionId?: string;
  currentView: OperatorViewKind;
  selectedItemId?: string;
  selectedTargetType?: OperatorTargetType;
  previousView?: OperatorViewKind;
  mode?: OperatorMode;
  filter?: Record<string, unknown>;
  sort?: string;
  page?: number;
  pageSize?: number;
  lastCommandAt?: number;
}

export interface OperatorActorContext {
  actorId?: string;
  displayName?: string;
  roles?: string[];
  surface: OperatorSurface;
  chatId?: string;
  userId?: string;
  sessionId?: string;
  workspaceId?: string;
}

// ============================================================================
// 命令与执行结果
// ============================================================================

export interface OperatorCommand {
  id: string;
  surface: OperatorSurface;
  commandType: OperatorActionType;
  targetType?: OperatorTargetType;
  targetId?: string;
  params?: Record<string, unknown>;
  actor: OperatorActorContext;
  issuedAt: number;
  rawInput?: string;
}

export interface OperatorCommandError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OperatorActionResult {
  success: boolean;
  actionType: OperatorActionType;
  targetType?: OperatorTargetType;
  targetId?: string;
  message: string;
  data?: unknown;
  confirmationState?: OperatorConfirmationState;
  errors?: OperatorCommandError[];
  executedAt: number;
}

// ============================================================================
// 视图与渲染
// ============================================================================

export interface OperatorViewAction {
  actionType: OperatorActionType;
  label: string;
  targetType?: OperatorTargetType;
  targetId?: string;
  style?: "default" | "primary" | "danger" | "warning";
  requiresConfirmation?: boolean;
  params?: Record<string, unknown>;
}

export interface OperatorViewPayload {
  viewKind: OperatorViewKind;
  title: string;
  subtitle?: string;
  workspaceId?: string;
  sessionId?: string;
  mode?: OperatorMode;
  summary?: string;
  content: unknown;
  availableActions: OperatorViewAction[];
  breadcrumbs?: string[];
  generatedAt: number;
  freshnessMs?: number;
}

export interface OperatorCommandResult {
  success: boolean;
  message: string;
  actionResult?: OperatorActionResult;
  updatedView?: OperatorViewPayload;
  navigationState?: OperatorNavigationState;
  errors?: OperatorCommandError[];
  respondedAt: number;
}

// ============================================================================
// 服务接口输入输出
// ============================================================================

export interface GetSurfaceViewInput {
  actor: OperatorActorContext;
  viewKind: OperatorViewKind;
  workspaceId?: string;
  targetId?: string;
  mode?: OperatorMode;
  filter?: Record<string, unknown>;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface DispatchContext {
  actor: OperatorActorContext;
  navigation?: OperatorNavigationState;
  requireUpdatedView?: boolean;
}

export interface ConfirmableActionEnvelope {
  actionId: string;
  actionType: OperatorActionType;
  targetType?: OperatorTargetType;
  targetId?: string;
  confirmationTitle: string;
  confirmationMessage: string;
  riskLevel?: "low" | "medium" | "high";
  expiresAt?: number;
  params?: Record<string, unknown>;
}

export interface SurfaceRenderedResponse {
  text: string;
  actions?: OperatorViewAction[];
  metadata?: Record<string, unknown>;
}
