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
