/**
 * CLI Cockpit
 * Phase 2A-1 - CLI 统一入口
 * 
 * 职责：
 * - 接收 CLI 原始输入
 * - 路由到命令分发器
 * - 渲染响应
 */

import type { SurfaceRenderedResponse } from "../types/surface_types";
import type { CliRouter } from "./cli_router";
import type { CliRenderer } from "./cli_renderer";
import type { OperatorCommandDispatch } from "../services/operator_command_dispatch";
import type { OperatorSurfaceService } from "../services/operator_surface_service";

export interface CliCockpitConfig {
  router: CliRouter;
  renderer: CliRenderer;
  dispatch: OperatorCommandDispatch;
  surfaceService: OperatorSurfaceService;
  defaultWorkspaceId?: string;
}

export interface CliCockpit {
  /**
   * 处理 CLI 输入
   * @param rawInput - 原始命令行输入
   * @returns 渲染后的响应
   */
  handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
}

// ============================================================================
// 默认实现
// ============================================================================

export class DefaultCliCockpit implements CliCockpit {
  private config: CliCockpitConfig;

  constructor(config: CliCockpitConfig) {
    this.config = config;
  }

  async handleInput(rawInput: string): Promise<SurfaceRenderedResponse> {
    try {
      // 1. 构建 Actor 上下文
      const actor = {
        surface: "cli" as const,
        workspaceId: this.config.defaultWorkspaceId,
      };

      // 2. 解析命令
      const command = this.config.router.parse(rawInput, { actor });

      // 3. 分发执行
      const result = await this.config.dispatch.dispatch(command, {
        actor,
        requireUpdatedView: true,
      });

      // 4. 渲染响应
      const response = this.config.renderer.renderResult(result);

      return response;
    } catch (error) {
      // 错误处理
      return this.config.renderer.renderResult({
        success: false,
        message: error instanceof Error ? error.message : "未知错误",
        errors: error instanceof Error ? [{ code: "CLI_ERROR", message: error.message }] : [],
        respondedAt: Date.now(),
      });
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCliCockpit(config: CliCockpitConfig): CliCockpit {
  return new DefaultCliCockpit(config);
}
