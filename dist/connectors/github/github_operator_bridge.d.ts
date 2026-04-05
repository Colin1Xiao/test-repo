/**
 * GitHub Operator Bridge
 * Phase 2B-1-I - GitHub Connector 集成桥接
 *
 * 职责：
 * - 将 GitHub 事件写入 Operator 数据面
 * - PR opened → TaskDataSource + Inbox
 * - Review requested → ApprovalDataSource
 * - Check failed → IncidentDataSource
 * - 动作后状态同步回写
 */
import type { GitHubPREvent, GitHubCheckEvent } from './github_types';
import type { TaskDataSource } from '../../operator/data/task_data_source';
import type { ApprovalDataSource } from '../../operator/data/approval_data_source';
import type { IncidentDataSource } from '../../operator/data/incident_data_source';
import type { PREventAdapter } from './pr_event_adapter';
import type { PRTaskMapper } from './pr_task_mapper';
import type { CheckStatusAdapter } from './check_status_adapter';
export interface GitHubOperatorBridgeConfig {
    /** 默认 Workspace ID */
    defaultWorkspaceId?: string;
    /** 自动创建 Task */
    autoCreateTask?: boolean;
    /** 自动创建 Approval */
    autoCreateApproval?: boolean;
    /** 自动创建 Incident */
    autoCreateIncident?: boolean;
}
export declare class GitHubOperatorBridge {
    private config;
    private taskDataSource;
    private approvalDataSource;
    private incidentDataSource;
    private prEventAdapter;
    private prTaskMapper;
    private checkStatusAdapter;
    constructor(taskDataSource: TaskDataSource, approvalDataSource: ApprovalDataSource, incidentDataSource: IncidentDataSource, prEventAdapter: PREventAdapter, prTaskMapper: PRTaskMapper, checkStatusAdapter: CheckStatusAdapter, config?: GitHubOperatorBridgeConfig);
    /**
     * 处理 GitHub PR 事件
     */
    handlePREvent(event: GitHubPREvent, workspaceId?: string): Promise<{
        taskCreated?: boolean;
        approvalCreated?: boolean;
        inboxItemCreated?: boolean;
    }>;
    /**
     * 处理 GitHub Check 事件
     */
    handleCheckEvent(event: GitHubCheckEvent, workspaceId?: string): Promise<{
        incidentCreated?: boolean;
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
export declare function createGitHubOperatorBridge(taskDataSource: TaskDataSource, approvalDataSource: ApprovalDataSource, incidentDataSource: IncidentDataSource, prEventAdapter: PREventAdapter, prTaskMapper: PRTaskMapper, checkStatusAdapter: CheckStatusAdapter, config?: GitHubOperatorBridgeConfig): GitHubOperatorBridge;
