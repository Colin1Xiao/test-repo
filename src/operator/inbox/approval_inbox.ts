/**
 * Approval Inbox
 * Phase 2A-2B - 审批收件箱聚合
 * 
 * 职责：
 * - 聚合 pending approvals
 * - 聚合 aged approvals
 * - 聚合 timeout-risk approvals
 * - 输出 InboxItem 列表
 */

import type { InboxItem, InboxSeverity, InboxItemStatus } from '../types/inbox_types';
import type { ApprovalDataSource } from '../data/approval_data_source';

// ============================================================================
// 配置
// ============================================================================

export interface ApprovalInboxConfig {
  /** 超时阈值（毫秒） */
  timeoutThresholdMs?: number;
  
  /** 老化阈值（毫秒） */
  agedThresholdMs?: number;
  
  /** 返回数量限制 */
  limit?: number;
}

// ============================================================================
// 审批收件箱
// ============================================================================

export class ApprovalInbox {
  private config: Required<ApprovalInboxConfig>;
  private approvalDataSource: ApprovalDataSource;
  
  constructor(
    approvalDataSource: ApprovalDataSource,
    config: ApprovalInboxConfig = {}
  ) {
    this.config = {
      timeoutThresholdMs: config.timeoutThresholdMs ?? 6 * 60 * 60 * 1000, // 6 小时
      agedThresholdMs: config.agedThresholdMs ?? 2 * 60 * 60 * 1000, // 2 小时
      limit: config.limit ?? 50,
    };
    
    this.approvalDataSource = approvalDataSource;
  }
  
  /**
   * 获取审批 Inbox 项
   */
  async getInboxItems(workspaceId?: string): Promise<InboxItem[]> {
    const approvalView = await this.approvalDataSource.getApprovalView();
    const now = Date.now();
    
    const items: InboxItem[] = [];
    
    // 待处理审批
    for (const approval of approvalView.pendingApprovals.slice(0, this.config.limit)) {
      const severity = this.calculateSeverity(approval, now);
      
      items.push({
        id: `approval_${approval.approvalId}`,
        itemType: 'approval',
        sourceId: approval.approvalId,
        workspaceId,
        title: `审批：${approval.scope}`,
        summary: approval.reason,
        severity,
        status: 'pending',
        owner: approval.requestingAgent,
        createdAt: approval.requestedAt,
        updatedAt: now,
        ageMs: approval.ageMs,
        suggestedActions: ['approve', 'reject', 'escalate'],
        metadata: {
          scope: approval.scope,
          ageMs: approval.ageMs,
          requestingAgent: approval.requestingAgent,
        },
      });
    }
    
    // 超时审批（如果不在 pending 中）
    for (const approval of approvalView.timeoutApprovals) {
      // 避免重复
      if (items.some(i => i.sourceId === approval.approvalId)) {
        continue;
      }
      
      items.push({
        id: `approval_${approval.approvalId}`,
        itemType: 'approval',
        sourceId: approval.approvalId,
        workspaceId,
        title: `超时审批：${approval.scope}`,
        summary: `已等待 ${this.formatAge(approval.ageMs)}`,
        severity: 'critical',
        status: 'pending',
        owner: approval.requestingAgent,
        createdAt: approval.requestedAt,
        updatedAt: now,
        ageMs: approval.ageMs,
        suggestedActions: ['approve', 'reject', 'escalate'],
        metadata: {
          scope: approval.scope,
          ageMs: approval.ageMs,
          timeout: true,
        },
      });
    }
    
    // 按严重级别和年龄排序
    return items.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return (b.ageMs || 0) - (a.ageMs || 0);
    });
  }
  
  /**
   * 获取摘要
   */
  async getSummary(workspaceId?: string): Promise<{
    pendingApprovals: number;
    agedApprovals: number;
    timeoutApprovals: number;
  }> {
    const approvalView = await this.approvalDataSource.getApprovalView();
    const now = Date.now();
    
    const pending = approvalView.pendingApprovals.length;
    const aged = approvalView.pendingApprovals.filter(a => a.ageMs > this.config.agedThresholdMs).length;
    const timeout = approvalView.timeoutApprovals.length;
    
    return {
      pendingApprovals: pending,
      agedApprovals: aged,
      timeoutApprovals: timeout,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private calculateSeverity(approval: any, now: number): InboxSeverity {
    const ageMs = approval.ageMs || (now - approval.requestedAt);
    
    // 超时 → critical
    if (ageMs > this.config.timeoutThresholdMs) {
      return 'critical';
    }
    
    // 老化 → high
    if (ageMs > this.config.agedThresholdMs) {
      return 'high';
    }
    
    // 正常 → medium
    return 'medium';
  }
  
  private formatAge(ageMs: number): string {
    const hours = Math.floor(ageMs / (60 * 60 * 1000));
    const minutes = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createApprovalInbox(
  approvalDataSource: ApprovalDataSource,
  config?: ApprovalInboxConfig
): ApprovalInbox {
  return new ApprovalInbox(approvalDataSource, config);
}
