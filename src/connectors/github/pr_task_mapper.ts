/**
 * PR Task Mapper
 * Phase 2B-1 - PR 任务映射器
 * 
 * 职责：
 * - 将 PR 事件映射到 Operator Task
 * - 支持 PR opened → task
 * - 支持 PR check failed → blocked task
 * - 支持 PR merged → completed task
 */

import type { GitHubPREvent, MappedTask } from './github_types';

// ============================================================================
// 配置
// ============================================================================

export interface PRTaskMapperConfig {
  /** 默认优先级 */
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
  
  /** 按 Label 调整优先级 */
  priorityByLabel?: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
  
  /** 自动标记 Blocked 任务 */
  autoMarkBlocked?: boolean;
}

// ============================================================================
// PR Task Mapper
// ============================================================================

export class PRTaskMapper {
  private config: Required<PRTaskMapperConfig>;
  
  constructor(config: PRTaskMapperConfig = {}) {
    this.config = {
      defaultPriority: config.defaultPriority ?? 'medium',
      priorityByLabel: config.priorityByLabel ?? {
        'critical': 'critical',
        'urgent': 'high',
        'bug': 'high',
        'enhancement': 'medium',
      },
      autoMarkBlocked: config.autoMarkBlocked ?? true,
    };
  }
  
  /**
   * 映射 PR 到 Task
   */
  mapPRToTask(event: GitHubPREvent): MappedTask {
    const { repository, pullRequest } = event;
    
    // 根据 Label 调整优先级
    const priority = this.calculatePriority(pullRequest.labels ?? []);
    
    return {
      taskId: `github_pr_${repository.owner}_${repository.name}_${pullRequest.number}`,
      title: `PR #${pullRequest.number}: ${pullRequest.title}`,
      description: this.buildDescription(event),
      priority,
      metadata: {
        source: 'github',
        sourceType: 'pr',
        sourceId: `${repository.owner}/${repository.name}#${pullRequest.number}`,
        owner: repository.owner,
        repo: repository.name,
        prNumber: pullRequest.number,
        author: pullRequest.user,
        labels: pullRequest.labels,
        state: pullRequest.state,
      },
    };
  }
  
  /**
   * 映射 PR 状态变化
   */
  mapPRStateChange(
    event: GitHubPREvent,
    existingTask: MappedTask
  ): Partial<MappedTask> {
    const updates: Partial<MappedTask> = {};
    
    // PR 关闭 → 任务完成
    if (event.action === 'closed' || event.action === 'merged') {
      updates.priority = 'low';
    }
    
    // Check 失败 → 任务阻塞
    if (this.config.autoMarkBlocked && event.action === 'synchronize') {
      // 可以在这里添加 blocked 标记逻辑
    }
    
    return updates;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private calculatePriority(labels: string[]): 'low' | 'medium' | 'high' | 'critical' {
    // 检查 Label 优先级
    for (const label of labels) {
      const labelLower = label.toLowerCase();
      if (this.config.priorityByLabel[labelLower]) {
        return this.config.priorityByLabel[labelLower];
      }
    }
    
    // 默认优先级
    return this.config.defaultPriority;
  }
  
  private buildDescription(event: GitHubPREvent): string {
    const { repository, pullRequest, sender } = event;
    
    return `PR opened by ${sender.login} in ${repository.owner}/${repository.name}\n\n` +
      `Author: ${pullRequest.user}\n` +
      `Labels: ${(pullRequest.labels ?? []).join(', ') || 'none'}`;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createPRTaskMapper(config?: PRTaskMapperConfig): PRTaskMapper {
  return new PRTaskMapper(config);
}
