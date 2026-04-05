/**
 * Trading Operator Views
 * Phase 2C-1 - 交易域 Operator 视图
 *
 * 职责：
 * - 提供 Trading Dashboard Snapshot
 * - 提供 Release Readiness 检查
 * - 提供 Active Incidents 视图
 * - 提供 Pending Approvals 视图
 * - 提供 Risk State 视图
 */
import type { TradingDashboardSnapshot, TradingReleaseReadiness, TradingActiveIncidents, TradingPendingApprovals, TradingRiskState } from './trading_types';
export interface TradingOperatorViewsConfig {
    defaultEnvironment?: 'testnet' | 'mainnet';
    dashboardRefreshIntervalMs?: number;
}
export declare class TradingOperatorViews {
    private config;
    constructor(config?: TradingOperatorViewsConfig);
    /**
     * 构建 Trading Dashboard Snapshot
     */
    buildDashboardSnapshot(releases: any[], alerts: any[], deployments: any[], riskChanges: any[]): Promise<TradingDashboardSnapshot>;
    /**
     * 构建 Release Readiness 检查
     */
    buildReleaseReadiness(releaseId: string, release: any): Promise<TradingReleaseReadiness>;
    /**
     * 构建 Active Incidents 视图
     */
    buildActiveIncidents(alerts: any[]): Promise<TradingActiveIncidents>;
    /**
     * 构建 Pending Approvals 视图
     */
    buildPendingApprovals(approvals: any[]): Promise<TradingPendingApprovals>;
    /**
     * 构建 Risk State 视图
     */
    buildRiskState(riskChanges: any[]): Promise<TradingRiskState>;
    /**
     * 过滤最近 24 小时的数据
     */
    private filterLast24h;
    /**
     * 获取当前风险级别
     */
    private getCurrentRiskLevel;
}
export declare function createTradingOperatorViews(config?: TradingOperatorViewsConfig): TradingOperatorViews;
