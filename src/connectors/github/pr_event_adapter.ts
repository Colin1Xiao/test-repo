/**
 * PR Event Adapter
 * Phase 2B-1 - PR 事件适配器
 * 
 * 职责：
 * - 将 GitHub PR 事件转换为内部标准事件
 * - 映射 PR opened → task
 * - 映射 review requested → approval
 * - 映射 check failed → attention/incident
 */

import type { GitHubPREvent, GitHubCheckEvent, MappedTask, MappedApproval, MappedInboxItem } from './github_types';

// ============================================================================
// 配置
// ============================================================================

export interface PREventAdapterConfig {
  /** 自动为 PR 创建 Task */
  autoCreateTask?: boolean;
  
  /** 自动为 Review Request 创建 Approval */
  autoCreateApproval?: boolean;
  
  /** 自动为 Failed Check 创建 Attention */
  autoCreateAttention?: boolean;
  
  /** 默认优先级 */
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// PR Event Adapter
// ============================================================================

export class PREventAdapter {
  private config: Required<PREventAdapterConfig>;
  
  constructor(config: PREventAdapterConfig = {}) {
    this.config = {
      autoCreateTask: config.autoCreateTask ?? true,
      autoCreateApproval: config.autoCreateApproval ?? true,
      autoCreateAttention: config.autoCreateAttention ?? true,
      defaultPriority: config.defaultPriority ?? 'medium',
    };
  }
  
  /**
   * 适配 PR 事件
   */
  adaptPREvent(event: GitHubPREvent): {
    task?: MappedTask;
    approval?: MappedApproval;
    inboxItem?: MappedInboxItem;
  } {
    const result: any = {};
    
    // PR opened → Task
    if (event.action === 'opened' && this.config.autoCreateTask) {
      result.task = this.mapPRToTask(event);
    }
    
    // Review requested → Approval
    if (event.action === 'review_requested' && this.config.autoCreateApproval) {
      result.approval = this.mapReviewRequestToApproval(event);
    }
    
    // PR opened/reopened → Inbox Item
    if (['opened', 'reopened'].includes(event.action)) {
      result.inboxItem = this.mapPRToInboxItem(event);
    }
    
    return result;
  }
  
  /**
   * 适配 Check 事件
   */
  adaptCheckEvent(event: GitHubCheckEvent): {
    inboxItem?: MappedInboxItem;
  } {
    const result: any = {};
    
    // Check failed → Attention
    if (event.checkSuite.conclusion === 'failure' && this.config.autoCreateAttention) {
      result.inboxItem = this.mapFailedCheckToInboxItem(event);
    }
    
    return result;
  }
  
  // ============================================================================
  // 映射方法
  // ============================================================================
  
  private mapPRToTask(event: GitHubPREvent): MappedTask {
    const { repository, pullRequest } = event;
    
    return {
      taskId: `github_pr_${repository.owner}_${repository.name}_${pullRequest.number}`,
      title: `PR #${pullRequest.number}: ${pullRequest.title}`,
      description: `PR opened by ${pullRequest.user} in ${repository.owner}/${repository.name}`,
      priority: this.config.defaultPriority,
      metadata: {
        source: 'github',
        sourceType: 'pr',
        sourceId: `${repository.owner}/${repository.name}#${pullRequest.number}`,
        owner: repository.owner,
        repo: repository.name,
        prNumber: pullRequest.number,
      },
    };
  }
  
  private mapReviewRequestToApproval(event: GitHubPREvent): MappedApproval {
    const { repository, pullRequest, sender } = event;
    
    return {
      approvalId: `github_review_${repository.owner}_${repository.name}_${pullRequest.number}`,
      scope: `PR Review: ${pullRequest.title}`,
      reason: `Review requested for PR #${pullRequest.number} by ${sender.login}`,
      requestingAgent: sender.login,
      metadata: {
        source: 'github',
        sourceType: 'pr_review',
        sourceId: `${repository.owner}/${repository.name}#${pullRequest.number}`,
        owner: repository.owner,
        repo: repository.name,
        prNumber: pullRequest.number,
      },
    };
  }
  
  private mapPRToInboxItem(event: GitHubPREvent): MappedInboxItem {
    const { repository, pullRequest, action } = event;
    
    return {
      itemType: 'task',
      sourceId: `${repository.owner}/${repository.name}#${pullRequest.number}`,
      title: `PR #${pullRequest.number}: ${pullRequest.title}`,
      summary: `PR ${action} by ${pullRequest.user}`,
      severity: 'medium',
      suggestedActions: ['open'],
      metadata: {
        source: 'github',
        action,
        prNumber: pullRequest.number,
      },
    };
  }
  
  private mapFailedCheckToInboxItem(event: GitHubCheckEvent): MappedInboxItem {
    const { repository, checkSuite } = event;
    
    return {
      itemType: 'incident',
      sourceId: `${repository.owner}/${repository.name}/check/${checkSuite.id}`,
      title: `Check Failed: ${repository.name}/${checkSuite.headBranch}`,
      summary: `Check suite ${checkSuite.id} failed`,
      severity: 'high',
      suggestedActions: ['open', 'request_replay'],
      metadata: {
        source: 'github',
        checkSuiteId: checkSuite.id,
        branch: checkSuite.headBranch,
        conclusion: checkSuite.conclusion,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createPREventAdapter(config?: PREventAdapterConfig): PREventAdapter {
  return new PREventAdapter(config);
}
