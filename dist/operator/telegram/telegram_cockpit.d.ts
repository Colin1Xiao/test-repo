/**
 * Telegram Cockpit
 * Phase 2A-1 - Telegram 统一入口
 *
 * 职责：
 * - 接收 Telegram 消息/回调
 * - 路由到命令分发器
 * - 渲染响应
 */
import type { TelegramResponse } from "./telegram_renderer";
import type { TelegramCallbackContext, TelegramMessageContext, TelegramRouter } from "./telegram_router";
import type { OperatorCommandDispatch } from "../services/operator_command_dispatch";
import type { OperatorSurfaceService } from "../services/operator_surface_service";
import type { TelegramRenderer } from "./telegram_renderer";
export interface TelegramCockpitConfig {
    router: TelegramRouter;
    renderer: TelegramRenderer;
    dispatch: OperatorCommandDispatch;
    surfaceService: OperatorSurfaceService;
    defaultWorkspaceId?: string;
}
export interface TelegramCockpit {
    /**
     * 处理 Telegram 文本消息
     * @param input - 消息上下文
     * @returns Telegram 响应
     */
    handleMessage(input: TelegramMessageContext): Promise<TelegramResponse>;
    /**
     * 处理 Telegram callback 回调
     * @param input - 回调上下文
     * @returns Telegram 响应
     */
    handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse>;
}
export declare class DefaultTelegramCockpit implements TelegramCockpit {
    private config;
    constructor(config: TelegramCockpitConfig);
    handleMessage(input: TelegramMessageContext): Promise<TelegramResponse>;
    handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse>;
}
export declare function createTelegramCockpit(config: TelegramCockpitConfig): TelegramCockpit;
