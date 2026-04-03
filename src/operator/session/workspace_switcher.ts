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

import type {
  OperatorSession,
  WorkspaceDescriptor,
  WorkspaceSwitchResult,
  WorkspaceSwitcher,
} from '../types/session_types';
import type { SessionStore } from '../types/session_types';
import type { WorkspaceRegistry } from '../types/session_types';

// ============================================================================
// 配置
// ============================================================================

export interface WorkspaceSwitcherConfig {
  /** 切换时是否重置 Navigation State */
  resetNavigationOnSwitch?: boolean;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultWorkspaceSwitcher implements WorkspaceSwitcher {
  private config: Required<WorkspaceSwitcherConfig>;
  private sessionStore: SessionStore;
  private workspaceRegistry: WorkspaceRegistry;
  
  constructor(
    sessionStore: SessionStore,
    workspaceRegistry: WorkspaceRegistry,
    config: WorkspaceSwitcherConfig = {}
  ) {
    this.config = {
      resetNavigationOnSwitch: config.resetNavigationOnSwitch ?? true,
    };
    
    this.sessionStore = sessionStore;
    this.workspaceRegistry = workspaceRegistry;
  }
  
  async switchWorkspace(
    sessionId: string,
    workspaceId: string
  ): Promise<WorkspaceSwitchResult> {
    const now = Date.now();
    
    // 1. 获取当前 Session
    const session = await this.sessionStore.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 2. 校验 Workspace 是否存在
    const workspace = await this.workspaceRegistry.getWorkspace(workspaceId);
    
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    // 3. 记录之前的 Workspace
    const previousWorkspaceId = session.workspaceId;
    
    // 4. 检查是否实际切换
    const changed = previousWorkspaceId !== workspaceId;
    
    // 5. 更新 Session
    session.workspaceId = workspaceId;
    session.updatedAt = now;
    
    // 6. 重置 Navigation State（如果配置）
    if (this.config.resetNavigationOnSwitch && changed) {
      session.navigationState = this.resetNavigationState(session.navigationState);
    }
    
    // 7. 保存 Session
    await this.sessionStore.saveSession(session);
    
    // 8. 返回结果
    return {
      session,
      previousWorkspaceId,
      currentWorkspaceId: workspaceId,
      changed,
      switchedAt: now,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 重置 Navigation State
   */
  private resetNavigationState(currentState: any): any {
    return {
      currentView: 'dashboard',
      lastCommandAt: Date.now(),
      // 清空选择状态
      selectedItemId: undefined,
      selectedTargetType: undefined,
      previousView: undefined,
      // 清空过滤/排序
      mode: undefined,
      filter: undefined,
      sort: undefined,
      page: undefined,
      pageSize: undefined,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createWorkspaceSwitcher(
  sessionStore: SessionStore,
  workspaceRegistry: WorkspaceRegistry,
  config?: WorkspaceSwitcherConfig
): WorkspaceSwitcher {
  return new DefaultWorkspaceSwitcher(
    sessionStore,
    workspaceRegistry,
    config
  );
}
