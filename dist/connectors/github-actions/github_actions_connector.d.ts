/**
 * GitHub Actions Connector
 * Phase 2B-2 - GitHub Actions 连接器
 *
 * 职责：
 * - 接收 GitHub Actions Webhook
 * - 调用 GitHub Actions API (rerun/cancel/approve deployment)
 */
import type { GitHubActionsEvent } from './github_actions_types';
export interface GitHubActionsConnectorConfig {
    apiToken?: string;
    webhookSecret?: string;
}
export interface GitHubActionsConnector {
    handleWebhook(payload: any, signature?: string): Promise<GitHubActionsEvent[]>;
    rerunWorkflow(owner: string, repo: string, runId: number): Promise<void>;
    cancelWorkflow(owner: string, repo: string, runId: number): Promise<void>;
    approveDeployment(owner: string, repo: string, deploymentId: number, description?: string): Promise<void>;
    rejectDeployment(owner: string, repo: string, deploymentId: number, reason?: string): Promise<void>;
}
export declare class GitHubActionsConnectorImpl implements GitHubActionsConnector {
    private apiClient;
    private webhookVerifier;
    constructor(config?: GitHubActionsConnectorConfig);
    handleWebhook(payload: any, signature?: string): Promise<GitHubActionsEvent[]>;
    rerunWorkflow(owner: string, repo: string, runId: number): Promise<void>;
    cancelWorkflow(owner: string, repo: string, runId: number): Promise<void>;
    approveDeployment(owner: string, repo: string, deploymentId: number, description?: string): Promise<void>;
    rejectDeployment(owner: string, repo: string, deploymentId: number, reason?: string): Promise<void>;
}
export declare function createGitHubActionsConnector(config?: GitHubActionsConnectorConfig): GitHubActionsConnector;
