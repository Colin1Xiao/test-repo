/**
 * GitHub Types
 * Phase 2B-1 - GitHub 连接器类型定义
 */
export type GitHubEventType = 'pr' | 'check' | 'issue' | 'push' | 'release';
export type GitHubPRAction = 'opened' | 'reopened' | 'synchronize' | 'closed' | 'merged' | 'review_requested' | 'review_request_removed' | 'labeled' | 'unlabeled';
export type GitHubCheckStatus = 'queued' | 'in_progress' | 'completed';
export type GitHubCheckConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
export interface GitHubEvent {
    type: GitHubEventType;
    timestamp: number;
}
export interface GitHubPREvent extends GitHubEvent {
    type: 'pr';
    action: GitHubPRAction;
    repository: {
        owner: string;
        name: string;
    };
    pullRequest: {
        number: number;
        title: string;
        state: 'open' | 'closed';
        user: string;
        createdAt: string;
        updatedAt: string;
        labels?: string[];
        assignees?: string[];
        requestedReviewers?: string[];
    };
    sender: {
        login: string;
    };
}
export interface GitHubCheckEvent extends GitHubEvent {
    type: 'check';
    action: string;
    repository: {
        owner: string;
        name: string;
    };
    checkSuite: {
        id: number;
        status: GitHubCheckStatus;
        conclusion: GitHubCheckConclusion;
        headBranch: string;
    };
}
export interface GitHubWebhookPayload {
    action?: string;
    repository?: {
        owner?: {
            login?: string;
        };
        name?: string;
        full_name?: string;
    };
    pull_request?: {
        number?: number;
        title?: string;
        state?: string;
        user?: {
            login?: string;
        };
        created_at?: string;
        updated_at?: string;
        labels?: Array<{
            name: string;
        }>;
        assignees?: Array<{
            login: string;
        }>;
        requested_reviewers?: Array<{
            login: string;
        }>;
    };
    check_suite?: {
        id?: number;
        status?: string;
        conclusion?: string;
        head_branch?: string;
    };
    check_run?: {
        id?: number;
        name?: string;
        status?: string;
        conclusion?: string;
    };
    sender?: {
        login?: string;
    };
    [key: string]: any;
}
/**
 * 映射到 Operator Task
 */
export interface MappedTask {
    taskId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    metadata: {
        source: 'github';
        sourceType: 'pr' | 'check';
        sourceId: string;
        owner: string;
        repo: string;
        prNumber?: number;
    };
}
/**
 * 映射到 Operator Approval
 */
export interface MappedApproval {
    approvalId: string;
    scope: string;
    reason: string;
    requestingAgent: string;
    metadata: {
        source: 'github';
        sourceType: 'pr_review' | 'pr_merge';
        sourceId: string;
        owner: string;
        repo: string;
        prNumber: number;
    };
}
/**
 * 映射到 Inbox Item
 */
export interface MappedInboxItem {
    itemType: 'task' | 'approval' | 'incident' | 'attention';
    sourceId: string;
    title: string;
    summary: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedActions: string[];
    metadata: Record<string, any>;
}
