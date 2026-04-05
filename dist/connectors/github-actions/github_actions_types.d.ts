/**
 * GitHub Actions Types
 * Phase 2B-2 - GitHub Actions 连接器类型定义
 */
export type GitHubActionsEventType = 'workflow_run' | 'workflow_dispatch' | 'workflow_job' | 'deployment' | 'deployment_status' | 'check_run';
export type WorkflowRunStatus = 'queued' | 'in_progress' | 'completed';
export type WorkflowRunConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
export type DeploymentStatus = 'pending' | 'in_progress' | 'queued' | 'active' | 'destroyed' | 'abandoned' | 'success' | 'failure';
export interface GitHubActionsEvent {
    type: GitHubActionsEventType;
    timestamp: number;
}
/**
 * Workflow Run 事件
 */
export interface WorkflowRunEvent extends GitHubActionsEvent {
    type: 'workflow_run';
    action: WorkflowRunStatus;
    repository: {
        owner: string;
        name: string;
        fullName: string;
    };
    workflow: {
        id: number;
        name: string;
        runId: number;
        runNumber: number;
        status: WorkflowRunStatus;
        conclusion: WorkflowRunConclusion;
        headBranch: string;
        headSha: string;
        durationMs?: number;
    };
    sender: {
        login: string;
    };
}
/**
 * Deployment 事件
 */
export interface DeploymentEvent extends GitHubActionsEvent {
    type: 'deployment';
    repository: {
        owner: string;
        name: string;
        fullName: string;
    };
    deployment: {
        id: number;
        environment: string;
        ref: string;
        task: string;
        creator: {
            login: string;
        };
        description?: string;
        createdAt: string;
        updatedAt: string;
    };
}
/**
 * Deployment Status 事件
 */
export interface DeploymentStatusEvent extends GitHubActionsEvent {
    type: 'deployment_status';
    repository: {
        owner: string;
        name: string;
        fullName: string;
    };
    deployment: {
        id: number;
        environment: string;
    };
    deploymentStatus: {
        id: number;
        state: DeploymentStatus;
        description?: string;
        environmentUrl?: string;
    };
}
/**
 * Check Run 事件
 */
export interface CheckRunEvent extends GitHubActionsEvent {
    type: 'check_run';
    action: 'created' | 'completed' | 'rerequested';
    repository: {
        owner: string;
        name: string;
        fullName: string;
    };
    checkRun: {
        id: number;
        name: string;
        status: 'queued' | 'in_progress' | 'completed';
        conclusion: WorkflowRunConclusion;
        headSha: string;
    };
}
/**
 * 映射到 Operator Task
 */
export interface MappedWorkflowTask {
    taskId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'running' | 'completed' | 'failed';
    metadata: {
        source: 'github_actions';
        sourceType: 'workflow_run';
        sourceId: string;
        workflowName: string;
        runId: number;
        environment?: string;
    };
}
/**
 * 映射到 Operator Approval
 */
export interface MappedDeploymentApproval {
    approvalId: string;
    scope: string;
    reason: string;
    requestingAgent: string;
    metadata: {
        source: 'github_actions';
        sourceType: 'deployment_approval';
        deploymentId: number;
        environment: string;
        ref: string;
    };
}
/**
 * 映射到 Operator Incident
 */
export interface MappedWorkflowIncident {
    incidentId: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metadata: {
        source: 'github_actions';
        workflowName: string;
        runId: number;
        conclusion: WorkflowRunConclusion;
    };
}
/**
 * 映射到 Inbox Item
 */
export interface MappedActionsInboxItem {
    itemType: 'task' | 'approval' | 'incident' | 'attention';
    sourceId: string;
    title: string;
    summary: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedActions: string[];
    metadata: Record<string, any>;
}
export interface WorkflowRunWebhookPayload {
    action: string;
    workflow_run: {
        id: number;
        name: string;
        run_number: number;
        status: string;
        conclusion: string | null;
        head_branch: string;
        head_sha: string;
        updated_at: string;
        created_at: string;
    };
    workflow: {
        id: number;
        name: string;
    };
    repository: {
        owner: {
            login: string;
        };
        name: string;
        full_name: string;
    };
    sender: {
        login: string;
    };
}
export interface DeploymentWebhookPayload {
    deployment: {
        id: number;
        environment: string;
        ref: string;
        task: string;
        description?: string;
        creator: {
            login: string;
        };
        created_at: string;
        updated_at: string;
    };
    repository: {
        owner: {
            login: string;
        };
        name: string;
        full_name: string;
    };
}
export interface DeploymentStatusWebhookPayload {
    deployment: {
        id: number;
        environment: string;
    };
    deployment_status: {
        id: number;
        state: string;
        description?: string;
        environment_url?: string;
    };
    repository: {
        owner: {
            login: string;
        };
        name: string;
        full_name: string;
    };
}
