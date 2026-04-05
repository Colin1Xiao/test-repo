/**
 * Operator Session Module
 * Phase 2A-2A - 会话与 Workspace 基础层
 */
export type { OperatorSessionStatus, OperatorSurface, WorkspaceEnvironment, OperatorNavigationState, OperatorSession, CreateSessionInput, UpdateNavigationInput, WorkspaceDescriptor, WorkspaceSwitchResult, SessionStore, WorkspaceRegistry, WorkspaceSwitcher, } from '../types/session_types';
export type { SessionStoreConfig } from './session_store';
export { InMemorySessionStore, createSessionStore } from './session_store';
export type { WorkspaceRegistryConfig } from './workspace_registry';
export { InMemoryWorkspaceRegistry, createWorkspaceRegistry } from './workspace_registry';
export type { WorkspaceSwitcherConfig } from './workspace_switcher';
export { DefaultWorkspaceSwitcher, createWorkspaceSwitcher } from './workspace_switcher';
export type { CliCockpitV2, CliCockpitV2Config, } from '../cli/cli_cockpit_v2';
export { DefaultCliCockpitV2, createCliCockpitV2 } from '../cli/cli_cockpit_v2';
export type { TelegramCockpitV2, TelegramCockpitV2Config, } from '../telegram/telegram_cockpit_v2';
export { DefaultTelegramCockpitV2, createTelegramCockpitV2 } from '../telegram/telegram_cockpit_v2';
export type { OperatorCommandDispatchV2, OperatorCommandDispatchV2Config, } from '../services/operator_command_dispatch_v2';
export { createOperatorCommandDispatchV2 } from '../services/operator_command_dispatch_v2';
