/**
 * Telegram Router
 * Phase 2A-1 - Telegram 消息/回调解析层
 *
 * 职责：
 * - 解析 Telegram 文本消息为 OperatorCommand
 * - 解析 Telegram callback 数据为 OperatorCommand
 */
import type { OperatorCommand } from "../types/surface_types";
export interface TelegramMessageContext {
    chatId: string;
    userId?: string;
    text?: string;
    username?: string;
}
export interface TelegramCallbackContext {
    chatId: string;
    userId?: string;
    callbackData: string;
    username?: string;
}
export interface TelegramRouter {
    /**
     * 解析 Telegram 文本消息
     * @param input - 消息上下文
     * @returns OperatorCommand
     */
    parseMessage(input: TelegramMessageContext): OperatorCommand;
    /**
     * 解析 Telegram callback 回调
     * @param input - 回调上下文
     * @returns OperatorCommand
     */
    parseCallback(input: TelegramCallbackContext): OperatorCommand;
}
export declare class DefaultTelegramRouter implements TelegramRouter {
    parseMessage(input: TelegramMessageContext): OperatorCommand;
    parseCallback(input: TelegramCallbackContext): OperatorCommand;
    private buildCommand;
}
