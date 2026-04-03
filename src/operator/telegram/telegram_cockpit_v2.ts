/**
 * Telegram Cockpit V2
 * Phase 2A-2A-I - 集成 Session/Workspace
 * 
 * 职责：
 * - 按 chatId 绑定 Session
 * - 自动创建/复用 Telegram Session
 * - 将 sessionId/workspaceId 注入 actor context
 * - Dispatch 后回写 navigation state
 */

import type { TelegramResponse } from './telegram_renderer';
import type {
  TelegramCallbackContext,
  TelegramMessageContext,
  TelegramRouter,
} from './telegram_router';
import type { TelegramRenderer } from './telegram_renderer';
import type { OperatorCommandDispatch } from '../services/operator_command_dispatch';
import type { OperatorSurfaceService } from '../services/operator_surface_service';
import type { SessionStore, WorkspaceRegistry } from '../types/session_types';

export interface TelegramCockpitV2Config {
  router: TelegramRouter;
  renderer: TelegramRenderer;
  dispatch: OperatorCommandDispatch;
  surfaceService: OperatorSurfaceService;
  sessionStore: SessionStore;
  workspaceRegistry: WorkspaceRegistry;
  defaultWorkspaceId?: string;
}

export interface TelegramCockpitV2 {
  /**
   * 处理 Telegram 文本消息（带 Session）
   */
  handleMessage(input: TelegramMessageContext): Promise<TelegramResponse>;
  
  /**
   * 处理 Telegram callback 回调（带 Session）
   */
  handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse>;
  
  /**
   * 获取 Chat 的 Session
   */
  getChatSession(chatId: string): Promise<any | null>;
  
  /**
   * 清除 Chat 的 Session
   */
  clearChatSession(chatId: string): Promise<void>;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultTelegramCockpitV2 implements TelegramCockpitV2 {
  private config: Required<TelegramCockpitV2Config>;
  
  constructor(config: TelegramCockpitV2Config) {
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
  
  async handleMessage(input: TelegramMessageContext): Promise<TelegramResponse> {
    try {
      // 1. 获取/创建 Session（按 chatId 绑定）
      const session = await this.getOrCreateSession(input.chatId, input.userId);
      
      // 2. 构建 Actor 上下文
      const actor = {
        surface: 'telegram' as const,
        workspaceId: session.workspaceId,
        sessionId: session.sessionId,
        chatId: input.chatId,
        userId: input.userId,
      };
      
      // 3. 解析消息
      const command = this.config.router.parseMessage({
        chatId: input.chatId,
        userId: input.userId,
        text: input.text,
        username: input.username,
      });
      
      // 4. 分发执行
      const result = await this.config.dispatch.dispatch(command, {
        actor,
        navigation: session.navigationState,
        requireUpdatedView: true,
      });
      
      // 5. 更新 Navigation State
      if (result.updatedView) {
        await this.config.sessionStore.updateNavigationState(
          session.sessionId,
          {
            currentView: result.updatedView.viewKind,
            previousView: session.navigationState.currentView,
          }
        );
      }
      
      // 6. 渲染响应
      const response = this.config.renderer.renderResult(result);
      
      return this.toTelegramResponse(response);
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        errors: error instanceof Error ? [{ code: 'TG_ERROR', message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }
  
  async handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse> {
    try {
      // 1. 获取/创建 Session（按 chatId 绑定）
      const session = await this.getOrCreateSession(input.chatId, input.userId);
      
      // 2. 构建 Actor 上下文
      const actor = {
        surface: 'telegram' as const,
        workspaceId: session.workspaceId,
        sessionId: session.sessionId,
        chatId: input.chatId,
        userId: input.userId,
      };
      
      // 3. 解析回调
      const command = this.config.router.parseCallback({
        chatId: input.chatId,
        userId: input.userId,
        callbackData: input.callbackData,
        username: input.username,
      });
      
      // 4. 分发执行
      const result = await this.config.dispatch.dispatch(command, {
        actor,
        navigation: session.navigationState,
        requireUpdatedView: true,
      });
      
      // 5. 更新 Navigation State
      if (result.updatedView) {
        await this.config.sessionStore.updateNavigationState(
          session.sessionId,
          {
            currentView: result.updatedView.viewKind,
            previousView: session.navigationState.currentView,
          }
        );
      }
      
      // 6. 渲染响应
      const response = this.config.renderer.renderResult(result);
      
      return this.toTelegramResponse(response);
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        errors: error instanceof Error ? [{ code: 'TG_CB_ERROR', message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }
  
  async getChatSession(chatId: string): Promise<any | null> {
    const sessionId = this.buildSessionId(chatId);
    return await this.config.sessionStore.getSession(sessionId);
  }
  
  async clearChatSession(chatId: string): Promise<void> {
    const sessionId = this.buildSessionId(chatId);
    await this.config.sessionStore.closeSession(sessionId);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private buildSessionId(chatId: string): string {
    return `telegram:${chatId}`;
  }
  
  private async getOrCreateSession(chatId: string, userId?: string): Promise<any> {
    const sessionId = this.buildSessionId(chatId);
    
    // 1. 尝试获取现存 session
    let session = await this.config.sessionStore.getSession(sessionId);
    
    if (session) {
      return session;
    }
    
    // 2. 获取默认 workspace
    const defaultWorkspace = await this.config.workspaceRegistry.getDefaultWorkspace();
    
    // 3. 创建新 session
    return await this.config.sessionStore.createSession({
      sessionId,
      surface: 'telegram',
      actorId: userId,
      workspaceId: defaultWorkspace?.workspaceId ?? this.config.defaultWorkspaceId,
    });
  }
  
  private toTelegramResponse(response: any): TelegramResponse {
    return {
      text: response.text,
      buttons: response.actions?.map((action: any) => [
        {
          text: action.label,
          callbackData: `oc:${action.actionType}:${action.targetType || 'unknown'}:${action.targetId || ''}`,
        },
      ]),
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTelegramCockpitV2(config: TelegramCockpitV2Config): TelegramCockpitV2 {
  return new DefaultTelegramCockpitV2(config);
}
