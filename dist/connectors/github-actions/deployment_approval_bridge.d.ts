/**
 * Deployment Approval Bridge
 * Phase 2B-2 - 部署审批桥接
 *
 * 职责：
 * - 将 Operator Approval 动作回写到 GitHub Deployment
 * - approve → Approve Deployment
 * - reject → Reject Deployment
 */
import type { GitHubActionsConnector } from './github_actions_connector';
export interface DeploymentApprovalBridgeConfig {
    defaultApprovalComment?: string;
    autoApproveStaging?: boolean;
}
export declare class DeploymentApprovalBridge {
    private config;
    private githubConnector;
    constructor(githubConnector: GitHubActionsConnector, config?: DeploymentApprovalBridgeConfig);
    /**
     * 处理 Approve 动作
     */
    handleApprove(sourceId: string, deploymentId: number, actorId?: string, environment?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Reject 动作
     */
    handleReject(sourceId: string, deploymentId: number, actorId?: string, reason?: string, environment?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare function createDeploymentApprovalBridge(githubConnector: GitHubActionsConnector, config?: DeploymentApprovalBridgeConfig): DeploymentApprovalBridge;
