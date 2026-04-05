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
import type { TelegramCallbackContext, TelegramMessageContext, TelegramRouter } from './telegram_router';
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
export declare class DefaultTelegramCockpitV2 implements TelegramCockpitV2 {
    private config;
    constructor(config: TelegramCockpitV2Config);
    handleMessage(input: TelegramMessageContext): Promise<TelegramResponse>;
    handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse>;
    getChatSession(chatId: string): Promise<any | null>;
    clearChatSession(chatId: string): Promise<void>;
    private buildSessionId;
    private getOrCreateSession;
    private toTelegramResponse;
}
export declare function createTelegramCockpitV2(config: TelegramCockpitV2Config): TelegramCockpitV2;
