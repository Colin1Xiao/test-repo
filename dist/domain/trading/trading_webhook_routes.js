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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ193ZWJob29rX3JvdXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9kb21haW4vdHJhZGluZy90cmFkaW5nX3dlYmhvb2tfcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBOEVILDRFQTJFQztBQU1ELDRFQTJGQztBQU1ELHNFQWdEQztBQU1ELG9FQVNDO0FBNVNELCtFQUErRTtBQUMvRSxtQkFBbUI7QUFDbkIsK0VBQStFO0FBRS9FLE1BQWEsc0JBQXNCO0lBR2pDO1FBRlEsYUFBUSxHQUFnQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRTNDLENBQUM7SUFFaEI7O09BRUc7SUFDSCxlQUFlLENBQUMsT0FBdUI7UUFDckMsTUFBTSxHQUFHLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzVELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsVUFBa0IsRUFBRSxVQUFrQjtRQUMvQyxNQUFNLEdBQUcsR0FBRyxHQUFHLFVBQVUsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUMxQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUNsQixVQUFrQixFQUNsQixVQUFrQixFQUNsQixPQUFZLEVBQ1osT0FBK0I7UUFFL0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQywy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LFVBQVU7SUFDVixRQUFRLENBQUMsZUFBZSxDQUFDLGdDQUFnQyxFQUFFLENBQUMsQ0FBQztJQUM3RCxRQUFRLENBQUMsZUFBZSxDQUFDLGdDQUFnQyxFQUFFLENBQUMsQ0FBQztJQUM3RCxRQUFRLENBQUMsZUFBZSxDQUFDLDZCQUE2QixFQUFFLENBQUMsQ0FBQztJQUUxRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUcmFkaW5nIFdlYmhvb2sgUm91dGVzXG4gKiBQaGFzZSAyRC0xQyAtIOS6pOaYk+WfnyBXZWJob29rIOi3r+eUsVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5o6l5pS25aSW6YOo5Lqk5piT57O757ufIFdlYmhvb2tcbiAqIC0g6Kej5p6Q5bm26L2s5o2i5Li6IFRyYWRpbmcgRXZlbnRcbiAqIC0g6Lev55Sx5Yiw5a+55bqU5aSE55CG5ZmoXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBUcmFkaW5nRXZlbnQgfSBmcm9tICcuL3RyYWRpbmdfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBXZWJob29rU291cmNlIHtcbiAgdHlwZTogJ2dpdGh1YicgfCAnamVua2lucycgfCAnY2lyY2xlY2knIHwgJ3RyYWRpbmdfc3lzdGVtJyB8ICdtb25pdG9yaW5nJztcbiAgbmFtZTogc3RyaW5nO1xuICBzZWNyZXQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2ViaG9va0hhbmRsZXIge1xuICBzb3VyY2U6IFdlYmhvb2tTb3VyY2U7XG4gIHBhcnNlOiAocGF5bG9hZDogYW55LCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSA9PiBUcmFkaW5nRXZlbnQgfCBUcmFkaW5nRXZlbnRbXSB8IG51bGw7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFdlYmhvb2sgUmVnaXN0cnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFRyYWRpbmdXZWJob29rUmVnaXN0cnkge1xuICBwcml2YXRlIGhhbmRsZXJzOiBNYXA8c3RyaW5nLCBXZWJob29rSGFuZGxlcj4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoKSB7fVxuXG4gIC8qKlxuICAgKiDms6jlhowgV2ViaG9vayDlpITnkIblmahcbiAgICovXG4gIHJlZ2lzdGVySGFuZGxlcihoYW5kbGVyOiBXZWJob29rSGFuZGxlcik6IHZvaWQge1xuICAgIGNvbnN0IGtleSA9IGAke2hhbmRsZXIuc291cmNlLnR5cGV9OiR7aGFuZGxlci5zb3VyY2UubmFtZX1gO1xuICAgIHRoaXMuaGFuZGxlcnMuc2V0KGtleSwgaGFuZGxlcik7XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W5aSE55CG5ZmoXG4gICAqL1xuICBnZXRIYW5kbGVyKHNvdXJjZVR5cGU6IHN0cmluZywgc291cmNlTmFtZTogc3RyaW5nKTogV2ViaG9va0hhbmRsZXIgfCBudWxsIHtcbiAgICBjb25zdCBrZXkgPSBgJHtzb3VyY2VUeXBlfToke3NvdXJjZU5hbWV9YDtcbiAgICByZXR1cm4gdGhpcy5oYW5kbGVycy5nZXQoa2V5KSB8fCBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBXZWJob29rXG4gICAqL1xuICBhc3luYyBwcm9jZXNzV2ViaG9vayhcbiAgICBzb3VyY2VUeXBlOiBzdHJpbmcsXG4gICAgc291cmNlTmFtZTogc3RyaW5nLFxuICAgIHBheWxvYWQ6IGFueSxcbiAgICBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gICk6IFByb21pc2U8VHJhZGluZ0V2ZW50W10+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5nZXRIYW5kbGVyKHNvdXJjZVR5cGUsIHNvdXJjZU5hbWUpO1xuICAgIGlmICghaGFuZGxlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHdlYmhvb2sgc291cmNlOiAke3NvdXJjZVR5cGV9OiR7c291cmNlTmFtZX1gKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBoYW5kbGVyLnBhcnNlKHBheWxvYWQsIGhlYWRlcnMpO1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdCA6IFtyZXN1bHRdO1xuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPluaJgOacieazqOWGjOeahOWkhOeQhuWZqFxuICAgKi9cbiAgZ2V0UmVnaXN0ZXJlZEhhbmRsZXJzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmhhbmRsZXJzLmtleXMoKSk7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR2l0SHViIEFjdGlvbnMgV2ViaG9vayBQYXJzZXJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdpdEh1YkFjdGlvbnNXZWJob29rUGFyc2VyKCk6IFdlYmhvb2tIYW5kbGVyIHtcbiAgcmV0dXJuIHtcbiAgICBzb3VyY2U6IHsgdHlwZTogJ2dpdGh1YicsIG5hbWU6ICdnaXRodWJfYWN0aW9ucycgfSxcbiAgICBwYXJzZTogKHBheWxvYWQsIGhlYWRlcnMpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50czogVHJhZGluZ0V2ZW50W10gPSBbXTtcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICAgIC8vIERlcGxveW1lbnQg5LqL5Lu2XG4gICAgICBpZiAocGF5bG9hZC5kZXBsb3ltZW50KSB7XG4gICAgICAgIGNvbnN0IGRlcGxveW1lbnQgPSBwYXlsb2FkLmRlcGxveW1lbnQ7XG4gICAgICAgIGNvbnN0IHJlcG9zaXRvcnkgPSBwYXlsb2FkLnJlcG9zaXRvcnk7XG5cbiAgICAgICAgLy8gRGVwbG95bWVudCBQZW5kaW5nIOKGkiBUcmFkaW5nIERlcGxveW1lbnQgUGVuZGluZ1xuICAgICAgICBpZiAoZGVwbG95bWVudC5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgZXZlbnRzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ2RlcGxveW1lbnRfcGVuZGluZycsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vdyxcbiAgICAgICAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgICAgc3lzdGVtOiAnZ2l0aHViX2FjdGlvbnMnLFxuICAgICAgICAgICAgICBjb21wb25lbnQ6ICdkZXBsb3ltZW50JyxcbiAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6ICdtYWlubmV0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhY3Rvcjoge1xuICAgICAgICAgICAgICB1c2VySWQ6IGRlcGxveW1lbnQuY3JlYXRvcj8ubG9naW4gfHwgJ3Vua25vd24nLFxuICAgICAgICAgICAgICB1c2VybmFtZTogZGVwbG95bWVudC5jcmVhdG9yPy5sb2dpbiB8fCAndW5rbm93bicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgZGVwbG95bWVudElkOiBTdHJpbmcoZGVwbG95bWVudC5pZCksXG4gICAgICAgICAgICAgIGdpdGh1YkRlcGxveW1lbnRJZDogZGVwbG95bWVudC5pZCxcbiAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6ICdtYWlubmV0JyxcbiAgICAgICAgICAgICAgZW52aXJvbm1lbnROYW1lOiBkZXBsb3ltZW50LmVudmlyb25tZW50LFxuICAgICAgICAgICAgICByZWY6IGRlcGxveW1lbnQucmVmLFxuICAgICAgICAgICAgICByaXNrTGV2ZWw6ICdoaWdoJyxcbiAgICAgICAgICAgICAgcmVwb3NpdG9yeTogcmVwb3NpdG9yeT8uZnVsbF9uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBXb3JrZmxvdyBSdW4g5LqL5Lu2XG4gICAgICBpZiAocGF5bG9hZC53b3JrZmxvd19ydW4pIHtcbiAgICAgICAgY29uc3Qgd29ya2Zsb3cgPSBwYXlsb2FkLndvcmtmbG93X3J1bjtcbiAgICAgICAgY29uc3QgcmVwb3NpdG9yeSA9IHBheWxvYWQucmVwb3NpdG9yeTtcblxuICAgICAgICAvLyBXb3JrZmxvdyBGYWlsZWQg4oaSIFRyYWRpbmcgRGVwbG95bWVudCBGYWlsZWRcbiAgICAgICAgaWYgKHdvcmtmbG93LmNvbmNsdXNpb24gPT09ICdmYWlsdXJlJykge1xuICAgICAgICAgIGV2ZW50cy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICdkZXBsb3ltZW50X2ZhaWxlZCcsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vdyxcbiAgICAgICAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgICAgc3lzdGVtOiAnZ2l0aHViX2FjdGlvbnMnLFxuICAgICAgICAgICAgICBjb21wb25lbnQ6ICd3b3JrZmxvdycsXG4gICAgICAgICAgICAgIGVudmlyb25tZW50OiAnbWFpbm5ldCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWN0b3I6IHtcbiAgICAgICAgICAgICAgdXNlcklkOiBwYXlsb2FkLnNlbmRlcj8ubG9naW4gfHwgJ3Vua25vd24nLFxuICAgICAgICAgICAgICB1c2VybmFtZTogcGF5bG9hZC5zZW5kZXI/LmxvZ2luIHx8ICd1bmtub3duJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgICAgICBkZXBsb3ltZW50SWQ6IGB3b3JrZmxvd18ke3dvcmtmbG93LmlkfWAsXG4gICAgICAgICAgICAgIHdvcmtmbG93TmFtZTogd29ya2Zsb3cubmFtZSxcbiAgICAgICAgICAgICAgcnVuSWQ6IHdvcmtmbG93LmlkLFxuICAgICAgICAgICAgICBmYWlsdXJlUmVhc29uOiB3b3JrZmxvdy5jb25jbHVzaW9uLFxuICAgICAgICAgICAgICByZXBvc2l0b3J5OiByZXBvc2l0b3J5Py5mdWxsX25hbWUsXG4gICAgICAgICAgICAgIGJyYW5jaDogd29ya2Zsb3cuaGVhZF9icmFuY2gsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBldmVudHMubGVuZ3RoID4gMCA/IGV2ZW50cyA6IG51bGw7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVHJhZGluZyBTeXN0ZW0gV2ViaG9vayBQYXJzZXJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRyYWRpbmdTeXN0ZW1XZWJob29rUGFyc2VyKCk6IFdlYmhvb2tIYW5kbGVyIHtcbiAgcmV0dXJuIHtcbiAgICBzb3VyY2U6IHsgdHlwZTogJ3RyYWRpbmdfc3lzdGVtJywgbmFtZTogJ3RyYWRpbmdfY29yZScgfSxcbiAgICBwYXJzZTogKHBheWxvYWQsIGhlYWRlcnMpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50czogVHJhZGluZ0V2ZW50W10gPSBbXTtcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICAgIC8vIFJlbGVhc2UgUmVxdWVzdFxuICAgICAgaWYgKHBheWxvYWQudHlwZSA9PT0gJ3JlbGVhc2VfcmVxdWVzdCcpIHtcbiAgICAgICAgZXZlbnRzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdyZWxlYXNlX3JlcXVlc3RlZCcsXG4gICAgICAgICAgdGltZXN0YW1wOiBub3csXG4gICAgICAgICAgc2V2ZXJpdHk6IHBheWxvYWQucmlza0xldmVsIHx8ICdtZWRpdW0nLFxuICAgICAgICAgIHNvdXJjZToge1xuICAgICAgICAgICAgc3lzdGVtOiAndHJhZGluZ19zeXN0ZW0nLFxuICAgICAgICAgICAgY29tcG9uZW50OiAncmVsZWFzZV9tYW5hZ2VyJyxcbiAgICAgICAgICAgIGVudmlyb25tZW50OiBwYXlsb2FkLmVudmlyb25tZW50IHx8ICdtYWlubmV0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdG9yOiB7XG4gICAgICAgICAgICB1c2VySWQ6IHBheWxvYWQucmVxdWVzdGVkQnkgfHwgJ3Vua25vd24nLFxuICAgICAgICAgICAgdXNlcm5hbWU6IHBheWxvYWQucmVxdWVzdGVkQnkgfHwgJ3Vua25vd24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIHJlbGVhc2VJZDogcGF5bG9hZC5yZWxlYXNlSWQgfHwgYHJlbGVhc2VfJHtub3d9YCxcbiAgICAgICAgICAgIHN0cmF0ZWd5TmFtZTogcGF5bG9hZC5zdHJhdGVneU5hbWUsXG4gICAgICAgICAgICB2ZXJzaW9uOiBwYXlsb2FkLnZlcnNpb24sXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgIHJpc2tMZXZlbDogcGF5bG9hZC5yaXNrTGV2ZWwsXG4gICAgICAgICAgICBlbnZpcm9ubWVudDogcGF5bG9hZC5lbnZpcm9ubWVudCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gU3lzdGVtIEFsZXJ0XG4gICAgICBpZiAocGF5bG9hZC50eXBlID09PSAnc3lzdGVtX2FsZXJ0Jykge1xuICAgICAgICBldmVudHMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3N5c3RlbV9hbGVydCcsXG4gICAgICAgICAgdGltZXN0YW1wOiBub3csXG4gICAgICAgICAgc2V2ZXJpdHk6IHBheWxvYWQuc2V2ZXJpdHkgfHwgJ21lZGl1bScsXG4gICAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgICBzeXN0ZW06IHBheWxvYWQuc3lzdGVtIHx8ICd0cmFkaW5nX3N5c3RlbScsXG4gICAgICAgICAgICBjb21wb25lbnQ6IHBheWxvYWQuY29tcG9uZW50IHx8ICd1bmtub3duJyxcbiAgICAgICAgICAgIGVudmlyb25tZW50OiBwYXlsb2FkLmVudmlyb25tZW50IHx8ICdtYWlubmV0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdG9yOiB7XG4gICAgICAgICAgICB1c2VySWQ6ICdzeXN0ZW0nLFxuICAgICAgICAgICAgdXNlcm5hbWU6ICdzeXN0ZW0nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIGFsZXJ0SWQ6IHBheWxvYWQuYWxlcnRJZCB8fCBgYWxlcnRfJHtub3d9YCxcbiAgICAgICAgICAgIGFsZXJ0VHlwZTogcGF5bG9hZC5hbGVydFR5cGUsXG4gICAgICAgICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgbWV0cmljOiBwYXlsb2FkLm1ldHJpYyxcbiAgICAgICAgICAgIHRocmVzaG9sZDogcGF5bG9hZC50aHJlc2hvbGQsXG4gICAgICAgICAgICBjdXJyZW50VmFsdWU6IHBheWxvYWQuY3VycmVudFZhbHVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSaXNrIEJyZWFjaFxuICAgICAgaWYgKHBheWxvYWQudHlwZSA9PT0gJ3Jpc2tfYnJlYWNoJykge1xuICAgICAgICBldmVudHMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3N5c3RlbV9hbGVydCcsXG4gICAgICAgICAgdGltZXN0YW1wOiBub3csXG4gICAgICAgICAgc2V2ZXJpdHk6IHBheWxvYWQuc2V2ZXJpdHkgfHwgJ2hpZ2gnLFxuICAgICAgICAgIHNvdXJjZToge1xuICAgICAgICAgICAgc3lzdGVtOiAncmlza19tYW5hZ2VyJyxcbiAgICAgICAgICAgIGNvbXBvbmVudDogJ2JyZWFjaF9kZXRlY3RvcicsXG4gICAgICAgICAgICBlbnZpcm9ubWVudDogcGF5bG9hZC5lbnZpcm9ubWVudCB8fCAnbWFpbm5ldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhY3Rvcjoge1xuICAgICAgICAgICAgdXNlcklkOiAnc3lzdGVtJyxcbiAgICAgICAgICAgIHVzZXJuYW1lOiAnc3lzdGVtJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgICBhbGVydElkOiBgYnJlYWNoXyR7bm93fWAsXG4gICAgICAgICAgICBhbGVydFR5cGU6ICdyaXNrX2JyZWFjaCcsXG4gICAgICAgICAgICB0aXRsZTogYFJpc2sgQnJlYWNoOiAke3BheWxvYWQubWV0cmljfWAsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7cGF5bG9hZC5tZXRyaWN9IGV4Y2VlZGVkIHRocmVzaG9sZCAoJHtwYXlsb2FkLnZhbHVlfSA+ICR7cGF5bG9hZC50aHJlc2hvbGR9KWAsXG4gICAgICAgICAgICBtZXRyaWM6IHBheWxvYWQubWV0cmljLFxuICAgICAgICAgICAgdGhyZXNob2xkOiBwYXlsb2FkLnRocmVzaG9sZCxcbiAgICAgICAgICAgIGN1cnJlbnRWYWx1ZTogcGF5bG9hZC52YWx1ZSxcbiAgICAgICAgICAgIHJpc2tMZXZlbDogcGF5bG9hZC5zZXZlcml0eSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV2ZW50cy5sZW5ndGggPiAwID8gZXZlbnRzIDogbnVsbDtcbiAgICB9LFxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNb25pdG9yaW5nIFN5c3RlbSBXZWJob29rIFBhcnNlciAoZS5nLiwgUHJvbWV0aGV1cywgR3JhZmFuYSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vbml0b3JpbmdXZWJob29rUGFyc2VyKCk6IFdlYmhvb2tIYW5kbGVyIHtcbiAgcmV0dXJuIHtcbiAgICBzb3VyY2U6IHsgdHlwZTogJ21vbml0b3JpbmcnLCBuYW1lOiAncHJvbWV0aGV1cycgfSxcbiAgICBwYXJzZTogKHBheWxvYWQsIGhlYWRlcnMpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50czogVHJhZGluZ0V2ZW50W10gPSBbXTtcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICAgIC8vIFByb21ldGhldXMgQWxlcnRcbiAgICAgIGlmIChwYXlsb2FkLmFsZXJ0cyAmJiBBcnJheS5pc0FycmF5KHBheWxvYWQuYWxlcnRzKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGFsZXJ0IG9mIHBheWxvYWQuYWxlcnRzKSB7XG4gICAgICAgICAgaWYgKGFsZXJ0LnN0YXR1cyA9PT0gJ2ZpcmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IHNldmVyaXR5ID0gYWxlcnQubGFiZWxzPy5zZXZlcml0eSB8fCAnbWVkaXVtJztcbiAgICAgICAgICAgIGNvbnN0IHRyYWRpbmdTZXZlcml0eTogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB8ICdjcml0aWNhbCcgPVxuICAgICAgICAgICAgICBzZXZlcml0eSA9PT0gJ2NyaXRpY2FsJyA/ICdjcml0aWNhbCcgOlxuICAgICAgICAgICAgICBzZXZlcml0eSA9PT0gJ2Vycm9yJyA/ICdoaWdoJyA6XG4gICAgICAgICAgICAgIHNldmVyaXR5ID09PSAnd2FybmluZycgPyAnbWVkaXVtJyA6ICdsb3cnO1xuXG4gICAgICAgICAgICBldmVudHMucHVzaCh7XG4gICAgICAgICAgICAgIHR5cGU6ICdzeXN0ZW1fYWxlcnQnLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5vdyxcbiAgICAgICAgICAgICAgc2V2ZXJpdHk6IHRyYWRpbmdTZXZlcml0eSxcbiAgICAgICAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgICAgICAgc3lzdGVtOiAnbW9uaXRvcmluZycsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiAncHJvbWV0aGV1cycsXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6ICdtYWlubmV0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYWN0b3I6IHtcbiAgICAgICAgICAgICAgICB1c2VySWQ6ICdzeXN0ZW0nLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiAnc3lzdGVtJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICBhbGVydElkOiBgcHJvbWV0aGV1c18ke2FsZXJ0LmZpbmdlcnByaW50IHx8IG5vd31gLFxuICAgICAgICAgICAgICAgIGFsZXJ0VHlwZTogYWxlcnQubGFiZWxzPy5hbGVydG5hbWUgfHwgJ21vbml0b3JpbmdfYWxlcnQnLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBhbGVydC5sYWJlbHM/LmFsZXJ0bmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYWxlcnQuYW5ub3RhdGlvbnM/LmRlc2NyaXB0aW9uIHx8IGFsZXJ0LmFubm90YXRpb25zPy5zdW1tYXJ5LFxuICAgICAgICAgICAgICAgIG1ldHJpYzogYWxlcnQubGFiZWxzPy5tZXRyaWMsXG4gICAgICAgICAgICAgICAgc2V2ZXJpdHk6IHNldmVyaXR5LFxuICAgICAgICAgICAgICAgIGluc3RhbmNlOiBhbGVydC5sYWJlbHM/Lmluc3RhbmNlLFxuICAgICAgICAgICAgICAgIGpvYjogYWxlcnQubGFiZWxzPy5qb2IsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV2ZW50cy5sZW5ndGggPiAwID8gZXZlbnRzIDogbnVsbDtcbiAgICB9LFxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRyYWRpbmdXZWJob29rUmVnaXN0cnkoKTogVHJhZGluZ1dlYmhvb2tSZWdpc3RyeSB7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IFRyYWRpbmdXZWJob29rUmVnaXN0cnkoKTtcblxuICAvLyDms6jlhozpu5jorqTlpITnkIblmahcbiAgcmVnaXN0cnkucmVnaXN0ZXJIYW5kbGVyKGNyZWF0ZUdpdEh1YkFjdGlvbnNXZWJob29rUGFyc2VyKCkpO1xuICByZWdpc3RyeS5yZWdpc3RlckhhbmRsZXIoY3JlYXRlVHJhZGluZ1N5c3RlbVdlYmhvb2tQYXJzZXIoKSk7XG4gIHJlZ2lzdHJ5LnJlZ2lzdGVySGFuZGxlcihjcmVhdGVNb25pdG9yaW5nV2ViaG9va1BhcnNlcigpKTtcblxuICByZXR1cm4gcmVnaXN0cnk7XG59XG4iXX0=