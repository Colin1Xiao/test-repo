/**
 * Check Status Adapter
 * Phase 2B-1 - Check 状态适配器
 * 
 * 职责：
 * - 将 GitHub Check 状态映射到 Operator 语义
 * - success → task completed
 * - failure → incident / attention
 * - in_progress → task running
 */

import type { GitHubCheckEvent, MappedInboxItem } from './github_types';

// ============================================================================
// 配置
// ============================================================================

export interface CheckStatusAdapterConfig {
  /** 自动为 Failed Check 创建 Attention */
  autoCreateAttention?: boolean;
  
  /** Failed Check 的严重级别 */
  failedCheckSeverity?: 'low' | 'medium' | 'high' | 'critical';
  
  /** 忽略的 Check 名称模式 */
  ignoreCheckPatterns?: string[];
}

// ============================================================================
// Check Status Adapter
// ============================================================================

export class CheckStatusAdapter {
  private config: Required<CheckStatusAdapterConfig>;
  
  constructor(config: CheckStatusAdapterConfig = {}) {
    this.config = {
      autoCreateAttention: config.autoCreateAttention ?? true,
      failedCheckSeverity: config.failedCheckSeverity ?? 'high',
      ignoreCheckPatterns: config.ignoreCheckPatterns ?? [],
    };
  }
  
  /**
   * 适配 Check 事件
   */
  adaptCheckEvent(event: GitHubCheckEvent): {
    inboxItem?: MappedInboxItem;
    status: 'success' | 'failure' | 'in_progress' | 'queued';
  } {
    const status = this.mapCheckStatus(event.checkSuite.status, event.checkSuite.conclusion);
    
    const result: any = { status };
    
    // Failed Check → Attention
    if (status === 'failure' && this.config.autoCreateAttention) {
      if (!this.shouldIgnore(event)) {
        result.inboxItem = this.mapFailedCheckToInboxItem(event);
      }
    }
    
    return result;
  }
  
  /**
   * 映射 Check 状态
   */
  mapCheckStatus(
    status: string,
    conclusion: string | null
  ): 'success' | 'failure' | 'in_progress' | 'queued' {
    if (status === 'completed') {
      if (conclusion === 'success') return 'success';
      if (conclusion === 'failure') return 'failure';
      if (conclusion === 'cancelled') return 'failure';
      if (conclusion === 'timed_out') return 'failure';
      return 'success'; // 默认
    }
    
    if (status === 'in_progress') return 'in_progress';
    return 'queued';
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private shouldIgnore(event: GitHubCheckEvent): boolean {
    const branch = event.checkSuite.headBranch;
    
    for (const pattern of this.config.ignoreCheckPatterns) {
      if (branch.match(new RegExp(pattern))) {
        return true;
      }
    }
    
    return false;
  }
  
  private mapFailedCheckToInboxItem(event: GitHubCheckEvent): MappedInboxItem {
    const { repository, checkSuite } = event;
    
    return {
      itemType: 'incident',
      sourceId: `${repository.owner}/${repository.name}/check/${checkSuite.id}`,
      title: `Check Failed: ${repository.name}/${checkSuite.headBranch}`,
      summary: `Check suite ${checkSuite.id} ${checkSuite.conclusion}`,
      severity: this.config.failedCheckSeverity,
      suggestedActions: ['open', 'request_replay'],
      metadata: {
        source: 'github',
        checkSuiteId: checkSuite.id,
        branch: checkSuite.headBranch,
        conclusion: checkSuite.conclusion,
        status: checkSuite.status,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCheckStatusAdapter(config?: CheckStatusAdapterConfig): CheckStatusAdapter {
  return new CheckStatusAdapter(config);
}
