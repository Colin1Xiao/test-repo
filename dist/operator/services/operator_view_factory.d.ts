/**
 * Operator View Factory
 * Phase 2A-1R - 标准化视图 Payload 构造
 *
 * 职责：
 * - 统一构造 OperatorViewPayload
 * - 避免每个 view 方法手拼标题、summary、actions
 * - 提供一致的视图结构
 */
import type { OperatorViewPayload, OperatorMode, OperatorSurface } from '../types/surface_types';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { ControlSurfaceSnapshot } from '../ux/control_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';
export interface BuildDashboardViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    dashboardSnapshot: DashboardSnapshot;
    humanLoopSnapshot?: HumanLoopSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildTaskViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildApprovalViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    humanLoopSnapshot?: HumanLoopSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildIncidentViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    dashboardSnapshot: DashboardSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildAgentViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildInboxViewInput {
    controlSnapshot: ControlSurfaceSnapshot;
    humanLoopSnapshot?: HumanLoopSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildInterventionViewInput {
    humanLoopSnapshot: HumanLoopSnapshot;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface BuildDetailViewInput {
    targetType: string;
    targetId: string;
    data: unknown;
    mode?: OperatorMode;
    surface?: OperatorSurface;
}
export interface OperatorViewFactory {
    buildDashboardView(input: BuildDashboardViewInput): OperatorViewPayload;
    buildTaskView(input: BuildTaskViewInput): OperatorViewPayload;
    buildApprovalView(input: BuildApprovalViewInput): OperatorViewPayload;
    buildIncidentView(input: BuildIncidentViewInput): OperatorViewPayload;
    buildAgentView(input: BuildAgentViewInput): OperatorViewPayload;
    buildInboxView(input: BuildInboxViewInput): OperatorViewPayload;
    buildInterventionView(input: BuildInterventionViewInput): OperatorViewPayload;
    buildDetailView(input: BuildDetailViewInput): OperatorViewPayload;
}
export declare class DefaultOperatorViewFactory implements OperatorViewFactory {
    buildDashboardView(input: BuildDashboardViewInput): OperatorViewPayload;
    buildTaskView(input: BuildTaskViewInput): OperatorViewPayload;
    buildApprovalView(input: BuildApprovalViewInput): OperatorViewPayload;
    buildIncidentView(input: BuildIncidentViewInput): OperatorViewPayload;
    buildAgentView(input: BuildAgentViewInput): OperatorViewPayload;
    buildInboxView(input: BuildInboxViewInput): OperatorViewPayload;
    buildInterventionView(input: BuildInterventionViewInput): OperatorViewPayload;
    buildDetailView(input: BuildDetailViewInput): OperatorViewPayload;
    private buildDashboardSummary;
    private buildInboxSummary;
    private formatTargetType;
}
export declare function createOperatorViewFactory(): OperatorViewFactory;
