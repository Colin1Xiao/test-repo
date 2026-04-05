"use strict";
/**
 * Trading Incident Mapper
 * Phase 2C-1 - 交易域事件映射器
 *
 * 职责：
 * - Trading System Alert → Operator Incident
 * - Deployment Regression → Incident
 * - Execution Anomaly → Incident
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingIncidentMapper = void 0;
exports.createTradingIncidentMapper = createTradingIncidentMapper;
// ============================================================================
// Trading Incident Mapper
// ============================================================================
class TradingIncidentMapper {
    constructor(config = {}) {
        this.config = {
            autoCreateIncident: config.autoCreateIncident ?? true,
            alertSeverityThreshold: config.alertSeverityThreshold ?? 'medium',
            ignoreAlertTypes: config.ignoreAlertTypes || [],
        };
    }
    /**
     * 适配交易事件到 Incident
     */
    adaptEvent(event) {
        const result = {};
        if (!this.config.autoCreateIncident) {
            return result;
        }
        // 检查是否忽略该类型
        if (this.config.ignoreAlertTypes.includes(event.metadata.alertType)) {
            result.ignored = true;
            return result;
        }
        // 检查严重级别阈值
        const severity = event.severity;
        if (!this.meetsSeverityThreshold(severity)) {
            result.ignored = true;
            return result;
        }
        switch (event.type) {
            case 'system_alert':
                return this.adaptSystemAlert(event);
            case 'deployment_failed':
                return this.adaptDeploymentFailed(event);
            case 'execution_anomaly':
                return this.adaptExecutionAnomaly(event);
            case 'market_data_degradation':
                return this.adaptMarketDataDegradation(event);
            default:
                return result;
        }
    }
    /**
     * 适配 System Alert 事件
     */
    adaptSystemAlert(event) {
        const alertId = event.metadata.alertId || `alert_${Date.now()}`;
        const alertType = event.metadata.alertType || 'system_health';
        const severity = event.severity;
        const incident = this.mapAlertToIncident(event, alertId, alertType, severity);
        return { incident };
    }
    /**
     * 适配 Deployment Failed 事件
     */
    adaptDeploymentFailed(event) {
        const deploymentId = event.metadata.deploymentId || `deploy_${Date.now()}`;
        const alertType = 'deployment_regression';
        const severity = 'high';
        const incident = this.mapDeploymentFailedToIncident(event, deploymentId, alertType, severity);
        return { incident };
    }
    /**
     * 适配 Execution Anomaly 事件
     */
    adaptExecutionAnomaly(event) {
        const anomalyId = event.metadata.anomalyId || `anomaly_${Date.now()}`;
        const alertType = 'order_failure';
        const severity = event.severity;
        const incident = this.mapExecutionAnomalyToIncident(event, anomalyId, alertType, severity);
        return { incident };
    }
    /**
     * 适配 Market Data Degradation 事件
     */
    adaptMarketDataDegradation(event) {
        const alertId = event.metadata.alertId || `alert_${Date.now()}`;
        const alertType = 'market_data_degradation';
        const severity = 'critical';
        const incident = this.mapAlertToIncident(event, alertId, alertType, severity);
        return { incident };
    }
    // ============================================================================
    // 映射方法
    // ============================================================================
    /**
     * 映射 Alert 到 Incident
     */
    mapAlertToIncident(event, alertId, alertType, severity) {
        const incidentId = `trading_incident:${alertId}`;
        const sourceId = incidentId;
        const system = event.source.system;
        const component = event.source.component;
        const environment = event.source.environment;
        const title = event.metadata.title || `${alertType} in ${system}`;
        const description = event.metadata.description || event.metadata.message || title;
        return {
            incidentId,
            type: alertType,
            severity,
            description,
            metadata: {
                source: 'trading_ops',
                sourceId,
                alertId,
                alertType,
                system,
                component,
                environment,
                relatedReleaseId: event.metadata.relatedReleaseId,
                relatedDeploymentId: event.metadata.relatedDeploymentId,
            },
        };
    }
    /**
     * 映射 Deployment Failed 到 Incident
     */
    mapDeploymentFailedToIncident(event, deploymentId, alertType, severity) {
        const incidentId = `trading_incident:deploy_${deploymentId}`;
        const sourceId = incidentId;
        const environment = event.source.environment;
        const githubDeploymentId = event.metadata.githubDeploymentId;
        const failureReason = event.metadata.failureReason || 'Unknown failure';
        return {
            incidentId,
            type: alertType,
            severity,
            description: `Deployment ${deploymentId} failed: ${failureReason}`,
            metadata: {
                source: 'trading_ops',
                sourceId,
                alertId: deploymentId,
                alertType,
                system: 'deployment',
                component: 'github_actions',
                environment,
                githubDeploymentId,
                failureReason,
                relatedReleaseId: event.metadata.relatedReleaseId,
            },
        };
    }
    /**
     * 映射 Execution Anomaly 到 Incident
     */
    mapExecutionAnomalyToIncident(event, anomalyId, alertType, severity) {
        const incidentId = `trading_incident:anomaly_${anomalyId}`;
        const sourceId = incidentId;
        const system = event.source.system;
        const component = event.source.component;
        const environment = event.source.environment;
        const orderType = event.metadata.orderType || 'Unknown';
        const errorMessage = event.metadata.errorMessage || 'Execution failed';
        return {
            incidentId,
            type: alertType,
            severity,
            description: `Execution anomaly: ${orderType} - ${errorMessage}`,
            metadata: {
                source: 'trading_ops',
                sourceId,
                alertId: anomalyId,
                alertType,
                system,
                component,
                environment,
                orderType,
                errorMessage,
            },
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 检查是否达到严重级别阈值
     */
    meetsSeverityThreshold(severity) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        const threshold = this.config.alertSeverityThreshold;
        return severityOrder[severity] >= severityOrder[threshold];
    }
}
exports.TradingIncidentMapper = TradingIncidentMapper;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingIncidentMapper(config) {
    return new TradingIncidentMapper(config);
}
