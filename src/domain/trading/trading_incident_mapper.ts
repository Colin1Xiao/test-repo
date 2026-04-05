/**
 * Trading Incident Mapper
 * Phase 2C-1 - 交易域事件映射器
 * 
 * 职责：
 * - Trading System Alert → Operator Incident
 * - Deployment Regression → Incident
 * - Execution Anomaly → Incident
 */

import type {
  TradingEvent,
  TradingSystemAlert,
  MappedTradingIncident,
  TradingSeverity,
  TradingAlertType,
} from './trading_types';

// ============================================================================
// 配置
// ============================================================================

export interface TradingIncidentMapperConfig {
  autoCreateIncident?: boolean;
  alertSeverityThreshold?: TradingSeverity;
  ignoreAlertTypes?: TradingAlertType[];
}

// ============================================================================
// Trading Incident Mapper
// ============================================================================

export class TradingIncidentMapper {
  private config: Required<TradingIncidentMapperConfig>;

  constructor(config: TradingIncidentMapperConfig = {}) {
    this.config = {
      autoCreateIncident: config.autoCreateIncident ?? true,
      alertSeverityThreshold: config.alertSeverityThreshold ?? 'medium',
      ignoreAlertTypes: config.ignoreAlertTypes || [],
    };
  }

  /**
   * 适配交易事件到 Incident
   */
  adaptEvent(event: TradingEvent): {
    incident?: MappedTradingIncident;
    ignored?: boolean;
  } {
    const result: any = {};

    if (!this.config.autoCreateIncident) {
      return result;
    }

    // 检查是否忽略该类型
    if (this.config.ignoreAlertTypes.includes(event.metadata.alertType as TradingAlertType)) {
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
  private adaptSystemAlert(event: TradingEvent): {
    incident?: MappedTradingIncident;
    ignored?: boolean;
  } {
    const alertId = event.metadata.alertId as string || `alert_${Date.now()}`;
    const alertType = event.metadata.alertType as TradingAlertType || 'system_health';
    const severity = event.severity;

    const incident = this.mapAlertToIncident(event, alertId, alertType, severity);
    return { incident };
  }

  /**
   * 适配 Deployment Failed 事件
   */
  private adaptDeploymentFailed(event: TradingEvent): {
    incident?: MappedTradingIncident;
    ignored?: boolean;
  } {
    const deploymentId = event.metadata.deploymentId as string || `deploy_${Date.now()}`;
    const alertType: TradingAlertType = 'deployment_regression';
    const severity: TradingSeverity = 'high';

    const incident = this.mapDeploymentFailedToIncident(event, deploymentId, alertType, severity);
    return { incident };
  }

  /**
   * 适配 Execution Anomaly 事件
   */
  private adaptExecutionAnomaly(event: TradingEvent): {
    incident?: MappedTradingIncident;
    ignored?: boolean;
  } {
    const anomalyId = event.metadata.anomalyId as string || `anomaly_${Date.now()}`;
    const alertType: TradingAlertType = 'order_failure';
    const severity = event.severity;

    const incident = this.mapExecutionAnomalyToIncident(event, anomalyId, alertType, severity);
    return { incident };
  }

  /**
   * 适配 Market Data Degradation 事件
   */
  private adaptMarketDataDegradation(event: TradingEvent): {
    incident?: MappedTradingIncident;
    ignored?: boolean;
  } {
    const alertId = event.metadata.alertId as string || `alert_${Date.now()}`;
    const alertType: TradingAlertType = 'market_data_degradation';
    const severity: TradingSeverity = 'critical';

    const incident = this.mapAlertToIncident(event, alertId, alertType, severity);
    return { incident };
  }

  // ============================================================================
  // 映射方法
  // ============================================================================

  /**
   * 映射 Alert 到 Incident
   */
  private mapAlertToIncident(
    event: TradingEvent,
    alertId: string,
    alertType: TradingAlertType,
    severity: TradingSeverity
  ): MappedTradingIncident {
    const incidentId = `trading_incident:${alertId}`;
    const sourceId = incidentId;

    const system = event.source.system;
    const component = event.source.component;
    const environment = event.source.environment;
    const title = event.metadata.title as string || `${alertType} in ${system}`;
    const description = event.metadata.description as string || event.metadata.message as string || title;

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
        relatedReleaseId: event.metadata.relatedReleaseId as string,
        relatedDeploymentId: event.metadata.relatedDeploymentId as string,
      },
    };
  }

  /**
   * 映射 Deployment Failed 到 Incident
   */
  private mapDeploymentFailedToIncident(
    event: TradingEvent,
    deploymentId: string,
    alertType: TradingAlertType,
    severity: TradingSeverity
  ): MappedTradingIncident {
    const incidentId = `trading_incident:deploy_${deploymentId}`;
    const sourceId = incidentId;

    const environment = event.source.environment;
    const githubDeploymentId = event.metadata.githubDeploymentId as number;
    const failureReason = event.metadata.failureReason as string || 'Unknown failure';

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
        relatedReleaseId: event.metadata.relatedReleaseId as string,
      },
    };
  }

  /**
   * 映射 Execution Anomaly 到 Incident
   */
  private mapExecutionAnomalyToIncident(
    event: TradingEvent,
    anomalyId: string,
    alertType: TradingAlertType,
    severity: TradingSeverity
  ): MappedTradingIncident {
    const incidentId = `trading_incident:anomaly_${anomalyId}`;
    const sourceId = incidentId;

    const system = event.source.system;
    const component = event.source.component;
    const environment = event.source.environment;
    const orderType = event.metadata.orderType as string || 'Unknown';
    const errorMessage = event.metadata.errorMessage as string || 'Execution failed';

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
  private meetsSeverityThreshold(severity: TradingSeverity): boolean {
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const threshold = this.config.alertSeverityThreshold;

    return severityOrder[severity] >= severityOrder[threshold];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTradingIncidentMapper(
  config?: TradingIncidentMapperConfig
): TradingIncidentMapper {
  return new TradingIncidentMapper(config);
}
