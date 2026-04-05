"use strict";
/**
 * Trading Approval Mapper
 * Phase 2C-1 - 交易域审批映射器
 *
 * 职责：
 * - Trading Release Request → Operator Approval
 * - Risk Parameter Change → Operator Approval
 * - Deployment Gate → Operator Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingApprovalMapper = void 0;
exports.createTradingApprovalMapper = createTradingApprovalMapper;
// ============================================================================
// Trading Approval Mapper
// ============================================================================
class TradingApprovalMapper {
    constructor(config = {}) {
        this.config = {
            autoCreateApproval: config.autoCreateApproval ?? true,
            requireApprovalForRiskLevel: config.requireApprovalForRiskLevel ?? 'medium',
            autoApproveTestnet: config.autoApproveTestnet ?? false,
        };
    }
    /**
     * 适配交易事件到 Approval
     */
    adaptEvent(event) {
        const result = {};
        if (!this.config.autoCreateApproval) {
            return result;
        }
        switch (event.type) {
            case 'release_requested':
                return this.adaptReleaseRequested(event);
            case 'risk_parameter_changed':
                return this.adaptRiskParameterChange(event);
            case 'deployment_pending':
                return this.adaptDeploymentPending(event);
            default:
                return result;
        }
    }
    /**
     * 适配 Release Request 事件
     */
    adaptReleaseRequested(event) {
        const result = {};
        const releaseId = event.metadata.releaseId || `release_${Date.now()}`;
        const riskLevel = event.metadata.riskLevel || 'medium';
        const environment = event.metadata.environment || 'mainnet';
        // 检查是否自动批准 Testnet
        if (this.config.autoApproveTestnet && environment === 'testnet') {
            result.autoApproved = true;
            return result;
        }
        // 检查风险级别是否需要审批
        if (!this.requiresApproval(riskLevel)) {
            result.autoApproved = true;
            return result;
        }
        result.approval = this.mapReleaseToApproval(event, releaseId, riskLevel, environment);
        return result;
    }
    /**
     * 适配 Risk Parameter Change 事件
     */
    adaptRiskParameterChange(event) {
        const result = {};
        const changeId = event.metadata.changeId || `risk_change_${Date.now()}`;
        const riskLevel = event.metadata.riskLevel || 'high';
        const environment = event.metadata.environment || 'mainnet';
        // 所有风险参数变更都需要审批
        result.approval = this.mapRiskChangeToApproval(event, changeId, riskLevel, environment);
        return result;
    }
    /**
     * 适配 Deployment Pending 事件
     */
    adaptDeploymentPending(event) {
        const result = {};
        const deploymentId = event.metadata.deploymentId || `deploy_${Date.now()}`;
        const riskLevel = event.metadata.riskLevel || 'medium';
        const environment = event.metadata.environment || 'mainnet';
        // 检查是否自动批准 Testnet
        if (this.config.autoApproveTestnet && environment === 'testnet') {
            result.autoApproved = true;
            return result;
        }
        // 生产环境部署需要审批
        if (environment === 'mainnet') {
            result.approval = this.mapDeploymentToApproval(event, deploymentId, riskLevel, environment);
        }
        return result;
    }
    // ============================================================================
    // 映射方法
    // ============================================================================
    /**
     * 映射 Release Request 到 Approval
     */
    mapReleaseToApproval(event, releaseId, riskLevel, environment) {
        const approvalId = `trading_release:${releaseId}`;
        const sourceId = approvalId;
        const strategyName = event.metadata.strategyName || 'Unknown Strategy';
        const version = event.metadata.version || 'Unknown';
        return {
            approvalId,
            scope: `Release ${strategyName} v${version} to ${environment}`,
            reason: `Strategy release requested by ${event.actor.username}: ${event.metadata.description || ''}`,
            requestingAgent: event.actor.username,
            metadata: {
                source: 'trading_ops',
                sourceType: 'release_approval',
                sourceId,
                releaseId,
                riskLevel,
                environment,
                strategyName,
                version,
            },
        };
    }
    /**
     * 映射 Risk Parameter Change 到 Approval
     */
    mapRiskChangeToApproval(event, changeId, riskLevel, environment) {
        const approvalId = `trading_risk_change:${changeId}`;
        const sourceId = approvalId;
        const parameter = event.metadata.parameter || 'Unknown Parameter';
        const oldValue = event.metadata.oldValue || 'Unknown';
        const newValue = event.metadata.newValue || 'Unknown';
        return {
            approvalId,
            scope: `Change Risk Parameter: ${parameter}`,
            reason: `Risk parameter change requested by ${event.actor.username}: ${parameter} from ${oldValue} to ${newValue}`,
            requestingAgent: event.actor.username,
            metadata: {
                source: 'trading_ops',
                sourceType: 'risk_change_approval',
                sourceId,
                releaseId: changeId,
                riskLevel,
                environment,
                parameter,
                oldValue,
                newValue,
            },
        };
    }
    /**
     * 映射 Deployment 到 Approval
     */
    mapDeploymentToApproval(event, deploymentId, riskLevel, environment) {
        const approvalId = `trading_deployment:${deploymentId}`;
        const sourceId = approvalId;
        const githubDeploymentId = event.metadata.githubDeploymentId;
        const environmentName = event.metadata.environmentName || environment;
        return {
            approvalId,
            scope: `Deploy to ${environmentName}`,
            reason: `Deployment requested by ${event.actor.username}`,
            requestingAgent: event.actor.username,
            metadata: {
                source: 'trading_ops',
                sourceType: 'deployment_gate',
                sourceId,
                deploymentId,
                githubDeploymentId,
                riskLevel,
                environment,
                environmentName,
            },
        };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 检查是否需要审批
     */
    requiresApproval(riskLevel) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        const requiredLevel = this.config.requireApprovalForRiskLevel;
        return severityOrder[riskLevel] >= severityOrder[requiredLevel];
    }
}
exports.TradingApprovalMapper = TradingApprovalMapper;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingApprovalMapper(config) {
    return new TradingApprovalMapper(config);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19hcHByb3ZhbF9tYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZG9tYWluL3RyYWRpbmcvdHJhZGluZ19hcHByb3ZhbF9tYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFtUUgsa0VBSUM7QUFwUEQsK0VBQStFO0FBQy9FLDBCQUEwQjtBQUMxQiwrRUFBK0U7QUFFL0UsTUFBYSxxQkFBcUI7SUFHaEMsWUFBWSxTQUFzQyxFQUFFO1FBQ2xELElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksSUFBSTtZQUNyRCwyQkFBMkIsRUFBRSxNQUFNLENBQUMsMkJBQTJCLElBQUksUUFBUTtZQUMzRSxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksS0FBSztTQUN2RCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLEtBQW1CO1FBSTVCLE1BQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQztRQUV2QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuQixLQUFLLG1CQUFtQjtnQkFDdEIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFM0MsS0FBSyx3QkFBd0I7Z0JBQzNCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTlDLEtBQUssb0JBQW9CO2dCQUN2QixPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU1QztnQkFDRSxPQUFPLE1BQU0sQ0FBQztRQUNsQixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0sscUJB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RUQsK0VBQStFO0lBQy9FLE9BQU87SUFDUCwrRUFBK0U7SUFFL0U7O09BRUc7SUFDSyxnQkFBZ0IsQ0FBQyxTQUEwQjtRQUNqRCxNQUFNLGFBQWEsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUNsRSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLDJCQUEyQixDQUFDO1FBRTlELE9BQU8sYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNsRSxDQUFDO0NBQ0Y7QUF0T0Qsc0RBc09DO0FBRUQsK0VBQStFO0FBQy9FLE9BQU87QUFDUCwrRUFBK0U7QUFFL0UsU0FBZ0IsMkJBQTJCLENBQ3pDLE1BQW9DO0lBRXBDLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUcmFkaW5nIEFwcHJvdmFsIE1hcHBlclxuICogUGhhc2UgMkMtMSAtIOS6pOaYk+Wfn+WuoeaJueaYoOWwhOWZqFxuICogXG4gKiDogYzotKPvvJpcbiAqIC0gVHJhZGluZyBSZWxlYXNlIFJlcXVlc3Qg4oaSIE9wZXJhdG9yIEFwcHJvdmFsXG4gKiAtIFJpc2sgUGFyYW1ldGVyIENoYW5nZSDihpIgT3BlcmF0b3IgQXBwcm92YWxcbiAqIC0gRGVwbG95bWVudCBHYXRlIOKGkiBPcGVyYXRvciBBcHByb3ZhbFxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgVHJhZGluZ0V2ZW50LFxuICBUcmFkaW5nUmVsZWFzZVJlcXVlc3QsXG4gIE1hcHBlZFRyYWRpbmdBcHByb3ZhbCxcbiAgVHJhZGluZ1NldmVyaXR5LFxufSBmcm9tICcuL3RyYWRpbmdfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFkaW5nQXBwcm92YWxNYXBwZXJDb25maWcge1xuICBhdXRvQ3JlYXRlQXBwcm92YWw/OiBib29sZWFuO1xuICByZXF1aXJlQXBwcm92YWxGb3JSaXNrTGV2ZWw/OiBUcmFkaW5nU2V2ZXJpdHk7XG4gIGF1dG9BcHByb3ZlVGVzdG5ldD86IGJvb2xlYW47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFRyYWRpbmcgQXBwcm92YWwgTWFwcGVyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBUcmFkaW5nQXBwcm92YWxNYXBwZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8VHJhZGluZ0FwcHJvdmFsTWFwcGVyQ29uZmlnPjtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFRyYWRpbmdBcHByb3ZhbE1hcHBlckNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IGNvbmZpZy5hdXRvQ3JlYXRlQXBwcm92YWwgPz8gdHJ1ZSxcbiAgICAgIHJlcXVpcmVBcHByb3ZhbEZvclJpc2tMZXZlbDogY29uZmlnLnJlcXVpcmVBcHByb3ZhbEZvclJpc2tMZXZlbCA/PyAnbWVkaXVtJyxcbiAgICAgIGF1dG9BcHByb3ZlVGVzdG5ldDogY29uZmlnLmF1dG9BcHByb3ZlVGVzdG5ldCA/PyBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAgumFjeS6pOaYk+S6i+S7tuWIsCBBcHByb3ZhbFxuICAgKi9cbiAgYWRhcHRFdmVudChldmVudDogVHJhZGluZ0V2ZW50KToge1xuICAgIGFwcHJvdmFsPzogTWFwcGVkVHJhZGluZ0FwcHJvdmFsO1xuICAgIGF1dG9BcHByb3ZlZD86IGJvb2xlYW47XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cbiAgICBpZiAoIXRoaXMuY29uZmlnLmF1dG9DcmVhdGVBcHByb3ZhbCkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICAgIGNhc2UgJ3JlbGVhc2VfcmVxdWVzdGVkJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRSZWxlYXNlUmVxdWVzdGVkKGV2ZW50KTtcblxuICAgICAgY2FzZSAncmlza19wYXJhbWV0ZXJfY2hhbmdlZCc6XG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0Umlza1BhcmFtZXRlckNoYW5nZShldmVudCk7XG5cbiAgICAgIGNhc2UgJ2RlcGxveW1lbnRfcGVuZGluZyc6XG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0RGVwbG95bWVudFBlbmRpbmcoZXZlbnQpO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDpgILphY0gUmVsZWFzZSBSZXF1ZXN0IOS6i+S7tlxuICAgKi9cbiAgcHJpdmF0ZSBhZGFwdFJlbGVhc2VSZXF1ZXN0ZWQoZXZlbnQ6IFRyYWRpbmdFdmVudCk6IHtcbiAgICBhcHByb3ZhbD86IE1hcHBlZFRyYWRpbmdBcHByb3ZhbDtcbiAgICBhdXRvQXBwcm92ZWQ/OiBib29sZWFuO1xuICB9IHtcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG4gICAgY29uc3QgcmVsZWFzZUlkID0gZXZlbnQubWV0YWRhdGEucmVsZWFzZUlkIGFzIHN0cmluZyB8fCBgcmVsZWFzZV8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCByaXNrTGV2ZWwgPSAoZXZlbnQubWV0YWRhdGEucmlza0xldmVsIGFzIFRyYWRpbmdTZXZlcml0eSkgfHwgJ21lZGl1bSc7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSAoZXZlbnQubWV0YWRhdGEuZW52aXJvbm1lbnQgYXMgc3RyaW5nKSB8fCAnbWFpbm5ldCc7XG5cbiAgICAvLyDmo4Dmn6XmmK/lkKboh6rliqjmibnlh4YgVGVzdG5ldFxuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvQXBwcm92ZVRlc3RuZXQgJiYgZW52aXJvbm1lbnQgPT09ICd0ZXN0bmV0Jykge1xuICAgICAgcmVzdWx0LmF1dG9BcHByb3ZlZCA9IHRydWU7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIOajgOafpemjjumZqee6p+WIq+aYr+WQpumcgOimgeWuoeaJuVxuICAgIGlmICghdGhpcy5yZXF1aXJlc0FwcHJvdmFsKHJpc2tMZXZlbCkpIHtcbiAgICAgIHJlc3VsdC5hdXRvQXBwcm92ZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXN1bHQuYXBwcm92YWwgPSB0aGlzLm1hcFJlbGVhc2VUb0FwcHJvdmFsKGV2ZW50LCByZWxlYXNlSWQsIHJpc2tMZXZlbCwgZW52aXJvbm1lbnQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWNIFJpc2sgUGFyYW1ldGVyIENoYW5nZSDkuovku7ZcbiAgICovXG4gIHByaXZhdGUgYWRhcHRSaXNrUGFyYW1ldGVyQ2hhbmdlKGV2ZW50OiBUcmFkaW5nRXZlbnQpOiB7XG4gICAgYXBwcm92YWw/OiBNYXBwZWRUcmFkaW5nQXBwcm92YWw7XG4gICAgYXV0b0FwcHJvdmVkPzogYm9vbGVhbjtcbiAgfSB7XG4gICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuICAgIGNvbnN0IGNoYW5nZUlkID0gZXZlbnQubWV0YWRhdGEuY2hhbmdlSWQgYXMgc3RyaW5nIHx8IGByaXNrX2NoYW5nZV8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCByaXNrTGV2ZWwgPSAoZXZlbnQubWV0YWRhdGEucmlza0xldmVsIGFzIFRyYWRpbmdTZXZlcml0eSkgfHwgJ2hpZ2gnO1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gKGV2ZW50Lm1ldGFkYXRhLmVudmlyb25tZW50IGFzIHN0cmluZykgfHwgJ21haW5uZXQnO1xuXG4gICAgLy8g5omA5pyJ6aOO6Zmp5Y+C5pWw5Y+Y5pu06YO96ZyA6KaB5a6h5om5XG4gICAgcmVzdWx0LmFwcHJvdmFsID0gdGhpcy5tYXBSaXNrQ2hhbmdlVG9BcHByb3ZhbChldmVudCwgY2hhbmdlSWQsIHJpc2tMZXZlbCwgZW52aXJvbm1lbnQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog6YCC6YWNIERlcGxveW1lbnQgUGVuZGluZyDkuovku7ZcbiAgICovXG4gIHByaXZhdGUgYWRhcHREZXBsb3ltZW50UGVuZGluZyhldmVudDogVHJhZGluZ0V2ZW50KToge1xuICAgIGFwcHJvdmFsPzogTWFwcGVkVHJhZGluZ0FwcHJvdmFsO1xuICAgIGF1dG9BcHByb3ZlZD86IGJvb2xlYW47XG4gIH0ge1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cbiAgICBjb25zdCBkZXBsb3ltZW50SWQgPSBldmVudC5tZXRhZGF0YS5kZXBsb3ltZW50SWQgYXMgc3RyaW5nIHx8IGBkZXBsb3lfJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3Qgcmlza0xldmVsID0gKGV2ZW50Lm1ldGFkYXRhLnJpc2tMZXZlbCBhcyBUcmFkaW5nU2V2ZXJpdHkpIHx8ICdtZWRpdW0nO1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gKGV2ZW50Lm1ldGFkYXRhLmVudmlyb25tZW50IGFzIHN0cmluZykgfHwgJ21haW5uZXQnO1xuXG4gICAgLy8g5qOA5p+l5piv5ZCm6Ieq5Yqo5om55YeGIFRlc3RuZXRcbiAgICBpZiAodGhpcy5jb25maWcuYXV0b0FwcHJvdmVUZXN0bmV0ICYmIGVudmlyb25tZW50ID09PSAndGVzdG5ldCcpIHtcbiAgICAgIHJlc3VsdC5hdXRvQXBwcm92ZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyDnlJ/kuqfnjq/looPpg6jnvbLpnIDopoHlrqHmiblcbiAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdtYWlubmV0Jykge1xuICAgICAgcmVzdWx0LmFwcHJvdmFsID0gdGhpcy5tYXBEZXBsb3ltZW50VG9BcHByb3ZhbChldmVudCwgZGVwbG95bWVudElkLCByaXNrTGV2ZWwsIGVudmlyb25tZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5pig5bCE5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAvKipcbiAgICog5pig5bCEIFJlbGVhc2UgUmVxdWVzdCDliLAgQXBwcm92YWxcbiAgICovXG4gIHByaXZhdGUgbWFwUmVsZWFzZVRvQXBwcm92YWwoXG4gICAgZXZlbnQ6IFRyYWRpbmdFdmVudCxcbiAgICByZWxlYXNlSWQ6IHN0cmluZyxcbiAgICByaXNrTGV2ZWw6IFRyYWRpbmdTZXZlcml0eSxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IE1hcHBlZFRyYWRpbmdBcHByb3ZhbCB7XG4gICAgY29uc3QgYXBwcm92YWxJZCA9IGB0cmFkaW5nX3JlbGVhc2U6JHtyZWxlYXNlSWR9YDtcbiAgICBjb25zdCBzb3VyY2VJZCA9IGFwcHJvdmFsSWQ7XG5cbiAgICBjb25zdCBzdHJhdGVneU5hbWUgPSBldmVudC5tZXRhZGF0YS5zdHJhdGVneU5hbWUgYXMgc3RyaW5nIHx8ICdVbmtub3duIFN0cmF0ZWd5JztcbiAgICBjb25zdCB2ZXJzaW9uID0gZXZlbnQubWV0YWRhdGEudmVyc2lvbiBhcyBzdHJpbmcgfHwgJ1Vua25vd24nO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFwcHJvdmFsSWQsXG4gICAgICBzY29wZTogYFJlbGVhc2UgJHtzdHJhdGVneU5hbWV9IHYke3ZlcnNpb259IHRvICR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHJlYXNvbjogYFN0cmF0ZWd5IHJlbGVhc2UgcmVxdWVzdGVkIGJ5ICR7ZXZlbnQuYWN0b3IudXNlcm5hbWV9OiAke2V2ZW50Lm1ldGFkYXRhLmRlc2NyaXB0aW9uIHx8ICcnfWAsXG4gICAgICByZXF1ZXN0aW5nQWdlbnQ6IGV2ZW50LmFjdG9yLnVzZXJuYW1lLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgc291cmNlOiAndHJhZGluZ19vcHMnLFxuICAgICAgICBzb3VyY2VUeXBlOiAncmVsZWFzZV9hcHByb3ZhbCcsXG4gICAgICAgIHNvdXJjZUlkLFxuICAgICAgICByZWxlYXNlSWQsXG4gICAgICAgIHJpc2tMZXZlbCxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHN0cmF0ZWd5TmFtZSxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmmKDlsIQgUmlzayBQYXJhbWV0ZXIgQ2hhbmdlIOWIsCBBcHByb3ZhbFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBSaXNrQ2hhbmdlVG9BcHByb3ZhbChcbiAgICBldmVudDogVHJhZGluZ0V2ZW50LFxuICAgIGNoYW5nZUlkOiBzdHJpbmcsXG4gICAgcmlza0xldmVsOiBUcmFkaW5nU2V2ZXJpdHksXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZ1xuICApOiBNYXBwZWRUcmFkaW5nQXBwcm92YWwge1xuICAgIGNvbnN0IGFwcHJvdmFsSWQgPSBgdHJhZGluZ19yaXNrX2NoYW5nZToke2NoYW5nZUlkfWA7XG4gICAgY29uc3Qgc291cmNlSWQgPSBhcHByb3ZhbElkO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyID0gZXZlbnQubWV0YWRhdGEucGFyYW1ldGVyIGFzIHN0cmluZyB8fCAnVW5rbm93biBQYXJhbWV0ZXInO1xuICAgIGNvbnN0IG9sZFZhbHVlID0gZXZlbnQubWV0YWRhdGEub2xkVmFsdWUgYXMgc3RyaW5nIHx8ICdVbmtub3duJztcbiAgICBjb25zdCBuZXdWYWx1ZSA9IGV2ZW50Lm1ldGFkYXRhLm5ld1ZhbHVlIGFzIHN0cmluZyB8fCAnVW5rbm93bic7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYXBwcm92YWxJZCxcbiAgICAgIHNjb3BlOiBgQ2hhbmdlIFJpc2sgUGFyYW1ldGVyOiAke3BhcmFtZXRlcn1gLFxuICAgICAgcmVhc29uOiBgUmlzayBwYXJhbWV0ZXIgY2hhbmdlIHJlcXVlc3RlZCBieSAke2V2ZW50LmFjdG9yLnVzZXJuYW1lfTogJHtwYXJhbWV0ZXJ9IGZyb20gJHtvbGRWYWx1ZX0gdG8gJHtuZXdWYWx1ZX1gLFxuICAgICAgcmVxdWVzdGluZ0FnZW50OiBldmVudC5hY3Rvci51c2VybmFtZSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZTogJ3RyYWRpbmdfb3BzJyxcbiAgICAgICAgc291cmNlVHlwZTogJ3Jpc2tfY2hhbmdlX2FwcHJvdmFsJyxcbiAgICAgICAgc291cmNlSWQsXG4gICAgICAgIHJlbGVhc2VJZDogY2hhbmdlSWQsXG4gICAgICAgIHJpc2tMZXZlbCxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHBhcmFtZXRlcixcbiAgICAgICAgb2xkVmFsdWUsXG4gICAgICAgIG5ld1ZhbHVlLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaYoOWwhCBEZXBsb3ltZW50IOWIsCBBcHByb3ZhbFxuICAgKi9cbiAgcHJpdmF0ZSBtYXBEZXBsb3ltZW50VG9BcHByb3ZhbChcbiAgICBldmVudDogVHJhZGluZ0V2ZW50LFxuICAgIGRlcGxveW1lbnRJZDogc3RyaW5nLFxuICAgIHJpc2tMZXZlbDogVHJhZGluZ1NldmVyaXR5LFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogTWFwcGVkVHJhZGluZ0FwcHJvdmFsIHtcbiAgICBjb25zdCBhcHByb3ZhbElkID0gYHRyYWRpbmdfZGVwbG95bWVudDoke2RlcGxveW1lbnRJZH1gO1xuICAgIGNvbnN0IHNvdXJjZUlkID0gYXBwcm92YWxJZDtcblxuICAgIGNvbnN0IGdpdGh1YkRlcGxveW1lbnRJZCA9IGV2ZW50Lm1ldGFkYXRhLmdpdGh1YkRlcGxveW1lbnRJZCBhcyBudW1iZXI7XG4gICAgY29uc3QgZW52aXJvbm1lbnROYW1lID0gZXZlbnQubWV0YWRhdGEuZW52aXJvbm1lbnROYW1lIGFzIHN0cmluZyB8fCBlbnZpcm9ubWVudDtcblxuICAgIHJldHVybiB7XG4gICAgICBhcHByb3ZhbElkLFxuICAgICAgc2NvcGU6IGBEZXBsb3kgdG8gJHtlbnZpcm9ubWVudE5hbWV9YCxcbiAgICAgIHJlYXNvbjogYERlcGxveW1lbnQgcmVxdWVzdGVkIGJ5ICR7ZXZlbnQuYWN0b3IudXNlcm5hbWV9YCxcbiAgICAgIHJlcXVlc3RpbmdBZ2VudDogZXZlbnQuYWN0b3IudXNlcm5hbWUsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBzb3VyY2U6ICd0cmFkaW5nX29wcycsXG4gICAgICAgIHNvdXJjZVR5cGU6ICdkZXBsb3ltZW50X2dhdGUnLFxuICAgICAgICBzb3VyY2VJZCxcbiAgICAgICAgZGVwbG95bWVudElkLFxuICAgICAgICBnaXRodWJEZXBsb3ltZW50SWQsXG4gICAgICAgIHJpc2tMZXZlbCxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIGVudmlyb25tZW50TmFtZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm6ZyA6KaB5a6h5om5XG4gICAqL1xuICBwcml2YXRlIHJlcXVpcmVzQXBwcm92YWwocmlza0xldmVsOiBUcmFkaW5nU2V2ZXJpdHkpOiBib29sZWFuIHtcbiAgICBjb25zdCBzZXZlcml0eU9yZGVyID0geyBsb3c6IDAsIG1lZGl1bTogMSwgaGlnaDogMiwgY3JpdGljYWw6IDMgfTtcbiAgICBjb25zdCByZXF1aXJlZExldmVsID0gdGhpcy5jb25maWcucmVxdWlyZUFwcHJvdmFsRm9yUmlza0xldmVsO1xuXG4gICAgcmV0dXJuIHNldmVyaXR5T3JkZXJbcmlza0xldmVsXSA+PSBzZXZlcml0eU9yZGVyW3JlcXVpcmVkTGV2ZWxdO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVHJhZGluZ0FwcHJvdmFsTWFwcGVyKFxuICBjb25maWc/OiBUcmFkaW5nQXBwcm92YWxNYXBwZXJDb25maWdcbik6IFRyYWRpbmdBcHByb3ZhbE1hcHBlciB7XG4gIHJldHVybiBuZXcgVHJhZGluZ0FwcHJvdmFsTWFwcGVyKGNvbmZpZyk7XG59XG4iXX0=