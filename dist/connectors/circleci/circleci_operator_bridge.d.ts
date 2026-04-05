/**
 * CircleCI Operator Bridge
 * Phase 2B-3B - CircleCI → Operator 数据面桥接
 *
 * 职责：
 * - workflow_failed → IncidentDataSource
 * - approval_pending → ApprovalDataSource
 * - 动作后状态同步
 */
import type { CircleCIEvent } from './circleci_types';
import type { CircleCIEventAdapter } from './circleci_event_adapter';
import type { CircleCIConnector } from './circleci_connector';
export interface CircleCIOperatorBridgeConfig {
    defaultWorkspaceId?: string;
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
}
export declare class CircleCIOperatorBridge {
    private config;
    private eventAdapter;
    private circleCIConnector;
    constructor(eventAdapter: CircleCIEventAdapter, circleCIConnector: CircleCIConnector, config?: CircleCIOperatorBridgeConfig);
    /**
     * 处理 CircleCI 事件
     */
    handleCircleCIEvent(event: CircleCIEvent, workspaceId?: string): Promise<{
        incidentCreated?: boolean;
        approvalCreated?: boolean;
        inboxItemCreated?: boolean;
    }>;
    /**
     * 处理 Approve 动作回写
     */
    handleApproveAction(sourceId: string, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Reject 动作回写
     */
    handleRejectAction(sourceId: string, actorId?: string, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Rerun 动作
     */
    handleRerunAction(sourceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare function createCircleCIOperatorBridge(eventAdapter: CircleCIEventAdapter, circleCIConnector: CircleCIConnector, config?: CircleCIOperatorBridgeConfig): CircleCIOperatorBridge;
