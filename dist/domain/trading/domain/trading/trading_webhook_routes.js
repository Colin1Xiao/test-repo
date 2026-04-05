"use strict";
/**
 * Trading Webhook Routes
 * Phase 2D-1C - 交易域 Webhook 路由
 *
 * 职责：
 * - 接收外部交易系统 Webhook
 * - 解析并转换为 Trading Event
 * - 路由到对应处理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingWebhookRegistry = void 0;
exports.createGitHubActionsWebhookParser = createGitHubActionsWebhookParser;
exports.createTradingSystemWebhookParser = createTradingSystemWebhookParser;
exports.createMonitoringWebhookParser = createMonitoringWebhookParser;
exports.createTradingWebhookRegistry = createTradingWebhookRegistry;
// ============================================================================
// Webhook Registry
// ============================================================================
class TradingWebhookRegistry {
    constructor() {
        this.handlers = new Map();
    }
    /**
     * 注册 Webhook 处理器
     */
    registerHandler(handler) {
        const key = `${handler.source.type}:${handler.source.name}`;
        this.handlers.set(key, handler);
    }
    /**
     * 获取处理器
     */
    getHandler(sourceType, sourceName) {
        const key = `${sourceType}:${sourceName}`;
        return this.handlers.get(key) || null;
    }
    /**
     * 处理 Webhook
     */
    async processWebhook(sourceType, sourceName, payload, headers) {
        const handler = this.getHandler(sourceType, sourceName);
        if (!handler) {
            throw new Error(`Unknown webhook source: ${sourceType}:${sourceName}`);
        }
        const result = handler.parse(payload, headers);
        if (!result) {
            return [];
        }
        return Array.isArray(result) ? result : [result];
    }
    /**
     * 获取所有注册的处理器
     */
    getRegisteredHandlers() {
        return Array.from(this.handlers.keys());
    }
}
exports.TradingWebhookRegistry = TradingWebhookRegistry;
// ============================================================================
// GitHub Actions Webhook Parser
// ============================================================================
function createGitHubActionsWebhookParser() {
    return {
        source: { type: 'github', name: 'github_actions' },
        parse: (payload, headers) => {
            const events = [];
            const now = Date.now();
            // Deployment 事件
            if (payload.deployment) {
                const deployment = payload.deployment;
                const repository = payload.repository;
                // Deployment Pending → Trading Deployment Pending
                if (deployment.environment === 'production') {
                    events.push({
                        type: 'deployment_pending',
                        timestamp: now,
                        severity: 'high',
                        source: {
                            system: 'github_actions',
                            component: 'deployment',
                            environment: 'mainnet',
                        },
                        actor: {
                            userId: deployment.creator?.login || 'unknown',
                            username: deployment.creator?.login || 'unknown',
                        },
                        metadata: {
                            deploymentId: String(deployment.id),
                            githubDeploymentId: deployment.id,
                            environment: 'mainnet',
                            environmentName: deployment.environment,
                            ref: deployment.ref,
                            riskLevel: 'high',
                            repository: repository?.full_name,
                        },
                    });
                }
            }
            // Workflow Run 事件
            if (payload.workflow_run) {
                const workflow = payload.workflow_run;
                const repository = payload.repository;
                // Workflow Failed → Trading Deployment Failed
                if (workflow.conclusion === 'failure') {
                    events.push({
                        type: 'deployment_failed',
                        timestamp: now,
                        severity: 'high',
                        source: {
                            system: 'github_actions',
                            component: 'workflow',
                            environment: 'mainnet',
                        },
                        actor: {
                            userId: payload.sender?.login || 'unknown',
                            username: payload.sender?.login || 'unknown',
                        },
                        metadata: {
                            deploymentId: `workflow_${workflow.id}`,
                            workflowName: workflow.name,
                            runId: workflow.id,
                            failureReason: workflow.conclusion,
                            repository: repository?.full_name,
                            branch: workflow.head_branch,
                        },
                    });
                }
            }
            return events.length > 0 ? events : null;
        },
    };
}
// ============================================================================
// Trading System Webhook Parser
// ============================================================================
function createTradingSystemWebhookParser() {
    return {
        source: { type: 'trading_system', name: 'trading_core' },
        parse: (payload, headers) => {
            const events = [];
            const now = Date.now();
            // Release Request
            if (payload.type === 'release_request') {
                events.push({
                    type: 'release_requested',
                    timestamp: now,
                    severity: payload.riskLevel || 'medium',
                    source: {
                        system: 'trading_system',
                        component: 'release_manager',
                        environment: payload.environment || 'mainnet',
                    },
                    actor: {
                        userId: payload.requestedBy || 'unknown',
                        username: payload.requestedBy || 'unknown',
                    },
                    metadata: {
                        releaseId: payload.releaseId || `release_${now}`,
                        strategyName: payload.strategyName,
                        version: payload.version,
                        description: payload.description,
                        riskLevel: payload.riskLevel,
                        environment: payload.environment,
                    },
                });
            }
            // System Alert
            if (payload.type === 'system_alert') {
                events.push({
                    type: 'system_alert',
                    timestamp: now,
                    severity: payload.severity || 'medium',
                    source: {
                        system: payload.system || 'trading_system',
                        component: payload.component || 'unknown',
                        environment: payload.environment || 'mainnet',
                    },
                    actor: {
                        userId: 'system',
                        username: 'system',
                    },
                    metadata: {
                        alertId: payload.alertId || `alert_${now}`,
                        alertType: payload.alertType,
                        title: payload.title,
                        description: payload.description,
                        metric: payload.metric,
                        threshold: payload.threshold,
                        currentValue: payload.currentValue,
                    },
                });
            }
            // Risk Breach
            if (payload.type === 'risk_breach') {
                events.push({
                    type: 'system_alert',
                    timestamp: now,
                    severity: payload.severity || 'high',
                    source: {
                        system: 'risk_manager',
                        component: 'breach_detector',
                        environment: payload.environment || 'mainnet',
                    },
                    actor: {
                        userId: 'system',
                        username: 'system',
                    },
                    metadata: {
                        alertId: `breach_${now}`,
                        alertType: 'risk_breach',
                        title: `Risk Breach: ${payload.metric}`,
                        description: `${payload.metric} exceeded threshold (${payload.value} > ${payload.threshold})`,
                        metric: payload.metric,
                        threshold: payload.threshold,
                        currentValue: payload.value,
                        riskLevel: payload.severity,
                    },
                });
            }
            return events.length > 0 ? events : null;
        },
    };
}
// ============================================================================
// Monitoring System Webhook Parser (e.g., Prometheus, Grafana)
// ============================================================================
function createMonitoringWebhookParser() {
    return {
        source: { type: 'monitoring', name: 'prometheus' },
        parse: (payload, headers) => {
            const events = [];
            const now = Date.now();
            // Prometheus Alert
            if (payload.alerts && Array.isArray(payload.alerts)) {
                for (const alert of payload.alerts) {
                    if (alert.status === 'firing') {
                        const severity = alert.labels?.severity || 'medium';
                        const tradingSeverity = severity === 'critical' ? 'critical' :
                            severity === 'error' ? 'high' :
                                severity === 'warning' ? 'medium' : 'low';
                        events.push({
                            type: 'system_alert',
                            timestamp: now,
                            severity: tradingSeverity,
                            source: {
                                system: 'monitoring',
                                component: 'prometheus',
                                environment: 'mainnet',
                            },
                            actor: {
                                userId: 'system',
                                username: 'system',
                            },
                            metadata: {
                                alertId: `prometheus_${alert.fingerprint || now}`,
                                alertType: alert.labels?.alertname || 'monitoring_alert',
                                title: alert.labels?.alertname,
                                description: alert.annotations?.description || alert.annotations?.summary,
                                metric: alert.labels?.metric,
                                severity: severity,
                                instance: alert.labels?.instance,
                                job: alert.labels?.job,
                            },
                        });
                    }
                }
            }
            return events.length > 0 ? events : null;
        },
    };
}
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingWebhookRegistry() {
    const registry = new TradingWebhookRegistry();
    // 注册默认处理器
    registry.registerHandler(createGitHubActionsWebhookParser());
    registry.registerHandler(createTradingSystemWebhookParser());
    registry.registerHandler(createMonitoringWebhookParser());
    return registry;
}
