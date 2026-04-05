/**
 * GitHub Actions Operator Bridge
 * Phase 2B-2 - GitHub Actions → Operator 数据面桥接
 *
 * 职责：
 * - workflow_run failed → IncidentDataSource
 * - deployment → ApprovalDataSource
 * - 动作后状态同步回写
 */
import type { WorkflowRunEvent, DeploymentEvent, DeploymentStatusEvent } from './github_actions_types';
import type { WorkflowEventAdapter } from './workflow_event_adapter';
import type { DeploymentApprovalBridge } from './deployment_approval_bridge';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';
export interface GitHubActionsOperatorBridgeConfig {
    defaultWorkspaceId?: string;
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
}
export declare class GitHubActionsOperatorBridge {
    private config;
    private incidentDataSource;
    private approvalDataSource;
    private workflowEventAdapter;
    private deploymentApprovalBridge;
    constructor(incidentDataSource: IncidentDataSource, approvalDataSource: ApprovalDataSource, workflowEventAdapter: WorkflowEventAdapter, deploymentApprovalBridge: DeploymentApprovalBridge, config?: GitHubActionsOperatorBridgeConfig);
    /**
     * 处理 Workflow Run 事件
     */
    handleWorkflowRunEvent(event: WorkflowRunEvent, workspaceId?: string): Promise<{
        incidentCreated?: boolean;
        inboxItemCreated?: boolean;
    }>;
    /**
     * 处理 Deployment 事件
     */
    handleDeploymentEvent(event: DeploymentEvent, workspaceId?: string): Promise<{
        approvalCreated?: boolean;
        inboxItemCreated?: boolean;
    }>;
    /**
     * 处理 Deployment Status 事件
     */
    handleDeploymentStatusEvent(event: DeploymentStatusEvent, workspaceId?: string): Promise<{
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
}
export declare function createGitHubActionsOperatorBridge(incidentDataSource: IncidentDataSource, approvalDataSource: ApprovalDataSource, workflowEventAdapter: WorkflowEventAdapter, deploymentApprovalBridge: DeploymentApprovalBridge, config?: GitHubActionsOperatorBridgeConfig): GitHubActionsOperatorBridge;
