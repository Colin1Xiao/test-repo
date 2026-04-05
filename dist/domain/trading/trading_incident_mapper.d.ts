/**
 * Trading Incident Mapper
 * Phase 2C-1 - 交易域事件映射器
 *
 * 职责：
 * - Trading System Alert → Operator Incident
 * - Deployment Regression → Incident
 * - Execution Anomaly → Incident
 */
import type { TradingEvent, MappedTradingIncident, TradingSeverity, TradingAlertType } from './trading_types';
export interface TradingIncidentMapperConfig {
    autoCreateIncident?: boolean;
    alertSeverityThreshold?: TradingSeverity;
    ignoreAlertTypes?: TradingAlertType[];
}
export declare class TradingIncidentMapper {
    private config;
    constructor(config?: TradingIncidentMapperConfig);
    /**
     * 适配交易事件到 Incident
     */
    adaptEvent(event: TradingEvent): {
        incident?: MappedTradingIncident;
        ignored?: boolean;
    };
    /**
     * 适配 System Alert 事件
     */
    private adaptSystemAlert;
    /**
     * 适配 Deployment Failed 事件
     */
    private adaptDeploymentFailed;
    /**
     * 适配 Execution Anomaly 事件
     */
    private adaptExecutionAnomaly;
    /**
     * 适配 Market Data Degradation 事件
     */
    private adaptMarketDataDegradation;
    /**
     * 映射 Alert 到 Incident
     */
    private mapAlertToIncident;
    /**
     * 映射 Deployment Failed 到 Incident
     */
    private mapDeploymentFailedToIncident;
    /**
     * 映射 Execution Anomaly 到 Incident
     */
    private mapExecutionAnomalyToIncident;
    /**
     * 检查是否达到严重级别阈值
     */
    private meetsSeverityThreshold;
}
export declare function createTradingIncidentMapper(config?: TradingIncidentMapperConfig): TradingIncidentMapper;
