"use strict";
/**
 * Trading Event Ingest
 * Phase 2D-1C - 交易域事件入口
 *
 * 职责：
 * - 统一事件入口
 * - 事件验证与转换
 * - 事件路由与分发
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingEventIngest = void 0;
exports.createTradingEventIngest = createTradingEventIngest;
const trading_webhook_routes_1 = require("./trading_webhook_routes");
// ============================================================================
// Event Ingest
// ============================================================================
class TradingEventIngest {
    constructor() {
        this.validationRules = [];
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.webhookRegistry = (0, trading_webhook_routes_1.createTradingWebhookRegistry)();
        // 注册默认验证规则
        this.registerValidationRules();
    }
    /**
     * 注册验证规则
     */
    registerValidationRules() {
        // 规则 1: 必需字段检查
        this.validationRules.push({
            name: 'required_fields',
            validate: (event) => {
                if (!event.type) {
                    return { valid: false, error: 'Missing event type' };
                }
                if (!event.source) {
                    return { valid: false, error: 'Missing event source' };
                }
                if (!event.timestamp) {
                    return { valid: false, error: 'Missing event timestamp' };
                }
                return { valid: true };
            },
        });
        // 规则 2: 严重级别检查
        this.validationRules.push({
            name: 'severity_check',
            validate: (event) => {
                const validSeverities = ['low', 'medium', 'high', 'critical'];
                if (event.severity && !validSeverities.includes(event.severity)) {
                    return {
                        valid: false,
                        error: `Invalid severity: ${event.severity}`,
                    };
                }
                return { valid: true };
            },
        });
        // 规则 3: 环境检查
        this.validationRules.push({
            name: 'environment_check',
            validate: (event) => {
                const validEnvs = ['testnet', 'mainnet'];
                const env = event.source?.environment;
                if (env && !validEnvs.includes(env)) {
                    return { valid: false, error: `Invalid environment: ${env}` };
                }
                return { valid: true };
            },
        });
    }
    /**
     * 接收事件
     */
    async ingestEvent(event) {
        // 验证事件
        const validation = this.validateEvent(event);
        if (!validation.valid) {
            return { accepted: false, error: validation.error };
        }
        // 转换事件（添加默认值）
        const normalizedEvent = this.normalizeEvent(event);
        // 存储到历史
        this.eventHistory.push(normalizedEvent);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
        return { accepted: true };
    }
    /**
     * 接收 Webhook
     */
    async ingestWebhook(sourceType, sourceName, payload, headers = {}) {
        const result = {
            success: true,
            eventsProcessed: 0,
            eventsAccepted: 0,
            eventsRejected: 0,
            errors: [],
        };
        try {
            // 解析 Webhook
            const events = await this.webhookRegistry.processWebhook(sourceType, sourceName, payload, headers);
            result.eventsProcessed = events.length;
            // 处理每个事件
            for (const event of events) {
                const ingestResult = await this.ingestEvent(event);
                if (ingestResult.accepted) {
                    result.eventsAccepted++;
                }
                else {
                    result.eventsRejected++;
                    result.errors?.push({
                        event: event.type,
                        error: ingestResult.error || 'Unknown error',
                    });
                }
            }
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors?.push({
                event: 'webhook',
                error: error instanceof Error ? error.message : String(error),
            });
            return result;
        }
    }
    /**
     * 验证事件
     */
    validateEvent(event) {
        for (const rule of this.validationRules) {
            const result = rule.validate(event);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    }
    /**
     * 标准化事件
     */
    normalizeEvent(event) {
        return {
            ...event,
            severity: event.severity || 'medium',
            source: {
                system: event.source?.system || 'unknown',
                component: event.source?.component || 'unknown',
                environment: event.source?.environment || 'mainnet',
            },
            actor: {
                userId: event.actor?.userId || 'system',
                username: event.actor?.username || 'system',
            },
            metadata: event.metadata || {},
        };
    }
    /**
     * 获取事件历史
     */
    getEventHistory(filters) {
        let events = [...this.eventHistory];
        if (filters) {
            if (filters.type) {
                events = events.filter((e) => e.type === filters.type);
            }
            if (filters.severity) {
                events = events.filter((e) => e.severity === filters.severity);
            }
            if (filters.source) {
                events = events.filter((e) => e.source?.system === filters.source);
            }
        }
        const limit = filters?.limit || 100;
        return events.slice(-limit);
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const now = Date.now();
        const byType = new Map();
        const bySeverity = new Map();
        const bySource = new Map();
        let last24h = 0;
        for (const event of this.eventHistory) {
            // 按类型统计
            byType.set(event.type, (byType.get(event.type) || 0) + 1);
            // 按严重级别统计
            bySeverity.set(event.severity, (bySeverity.get(event.severity) || 0) + 1);
            // 按来源统计
            bySource.set(event.source?.system || 'unknown', (bySource.get(event.source?.system || 'unknown') || 0) + 1);
            // 24 小时内事件
            if (now - event.timestamp < 24 * 60 * 60 * 1000) {
                last24h++;
            }
        }
        return {
            totalEvents: this.eventHistory.length,
            byType,
            bySeverity,
            bySource,
            last24h,
        };
    }
}
exports.TradingEventIngest = TradingEventIngest;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingEventIngest() {
    return new TradingEventIngest();
}
