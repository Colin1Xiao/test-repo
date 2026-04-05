/**
 * Trading Ops Pack
 * Phase 2C-1 - 交易工程运维包统一装配入口
 * 
 * 职责：
 * - 组装所有交易域模块
 * - 提供统一的初始化接口
 * - 导出交易域能力
 */

import { createTradingApprovalMapper } from './trading_approval_mapper';
import { createTradingIncidentMapper } from './trading_incident_mapper';
import { createTradingConnectorBridge } from './trading_connector_bridge';
import { createTradingOperatorViews } from './trading_operator_views';
import type { TradingOpsPackConfig, TradingEvent } from './trading_types';
import type { MappedTradingApproval } from './trading_types';
import type { MappedTradingIncident } from './trading_types';

// ============================================================================
// 集成结果
// ============================================================================

export interface TradingOpsPackResult {
  approvalMapper: ReturnType<typeof createTradingApprovalMapper>;
  incidentMapper: ReturnType<typeof createTradingIncidentMapper>;
  connectorBridge: ReturnType<typeof createTradingConnectorBridge>;
  operatorViews: ReturnType<typeof createTradingOperatorViews>;
  processEvent: (event: TradingEvent) => Promise<{
    approval?: MappedTradingApproval;
    incident?: MappedTradingIncident;
    autoApproved?: boolean;
    ignored?: boolean;
  }>;
}

// ============================================================================
// 集成初始化
// ============================================================================

export function initializeTradingOpsPack(
  config: TradingOpsPackConfig = {}
): TradingOpsPackResult {
  // 1. 创建审批映射器
  const approvalMapper = createTradingApprovalMapper({
    autoCreateApproval: config.autoCreateApproval ?? true,
    requireApprovalForRiskLevel: config.requireApprovalForRiskLevel,
    autoApproveTestnet: config.environment === 'testnet',
  });

  // 2. 创建事件映射器
  const incidentMapper = createTradingIncidentMapper({
    autoCreateIncident: config.autoCreateIncident ?? true,
    alertSeverityThreshold: config.alertSeverityThreshold,
  });

  // 3. 创建 Connector 桥接
  const connectorBridge = createTradingConnectorBridge({
    githubActionsIntegration: config.githubActionsIntegration,
    defaultEnvironment: config.environment,
  });

  // 4. 创建 Operator 视图
  const operatorViews = createTradingOperatorViews({
    defaultEnvironment: config.environment,
  });

  // 5. 创建统一事件处理器
  const processEvent = async (event: TradingEvent) => {
    const result: any = {};

    // 处理审批
    const approvalResult = approvalMapper.adaptEvent(event);
    if (approvalResult.approval) {
      result.approval = approvalResult.approval;
    }
    if (approvalResult.autoApproved) {
      result.autoApproved = true;
    }

    // 处理事件
    const incidentResult = incidentMapper.adaptEvent(event);
    if (incidentResult.incident) {
      result.incident = incidentResult.incident;
    }
    if (incidentResult.ignored) {
      result.ignored = true;
    }

    return result;
  };

  return {
    approvalMapper,
    incidentMapper,
    connectorBridge,
    operatorViews,
    processEvent,
  };
}

// ============================================================================
// 便利函数
// ============================================================================

/**
 * 创建 Release Request 事件
 */
export function createReleaseRequestEvent(
  strategyName: string,
  version: string,
  description: string,
  requestedBy: string,
  environment: 'testnet' | 'mainnet' = 'mainnet',
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): TradingEvent {
  return {
    type: 'release_requested',
    timestamp: Date.now(),
    severity: riskLevel,
    source: {
      system: 'trading_ops',
      component: 'release_manager',
      environment,
    },
    actor: {
      userId: requestedBy,
      username: requestedBy,
    },
    metadata: {
      releaseId: `release_${Date.now()}`,
      strategyName,
      version,
      description,
      riskLevel,
      environment,
    },
  };
}

/**
 * 创建 System Alert 事件
 */
export function createSystemAlertEvent(
  alertType: string,
  title: string,
  description: string,
  system: string,
  component: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  environment: 'testnet' | 'mainnet' = 'mainnet'
): TradingEvent {
  return {
    type: 'system_alert',
    timestamp: Date.now(),
    severity,
    source: {
      system,
      component,
      environment,
    },
    actor: {
      userId: 'system',
      username: 'system',
    },
    metadata: {
      alertId: `alert_${Date.now()}`,
      alertType,
      title,
      description,
    },
  };
}

/**
 * 创建 Deployment Pending 事件
 */
export function createDeploymentPendingEvent(
  deploymentId: number,
  environment: string,
  requestedBy: string,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
): TradingEvent {
  return {
    type: 'deployment_pending',
    timestamp: Date.now(),
    severity: riskLevel,
    source: {
      system: 'github_actions',
      component: 'deployment',
      environment: environment as 'testnet' | 'mainnet',
    },
    actor: {
      userId: requestedBy,
      username: requestedBy,
    },
    metadata: {
      deploymentId: String(deploymentId),
      githubDeploymentId: deploymentId,
      environment,
      environmentName: environment,
      riskLevel,
    },
  };
}

// ============================================================================
// 导出类型
// ============================================================================

export * from './trading_types';
export { TradingApprovalMapper } from './trading_approval_mapper';
export { TradingIncidentMapper } from './trading_incident_mapper';
export { TradingConnectorBridge } from './trading_connector_bridge';
export { TradingOperatorViews } from './trading_operator_views';
