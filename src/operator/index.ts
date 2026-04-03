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

export type {
  OperatorCommandDispatch,
  CommandMapping,
} from "./services/operator_command_dispatch";

export {
  COMMAND_REGISTRY,
  PHASE_2A1_MINIMAL_COMMANDS,
} from "./services/operator_command_dispatch";

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
