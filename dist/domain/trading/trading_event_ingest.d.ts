/**
 * Trading Event Ingest
 * Phase 2D-1C - 交易域事件入口
 *
 * 职责：
 * - 统一事件入口
 * - 事件验证与转换
 * - 事件路由与分发
 */
import type { TradingEvent, TradingSeverity } from './trading_types';
export interface EventIngestResult {
    success: boolean;
    eventsProcessed: number;
    eventsAccepted: number;
    eventsRejected: number;
    errors?: Array<{
        event: string;
        error: string;
    }>;
}
export interface EventValidationRule {
    name: string;
    validate: (event: TradingEvent) => {
        valid: boolean;
        error?: string;
    };
}
export declare class TradingEventIngest {
    private webhookRegistry;
    private validationRules;
    private eventHistory;
    private maxHistorySize;
    constructor();
    /**
     * 注册验证规则
     */
    private registerValidationRules;
    /**
     * 接收事件
     */
    ingestEvent(event: TradingEvent): Promise<{
        accepted: boolean;
        error?: string;
    }>;
    /**
     * 接收 Webhook
     */
    ingestWebhook(sourceType: string, sourceName: string, payload: any, headers?: Record<string, string>): Promise<EventIngestResult>;
    /**
     * 验证事件
     */
    validateEvent(event: TradingEvent): {
        valid: boolean;
        error?: string;
    };
    /**
     * 标准化事件
     */
    private normalizeEvent;
    /**
     * 获取事件历史
     */
    getEventHistory(filters?: {
        type?: string;
        severity?: TradingSeverity;
        source?: string;
        limit?: number;
    }): TradingEvent[];
    /**
     * 获取统计信息
     */
    getStats(): {
        totalEvents: number;
        byType: Map<string, number>;
        bySeverity: Map<string, number>;
        bySource: Map<string, number>;
        last24h: number;
    };
}
export declare function createTradingEventIngest(): TradingEventIngest;
