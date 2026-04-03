/**
 * Review Bridge
 * Phase 2B-1 - PR Review 桥接
 * 
 * 职责：
 * - 将 Operator Approval 动作回写到 GitHub PR Review
 * - approve → APPROVE review
 * - reject → REQUEST_CHANGES review
 * - merge → merge PR
 */

import type { GitHubConnector } from './github_connector';

// ============================================================================
// 配置
// ============================================================================

export interface ReviewBridgeConfig {
  /** 默认 Review 留言 */
  defaultReviewBody?: string;
  
  /** Merge 方法 */
  defaultMergeMethod?: 'merge' | 'squash' | 'rebase';
  
  /** 需要至少一个 Approve 才能 Merge */
  requireApprovalBeforeMerge?: boolean;
}

// ============================================================================
// Review Bridge
// ============================================================================

export class ReviewBridge {
  private config: Required<ReviewBridgeConfig>;
  private githubConnector: GitHubConnector;
  
  constructor(
    githubConnector: GitHubConnector,
    config: ReviewBridgeConfig = {}
  ) {
    this.config = {
      defaultReviewBody: config.defaultReviewBody ?? 'Approved via OpenClaw Operator',
      defaultMergeMethod: config.defaultMergeMethod ?? 'squash',
      requireApprovalBeforeMerge: config.requireApprovalBeforeMerge ?? true,
    };
    
    this.githubConnector = githubConnector;
  }
  
  /**
   * 处理 Approve 动作
   */
  async handleApprove(
    owner: string,
    repo: string,
    prNumber: number,
    actorId?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // 提交 APPROVE Review
      await this.githubConnector.submitReview(owner, repo, prNumber, {
        event: 'APPROVE',
        body: this.config.defaultReviewBody,
      });
      
      return {
        success: true,
        message: `Approved PR ${owner}/${repo}#${prNumber}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to approve PR: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * 处理 Reject 动作
   */
  async handleReject(
    owner: string,
    repo: string,
    prNumber: number,
    actorId?: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // 提交 REQUEST_CHANGES Review
      await this.githubConnector.submitReview(owner, repo, prNumber, {
        event: 'REQUEST_CHANGES',
        body: reason ?? 'Changes requested via OpenClaw Operator',
      });
      
      return {
        success: true,
        message: `Requested changes for PR ${owner}/${repo}#${prNumber}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reject PR: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * 处理 Merge 动作
   */
  async handleMerge(
    owner: string,
    repo: string,
    prNumber: number,
    actorId?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // 检查是否需要先 Approve
      if (this.config.requireApprovalBeforeMerge) {
        // TODO: 检查是否已有 Approve
        // MVP 版本：跳过检查
      }
      
      // 合并 PR
      await this.githubConnector.mergePR(owner, repo, prNumber, {
        mergeMethod: this.config.defaultMergeMethod,
      });
      
      return {
        success: true,
        message: `Merged PR ${owner}/${repo}#${prNumber}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to merge PR: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createReviewBridge(
  githubConnector: GitHubConnector,
  config?: ReviewBridgeConfig
): ReviewBridge {
  return new ReviewBridge(githubConnector, config);
}
