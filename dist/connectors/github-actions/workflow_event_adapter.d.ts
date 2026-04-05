/**
 * Workflow Event Adapter
 * Phase 2B-2 - Workflow 事件适配器
 *
 * 职责：
 * - 将 Workflow Run 事件转换为内部标准事件
 * - workflow_run completed(failure) → Incident
 * - deployment → Approval
 */
import type { WorkflowRunEvent, DeploymentEvent, DeploymentStatusEvent, MappedWorkflowIncident, MappedDeploymentApproval, MappedActionsInboxItem } from './github_actions_types';
export interface WorkflowEventAdapterConfig {
    autoCreateIncident?: boolean;
    autoCreateApproval?: boolean;
    autoCreateAttention?: boolean;
    failureSeverity?: 'low' | 'medium' | 'high' | 'critical';
    ignoreWorkflows?: string[];
    requireApprovalForEnvironments?: string[];
}
export declare class WorkflowEventAdapter {
    private config;
    constructor(config?: WorkflowEventAdapterConfig);
    /**
     * 适配 Workflow Run 事件
     */
    adaptWorkflowRunEvent(event: WorkflowRunEvent): {
        incident?: MappedWorkflowIncident;
        inboxItem?: MappedActionsInboxItem;
    };
    /**
     * 适配 Deployment 事件
     */
    adaptDeploymentEvent(event: DeploymentEvent): {
        approval?: MappedDeploymentApproval;
        inboxItem?: MappedActionsInboxItem;
    };
    /**
     * 适配 Deployment Status 事件
     */
    adaptDeploymentStatusEvent(event: DeploymentStatusEvent): {
        inboxItem?: MappedActionsInboxItem;
    };
    private mapFailedWorkflowToIncident;
    private mapFailedWorkflowToInboxItem;
    private mapDeploymentToApproval;
    private mapDeploymentToInboxItem;
    private mapFailedDeploymentToInboxItem;
}
export declare function createWorkflowEventAdapter(config?: WorkflowEventAdapterConfig): WorkflowEventAdapter;
