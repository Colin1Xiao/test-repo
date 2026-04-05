/**
 * Telegram Renderer
 * Phase 2A-1 - Telegram 响应渲染层
 *
 * 职责：
 * - 将 OperatorViewPayload 渲染为 Telegram 响应（文本 + Inline Keyboard）
 * - 将 OperatorCommandResult 渲染为 Telegram 响应
 */
import type { OperatorCommandResult, OperatorViewPayload } from "../types/surface_types";
export interface TelegramInlineButton {
    text: string;
    callbackData: string;
}
export interface TelegramResponse {
    text: string;
    buttons?: TelegramInlineButton[][];
}
export interface TelegramRenderer {
    /**
     * 渲染视图为 Telegram 响应
     * @param payload - 视图数据
     * @returns Telegram 响应（文本 + 按钮）
     */
    renderView(payload: OperatorViewPayload): TelegramResponse;
    /**
     * 渲染命令执行结果为 Telegram 响应
     * @param result - 命令执行结果
     * @returns Telegram 响应
     */
    renderResult(result: OperatorCommandResult): TelegramResponse;
}
export declare class DefaultTelegramRenderer implements TelegramRenderer {
    renderView(payload: OperatorViewPayload): TelegramResponse;
    renderResult(result: OperatorCommandResult): TelegramResponse;
    private renderContent;
    private renderObjectItem;
    private buildButtons;
    private inferTargetType;
    private formatValue;
    private formatFreshness;
    private isInboxItem;
    private isInboxContent;
    private renderInboxContent;
    private renderInboxItem;
}
