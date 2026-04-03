/**
 * Operator Module
 * Phase 2A-1 - 统一导出
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  OperatorSurface,
  OperatorViewKind,
  OperatorMode,
  OperatorActionType,
  OperatorTargetType,
  OperatorConfirmationState,
  OperatorNavigationState,
  OperatorActorContext,
  OperatorCommand,
  OperatorCommandError,
  OperatorActionResult,
  OperatorViewAction,
  OperatorViewPayload,
  OperatorCommandResult,
  GetSurfaceViewInput,
  DispatchContext,
  ConfirmableActionEnvelope,
  SurfaceRenderedResponse,
} from "./types/surface_types";

// ============================================================================
// 服务接口导出
// ============================================================================

export type { OperatorSurfaceService } from "./services/operator_surface_service";
export { DefaultOperatorSurfaceService, createOperatorSurfaceService } from "./services/default_operator_surface_service";

export type {
  OperatorCommandDispatch,
  CommandMapping,
} from "./services/operator_command_dispatch";

export {
  COMMAND_REGISTRY,
  PHASE_2A1_MINIMAL_COMMANDS,
} from "./services/operator_command_dispatch";

export type { OperatorCommandDispatch as DefaultOperatorCommandDispatch } from "./services/default_operator_command_dispatch";
export { createOperatorCommandDispatch } from "./services/default_operator_command_dispatch";

// ============================================================================
// 执行策略导出
// ============================================================================

export type {
  ExecutionPolicy,
  ExecutionPolicyConfig,
  ExecutionMode,
} from "./services/operator_execution_policy";
export {
  DefaultExecutionPolicy,
  createExecutionPolicy,
  createSafeExecutionPolicy,
  create2A1RPrimeBExecutionPolicy,
  createProductionExecutionPolicy,
} from "./services/operator_execution_policy";

// ============================================================================
// 执行桥接导出
// ============================================================================

export type {
  OperatorExecutionBridge,
  OperatorExecutionBridgeConfig,
  ExecutionResult,
} from "./services/operator_execution_bridge";
export { DefaultOperatorExecutionBridge, createOperatorExecutionBridge } from "./services/operator_execution_bridge";

// ============================================================================
// 数据层导出
// ============================================================================

export * from './data';

// ============================================================================
// Session / Workspace 导出
// ============================================================================

export * from './session';

// Session 类型
export type {
  OperatorSessionStatus,
  OperatorSurface,
  WorkspaceEnvironment,
  OperatorNavigationState,
  OperatorSession,
  CreateSessionInput,
  UpdateNavigationInput,
  WorkspaceDescriptor,
  WorkspaceSwitchResult,
} from './types/session_types';

// ============================================================================
// Inbox 导出
// ============================================================================

export * from './inbox';

// ============================================================================
// 服务工具导出
// ============================================================================

export type {
  OperatorContextAdapter,
  OperatorContextAdapterConfig,
} from "./services/operator_context_adapter";
export { DefaultOperatorContextAdapter, createOperatorContextAdapter } from "./services/operator_context_adapter";

// V2 - 使用真实数据源
export type {
  OperatorContextAdapterV2,
  OperatorContextAdapterV2Config,
  DataSourceMode,
} from "./services/operator_context_adapter_v2";
export { DefaultOperatorContextAdapterV2, createOperatorContextAdapterV2 } from "./services/operator_context_adapter_v2";

export type {
  OperatorViewFactory,
  BuildDashboardViewInput,
  BuildTaskViewInput,
  BuildApprovalViewInput,
  BuildIncidentViewInput,
  BuildAgentViewInput,
  BuildInboxViewInput,
  BuildInterventionViewInput,
  BuildDetailViewInput,
} from "./services/operator_view_factory";
export { DefaultOperatorViewFactory, createOperatorViewFactory } from "./services/operator_view_factory";

// ============================================================================
// CLI 导出
// ============================================================================

export type { CliContext, CliRouter } from "./cli/cli_router";
export { DefaultCliRouter } from "./cli/cli_router";

export type { CliRenderer } from "./cli/cli_renderer";
export { DefaultCliRenderer } from "./cli/cli_renderer";

export type { CliCockpit, CliCockpitConfig } from "./cli/cli_cockpit";
export { DefaultCliCockpit, createCliCockpit } from "./cli/cli_cockpit";

// ============================================================================
// Telegram 导出
// ============================================================================

export type {
  TelegramMessageContext,
  TelegramCallbackContext,
  TelegramRouter,
} from "./telegram/telegram_router";
export { DefaultTelegramRouter } from "./telegram/telegram_router";

export type {
  TelegramInlineButton,
  TelegramResponse,
  TelegramRenderer,
} from "./telegram/telegram_renderer";
export { DefaultTelegramRenderer } from "./telegram/telegram_renderer";

export type {
  TelegramCockpit,
  TelegramCockpitConfig,
} from "./telegram/telegram_cockpit";
export { DefaultTelegramCockpit, createTelegramCockpit } from "./telegram/telegram_cockpit";
