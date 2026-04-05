/**
 * Trading Dashboard Projection
 * Phase 2D-1B - 交易域仪表盘投影
 *
 * 职责：
 * - 提供 Trading-specific Dashboard
 * - 显示 Release / Incident / Risk 状态
 * - 提供可操作视图
 */
import type { TradingReleaseReadiness, TradingActiveIncidents } from './trading_types';
export interface TradingDashboardProjectionConfig {
    refreshIntervalMs?: number;
    maxItems?: number;
}
export declare class TradingDashboardProjection {
    private config;
    private riskStateService;
    constructor(config?: TradingDashboardProjectionConfig);
    /**
     * 构建增强版 Dashboard
     */
    buildEnhancedDashboard(releases: any[], alerts: any[], deployments: any[], approvals: any[]): Promise<any>;
    /**
     * 构建 Release Readiness 视图
     */
    buildReleaseReadinessView(releaseId: string, release: any): Promise<TradingReleaseReadiness & {
        riskGatePassed: boolean;
        dependenciesHealthy: boolean;
    }>;
    /**
     * 构建 Incident 处理视图
     */
    buildIncidentHandlingView(alerts: any[]): Promise<TradingActiveIncidents & {
        suggestedActions: Array<{
            incidentId: string;
            actions: Array<{
                type: string;
                label: string;
                priority: 'high' | 'medium' | 'low';
            }>;
        }>;
    }>;
    private filterLast24h;
    private buildActiveIncidents;
}
export declare function createTradingDashboardProjection(config?: TradingDashboardProjectionConfig): TradingDashboardProjection;
