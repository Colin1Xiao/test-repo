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
export declare class DefaultCliCockpit implements CliCockpit {
    private config;
    constructor(config: CliCockpitConfig);
    handleInput(rawInput: string): Promise<SurfaceRenderedResponse>;
}
export declare function createCliCockpit(config: CliCockpitConfig): CliCockpit;
