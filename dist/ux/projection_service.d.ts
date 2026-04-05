/**
 * Projection Service - 投影服务
 *
 * 职责：
 * 1. 把 dashboard snapshot 投影成不同模式
 * 2. 支持 summary / detail / operator / management / incident / approval_focus / agent_focus
 * 3. 支持不同目标端：cli / telegram / web / audit / api
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { DashboardSnapshot, ProjectionOptions, ProjectionResult } from './dashboard_types';
export declare class ProjectionService {
    /**
     * 投影仪表盘
     */
    project(dashboard: DashboardSnapshot, options?: ProjectionOptions): ProjectionResult;
    /**
     * 投影为摘要模式
     */
    projectSummary(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为详情模式
     */
    projectDetail(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为操作员模式
     */
    projectOperator(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为管理模式
     */
    projectManagement(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为事件聚焦模式
     */
    projectIncident(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为审批聚焦模式
     */
    projectApprovalFocus(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 投影为 Agent 聚焦模式
     */
    projectAgentFocus(dashboard: DashboardSnapshot): ProjectionResult;
    /**
     * 应用过滤器
     */
    private applyFilter;
    /**
     * 应用排序
     */
    private applySort;
    /**
     * 应用分组
     */
    private applyGroup;
    /**
     * 限制项数
     */
    private limitItems;
    /**
     * 应用关注项过滤器
     */
    private applyAttentionFilter;
    /**
     * 生成投影内容
     */
    private generateContent;
    /**
     * 生成摘要内容
     */
    private generateSummaryContent;
    /**
     * 生成详情内容
     */
    private generateDetailContent;
    /**
     * 生成操作员内容
     */
    private generateOperatorContent;
    /**
     * 生成管理内容
     */
    private generateManagementContent;
    /**
     * 生成事件内容
     */
    private generateIncidentContent;
    /**
     * 生成默认内容
     */
    private generateDefaultContent;
    /**
     * 构建投影摘要
     */
    private buildProjectionSummary;
    /**
     * 计算项数
     */
    private countItems;
}
/**
 * 创建投影服务
 */
export declare function createProjectionService(): ProjectionService;
/**
 * 快速投影仪表盘
 */
export declare function projectDashboard(dashboard: any, options?: ProjectionOptions): ProjectionResult;
