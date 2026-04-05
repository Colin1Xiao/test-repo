/**
 * CLI Renderer
 * Phase 2A-1 - CLI 响应渲染层
 *
 * 职责：将 OperatorViewPayload 和 OperatorCommandResult 渲染为 CLI 文本响应
 */
import type { OperatorCommandResult, OperatorViewPayload, SurfaceRenderedResponse } from "../types/surface_types";
export interface CliRenderer {
    /**
     * 渲染视图为 CLI 响应
     * @param payload - 视图数据
     * @param style - 可选的样式配置
     * @returns CLI 渲染响应
     */
    renderView(payload: OperatorViewPayload, style?: string): SurfaceRenderedResponse;
    /**
     * 渲染命令执行结果为 CLI 响应
     * @param result - 命令执行结果
     * @param style - 可选的样式配置
     * @returns CLI 渲染响应
     */
    renderResult(result: OperatorCommandResult, style?: string): SurfaceRenderedResponse;
}
export declare class DefaultCliRenderer implements CliRenderer {
    renderView(payload: OperatorViewPayload, style?: string): SurfaceRenderedResponse;
    renderResult(result: OperatorCommandResult, style?: string): SurfaceRenderedResponse;
    private renderContent;
    private renderObjectItem;
    private renderAction;
    private getStyleIndicator;
    private formatHeader;
    private formatSuccess;
    private formatError;
    private formatDim;
    private formatValue;
    private formatFreshness;
    private isInboxItem;
    private isInboxContent;
    private renderInboxContent;
    private renderInboxItem;
}
