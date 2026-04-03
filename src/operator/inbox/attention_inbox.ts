/**
 * Attention Inbox
 * Phase 2A-2B - 关注项收件箱聚合
 * 
 * 职责：
 * - 聚合 dashboard attention items
 * - 聚合 human loop interventions
 * - 聚合 high-severity recommendations
 * - 输出 InboxItem 列表
 */

import type { InboxItem, InboxSeverity } from '../types/inbox_types';
import type { DashboardSnapshot, AttentionItem } from '../ux/dashboard_types';
import type { HumanLoopSnapshot, InterventionItem } from '../ux/hitl_types';

// ============================================================================
// 配置
// ============================================================================

export interface AttentionInboxConfig {
  /** 返回数量限制 */
  limit?: number;
}

// ============================================================================
// 关注项收件箱
// ============================================================================

export class AttentionInbox {
  private config: Required<AttentionInboxConfig>;
  
  constructor(config: AttentionInboxConfig = {}) {
    this.config = {
      limit: config.limit ?? 50,
    };
  }
  
  /**
   * 从 Dashboard 获取关注项
   */
  async getFromDashboard(dashboard: DashboardSnapshot, workspaceId?: string): Promise<InboxItem[]> {
    const items: InboxItem[] = [];
    
    for (const attention of dashboard.attentionItems.slice(0, this.config.limit)) {
      items.push(this.toInboxItem(attention, workspaceId));
    }
    
    return items;
  }
  
  /**
   * 从 HumanLoop 获取介入项
   */
  async getFromHumanLoop(humanLoop: HumanLoopSnapshot, workspaceId?: string): Promise<InboxItem[]> {
    const items: InboxItem[] = [];
    const now = Date.now();
    
    for (const intervention of humanLoop.openInterventions.slice(0, this.config.limit)) {
      items.push(this.interventionToInboxItem(intervention, workspaceId, now));
    }
    
    return items;
  }
  
  /**
   * 合并并去重
   */
  mergeItems(...itemArrays: InboxItem[][]): InboxItem[] {
    const allItems = itemArrays.flat();
    
    // 去重（按 sourceId + itemType）
    const uniqueMap = new Map<string, InboxItem>();
    
    for (const item of allItems) {
      const key = `${item.itemType}:${item.sourceId}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        // 保留严重级别更高的
        const existing = uniqueMap.get(key)!;
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (severityOrder[item.severity] < severityOrder[existing.severity]) {
          uniqueMap.set(key, item);
        }
      }
    }
    
    // 按严重级别和年龄排序
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return (b.ageMs || 0) - (a.ageMs || 0);
    });
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private toInboxItem(attention: AttentionItem, workspaceId?: string): InboxItem {
    const now = Date.now();
    
    return {
      id: `attention_${attention.sourceType}_${attention.sourceId}`,
      itemType: 'attention',
      sourceId: attention.sourceId,
      workspaceId,
      title: attention.title,
      summary: attention.reason,
      severity: attention.severity,
      status: 'active',
      createdAt: now - (attention.ageMs || 0),
      updatedAt: now,
      ageMs: attention.ageMs,
      suggestedActions: attention.recommendedAction ? [attention.recommendedAction.type] : undefined,
      metadata: {
        sourceType: attention.sourceType,
      },
    };
  }
  
  private interventionToInboxItem(
    intervention: InterventionItem,
    workspaceId?: string,
    now: number = Date.now()
  ): InboxItem {
    return {
      id: `intervention_${intervention.id}`,
      itemType: 'intervention',
      sourceId: intervention.sourceId,
      workspaceId,
      title: intervention.title,
      summary: intervention.reason,
      severity: intervention.severity as InboxSeverity,
      status: intervention.status as any,
      owner: intervention.sourceType,
      createdAt: intervention.createdAt,
      updatedAt: intervention.updatedAt || now,
      ageMs: now - intervention.createdAt,
      suggestedActions: ['dismiss_intervention', 'snooze_intervention'],
      metadata: {
        sourceType: intervention.sourceType,
        sourceId: intervention.sourceId,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createAttentionInbox(config?: AttentionInboxConfig): AttentionInbox {
  return new AttentionInbox(config);
}
