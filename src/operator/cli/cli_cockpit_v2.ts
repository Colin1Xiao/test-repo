/**
 * CLI Cockpit V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 * 
 * 职责：
 * - 自动创建/复用 CLI Session
 * - 将 sessionId/workspaceId 注入 actor context
 * - Dispatch 后回写 navigation state
 */

import type { SurfaceRenderedResponse } from '../types/surface_types';
import type { CliRouter } from './cli_router';
import type { CliRenderer } from './cli_renderer';
import type { OperatorCommandDispatch } from '../services/operator_command_dispatch';
import type { OperatorSurfaceService } from '../services/operator_surface_service';
import type { SessionStore, WorkspaceRegistry } from '../types/session_types';

export interface CliCockpitV2Config {
  router: CliRouter;
  renderer: CliRenderer;
  dispatch: OperatorCommandDispatch;
  surfaceService: OperatorSurfaceService;
  sessionStore: SessionStore;
  workspaceRegistry: WorkspaceRegistry;
  defaultWorkspaceId?: string;
}

export interface CliCockpitV2 {
  /**
   * 处理 CLI 输入（带 Session）
   */
  handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
  
  /**
   * 获取当前 Session
   */
  getCurrentSession(): Promise<any | null>;
  
  /**
   * 清除当前 Session
   */
  clearSession(): Promise<void>;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultCliCockpitV2 implements CliCockpitV2 {
  private config: Required<CliCockpitV2Config>;
  private currentSession: any | null = null;
  
  constructor(config: CliCockpitV2Config) {
    this.config = {
      router: config.router,
      renderer: config.renderer,
      dispatch: config.dispatch,
      surfaceService: config.surfaceService,
      sessionStore: config.sessionStore,
      workspaceRegistry: config.workspaceRegistry,
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
    };
  }
  
  async handleInput(rawInput: string): Promise<SurfaceRenderedResponse> {
    try {
      // 1. 获取/创建 Session
      const session = await this.getOrCreateSession();
      this.currentSession = session;
      
      // 2. 构建 Actor 上下文（包含 session 信息）
      const actor = {
        surface: 'cli' as const,
        workspaceId: session.workspaceId,
        sessionId: session.sessionId,
      };
      
      // 3. 解析命令
      const command = this.config.router.parse(rawInput, { actor });
      
      // 4. 分发执行（传入 session context）
      const result = await this.config.dispatch.dispatch(command, {
        actor,
        navigation: session.navigationState,
        requireUpdatedView: true,
      });
      
      // 5. 更新 Navigation State
      if (result.updatedView && session.sessionId) {
        await this.config.sessionStore.updateNavigationState(
          session.sessionId,
          {
            currentView: result.updatedView.viewKind,
            previousView: session.navigationState.currentView,
          }
        );
        
        // 更新本地缓存
        this.currentSession.navigationState.currentView = result.updatedView.viewKind;
        this.currentSession.navigationState.previousView = session.navigationState.currentView;
      }
      
      // 6. 渲染响应
      const response = this.config.renderer.renderResult(result);
      
      return response;
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        errors: error instanceof Error ? [{ code: 'CLI_ERROR', message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }
  
  async getCurrentSession(): Promise<any | null> {
    if (!this.currentSession) {
      // 尝试获取现存的 CLI session
      const sessions = await this.config.sessionStore.listActiveSessions('cli');
      this.currentSession = sessions[0] || null;
    }
    return this.currentSession;
  }
  
  async clearSession(): Promise<void> {
    if (this.currentSession) {
      await this.config.sessionStore.closeSession(this.currentSession.sessionId);
      this.currentSession = null;
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private async getOrCreateSession(): Promise<any> {
    // 1. 尝试获取现存的 CLI session
    const sessions = await this.config.sessionStore.listActiveSessions('cli');
    
    if (sessions.length > 0) {
      return sessions[0];
    }
    
    // 2. 获取默认 workspace
    const defaultWorkspace = await this.config.workspaceRegistry.getDefaultWorkspace();
    
    // 3. 创建新 session
    return await this.config.sessionStore.createSession({
      surface: 'cli',
      workspaceId: defaultWorkspace?.workspaceId ?? this.config.defaultWorkspaceId,
    });
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCliCockpitV2(config: CliCockpitV2Config): CliCockpitV2 {
  return new DefaultCliCockpitV2(config);
}
