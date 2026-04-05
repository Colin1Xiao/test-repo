/**
 * Workspace Switcher
 * Phase 2A-2A - Workspace 切换器
 *
 * 职责：
 * - 校验 Workspace 是否存在
 * - 更新 Session 的 workspaceId
 * - 重置 Navigation State
 * - 返回切换结果
 */
import type { WorkspaceSwitchResult, WorkspaceSwitcher } from '../types/session_types';
import type { SessionStore } from '../types/session_types';
import type { WorkspaceRegistry } from '../types/session_types';
export interface WorkspaceSwitcherConfig {
    /** 切换时是否重置 Navigation State */
    resetNavigationOnSwitch?: boolean;
}
export declare class DefaultWorkspaceSwitcher implements WorkspaceSwitcher {
    private config;
    private sessionStore;
    private workspaceRegistry;
    constructor(sessionStore: SessionStore, workspaceRegistry: WorkspaceRegistry, config?: WorkspaceSwitcherConfig);
    switchWorkspace(sessionId: string, workspaceId: string): Promise<WorkspaceSwitchResult>;
    /**
     * 重置 Navigation State
     */
    private resetNavigationState;
}
export declare function createWorkspaceSwitcher(sessionStore: SessionStore, workspaceRegistry: WorkspaceRegistry, config?: WorkspaceSwitcherConfig): WorkspaceSwitcher;
