/**
 * Job Status Adapter
 * Phase 2B-2 - Job/Check 状态适配器（轻量版）
 * 
 * 职责：
 * - 将 failed check/job → Attention/Incident
 */

import type { CheckRunEvent, MappedActionsInboxItem } from './github_actions_types';

// ============================================================================
// 配置
// ============================================================================

export interface JobStatusAdapterConfig {
  autoCreateAttention?: boolean;
  failedJobSeverity?: 'low' | 'medium' | 'high' | 'critical';
  ignoreJobs?: string[];
}

// ============================================================================
// Job Status Adapter
// ============================================================================

export class JobStatusAdapter {
  private config: Required<JobStatusAdapterConfig>;
  
  constructor(config: JobStatusAdapterConfig = {}) {
    this.config = {
      autoCreateAttention: config.autoCreateAttention ?? true,
      failedJobSeverity: config.failedJobSeverity ?? 'medium',
      ignoreJobs: config.ignoreJobs ?? [],
    };
  }
  
  /**
   * 适配 Check Run 事件
   */
  adaptCheckRunEvent(event: CheckRunEvent): {
    inboxItem?: MappedActionsInboxItem;
  } {
    const result: any = {};
    
    // 检查是否忽略该 Job
    if (this.config.ignoreJobs.includes(event.checkRun.name)) {
      return result;
    }
    
    // check_run completed(failure) → Attention
    if (event.action === 'completed' && event.checkRun.conclusion === 'failure') {
      if (this.config.autoCreateAttention) {
        result.inboxItem = this.mapFailedCheckToInboxItem(event);
      }
    }
    
    return result;
  }
  
  // ============================================================================
  // 映射方法
  // ============================================================================
  
  private mapFailedCheckToInboxItem(event: CheckRunEvent): MappedActionsInboxItem {
    return {
      itemType: 'attention',
      sourceId: `${event.repository.fullName}/check-runs/${event.checkRun.id}`,
      title: `Check Failed: ${event.checkRun.name}`,
      summary: `Check ${event.checkRun.name} failed on ${event.checkRun.headSha.slice(0, 7)}`,
      severity: this.config.failedJobSeverity,
      suggestedActions: ['rerun_workflow', 'open'],
      metadata: {
        source: 'github_actions',
        checkRunId: event.checkRun.id,
        checkName: event.checkRun.name,
        headSha: event.checkRun.headSha,
        conclusion: event.checkRun.conclusion,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createJobStatusAdapter(config?: JobStatusAdapterConfig): JobStatusAdapter {
  return new JobStatusAdapter(config);
}
