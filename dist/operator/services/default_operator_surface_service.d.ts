/**
 * Default Operator Surface Service
 * Phase 2A-1R - 视图服务实现
 *
 * 职责：
 * - 实现 OperatorSurfaceService 接口
 * - 从现有系统组装真实视图数据
 * - 依赖：OperatorContextAdapter, OperatorViewFactory
 */
import type { GetSurfaceViewInput, OperatorViewPayload, OperatorSurfaceService } from '../types/surface_types';
import type { OperatorContextAdapter } from './operator_context_adapter';
import type { OperatorViewFactory } from './operator_view_factory';
import type { InboxService } from '../inbox/inbox_service';
export declare class DefaultOperatorSurfaceService implements OperatorSurfaceService {
    private contextAdapter;
    private viewFactory;
    private inboxService;
    constructor(contextAdapter: OperatorContextAdapter, viewFactory: OperatorViewFactory, inboxService?: InboxService);
    getDashboardView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getTaskView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getApprovalView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getIncidentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getAgentView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getInboxView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getInterventionView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getHistoryView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getItemDetailView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
    getView(input: GetSurfaceViewInput): Promise<OperatorViewPayload>;
}
export declare function createOperatorSurfaceService(contextAdapter: OperatorContextAdapter, viewFactory: OperatorViewFactory): OperatorSurfaceService;
