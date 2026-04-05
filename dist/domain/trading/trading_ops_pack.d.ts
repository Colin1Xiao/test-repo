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
export declare function initializeTradingOpsPack(config?: TradingOpsPackConfig): TradingOpsPackResult;
/**
 * 创建 Release Request 事件
 */
export declare function createReleaseRequestEvent(strategyName: string, version: string, description: string, requestedBy: string, environment?: 'testnet' | 'mainnet', riskLevel?: 'low' | 'medium' | 'high' | 'critical'): TradingEvent;
/**
 * 创建 System Alert 事件
 */
export declare function createSystemAlertEvent(alertType: string, title: string, description: string, system: string, component: string, severity?: 'low' | 'medium' | 'high' | 'critical', environment?: 'testnet' | 'mainnet'): TradingEvent;
/**
 * 创建 Deployment Pending 事件
 */
export declare function createDeploymentPendingEvent(deploymentId: number, environment: string, requestedBy: string, riskLevel?: 'low' | 'medium' | 'high' | 'critical'): TradingEvent;
export * from './trading_types';
export { TradingApprovalMapper } from './trading_approval_mapper';
export { TradingIncidentMapper } from './trading_incident_mapper';
export { TradingConnectorBridge } from './trading_connector_bridge';
export { TradingOperatorViews } from './trading_operator_views';
