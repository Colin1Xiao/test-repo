/**
 * Operator Surface Service
 * Phase 2A-1 - 核心读模型服务
 *
 * 职责：给入口层返回标准化视图
 */
import type { GetSurfaceViewInput, OperatorViewPayload } from "../types/surface_types";
export interface OperatorSurfaceService {
    /**
     * 获取 Dashboard 视图
     * content: dashboard summary, top attention items, incidents count, approvals count, health score
     */
    getDashboardView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Tasks 视图
     * content: active tasks, blocked tasks, failed tasks, top suggested actions
     */
    getTaskView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Approvals 视图
     * content: pending approvals, aged approvals, bottlenecks
     */
    getApprovalView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Incidents 视图
     * content: active incidents, degraded services, recovery suggestions
     */
    getIncidentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Agents 视图
     * content: agent status, active sessions, health metrics
     */
    getAgentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Inbox 视图 (轻量版)
     * content: pending approvals, open incidents, blocked tasks, open interventions
     */
    getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Interventions 视图
     * content: pending interventions, intervention history
     */
    getInterventionView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 History 视图
     * content: session history, command history
     */
    getHistoryView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 获取 Item Detail 视图
     * content: detailed view of specific item (task/approval/incident/agent/etc)
     */
    getItemDetailView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    /**
     * 统一视图入口 - 按 viewKind 分发到具体方法
     */
    getView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
}
