/**
 * GitHub Actions Event Handler
 * Phase 2B-2-I - GitHub Actions 事件处理器
 *
 * 职责：
 * - 接收 GitHubActionsConnector 的事件
 * - 分发到对应的数据源（Approval / Incident）
 * - 支持事件过滤和日志记录
 */
import type { GitHubActionsEvent } from './github_actions_types';
import type { GitHubActionsApprovalDataSource } from '../../operator/data/github_actions_approval_data_source';
import type { GitHubActionsIncidentDataSource } from '../../operator/data/github_actions_incident_data_source';
import type { WorkflowEventAdapter } from './workflow_event_adapter';
export interface GitHubActionsEventHandlerConfig {
    /** 是否记录详细日志 */
    verboseLogging?: boolean;
    /** 是否启用自动创建审批 */
    autoCreateApproval?: boolean;
    /** 是否启用自动创建事件 */
    autoCreateIncident?: boolean;
    /** 是否启用自动创建 Attention */
    autoCreateAttention?: boolean;
}
export interface EventHandlerResult {
    /** 处理的事件总数 */
    totalEvents: number;
    /** 创建的审批数 */
    approvalsCreated: number;
    /** 创建的事件数 */
    incidentsCreated: number;
    /** 忽略的事件数 */
    ignored: number;
    /** 错误列表 */
    errors: Array<{
        eventId: string;
        error: string;
    }>;
}
export declare class GitHubActionsEventHandler {
    private config;
    private approvalDataSource;
    private incidentDataSource;
    private workflowEventAdapter;
    constructor(approvalDataSource: GitHubActionsApprovalDataSource, incidentDataSource: GitHubActionsIncidentDataSource, workflowEventAdapter: WorkflowEventAdapter, config?: GitHubActionsEventHandlerConfig);
    /**
     * 处理单个事件
     */
    handleEvent(event: GitHubActionsEvent): Promise<{
        success: boolean;
        approvalCreated?: boolean;
        incidentCreated?: boolean;
        ignored?: boolean;
        error?: string;
    }>;
    /**
     * 批量处理事件
     */
    handleEvents(events: GitHubActionsEvent[]): Promise<EventHandlerResult>;
    /**
     * 处理 Deployment 事件
     */
    private handleDeploymentEvent;
    /**
     * 处理 Workflow Run 事件
     */
    private handleWorkflowRunEvent;
    /**
     * 处理 Deployment Status 事件
     */
    private handleDeploymentStatusEvent;
}
export declare function createGitHubActionsEventHandler(approvalDataSource: GitHubActionsApprovalDataSource, incidentDataSource: GitHubActionsIncidentDataSource, workflowEventAdapter: WorkflowEventAdapter, config?: GitHubActionsEventHandlerConfig): GitHubActionsEventHandler;
