/**
 * Trading Webhook Routes
 * Phase 2D-1C - 交易域 Webhook 路由
 *
 * 职责：
 * - 接收外部交易系统 Webhook
 * - 解析并转换为 Trading Event
 * - 路由到对应处理器
 */
import type { TradingEvent } from './trading_types';
export interface WebhookSource {
    type: 'github' | 'jenkins' | 'circleci' | 'trading_system' | 'monitoring';
    name: string;
    secret?: string;
}
export interface WebhookHandler {
    source: WebhookSource;
    parse: (payload: any, headers: Record<string, string>) => TradingEvent | TradingEvent[] | null;
}
export declare class TradingWebhookRegistry {
    private handlers;
    constructor();
    /**
     * 注册 Webhook 处理器
     */
    registerHandler(handler: WebhookHandler): void;
    /**
     * 获取处理器
     */
    getHandler(sourceType: string, sourceName: string): WebhookHandler | null;
    /**
     * 处理 Webhook
     */
    processWebhook(sourceType: string, sourceName: string, payload: any, headers: Record<string, string>): Promise<TradingEvent[]>;
    /**
     * 获取所有注册的处理器
     */
    getRegisteredHandlers(): string[];
}
export declare function createGitHubActionsWebhookParser(): WebhookHandler;
export declare function createTradingSystemWebhookParser(): WebhookHandler;
export declare function createMonitoringWebhookParser(): WebhookHandler;
export declare function createTradingWebhookRegistry(): TradingWebhookRegistry;
