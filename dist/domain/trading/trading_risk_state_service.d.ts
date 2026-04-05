/**
 * Trading Risk State Service
 * Phase 2D-1B - 交易风险状态服务
 *
 * 职责：
 * - 维护风险状态
 * - 计算风险暴露
 * - 提供风险门控
 * - 生成风险报告
 */
import type { TradingSeverity, TradingRiskState } from './trading_types';
export interface RiskLevelChange {
    timestamp: number;
    from: TradingSeverity;
    to: TradingSeverity;
    reason: string;
    changedBy: string;
}
export interface RiskBreach {
    id: string;
    timestamp: number;
    metric: string;
    threshold: string;
    value: string;
    severity: TradingSeverity;
    acknowledged: boolean;
}
export interface RiskExposure {
    totalExposure: number;
    byStrategy: Map<string, number>;
    byEnvironment: Map<string, number>;
    topRisks: Array<{
        type: string;
        severity: TradingSeverity;
        description: string;
        mitigation?: string;
    }>;
}
export declare class TradingRiskStateService {
    private currentLevel;
    private levelChanges;
    private breaches;
    private exposures;
    constructor();
    /**
     * 获取当前风险状态
     */
    getCurrentState(): TradingRiskState;
    /**
     * 更新风险级别
     */
    updateRiskLevel(newLevel: TradingSeverity, reason: string, changedBy: string): boolean;
    /**
     * 记录风险突破
     */
    recordBreach(metric: string, threshold: string, value: string, severity: TradingSeverity): string;
    /**
     * 确认风险突破
     */
    acknowledgeBreach(breachId: string, acknowledgedBy?: string): boolean;
    /**
     * 计算风险暴露
     */
    calculateExposure(): RiskExposure;
    /**
     * 设置风险暴露
     */
    setExposure(key: string, value: number): void;
    /**
     * 风险门控检查
     */
    checkRiskGate(action: string, requiredLevel?: TradingSeverity): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * 生成风险报告
     */
    generateReport(): {
        summary: string;
        currentLevel: TradingSeverity;
        changes24h: number;
        breaches24h: number;
        unacknowledgedBreaches: number;
        recommendations: string[];
    };
}
export declare function createTradingRiskStateService(): TradingRiskStateService;
