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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19pbmNpZGVudF9tYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZG9tYWluL3RyYWRpbmcvdHJhZGluZ19pbmNpZGVudF9tYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFnUkgsa0VBSUM7QUFoUUQsK0VBQStFO0FBQy9FLDBCQUEwQjtBQUMxQiwrRUFBK0U7QUFFL0UsTUFBYSxxQkFBcUI7SUFHaEMsWUFBWSxTQUFzQyxFQUFFO1FBQ2xELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCxzQkFBc0IsRUFBRSxNQUFNLENBQUMsc0JBQXNCLElBQUksUUFBUTtZQUNqRSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLElBQUksRUFBRTtTQUNoRCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLEtBQW1CO1FBSTVCLE1BQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQztRQUV2QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxZQUFZO1FBQ1osSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQTZCLENBQUMsRUFBRSxDQUFDO1lBQ3hGLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxXQUFXO1FBQ1gsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDM0MsTUFBTSxDQUFDLE9BQU8sR0FB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Q2YsUUFBUTtZQUNSLFdBQVcsRUFBRSxzQkFBc0IsU0FBUyxNQUFNLFlBQVksRUFBRTtZQUNoRSxRQUFRLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFLGFBQWE7Z0JBQ3JCLFFBQVE7Z0JBQ1IsT0FBTyxFQUFFLFNBQVM7Z0JBQ2xCLFNBQVM7Z0JBQ1QsTUFBTTtnQkFDTixTQUFTO2dCQUNULFdBQVc7Z0JBQ1gsU0FBUztnQkFDVCxZQUFZO2FBQ2I7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVELCtFQUErRTtJQUMvRSxPQUFPO0lBQ1AsK0VBQStFO0lBRS9FOztPQUVHO0lBQ0ssc0JBQXNCLENBQUMsUUFBeUI7UUFDdEQsTUFBTSxhQUFhLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDbEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQztRQUVyRCxPQUFPLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0QsQ0FBQztDQUNGO0FBbFBELHNEQWtQQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDJCQUEyQixDQUN6QyxNQUFvQztJQUVwQyxPQUFPLElBQUkscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVHJhZGluZyBJbmNpZGVudCBNYXBwZXJcbiAqIFBoYXNlIDJDLTEgLSDkuqTmmJPln5/kuovku7bmmKDlsITlmahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIFRyYWRpbmcgU3lzdGVtIEFsZXJ0IOKGkiBPcGVyYXRvciBJbmNpZGVudFxuICogLSBEZXBsb3ltZW50IFJlZ3Jlc3Npb24g4oaSIEluY2lkZW50XG4gKiAtIEV4ZWN1dGlvbiBBbm9tYWx5IOKGkiBJbmNpZGVudFxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgVHJhZGluZ0V2ZW50LFxuICBUcmFkaW5nU3lzdGVtQWxlcnQsXG4gIE1hcHBlZFRyYWRpbmdJbmNpZGVudCxcbiAgVHJhZGluZ1NldmVyaXR5LFxuICBUcmFkaW5nQWxlcnRUeXBlLFxufSBmcm9tICcuL3RyYWRpbmdfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFkaW5nSW5jaWRlbnRNYXBwZXJDb25maWcge1xuICBhdXRvQ3JlYXRlSW5jaWRlbnQ/OiBib29sZWFuO1xuICBhbGVydFNldmVyaXR5VGhyZXNob2xkPzogVHJhZGluZ1NldmVyaXR5O1xuICBpZ25vcmVBbGVydFR5cGVzPzogVHJhZGluZ0FsZXJ0VHlwZVtdO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBUcmFkaW5nIEluY2lkZW50IE1hcHBlclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgVHJhZGluZ0luY2lkZW50TWFwcGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFRyYWRpbmdJbmNpZGVudE1hcHBlckNvbmZpZz47XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBUcmFkaW5nSW5jaWRlbnRNYXBwZXJDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgYXV0b0NyZWF0ZUluY2lkZW50OiBjb25maWcuYXV0b0NyZWF0ZUluY2lkZW50ID8/IHRydWUsXG4gICAgICBhbGVydFNldmVyaXR5VGhyZXNob2xkOiBjb25maWcuYWxlcnRTZXZlcml0eVRocmVzaG9sZCA/PyAnbWVkaXVtJyxcbiAgICAgIGlnbm9yZUFsZXJ0VHlwZXM6IGNvbmZpZy5pZ25vcmVBbGVydFR5cGVzIHx8IFtdLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWN5Lqk5piT5LqL5Lu25YiwIEluY2lkZW50XG4gICAqL1xuICBhZGFwdEV2ZW50KGV2ZW50OiBUcmFkaW5nRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRUcmFkaW5nSW5jaWRlbnQ7XG4gICAgaWdub3JlZD86IGJvb2xlYW47XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cbiAgICBpZiAoIXRoaXMuY29uZmlnLmF1dG9DcmVhdGVJbmNpZGVudCkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyDmo4Dmn6XmmK/lkKblv73nlaXor6XnsbvlnotcbiAgICBpZiAodGhpcy5jb25maWcuaWdub3JlQWxlcnRUeXBlcy5pbmNsdWRlcyhldmVudC5tZXRhZGF0YS5hbGVydFR5cGUgYXMgVHJhZGluZ0FsZXJ0VHlwZSkpIHtcbiAgICAgIHJlc3VsdC5pZ25vcmVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8g5qOA5p+l5Lil6YeN57qn5Yir6ZiI5YC8XG4gICAgY29uc3Qgc2V2ZXJpdHkgPSBldmVudC5zZXZlcml0eTtcbiAgICBpZiAoIXRoaXMubWVldHNTZXZlcml0eVRocmVzaG9sZChzZXZlcml0eSkpIHtcbiAgICAgIHJlc3VsdC5pZ25vcmVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgICBjYXNlICdzeXN0ZW1fYWxlcnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5hZGFwdFN5c3RlbUFsZXJ0KGV2ZW50KTtcblxuICAgICAgY2FzZSAnZGVwbG95bWVudF9mYWlsZWQnOlxuICAgICAgICByZXR1cm4gdGhpcy5hZGFwdERlcGxveW1lbnRGYWlsZWQoZXZlbnQpO1xuXG4gICAgICBjYXNlICdleGVjdXRpb25fYW5vbWFseSc6XG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0RXhlY3V0aW9uQW5vbWFseShldmVudCk7XG5cbiAgICAgIGNhc2UgJ21hcmtldF9kYXRhX2RlZ3JhZGF0aW9uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRNYXJrZXREYXRhRGVncmFkYXRpb24oZXZlbnQpO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDpgILphY0gU3lzdGVtIEFsZXJ0IOS6i+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdFN5c3RlbUFsZXJ0KGV2ZW50OiBUcmFkaW5nRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRUcmFkaW5nSW5jaWRlbnQ7XG4gICAgaWdub3JlZD86IGJvb2xlYW47XG4gIH0ge1xuICAgIGNvbnN0IGFsZXJ0SWQgPSBldmVudC5tZXRhZGF0YS5hbGVydElkIGFzIHN0cmluZyB8fCBgYWxlcnRfJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3QgYWxlcnRUeXBlID0gZXZlbnQubWV0YWRhdGEuYWxlcnRUeXBlIGFzIFRyYWRpbmdBbGVydFR5cGUgfHwgJ3N5c3RlbV9oZWFsdGgnO1xuICAgIGNvbnN0IHNldmVyaXR5ID0gZXZlbnQuc2V2ZXJpdHk7XG5cbiAgICBjb25zdCBpbmNpZGVudCA9IHRoaXMubWFwQWxlcnRUb0luY2lkZW50KGV2ZW50LCBhbGVydElkLCBhbGVydFR5cGUsIHNldmVyaXR5KTtcbiAgICByZXR1cm4geyBpbmNpZGVudCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAgumFjSBEZXBsb3ltZW50IEZhaWxlZCDkuovku7ZcbiAgICovXG4gIHByaXZhdGUgYWRhcHREZXBsb3ltZW50RmFpbGVkKGV2ZW50OiBUcmFkaW5nRXZlbnQpOiB7XG4gICAgaW5jaWRlbnQ/OiBNYXBwZWRUcmFkaW5nSW5jaWRlbnQ7XG4gICAgaWdub3JlZD86IGJvb2xlYW47XG4gIH0ge1xuICAgIGNvbnN0IGRlcGxveW1lbnRJZCA9IGV2ZW50Lm1ldGFkYXRhLmRlcGxveW1lbnRJZCBhcyBzdHJpbmcgfHwgYGRlcGxveV8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCBhbGVydFR5cGU6IFRyYWRpbmdBbGVydFR5cGUgPSAnZGVwbG95bWVudF9yZWdyZXNzaW9uJztcbiAgICBjb25zdCBzZXZlcml0eTogVHJhZGluZ1NldmVyaXR5ID0gJ2hpZ2gnO1xuXG4gICAgY29uc3QgaW5jaWRlbnQgPSB0aGlzLm1hcERlcGxveW1lbnRGYWlsZWRUb0luY2lkZW50KGV2ZW50LCBkZXBsb3ltZW50SWQsIGFsZXJ0VHlwZSwgc2V2ZXJpdHkpO1xuICAgIHJldHVybiB7IGluY2lkZW50IH07XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWNIEV4ZWN1dGlvbiBBbm9tYWx5IOS6i+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdEV4ZWN1dGlvbkFub21hbHkoZXZlbnQ6IFRyYWRpbmdFdmVudCk6IHtcbiAgICBpbmNpZGVudD86IE1hcHBlZFRyYWRpbmdJbmNpZGVudDtcbiAgICBpZ25vcmVkPzogYm9vbGVhbjtcbiAgfSB7XG4gICAgY29uc3QgYW5vbWFseUlkID0gZXZlbnQubWV0YWRhdGEuYW5vbWFseUlkIGFzIHN0cmluZyB8fCBgYW5vbWFseV8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCBhbGVydFR5cGU6IFRyYWRpbmdBbGVydFR5cGUgPSAnb3JkZXJfZmFpbHVyZSc7XG4gICAgY29uc3Qgc2V2ZXJpdHkgPSBldmVudC5zZXZlcml0eTtcblxuICAgIGNvbnN0IGluY2lkZW50ID0gdGhpcy5tYXBFeGVjdXRpb25Bbm9tYWx5VG9JbmNpZGVudChldmVudCwgYW5vbWFseUlkLCBhbGVydFR5cGUsIHNldmVyaXR5KTtcbiAgICByZXR1cm4geyBpbmNpZGVudCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAgumFjSBNYXJrZXQgRGF0YSBEZWdyYWRhdGlvbiDkuovku7ZcbiAgICovXG4gIHByaXZhdGUgYWRhcHRNYXJrZXREYXRhRGVncmFkYXRpb24oZXZlbnQ6IFRyYWRpbmdFdmVudCk6IHtcbiAgICBpbmNpZGVudD86IE1hcHBlZFRyYWRpbmdJbmNpZGVudDtcbiAgICBpZ25vcmVkPzogYm9vbGVhbjtcbiAgfSB7XG4gICAgY29uc3QgYWxlcnRJZCA9IGV2ZW50Lm1ldGFkYXRhLmFsZXJ0SWQgYXMgc3RyaW5nIHx8IGBhbGVydF8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCBhbGVydFR5cGU6IFRyYWRpbmdBbGVydFR5cGUgPSAnbWFya2V0X2RhdGFfZGVncmFkYXRpb24nO1xuICAgIGNvbnN0IHNldmVyaXR5OiBUcmFkaW5nU2V2ZXJpdHkgPSAnY3JpdGljYWwnO1xuXG4gICAgY29uc3QgaW5jaWRlbnQgPSB0aGlzLm1hcEFsZXJ0VG9JbmNpZGVudChldmVudCwgYWxlcnRJZCwgYWxlcnRUeXBlLCBzZXZlcml0eSk7XG4gICAgcmV0dXJuIHsgaW5jaWRlbnQgfTtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5pig5bCE5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAvKipcbiAgICog5pig5bCEIEFsZXJ0IOWIsCBJbmNpZGVudFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBBbGVydFRvSW5jaWRlbnQoXG4gICAgZXZlbnQ6IFRyYWRpbmdFdmVudCxcbiAgICBhbGVydElkOiBzdHJpbmcsXG4gICAgYWxlcnRUeXBlOiBUcmFkaW5nQWxlcnRUeXBlLFxuICAgIHNldmVyaXR5OiBUcmFkaW5nU2V2ZXJpdHlcbiAgKTogTWFwcGVkVHJhZGluZ0luY2lkZW50IHtcbiAgICBjb25zdCBpbmNpZGVudElkID0gYHRyYWRpbmdfaW5jaWRlbnQ6JHthbGVydElkfWA7XG4gICAgY29uc3Qgc291cmNlSWQgPSBpbmNpZGVudElkO1xuXG4gICAgY29uc3Qgc3lzdGVtID0gZXZlbnQuc291cmNlLnN5c3RlbTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBldmVudC5zb3VyY2UuY29tcG9uZW50O1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gZXZlbnQuc291cmNlLmVudmlyb25tZW50O1xuICAgIGNvbnN0IHRpdGxlID0gZXZlbnQubWV0YWRhdGEudGl0bGUgYXMgc3RyaW5nIHx8IGAke2FsZXJ0VHlwZX0gaW4gJHtzeXN0ZW19YDtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGV2ZW50Lm1ldGFkYXRhLmRlc2NyaXB0aW9uIGFzIHN0cmluZyB8fCBldmVudC5tZXRhZGF0YS5tZXNzYWdlIGFzIHN0cmluZyB8fCB0aXRsZTtcblxuICAgIHJldHVybiB7XG4gICAgICBpbmNpZGVudElkLFxuICAgICAgdHlwZTogYWxlcnRUeXBlLFxuICAgICAgc2V2ZXJpdHksXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ3RyYWRpbmdfb3BzJyxcbiAgICAgICAgc291cmNlSWQsXG4gICAgICAgIGFsZXJ0SWQsXG4gICAgICAgIGFsZXJ0VHlwZSxcbiAgICAgICAgc3lzdGVtLFxuICAgICAgICBjb21wb25lbnQsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICByZWxhdGVkUmVsZWFzZUlkOiBldmVudC5tZXRhZGF0YS5yZWxhdGVkUmVsZWFzZUlkIGFzIHN0cmluZyxcbiAgICAgICAgcmVsYXRlZERlcGxveW1lbnRJZDogZXZlbnQubWV0YWRhdGEucmVsYXRlZERlcGxveW1lbnRJZCBhcyBzdHJpbmcsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5pig5bCEIERlcGxveW1lbnQgRmFpbGVkIOWIsCBJbmNpZGVudFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBEZXBsb3ltZW50RmFpbGVkVG9JbmNpZGVudChcbiAgICBldmVudDogVHJhZGluZ0V2ZW50LFxuICAgIGRlcGxveW1lbnRJZDogc3RyaW5nLFxuICAgIGFsZXJ0VHlwZTogVHJhZGluZ0FsZXJ0VHlwZSxcbiAgICBzZXZlcml0eTogVHJhZGluZ1NldmVyaXR5XG4gICk6IE1hcHBlZFRyYWRpbmdJbmNpZGVudCB7XG4gICAgY29uc3QgaW5jaWRlbnRJZCA9IGB0cmFkaW5nX2luY2lkZW50OmRlcGxveV8ke2RlcGxveW1lbnRJZH1gO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gaW5jaWRlbnRJZDtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gZXZlbnQuc291cmNlLmVudmlyb25tZW50O1xuICAgIGNvbnN0IGdpdGh1YkRlcGxveW1lbnRJZCA9IGV2ZW50Lm1ldGFkYXRhLmdpdGh1YkRlcGxveW1lbnRJZCBhcyBudW1iZXI7XG4gICAgY29uc3QgZmFpbHVyZVJlYXNvbiA9IGV2ZW50Lm1ldGFkYXRhLmZhaWx1cmVSZWFzb24gYXMgc3RyaW5nIHx8ICdVbmtub3duIGZhaWx1cmUnO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGluY2lkZW50SWQsXG4gICAgICB0eXBlOiBhbGVydFR5cGUsXG4gICAgICBzZXZlcml0eSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRGVwbG95bWVudCAke2RlcGxveW1lbnRJZH0gZmFpbGVkOiAke2ZhaWx1cmVSZWFzb259YCxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ3RyYWRpbmdfb3BzJyxcbiAgICAgICAgc291cmNlSWQsXG4gICAgICAgIGFsZXJ0SWQ6IGRlcGxveW1lbnRJZCxcbiAgICAgICAgYWxlcnRUeXBlLFxuICAgICAgICBzeXN0ZW06ICdkZXBsb3ltZW50JyxcbiAgICAgICAgY29tcG9uZW50OiAnZ2l0aHViX2FjdGlvbnMnLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgZ2l0aHViRGVwbG95bWVudElkLFxuICAgICAgICBmYWlsdXJlUmVhc29uLFxuICAgICAgICByZWxhdGVkUmVsZWFzZUlkOiBldmVudC5tZXRhZGF0YS5yZWxhdGVkUmVsZWFzZUlkIGFzIHN0cmluZyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmmKDlsIQgRXhlY3V0aW9uIEFub21hbHkg5YiwIEluY2lkZW50XG4gICAqL1xuICBwcml2YXRlIG1hcEV4ZWN1dGlvbkFub21hbHlUb0luY2lkZW50KFxuICAgIGV2ZW50OiBUcmFkaW5nRXZlbnQsXG4gICAgYW5vbWFseUlkOiBzdHJpbmcsXG4gICAgYWxlcnRUeXBlOiBUcmFkaW5nQWxlcnRUeXBlLFxuICAgIHNldmVyaXR5OiBUcmFkaW5nU2V2ZXJpdHlcbiAgKTogTWFwcGVkVHJhZGluZ0luY2lkZW50IHtcbiAgICBjb25zdCBpbmNpZGVudElkID0gYHRyYWRpbmdfaW5jaWRlbnQ6YW5vbWFseV8ke2Fub21hbHlJZH1gO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gaW5jaWRlbnRJZDtcblxuICAgIGNvbnN0IHN5c3RlbSA9IGV2ZW50LnNvdXJjZS5zeXN0ZW07XG4gICAgY29uc3QgY29tcG9uZW50ID0gZXZlbnQuc291cmNlLmNvbXBvbmVudDtcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IGV2ZW50LnNvdXJjZS5lbnZpcm9ubWVudDtcbiAgICBjb25zdCBvcmRlclR5cGUgPSBldmVudC5tZXRhZGF0YS5vcmRlclR5cGUgYXMgc3RyaW5nIHx8ICdVbmtub3duJztcbiAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBldmVudC5tZXRhZGF0YS5lcnJvck1lc3NhZ2UgYXMgc3RyaW5nIHx8ICdFeGVjdXRpb24gZmFpbGVkJztcblxuICAgIHJldHVybiB7XG4gICAgICBpbmNpZGVudElkLFxuICAgICAgdHlwZTogYWxlcnRUeXBlLFxuICAgICAgc2V2ZXJpdHksXG4gICAgICBkZXNjcmlwdGlvbjogYEV4ZWN1dGlvbiBhbm9tYWx5OiAke29yZGVyVHlwZX0gLSAke2Vycm9yTWVzc2FnZX1gLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAndHJhZGluZ19vcHMnLFxuICAgICAgICBzb3VyY2VJZCxcbiAgICAgICAgYWxlcnRJZDogYW5vbWFseUlkLFxuICAgICAgICBhbGVydFR5cGUsXG4gICAgICAgIHN5c3RlbSxcbiAgICAgICAgY29tcG9uZW50LFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgb3JkZXJUeXBlLFxuICAgICAgICBlcnJvck1lc3NhZ2UsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgLyoqXG4gICAqIOajgOafpeaYr+WQpui+vuWIsOS4pemHjee6p+WIq+mYiOWAvFxuICAgKi9cbiAgcHJpdmF0ZSBtZWV0c1NldmVyaXR5VGhyZXNob2xkKHNldmVyaXR5OiBUcmFkaW5nU2V2ZXJpdHkpOiBib29sZWFuIHtcbiAgICBjb25zdCBzZXZlcml0eU9yZGVyID0geyBsb3c6IDAsIG1lZGl1bTogMSwgaGlnaDogMiwgY3JpdGljYWw6IDMgfTtcbiAgICBjb25zdCB0aHJlc2hvbGQgPSB0aGlzLmNvbmZpZy5hbGVydFNldmVyaXR5VGhyZXNob2xkO1xuXG4gICAgcmV0dXJuIHNldmVyaXR5T3JkZXJbc2V2ZXJpdHldID49IHNldmVyaXR5T3JkZXJbdGhyZXNob2xkXTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRyYWRpbmdJbmNpZGVudE1hcHBlcihcbiAgY29uZmlnPzogVHJhZGluZ0luY2lkZW50TWFwcGVyQ29uZmlnXG4pOiBUcmFkaW5nSW5jaWRlbnRNYXBwZXIge1xuICByZXR1cm4gbmV3IFRyYWRpbmdJbmNpZGVudE1hcHBlcihjb25maWcpO1xufVxuIl19