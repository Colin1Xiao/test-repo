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

// ============================================================================
// 配置
// ============================================================================

export interface DeploymentApprovalBridgeConfig {
  defaultApprovalComment?: string;
  autoApproveStaging?: boolean;
}

// ============================================================================
// Deployment Approval Bridge
// ============================================================================

export class DeploymentApprovalBridge {
  private config: Required<DeploymentApprovalBridgeConfig>;
  private githubConnector: GitHubActionsConnector;
  
  constructor(
    githubConnector: GitHubActionsConnector,
    config: DeploymentApprovalBridgeConfig = {}
  ) {
    this.config = {
      defaultApprovalComment: config.defaultApprovalComment ?? 'Approved via OpenClaw Operator',
      autoApproveStaging: config.autoApproveStaging ?? false,
    };
    
    this.githubConnector = githubConnector;
  }
  
  /**
   * 处理 Approve 动作
   */
  async handleApprove(
    sourceId: string,
    deploymentId: number,
    actorId?: string,
    environment?: string
  ): Promise<{ success: boolean; message: string }> {
    // 解析 sourceId (格式：owner/repo/deployments/id)
    const match = sourceId.match(/^(.+)\/(.+)\/deployments\/(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const [, owner, repo] = match;
    
    try {
      // 调用 GitHub API 批准部署
      await this.githubConnector.approveDeployment(
        owner,
        repo,
        deploymentId,
        this.config.defaultApprovalComment
      );
      
      return {
        success: true,
        message: `Approved deployment to ${environment ?? 'unknown'}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to approve deployment: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * 处理 Reject 动作
   */
  async handleReject(
    sourceId: string,
    deploymentId: number,
    actorId?: string,
    reason?: string,
    environment?: string
  ): Promise<{ success: boolean; message: string }> {
    // 解析 sourceId
    const match = sourceId.match(/^(.+)\/(.+)\/deployments\/(\d+)$/);
    if (!match) {
      return { success: false, message: 'Invalid sourceId format' };
    }
    
    const [, owner, repo] = match;
    
    try {
      // 调用 GitHub API 拒绝部署
      await this.githubConnector.rejectDeployment(
        owner,
        repo,
        deploymentId,
        reason ?? 'Rejected via OpenClaw Operator'
      );
      
      return {
        success: true,
        message: `Rejected deployment to ${environment ?? 'unknown'}: ${reason ?? 'No reason provided'}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reject deployment: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createDeploymentApprovalBridge(
  githubConnector: GitHubActionsConnector,
  config?: DeploymentApprovalBridgeConfig
): DeploymentApprovalBridge {
  return new DeploymentApprovalBridge(githubConnector, config);
}
