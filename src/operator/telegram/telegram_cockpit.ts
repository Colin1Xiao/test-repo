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
import type {
  TelegramCallbackContext,
  TelegramMessageContext,
  TelegramRouter,
} from "./telegram_router";
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

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultTelegramCockpit implements TelegramCockpit {
  private config: TelegramCockpitConfig;

  constructor(config: TelegramCockpitConfig) {
    this.config = config;
  }

  async handleMessage(input: TelegramMessageContext): Promise<TelegramResponse> {
    try {
      // 1. 解析消息
      const command = this.config.router.parseMessage(input);

      // 2. 分发执行
      const result = await this.config.dispatch.dispatch(command, {
        actor: command.actor,
        requireUpdatedView: true,
      });

      // 3. 渲染响应
      const response = this.config.renderer.renderResult(result);

      return response;
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : "未知错误",
        errors: error instanceof Error ? [{ code: "TG_ERROR", message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }

  async handleCallback(input: TelegramCallbackContext): Promise<TelegramResponse> {
    try {
      // 1. 解析回调
      const command = this.config.router.parseCallback(input);

      // 2. 分发执行
      const result = await this.config.dispatch.dispatch(command, {
        actor: command.actor,
        requireUpdatedView: true,
      });

      // 3. 渲染响应
      const response = this.config.renderer.renderResult(result);

      return response;
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : "未知错误",
        errors: error instanceof Error ? [{ code: "TG_CB_ERROR", message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTelegramCockpit(config: TelegramCockpitConfig): TelegramCockpit {
  return new DefaultTelegramCockpit(config);
}
