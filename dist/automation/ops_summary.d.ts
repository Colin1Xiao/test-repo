/**
 * Ops Summary - 运维摘要
 *
 * 职责：
 * 1. 把 audit + health + failure 结果压成可操作摘要
 * 2. 给运维、开发者、管理者不同摘要视图
 * 3. 产出"当前最该处理什么"的列表
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { OpsSummary, HealthSnapshot, AuditEvent, FailureRecord, AlertLevel } from './types';
/**
 * 运维摘要生成器配置
 */
export interface OpsSummaryGeneratorConfig {
    /** 顶级问题数量限制 */
    topIssuesLimit?: number;
    /** 建议操作数量限制 */
    recommendedActionsLimit?: number;
    /** 告警阈值配置 */
    alertThresholds?: {
        healthScoreCritical: number;
        healthScoreDegraded: number;
        failureRateHigh: number;
        pendingApprovalsHigh: number;
    };
}
export declare class OpsSummaryGenerator {
    private config;
    constructor(config?: OpsSummaryGeneratorConfig);
    /**
     * 构建运维摘要
     */
    buildOpsSummary(snapshot: HealthSnapshot, auditData?: {
        events: AuditEvent[];
        failures: FailureRecord[];
    }): OpsSummary;
    /**
     * 构建每日运维摘要
     */
    buildDailyOpsDigest(snapshots: HealthSnapshot[], date: string): {
        date: string;
        avgHealthScore: number;
        trend: 'improving' | 'stable' | 'degrading';
        criticalIssues: number;
        summary: string;
    };
    /**
     * 构建顶级问题列表
     */
    buildTopIssues(snapshot: HealthSnapshot, auditData?: {
        failures: FailureRecord[];
    }): Array<{
        issue: string;
        severity: AlertLevel;
        impact: string;
        count: number;
    }>;
    /**
     * 构建建议操作列表
     */
    buildAttentionItems(summary: OpsSummary): Array<{
        priority: AlertLevel;
        item: string;
        action: string;
    }>;
    /**
     * 确定总体状态
     */
    private determineOverallStatus;
    /**
     * 构建顶级失败问题
     */
    private buildTopFailures;
    /**
     * 构建降级 Server 列表
     */
    private buildDegradedServers;
    /**
     * 构建被阻塞/待审批 Skill 列表
     */
    private buildBlockedOrPendingSkills;
    /**
     * 构建审批瓶颈列表
     */
    private buildApprovalBottlenecks;
    /**
     * 构建重放热点列表
     */
    private buildReplayHotspots;
    /**
     * 构建建议操作列表
     */
    private buildRecommendedActions;
    /**
     * 计算趋势
     */
    private calculateTrend;
    /**
     * 生成每日摘要
     */
    private generateDailySummary;
    /**
     * 获取分类影响描述
     */
    private getCategoryImpact;
}
/**
 * 创建运维摘要生成器
 */
export declare function createOpsSummaryGenerator(config?: OpsSummaryGeneratorConfig): OpsSummaryGenerator;
/**
 * 快速构建运维摘要
 */
export declare function buildOpsSummary(snapshot: HealthSnapshot, auditData?: {
    events: AuditEvent[];
    failures: FailureRecord[];
}, config?: OpsSummaryGeneratorConfig): OpsSummary;
