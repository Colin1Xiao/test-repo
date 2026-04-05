/**
 * Dashboard Builder - 仪表盘构建器
 *
 * 职责：
 * 1. 把 ControlSurfaceSnapshot 转成 DashboardSnapshot
 * 2. 生成 sections / cards
 * 3. 归并 summary
 * 4. 计算 badge / severity / freshness
 * 5. 生成 top attention items
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { ControlSurfaceSnapshot } from './control_types';
import type { DashboardSnapshot, DashboardBuilderConfig } from './dashboard_types';
export declare class DashboardBuilder {
    private config;
    private attentionEngine;
    constructor(config?: DashboardBuilderConfig);
    /**
     * 构建仪表盘快照
     */
    buildDashboardSnapshot(controlSnapshot: ControlSurfaceSnapshot): DashboardSnapshot;
    /**
     * 刷新仪表盘快照
     */
    refreshDashboardSnapshot(oldDashboard: DashboardSnapshot, newControlSnapshot: ControlSurfaceSnapshot): {
        dashboard: DashboardSnapshot;
        changes?: any;
    };
    /**
     * 构建摘要
     */
    private buildSummary;
    /**
     * 确定总体状态
     */
    private determineOverallStatus;
    /**
     * 构建分段
     */
    private buildSections;
    /**
     * 构建关注项分段
     */
    private buildAttentionSection;
    /**
     * 构建任务分段
     */
    private buildTaskSection;
    /**
     * 构建审批分段
     */
    private buildApprovalSection;
    /**
     * 构建运维分段
     */
    private buildOpsSection;
    /**
     * 构建 Agent 分段
     */
    private buildAgentSection;
    /**
     * 构建动作分段
     */
    private buildActionSection;
    /**
     * 构建建议动作
     */
    private buildRecommendedActions;
    /**
     * 检测变化
     */
    private detectChanges;
}
/**
 * 创建仪表盘构建器
 */
export declare function createDashboardBuilder(config?: DashboardBuilderConfig): DashboardBuilder;
/**
 * 快速构建仪表盘快照
 */
export declare function buildDashboardSnapshot(controlSnapshot: ControlSurfaceSnapshot, config?: DashboardBuilderConfig): DashboardSnapshot;
