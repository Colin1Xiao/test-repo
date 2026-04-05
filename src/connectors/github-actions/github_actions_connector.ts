/**
 * GitHub Actions Connector
 * Phase 2B-2 - GitHub Actions 连接器
 * 
 * 职责：
 * - 接收 GitHub Actions Webhook
 * - 调用 GitHub Actions API (rerun/cancel/approve deployment)
 */

import type { GitHubActionsEvent, WorkflowRunEvent, DeploymentEvent, DeploymentStatusEvent } from './github_actions_types';
import { GitHubApiClient } from '../github/shared/github_api_client';
import { GitHubWebhookVerifier } from '../github/shared/github_webhook_verifier';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubActionsConnectorConfig {
  apiToken?: string;
  webhookSecret?: string;
}

// ============================================================================
// Connector 接口
// ============================================================================

export interface GitHubActionsConnector {
  handleWebhook(payload: any, signature?: string): Promise<GitHubActionsEvent[]>;
  rerunWorkflow(owner: string, repo: string, runId: number): Promise<void>;
  cancelWorkflow(owner: string, repo: string, runId: number): Promise<void>;
  approveDeployment(owner: string, repo: string, deploymentId: number, description?: string): Promise<void>;
  rejectDeployment(owner: string, repo: string, deploymentId: number, reason?: string): Promise<void>;
}

// ============================================================================
// 实现
// ============================================================================

export class GitHubActionsConnectorImpl implements GitHubActionsConnector {
  private apiClient: GitHubApiClient;
  private webhookVerifier: GitHubWebhookVerifier;
  
  constructor(config: GitHubActionsConnectorConfig = {}) {
    this.apiClient = new GitHubApiClient({
      token: config.apiToken ?? process.env.GITHUB_TOKEN ?? '',
    });
    
    this.webhookVerifier = new GitHubWebhookVerifier({
      secret: config.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET ?? '',
    });
  }
  
  async handleWebhook(payload: any, signature?: string): Promise<GitHubActionsEvent[]> {
    const events: GitHubActionsEvent[] = [];
    const now = Date.now();
    
    // 解析事件类型
    const eventType = payload.workflow_run ? 'workflow_run'
      : payload.deployment ? 'deployment'
      : payload.deployment_status ? 'deployment_status'
      : payload.check_run ? 'check_run'
      : null;
    
    if (!eventType) {
      return events;
    }
    
    if (eventType === 'workflow_run') {
      const event: WorkflowRunEvent = {
        type: 'workflow_run',
        timestamp: now,
        action: payload.workflow_run.status as any,
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
        },
        workflow: {
          id: payload.workflow.id,
          name: payload.workflow.name,
          runId: payload.workflow_run.id,
          runNumber: payload.workflow_run.run_number,
          status: payload.workflow_run.status as any,
          conclusion: payload.workflow_run.conclusion as any,
          headBranch: payload.workflow_run.head_branch,
          headSha: payload.workflow_run.head_sha,
        },
        sender: {
          login: payload.sender.login,
        },
      };
      events.push(event);
    }
    
    if (eventType === 'deployment') {
      const event: DeploymentEvent = {
        type: 'deployment',
        timestamp: now,
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
        },
        deployment: {
          id: payload.deployment.id,
          environment: payload.deployment.environment,
          ref: payload.deployment.ref,
          task: payload.deployment.task,
          creator: {
            login: payload.deployment.creator.login,
          },
          description: payload.deployment.description,
          createdAt: payload.deployment.created_at,
          updatedAt: payload.deployment.updated_at,
        },
      };
      events.push(event);
    }
    
    if (eventType === 'deployment_status') {
      const event: DeploymentStatusEvent = {
        type: 'deployment_status',
        timestamp: now,
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
        },
        deployment: {
          id: payload.deployment.id,
          environment: payload.deployment.environment,
        },
        deploymentStatus: {
          id: payload.deployment_status.id,
          state: payload.deployment_status.state as any,
          description: payload.deployment_status.description,
          environmentUrl: payload.deployment_status.environment_url,
        },
      };
      events.push(event);
    }
    
    return events;
  }
  
  async rerunWorkflow(owner: string, repo: string, runId: number): Promise<void> {
    await this.apiClient.post(
      `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`
    );
  }
  
  async cancelWorkflow(owner: string, repo: string, runId: number): Promise<void> {
    await this.apiClient.post(
      `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`
    );
  }
  
  async approveDeployment(
    owner: string,
    repo: string,
    deploymentId: number,
    description?: string
  ): Promise<void> {
    // GitHub API: POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
    const path = `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`;
    console.log('[GitHubConnector] Approve Deployment:', { owner, repo, deploymentId, path });
    await this.apiClient.post(
      path,
      {
        state: 'success',
        description: description ?? 'Approved via OpenClaw Operator',
      }
    );
  }
  
  async rejectDeployment(
    owner: string,
    repo: string,
    deploymentId: number,
    reason?: string
  ): Promise<void> {
    // GitHub API: POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
    await this.apiClient.post(
      `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`,
      {
        state: 'failure',
        description: reason ?? 'Rejected via OpenClaw Operator',
      }
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubActionsConnector(config?: GitHubActionsConnectorConfig): GitHubActionsConnector {
  return new GitHubActionsConnectorImpl(config);
}
