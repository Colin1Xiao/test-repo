/**
 * Operator Session Module
 * Phase 2A-2A - 会话与 Workspace 基础层
 */

// ============================================================================
// 类型导出
// ============================================================================

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
  SessionStore,
  WorkspaceRegistry,
  WorkspaceSwitcher,
} from '../types/session_types';

// ============================================================================
// Session Store
// ============================================================================

export type { SessionStoreConfig } from './session_store';
export { InMemorySessionStore, createSessionStore } from './session_store';

// ============================================================================
// Workspace Registry
// ============================================================================

export type { WorkspaceRegistryConfig } from './workspace_registry';
export { InMemoryWorkspaceRegistry, createWorkspaceRegistry } from './workspace_registry';

// ============================================================================
// Workspace Switcher
// ============================================================================

export type { WorkspaceSwitcherConfig } from './workspace_switcher';
export { DefaultWorkspaceSwitcher, createWorkspaceSwitcher } from './workspace_switcher';
