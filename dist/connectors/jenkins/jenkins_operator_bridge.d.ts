/**
 * Jenkins Operator Bridge
 * Phase 2B-3A - Jenkins → Operator 数据面桥接
 *
 * 职责：
 * - build_failed → IncidentDataSource
 * - input_pending → ApprovalDataSource
 * - 动作后状态同步
 */
import type { JenkinsEvent } from './jenkins_types';
import type { JenkinsEventAdapter } from './jenkins_event_adapter';
import type { JenkinsConnector } from './jenkins_connector';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';
export interface JenkinsOperatorBridgeConfig {
    defaultWorkspaceId?: string;
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
}
export declare class JenkinsOperatorBridge {
    private config;
    private incidentDataSource;
    private approvalDataSource;
    private eventAdapter;
    private jenkinsConnector;
    constructor(incidentDataSource: IncidentDataSource, approvalDataSource: ApprovalDataSource, eventAdapter: JenkinsEventAdapter, jenkinsConnector: JenkinsConnector, config?: JenkinsOperatorBridgeConfig);
    /**
     * 处理 Jenkins 事件
     */
    handleJenkinsEvent(event: JenkinsEvent, workspaceId?: string): Promise<{
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
export declare function createJenkinsOperatorBridge(incidentDataSource: IncidentDataSource, approvalDataSource: ApprovalDataSource, eventAdapter: JenkinsEventAdapter, jenkinsConnector: JenkinsConnector, config?: JenkinsOperatorBridgeConfig): JenkinsOperatorBridge;
