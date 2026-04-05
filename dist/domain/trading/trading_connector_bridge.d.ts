/**
 * Trading Connector Bridge
 * Phase 2C-1 - 交易域 Connector 桥接
 *
 * 职责：
 * - 复用现有 GitHub / GitHub Actions Connectors
 * - 转换为交易域语义
 * - 提供统一的交易域事件接口
 */
import type { TradingEvent } from './trading_types';
export interface TradingConnectorBridgeConfig {
    githubActionsIntegration?: {
        enabled: boolean;
        deploymentWebhookPath?: string;
    };
    defaultEnvironment?: 'testnet' | 'mainnet';
}
export declare class TradingConnectorBridge {
    private config;
    constructor(config?: TradingConnectorBridgeConfig);
    /**
     * 转换 GitHub Actions Deployment 事件到 Trading Event
     */
    convertGitHubActionsDeployment(githubEvent: any): TradingEvent | null;
    /**
     * 转换 GitHub PR Review 事件到 Trading Event
     */
    convertGitHubReview(githubEvent: any): TradingEvent | null;
    /**
     * 转换 System Alert 到 Trading Event
     */
    convertSystemAlert(alertData: any): TradingEvent;
    /**
     * 转换 Execution Anomaly 到 Trading Event
     */
    convertExecutionAnomaly(anomalyData: any): TradingEvent;
    /**
     * 转换 Risk Parameter Change 到 Trading Event
     */
    convertRiskParameterChange(changeData: any): TradingEvent;
}
export declare function createTradingConnectorBridge(config?: TradingConnectorBridgeConfig): TradingConnectorBridge;
