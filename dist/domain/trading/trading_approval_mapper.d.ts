/**
 * Trading Approval Mapper
 * Phase 2C-1 - 交易域审批映射器
 *
 * 职责：
 * - Trading Release Request → Operator Approval
 * - Risk Parameter Change → Operator Approval
 * - Deployment Gate → Operator Approval
 */
import type { TradingEvent, MappedTradingApproval, TradingSeverity } from './trading_types';
export interface TradingApprovalMapperConfig {
    autoCreateApproval?: boolean;
    requireApprovalForRiskLevel?: TradingSeverity;
    autoApproveTestnet?: boolean;
}
export declare class TradingApprovalMapper {
    private config;
    constructor(config?: TradingApprovalMapperConfig);
    /**
     * 适配交易事件到 Approval
     */
    adaptEvent(event: TradingEvent): {
        approval?: MappedTradingApproval;
        autoApproved?: boolean;
    };
    /**
     * 适配 Release Request 事件
     */
    private adaptReleaseRequested;
    /**
     * 适配 Risk Parameter Change 事件
     */
    private adaptRiskParameterChange;
    /**
     * 适配 Deployment Pending 事件
     */
    private adaptDeploymentPending;
    /**
     * 映射 Release Request 到 Approval
     */
    private mapReleaseToApproval;
    /**
     * 映射 Risk Parameter Change 到 Approval
     */
    private mapRiskChangeToApproval;
    /**
     * 映射 Deployment 到 Approval
     */
    private mapDeploymentToApproval;
    /**
     * 检查是否需要审批
     */
    private requiresApproval;
}
export declare function createTradingApprovalMapper(config?: TradingApprovalMapperConfig): TradingApprovalMapper;
