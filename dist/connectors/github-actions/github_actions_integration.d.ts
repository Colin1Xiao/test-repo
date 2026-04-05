/**
 * GitHub Actions Integration
 * Phase 2B-2-I - GitHub Actions 与 Operator 主链路集成
 *
 * 职责：
 * - 组装所有 GitHub Actions 相关组件
 * - 提供统一的初始化接口
 * - 导出集成的数据源和处理器
 */
import { GitHubActionsConnectorImpl } from './github_actions_connector';
import { DeploymentApprovalBridge } from './deployment_approval_bridge';
import { GitHubActionsApprovalDataSource } from '../../operator/data/github_actions_approval_data_source';
import { GitHubActionsIncidentDataSource } from '../../operator/data/github_actions_incident_data_source';
import { GitHubActionsEventHandler } from './github_actions_event_handler';
import { GitHubActionsOperatorBridge } from './github_actions_operator_bridge';
export interface GitHubActionsIntegrationConfig {
    /** GitHub API Token */
    githubToken?: string;
    /** Webhook Secret */
    webhookSecret?: string;
    /** 自动批准的环境列表 */
    autoApproveEnvironments?: string[];
    /** 忽略的 Workflow 列表 */
    ignoreWorkflows?: string[];
    /** 需要审批的环境列表 */
    requireApprovalForEnvironments?: string[];
    /** 详细日志 */
    verboseLogging?: boolean;
}
export interface GitHubActionsIntegrationResult {
    /** GitHub Actions Connector */
    connector: GitHubActionsConnectorImpl;
    /** 审批数据源 */
    approvalDataSource: GitHubActionsApprovalDataSource;
    /** 事件数据源 */
    incidentDataSource: GitHubActionsIncidentDataSource;
    /** 事件处理器 */
    eventHandler: GitHubActionsEventHandler;
    /** 审批桥接 */
    deploymentApprovalBridge: DeploymentApprovalBridge;
    /** Operator 桥接 */
    operatorBridge: GitHubActionsOperatorBridge;
}
export declare function initializeGitHubActionsIntegration(config?: GitHubActionsIntegrationConfig): GitHubActionsIntegrationResult;
/**
 * 创建 Webhook 处理器
 *
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const webhookHandler = createWebhookHandler(integration);
 *
 * // 在 HTTP 服务器中使用
 * app.post('/webhooks/github', async (req, res) => {
 *   const result = await webhookHandler(req.body, req.headers['x-hub-signature-256']);
 *   res.json(result);
 * });
 * ```
 */
export declare function createWebhookHandler(integration: GitHubActionsIntegrationResult): (payload: any, signature?: string) => Promise<{
    success: boolean;
    eventsProcessed: number;
    approvalsCreated: number;
    incidentsCreated: number;
    errors?: Array<{
        eventId: string;
        error: string;
    }>;
}>;
/**
 * 创建动作处理器
 *
 * 用法：
 * ```typescript
 * const integration = initializeGitHubActionsIntegration({ githubToken: '...' });
 * const actionHandler = createActionHandler(integration);
 *
 * // 在 Operator Action Handler 中使用
 * operatorActionHandler.on('approve', async (sourceId, actorId) => {
 *   return await actionHandler.handleApprove(sourceId, actorId);
 * });
 *
 * operatorActionHandler.on('reject', async (sourceId, actorId, reason) => {
 *   return await actionHandler.handleReject(sourceId, actorId, reason);
 * });
 * ```
 */
export declare function createActionHandler(integration: GitHubActionsIntegrationResult): {
    /**
     * 处理 Approve 动作
     */
    handleApprove(sourceId: string, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Reject 动作
     */
    handleReject(sourceId: string, actorId?: string, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 获取审批状态
     */
    getApprovalStatus(sourceId: string): Promise<{
        status: "pending" | "approved" | "rejected" | "cancelled" | null;
        approvalId?: string;
    }>;
};
export { GitHubActionsApprovalDataSource, GitHubActionsIncidentDataSource, GitHubActionsEventHandler, GitHubActionsOperatorBridge, } from './github_actions_integration';
