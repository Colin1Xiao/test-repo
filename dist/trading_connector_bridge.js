"use strict";
/**
 * Trading Connector Bridge
 * Phase 2C-1 - 交易域 Connector 桥接
 *
 * 职责：
 * - 复用现有 GitHub / GitHub Actions Connectors
 * - 转换为交易域语义
 * - 提供统一的交易域事件接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingConnectorBridge = void 0;
exports.createTradingConnectorBridge = createTradingConnectorBridge;
// ============================================================================
// Trading Connector Bridge
// ============================================================================
class TradingConnectorBridge {
    constructor(config = {}) {
        this.config = {
            githubActionsIntegration: config.githubActionsIntegration || { enabled: false },
            defaultEnvironment: config.defaultEnvironment || 'mainnet',
        };
    }
    /**
     * 转换 GitHub Actions Deployment 事件到 Trading Event
     */
    convertGitHubActionsDeployment(githubEvent) {
        if (!this.config.githubActionsIntegration.enabled) {
            return null;
        }
        const eventType = githubEvent.type;
        const deployment = githubEvent.deployment;
        const workflow = githubEvent.workflow;
        // Deployment Pending → Trading Deployment Pending
        if (eventType === 'deployment' && deployment?.environment === 'production') {
            return {
                type: 'deployment_pending',
                timestamp: Date.now(),
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
                    deploymentId: deployment.id,
                    githubDeploymentId: deployment.id,
                    environment: 'mainnet',
                    environmentName: deployment.environment,
                    ref: deployment.ref,
                    riskLevel: 'high',
                },
            };
        }
        // Workflow Failed → Trading Deployment Failed
        if (eventType === 'workflow_run' && workflow?.conclusion === 'failure') {
            return {
                type: 'deployment_failed',
                timestamp: Date.now(),
                severity: 'high',
                source: {
                    system: 'github_actions',
                    component: 'workflow',
                    environment: 'mainnet',
                },
                actor: {
                    userId: workflow.sender?.login || 'unknown',
                    username: workflow.sender?.login || 'unknown',
                },
                metadata: {
                    deploymentId: `workflow_${workflow.runId}`,
                    workflowName: workflow.name,
                    runId: workflow.runId,
                    failureReason: workflow.conclusion,
                    relatedReleaseId: workflow.metadata?.releaseId,
                },
            };
        }
        return null;
    }
    /**
     * 转换 GitHub PR Review 事件到 Trading Event
     */
    convertGitHubReview(githubEvent) {
        const eventType = githubEvent.type;
        const pr = githubEvent.pull_request;
        const review = githubEvent.review;
        // Review Requested → Trading Release Approval Needed
        if (eventType === 'pull_request_review' && review?.state === 'pending') {
            return {
                type: 'release_requested',
                timestamp: Date.now(),
                severity: 'medium',
                source: {
                    system: 'github',
                    component: 'pull_request',
                    environment: 'testnet',
                },
                actor: {
                    userId: pr.user?.login || 'unknown',
                    username: pr.user?.login || 'unknown',
                },
                metadata: {
                    releaseId: `pr_${pr.number}`,
                    strategyName: pr.title,
                    version: `PR #${pr.number}`,
                    description: pr.body || '',
                    riskLevel: 'medium',
                    environment: 'testnet',
                    prNumber: pr.number,
                },
            };
        }
        return null;
    }
    /**
     * 转换 System Alert 到 Trading Event
     */
    convertSystemAlert(alertData) {
        const alertType = alertData.type || 'system_health';
        const severity = alertData.severity || 'medium';
        const system = alertData.system || 'unknown';
        const component = alertData.component || 'unknown';
        const environment = alertData.environment || this.config.defaultEnvironment;
        return {
            type: 'system_alert',
            timestamp: Date.now(),
            severity: severity,
            source: {
                system,
                component,
                environment: environment,
            },
            actor: {
                userId: 'system',
                username: 'system',
            },
            metadata: {
                alertId: alertData.id || `alert_${Date.now()}`,
                alertType,
                title: alertData.title || `${alertType} in ${system}`,
                description: alertData.description || alertData.message || '',
                metric: alertData.metric,
                threshold: alertData.threshold,
                currentValue: alertData.currentValue,
                relatedReleaseId: alertData.relatedReleaseId,
                relatedDeploymentId: alertData.relatedDeploymentId,
            },
        };
    }
    /**
     * 转换 Execution Anomaly 到 Trading Event
     */
    convertExecutionAnomaly(anomalyData) {
        const system = anomalyData.system || 'execution';
        const component = anomalyData.component || 'order_manager';
        const environment = anomalyData.environment || this.config.defaultEnvironment;
        const severity = anomalyData.severity || 'high';
        return {
            type: 'execution_anomaly',
            timestamp: Date.now(),
            severity: severity,
            source: {
                system,
                component,
                environment: environment,
            },
            actor: {
                userId: 'system',
                username: 'system',
            },
            metadata: {
                anomalyId: anomalyData.id || `anomaly_${Date.now()}`,
                orderType: anomalyData.orderType || 'unknown',
                errorMessage: anomalyData.errorMessage || 'Execution failed',
                orderId: anomalyData.orderId,
                symbol: anomalyData.symbol,
                side: anomalyData.side,
                quantity: anomalyData.quantity,
            },
        };
    }
    /**
     * 转换 Risk Parameter Change 到 Trading Event
     */
    convertRiskParameterChange(changeData) {
        const environment = changeData.environment || this.config.defaultEnvironment;
        const parameter = changeData.parameter || 'unknown';
        const oldValue = changeData.oldValue || 'unknown';
        const newValue = changeData.newValue || 'unknown';
        // 根据变化幅度判断风险级别
        let severity = 'medium';
        if (changeData.riskLevel) {
            severity = changeData.riskLevel;
        }
        else if (parameter.includes('leverage') || parameter.includes('max_position')) {
            severity = 'high';
        }
        return {
            type: 'risk_parameter_changed',
            timestamp: Date.now(),
            severity,
            source: {
                system: 'risk_manager',
                component: 'parameter_store',
                environment: environment,
            },
            actor: {
                userId: changeData.userId || 'unknown',
                username: changeData.username || 'unknown',
            },
            metadata: {
                changeId: changeData.id || `risk_change_${Date.now()}`,
                parameter,
                oldValue,
                newValue,
                riskLevel: severity,
                environment,
                reason: changeData.reason || '',
            },
        };
    }
}
exports.TradingConnectorBridge = TradingConnectorBridge;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingConnectorBridge(config) {
    return new TradingConnectorBridge(config);
}
