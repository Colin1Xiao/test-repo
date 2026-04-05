/**
 * Trading Approval Mapper
 * Phase 2C-1 - 交易域审批映射器
 * 
 * 职责：
 * - Trading Release Request → Operator Approval
 * - Risk Parameter Change → Operator Approval
 * - Deployment Gate → Operator Approval
 */

import type {
  TradingEvent,
  TradingReleaseRequest,
  MappedTradingApproval,
  TradingSeverity,
} from './trading_types';

// ============================================================================
// 配置
// ============================================================================

export interface TradingApprovalMapperConfig {
  autoCreateApproval?: boolean;
  requireApprovalForRiskLevel?: TradingSeverity;
  autoApproveTestnet?: boolean;
}

// ============================================================================
// Trading Approval Mapper
// ============================================================================

export class TradingApprovalMapper {
  private config: Required<TradingApprovalMapperConfig>;

  constructor(config: TradingApprovalMapperConfig = {}) {
    this.config = {
      autoCreateApproval: config.autoCreateApproval ?? true,
      requireApprovalForRiskLevel: config.requireApprovalForRiskLevel ?? 'medium',
      autoApproveTestnet: config.autoApproveTestnet ?? false,
    };
  }

  /**
   * 适配交易事件到 Approval
   */
  adaptEvent(event: TradingEvent): {
    approval?: MappedTradingApproval;
    autoApproved?: boolean;
  } {
    const result: any = {};

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
  private adaptReleaseRequested(event: TradingEvent): {
    approval?: MappedTradingApproval;
    autoApproved?: boolean;
  } {
    const result: any = {};

    const releaseId = event.metadata.releaseId as string || `release_${Date.now()}`;
    const riskLevel = (event.metadata.riskLevel as TradingSeverity) || 'medium';
    const environment = (event.metadata.environment as string) || 'mainnet';

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
  private adaptRiskParameterChange(event: TradingEvent): {
    approval?: MappedTradingApproval;
    autoApproved?: boolean;
  } {
    const result: any = {};

    const changeId = event.metadata.changeId as string || `risk_change_${Date.now()}`;
    const riskLevel = (event.metadata.riskLevel as TradingSeverity) || 'high';
    const environment = (event.metadata.environment as string) || 'mainnet';

    // 所有风险参数变更都需要审批
    result.approval = this.mapRiskChangeToApproval(event, changeId, riskLevel, environment);
    return result;
  }

  /**
   * 适配 Deployment Pending 事件
   */
  private adaptDeploymentPending(event: TradingEvent): {
    approval?: MappedTradingApproval;
    autoApproved?: boolean;
  } {
    const result: any = {};

    const deploymentId = event.metadata.deploymentId as string || `deploy_${Date.now()}`;
    const riskLevel = (event.metadata.riskLevel as TradingSeverity) || 'medium';
    const environment = (event.metadata.environment as string) || 'mainnet';

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
  private mapReleaseToApproval(
    event: TradingEvent,
    releaseId: string,
    riskLevel: TradingSeverity,
    environment: string
  ): MappedTradingApproval {
    const approvalId = `trading_release:${releaseId}`;
    const sourceId = approvalId;

    const strategyName = event.metadata.strategyName as string || 'Unknown Strategy';
    const version = event.metadata.version as string || 'Unknown';

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
  private mapRiskChangeToApproval(
    event: TradingEvent,
    changeId: string,
    riskLevel: TradingSeverity,
    environment: string
  ): MappedTradingApproval {
    const approvalId = `trading_risk_change:${changeId}`;
    const sourceId = approvalId;

    const parameter = event.metadata.parameter as string || 'Unknown Parameter';
    const oldValue = event.metadata.oldValue as string || 'Unknown';
    const newValue = event.metadata.newValue as string || 'Unknown';

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
  private mapDeploymentToApproval(
    event: TradingEvent,
    deploymentId: string,
    riskLevel: TradingSeverity,
    environment: string
  ): MappedTradingApproval {
    const approvalId = `trading_deployment:${deploymentId}`;
    const sourceId = approvalId;

    const githubDeploymentId = event.metadata.githubDeploymentId as number;
    const environmentName = event.metadata.environmentName as string || environment;

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
  private requiresApproval(riskLevel: TradingSeverity): boolean {
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const requiredLevel = this.config.requireApprovalForRiskLevel;

    return severityOrder[riskLevel] >= severityOrder[requiredLevel];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTradingApprovalMapper(
  config?: TradingApprovalMapperConfig
): TradingApprovalMapper {
  return new TradingApprovalMapper(config);
}
