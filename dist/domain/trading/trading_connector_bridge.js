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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19jb25uZWN0b3JfYnJpZGdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RvbWFpbi90cmFkaW5nL3RyYWRpbmdfY29ubmVjdG9yX2JyaWRnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQXNRSCxvRUFJQztBQTFQRCwrRUFBK0U7QUFDL0UsMkJBQTJCO0FBQzNCLCtFQUErRTtBQUUvRSxNQUFhLHNCQUFzQjtJQUdqQyxZQUFZLFNBQXVDLEVBQUU7UUFDbkQsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLHdCQUF3QixFQUFFLE1BQU0sQ0FBQyx3QkFBd0IsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7WUFDL0Usa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixJQUFJLFNBQVM7U0FDM0QsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILDhCQUE4QixDQUM1QixXQUFnQjtRQUVoQixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBQ25DLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxVQUFVLENBQUM7UUFDMUMsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUV0QyxrREFBa0Q7UUFDbEQsSUFBSSxTQUFTLEtBQUssWUFBWSxJQUFJLFVBQVUsRUFBRSxXQUFXLEtBQUssWUFBWSxFQUFFLENBQUM7WUFDM0UsT0FBTztnQkFDTCxJQUFJLEVBQUUsb0JBQW9CO2dCQUMxQixTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDckIsUUFBUSxFQUFFLE1BQU07Z0JBQ2hCLE1BQU0sRUFBRTtvQkFDTixNQUFNLEVBQUUsZ0JBQWdCO29CQUN4QixTQUFT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QUFRO2dCQUNSLFFBQVE7Z0JBQ1IsU0FBUyxFQUFFLFFBQVE7Z0JBQ25CLFdBQVc7Z0JBQ1gsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNLElBQUksRUFBRTthQUNoQztTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUE1T0Qsd0RBNE9DO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0UsU0FBZ0IsNEJBQTRCLENBQzFDLE1BQXFDO0lBRXJDLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUcmFkaW5nIENvbm5lY3RvciBCcmlkZ2VcbiAqIFBoYXNlIDJDLTEgLSDkuqTmmJPln58gQ29ubmVjdG9yIOahpeaOpVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5aSN55So546w5pyJIEdpdEh1YiAvIEdpdEh1YiBBY3Rpb25zIENvbm5lY3RvcnNcbiAqIC0g6L2s5o2i5Li65Lqk5piT5Z+f6K+t5LmJXG4gKiAtIOaPkOS+m+e7n+S4gOeahOS6pOaYk+Wfn+S6i+S7tuaOpeWPo1xuICovXG5cbmltcG9ydCB0eXBlIHsgVHJhZGluZ0V2ZW50LCBUcmFkaW5nU2V2ZXJpdHkgfSBmcm9tICcuL3RyYWRpbmdfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFkaW5nQ29ubmVjdG9yQnJpZGdlQ29uZmlnIHtcbiAgZ2l0aHViQWN0aW9uc0ludGVncmF0aW9uPzoge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgZGVwbG95bWVudFdlYmhvb2tQYXRoPzogc3RyaW5nO1xuICB9O1xuICBkZWZhdWx0RW52aXJvbm1lbnQ/OiAndGVzdG5ldCcgfCAnbWFpbm5ldCc7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFRyYWRpbmcgQ29ubmVjdG9yIEJyaWRnZVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgVHJhZGluZ0Nvbm5lY3RvckJyaWRnZSB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxUcmFkaW5nQ29ubmVjdG9yQnJpZGdlQ29uZmlnPjtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFRyYWRpbmdDb25uZWN0b3JCcmlkZ2VDb25maWcgPSB7fSkge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgZ2l0aHViQWN0aW9uc0ludGVncmF0aW9uOiBjb25maWcuZ2l0aHViQWN0aW9uc0ludGVncmF0aW9uIHx8IHsgZW5hYmxlZDogZmFsc2UgfSxcbiAgICAgIGRlZmF1bHRFbnZpcm9ubWVudDogY29uZmlnLmRlZmF1bHRFbnZpcm9ubWVudCB8fCAnbWFpbm5ldCcsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDovazmjaIgR2l0SHViIEFjdGlvbnMgRGVwbG95bWVudCDkuovku7bliLAgVHJhZGluZyBFdmVudFxuICAgKi9cbiAgY29udmVydEdpdEh1YkFjdGlvbnNEZXBsb3ltZW50KFxuICAgIGdpdGh1YkV2ZW50OiBhbnlcbiAgKTogVHJhZGluZ0V2ZW50IHwgbnVsbCB7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5naXRodWJBY3Rpb25zSW50ZWdyYXRpb24uZW5hYmxlZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZXZlbnRUeXBlID0gZ2l0aHViRXZlbnQudHlwZTtcbiAgICBjb25zdCBkZXBsb3ltZW50ID0gZ2l0aHViRXZlbnQuZGVwbG95bWVudDtcbiAgICBjb25zdCB3b3JrZmxvdyA9IGdpdGh1YkV2ZW50LndvcmtmbG93O1xuXG4gICAgLy8gRGVwbG95bWVudCBQZW5kaW5nIOKGkiBUcmFkaW5nIERlcGxveW1lbnQgUGVuZGluZ1xuICAgIGlmIChldmVudFR5cGUgPT09ICdkZXBsb3ltZW50JyAmJiBkZXBsb3ltZW50Py5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnZGVwbG95bWVudF9wZW5kaW5nJyxcbiAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICBzZXZlcml0eTogJ2hpZ2gnLFxuICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICBzeXN0ZW06ICdnaXRodWJfYWN0aW9ucycsXG4gICAgICAgICAgY29tcG9uZW50OiAnZGVwbG95bWVudCcsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdtYWlubmV0JyxcbiAgICAgICAgfSxcbiAgICAgICAgYWN0b3I6IHtcbiAgICAgICAgICB1c2VySWQ6IGRlcGxveW1lbnQuY3JlYXRvcj8ubG9naW4gfHwgJ3Vua25vd24nLFxuICAgICAgICAgIHVzZXJuYW1lOiBkZXBsb3ltZW50LmNyZWF0b3I/LmxvZ2luIHx8ICd1bmtub3duJyxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICBkZXBsb3ltZW50SWQ6IGRlcGxveW1lbnQuaWQsXG4gICAgICAgICAgZ2l0aHViRGVwbG95bWVudElkOiBkZXBsb3ltZW50LmlkLFxuICAgICAgICAgIGVudmlyb25tZW50OiAnbWFpbm5ldCcsXG4gICAgICAgICAgZW52aXJvbm1lbnROYW1lOiBkZXBsb3ltZW50LmVudmlyb25tZW50LFxuICAgICAgICAgIHJlZjogZGVwbG95bWVudC5yZWYsXG4gICAgICAgICAgcmlza0xldmVsOiAnaGlnaCcgYXMgVHJhZGluZ1NldmVyaXR5LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBXb3JrZmxvdyBGYWlsZWQg4oaSIFRyYWRpbmcgRGVwbG95bWVudCBGYWlsZWRcbiAgICBpZiAoZXZlbnRUeXBlID09PSAnd29ya2Zsb3dfcnVuJyAmJiB3b3JrZmxvdz8uY29uY2x1c2lvbiA9PT0gJ2ZhaWx1cmUnKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnZGVwbG95bWVudF9mYWlsZWQnLFxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAgIHN5c3RlbTogJ2dpdGh1Yl9hY3Rpb25zJyxcbiAgICAgICAgICBjb21wb25lbnQ6ICd3b3JrZmxvdycsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdtYWlubmV0JyxcbiAgICAgICAgfSxcbiAgICAgICAgYWN0b3I6IHtcbiAgICAgICAgICB1c2VySWQ6IHdvcmtmbG93LnNlbmRlcj8ubG9naW4gfHwgJ3Vua25vd24nLFxuICAgICAgICAgIHVzZXJuYW1lOiB3b3JrZmxvdy5zZW5kZXI/LmxvZ2luIHx8ICd1bmtub3duJyxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICBkZXBsb3ltZW50SWQ6IGB3b3JrZmxvd18ke3dvcmtmbG93LnJ1bklkfWAsXG4gICAgICAgICAgd29ya2Zsb3dOYW1lOiB3b3JrZmxvdy5uYW1lLFxuICAgICAgICAgIHJ1bklkOiB3b3JrZmxvdy5ydW5JZCxcbiAgICAgICAgICBmYWlsdXJlUmVhc29uOiB3b3JrZmxvdy5jb25jbHVzaW9uLFxuICAgICAgICAgIHJlbGF0ZWRSZWxlYXNlSWQ6IHdvcmtmbG93Lm1ldGFkYXRhPy5yZWxlYXNlSWQsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIOi9rOaNoiBHaXRIdWIgUFIgUmV2aWV3IOS6i+S7tuWIsCBUcmFkaW5nIEV2ZW50XG4gICAqL1xuICBjb252ZXJ0R2l0SHViUmV2aWV3KFxuICAgIGdpdGh1YkV2ZW50OiBhbnlcbiAgKTogVHJhZGluZ0V2ZW50IHwgbnVsbCB7XG4gICAgY29uc3QgZXZlbnRUeXBlID0gZ2l0aHViRXZlbnQudHlwZTtcbiAgICBjb25zdCBwciA9IGdpdGh1YkV2ZW50LnB1bGxfcmVxdWVzdDtcbiAgICBjb25zdCByZXZpZXcgPSBnaXRodWJFdmVudC5yZXZpZXc7XG5cbiAgICAvLyBSZXZpZXcgUmVxdWVzdGVkIOKGkiBUcmFkaW5nIFJlbGVhc2UgQXBwcm92YWwgTmVlZGVkXG4gICAgaWYgKGV2ZW50VHlwZSA9PT0gJ3B1bGxfcmVxdWVzdF9yZXZpZXcnICYmIHJldmlldz8uc3RhdGUgPT09ICdwZW5kaW5nJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ3JlbGVhc2VfcmVxdWVzdGVkJyxcbiAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICBzZXZlcml0eTogJ21lZGl1bScsXG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAgIHN5c3RlbTogJ2dpdGh1YicsXG4gICAgICAgICAgY29tcG9uZW50OiAncHVsbF9yZXF1ZXN0JyxcbiAgICAgICAgICBlbnZpcm9ubWVudDogJ3Rlc3RuZXQnLFxuICAgICAgICB9LFxuICAgICAgICBhY3Rvcjoge1xuICAgICAgICAgIHVzZXJJZDogcHIudXNlcj8ubG9naW4gfHwgJ3Vua25vd24nLFxuICAgICAgICAgIHVzZXJuYW1lOiBwci51c2VyPy5sb2dpbiB8fCAndW5rbm93bicsXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgcmVsZWFzZUlkOiBgcHJfJHtwci5udW1iZXJ9YCxcbiAgICAgICAgICBzdHJhdGVneU5hbWU6IHByLnRpdGxlLFxuICAgICAgICAgIHZlcnNpb246IGBQUiAjJHtwci5udW1iZXJ9YCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogcHIuYm9keSB8fCAnJyxcbiAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nIGFzIFRyYWRpbmdTZXZlcml0eSxcbiAgICAgICAgICBlbnZpcm9ubWVudDogJ3Rlc3RuZXQnLFxuICAgICAgICAgIHByTnVtYmVyOiBwci5udW1iZXIsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIOi9rOaNoiBTeXN0ZW0gQWxlcnQg5YiwIFRyYWRpbmcgRXZlbnRcbiAgICovXG4gIGNvbnZlcnRTeXN0ZW1BbGVydChcbiAgICBhbGVydERhdGE6IGFueVxuICApOiBUcmFkaW5nRXZlbnQge1xuICAgIGNvbnN0IGFsZXJ0VHlwZSA9IGFsZXJ0RGF0YS50eXBlIHx8ICdzeXN0ZW1faGVhbHRoJztcbiAgICBjb25zdCBzZXZlcml0eSA9IGFsZXJ0RGF0YS5zZXZlcml0eSB8fCAnbWVkaXVtJztcbiAgICBjb25zdCBzeXN0ZW0gPSBhbGVydERhdGEuc3lzdGVtIHx8ICd1bmtub3duJztcbiAgICBjb25zdCBjb21wb25lbnQgPSBhbGVydERhdGEuY29tcG9uZW50IHx8ICd1bmtub3duJztcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IGFsZXJ0RGF0YS5lbnZpcm9ubWVudCB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0RW52aXJvbm1lbnQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3N5c3RlbV9hbGVydCcsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBzZXZlcml0eTogc2V2ZXJpdHkgYXMgVHJhZGluZ1NldmVyaXR5LFxuICAgICAgc291cmNlOiB7XG4gICAgICAgIHN5c3RlbSxcbiAgICAgICAgY29tcG9uZW50LFxuICAgICAgICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQgYXMgJ3Rlc3RuZXQnIHwgJ21haW5uZXQnLFxuICAgICAgfSxcbiAgICAgIGFjdG9yOiB7XG4gICAgICAgIHVzZXJJZDogJ3N5c3RlbScsXG4gICAgICAgIHVzZXJuYW1lOiAnc3lzdGVtJyxcbiAgICAgIH0sXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBhbGVydElkOiBhbGVydERhdGEuaWQgfHwgYGFsZXJ0XyR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBhbGVydFR5cGUsXG4gICAgICAgIHRpdGxlOiBhbGVydERhdGEudGl0bGUgfHwgYCR7YWxlcnRUeXBlfSBpbiAke3N5c3RlbX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogYWxlcnREYXRhLmRlc2NyaXB0aW9uIHx8IGFsZXJ0RGF0YS5tZXNzYWdlIHx8ICcnLFxuICAgICAgICBtZXRyaWM6IGFsZXJ0RGF0YS5tZXRyaWMsXG4gICAgICAgIHRocmVzaG9sZDogYWxlcnREYXRhLnRocmVzaG9sZCxcbiAgICAgICAgY3VycmVudFZhbHVlOiBhbGVydERhdGEuY3VycmVudFZhbHVlLFxuICAgICAgICByZWxhdGVkUmVsZWFzZUlkOiBhbGVydERhdGEucmVsYXRlZFJlbGVhc2VJZCxcbiAgICAgICAgcmVsYXRlZERlcGxveW1lbnRJZDogYWxlcnREYXRhLnJlbGF0ZWREZXBsb3ltZW50SWQsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog6L2s5o2iIEV4ZWN1dGlvbiBBbm9tYWx5IOWIsCBUcmFkaW5nIEV2ZW50XG4gICAqL1xuICBjb252ZXJ0RXhlY3V0aW9uQW5vbWFseShcbiAgICBhbm9tYWx5RGF0YTogYW55XG4gICk6IFRyYWRpbmdFdmVudCB7XG4gICAgY29uc3Qgc3lzdGVtID0gYW5vbWFseURhdGEuc3lzdGVtIHx8ICdleGVjdXRpb24nO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGFub21hbHlEYXRhLmNvbXBvbmVudCB8fCAnb3JkZXJfbWFuYWdlcic7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBhbm9tYWx5RGF0YS5lbnZpcm9ubWVudCB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0RW52aXJvbm1lbnQ7XG4gICAgY29uc3Qgc2V2ZXJpdHkgPSBhbm9tYWx5RGF0YS5zZXZlcml0eSB8fCAnaGlnaCc7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2V4ZWN1dGlvbl9hbm9tYWx5JyxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIHNldmVyaXR5OiBzZXZlcml0eSBhcyBUcmFkaW5nU2V2ZXJpdHksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgc3lzdGVtLFxuICAgICAgICBjb21wb25lbnQsXG4gICAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCBhcyAndGVzdG5ldCcgfCAnbWFpbm5ldCcsXG4gICAgICB9LFxuICAgICAgYWN0b3I6IHtcbiAgICAgICAgdXNlcklkOiAnc3lzdGVtJyxcbiAgICAgICAgdXNlcm5hbWU6ICdzeXN0ZW0nLFxuICAgICAgfSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGFub21hbHlJZDogYW5vbWFseURhdGEuaWQgfHwgYGFub21hbHlfJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIG9yZGVyVHlwZTogYW5vbWFseURhdGEub3JkZXJUeXBlIHx8ICd1bmtub3duJyxcbiAgICAgICAgZXJyb3JNZXNzYWdlOiBhbm9tYWx5RGF0YS5lcnJvck1lc3NhZ2UgfHwgJ0V4ZWN1dGlvbiBmYWlsZWQnLFxuICAgICAgICBvcmRlcklkOiBhbm9tYWx5RGF0YS5vcmRlcklkLFxuICAgICAgICBzeW1ib2w6IGFub21hbHlEYXRhLnN5bWJvbCxcbiAgICAgICAgc2lkZTogYW5vbWFseURhdGEuc2lkZSxcbiAgICAgICAgcXVhbnRpdHk6IGFub21hbHlEYXRhLnF1YW50aXR5LFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOi9rOaNoiBSaXNrIFBhcmFtZXRlciBDaGFuZ2Ug5YiwIFRyYWRpbmcgRXZlbnRcbiAgICovXG4gIGNvbnZlcnRSaXNrUGFyYW1ldGVyQ2hhbmdlKFxuICAgIGNoYW5nZURhdGE6IGFueVxuICApOiBUcmFkaW5nRXZlbnQge1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gY2hhbmdlRGF0YS5lbnZpcm9ubWVudCB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0RW52aXJvbm1lbnQ7XG4gICAgY29uc3QgcGFyYW1ldGVyID0gY2hhbmdlRGF0YS5wYXJhbWV0ZXIgfHwgJ3Vua25vd24nO1xuICAgIGNvbnN0IG9sZFZhbHVlID0gY2hhbmdlRGF0YS5vbGRWYWx1ZSB8fCAndW5rbm93bic7XG4gICAgY29uc3QgbmV3VmFsdWUgPSBjaGFuZ2VEYXRhLm5ld1ZhbHVlIHx8ICd1bmtub3duJztcblxuICAgIC8vIOagueaNruWPmOWMluW5heW6puWIpOaWremjjumZqee6p+WIq1xuICAgIGxldCBzZXZlcml0eTogVHJhZGluZ1NldmVyaXR5ID0gJ21lZGl1bSc7XG4gICAgaWYgKGNoYW5nZURhdGEucmlza0xldmVsKSB7XG4gICAgICBzZXZlcml0eSA9IGNoYW5nZURhdGEucmlza0xldmVsIGFzIFRyYWRpbmdTZXZlcml0eTtcbiAgICB9IGVsc2UgaWYgKHBhcmFtZXRlci5pbmNsdWRlcygnbGV2ZXJhZ2UnKSB8fCBwYXJhbWV0ZXIuaW5jbHVkZXMoJ21heF9wb3NpdGlvbicpKSB7XG4gICAgICBzZXZlcml0eSA9ICdoaWdoJztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3Jpc2tfcGFyYW1ldGVyX2NoYW5nZWQnLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgc2V2ZXJpdHksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgc3lzdGVtOiAncmlza19tYW5hZ2VyJyxcbiAgICAgICAgY29tcG9uZW50OiAncGFyYW1ldGVyX3N0b3JlJyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50IGFzICd0ZXN0bmV0JyB8ICdtYWlubmV0JyxcbiAgICAgIH0sXG4gICAgICBhY3Rvcjoge1xuICAgICAgICB1c2VySWQ6IGNoYW5nZURhdGEudXNlcklkIHx8ICd1bmtub3duJyxcbiAgICAgICAgdXNlcm5hbWU6IGNoYW5nZURhdGEudXNlcm5hbWUgfHwgJ3Vua25vd24nLFxuICAgICAgfSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGNoYW5nZUlkOiBjaGFuZ2VEYXRhLmlkIHx8IGByaXNrX2NoYW5nZV8ke0RhdGUubm93KCl9YCxcbiAgICAgICAgcGFyYW1ldGVyLFxuICAgICAgICBvbGRWYWx1ZSxcbiAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgIHJpc2tMZXZlbDogc2V2ZXJpdHksXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICByZWFzb246IGNoYW5nZURhdGEucmVhc29uIHx8ICcnLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVHJhZGluZ0Nvbm5lY3RvckJyaWRnZShcbiAgY29uZmlnPzogVHJhZGluZ0Nvbm5lY3RvckJyaWRnZUNvbmZpZ1xuKTogVHJhZGluZ0Nvbm5lY3RvckJyaWRnZSB7XG4gIHJldHVybiBuZXcgVHJhZGluZ0Nvbm5lY3RvckJyaWRnZShjb25maWcpO1xufVxuIl19