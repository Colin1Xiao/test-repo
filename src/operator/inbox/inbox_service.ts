/**
 * Inbox Service
 * Phase 2A-2B - 统一收件箱服务
 * 
 * 职责：
 * - 聚合 ApprovalInbox / IncidentCenter / TaskCenter / AttentionInbox
 * - 输出统一 InboxSnapshot
 * - 支持过滤和排序
 */

import type {
  InboxItem,
  InboxSnapshot,
  InboxSummary,
  InboxService as InboxServiceInterface,
  InboxConfig,
  InboxItemType,
  InboxSeverity,
} from '../types/inbox_types';
import { ApprovalInbox } from './approval_inbox';
import { IncidentCenter } from './incident_center';
import { TaskCenter } from './task_center';
import { AttentionInbox } from './attention_inbox';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';

// ============================================================================
// 依赖
// ============================================================================

export interface InboxServiceDependencies {
  approvalInbox: ApprovalInbox;
  incidentCenter: IncidentCenter;
  taskCenter: TaskCenter;
  attentionInbox: AttentionInbox;
}

// ============================================================================
// 统一 Inbox 服务
// ============================================================================

export class InboxService implements InboxServiceInterface {
  private config: Required<InboxConfig>;
  private dependencies: InboxServiceDependencies;
  
  constructor(
    dependencies: InboxServiceDependencies,
    config: InboxConfig = {}
  ) {
    this.config = {
      defaultSort: config.defaultSort ?? 'severity',
      defaultLimit: config.defaultLimit ?? 50,
      severityWeights: config.severityWeights ?? {
        critical: 100,
        high: 50,
        medium: 20,
        low: 10,
      },
      ageThresholds: config.ageThresholds ?? {
        agedApprovalMs: 2 * 60 * 60 * 1000,
        agedIncidentMs: 30 * 60 * 1000,
        agedTaskMs: 60 * 60 * 1000,
      },
    };
    
    this.dependencies = dependencies;
  }
  
  /**
   * 获取 Inbox 快照
   */
  async getInboxSnapshot(workspaceId?: string): Promise<InboxSnapshot> {
    const now = Date.now();
    
    // 并行获取所有 inbox 项
    const [approvalItems, incidentItems, taskItems] = await Promise.all([
      this.dependencies.approvalInbox.getInboxItems(workspaceId),
      this.dependencies.incidentCenter.getInboxItems(workspaceId),
      this.dependencies.taskCenter.getInboxItems(workspaceId),
    ]);
    
    // 合并所有项
    const allItems = this.dependencies.attentionInbox.mergeItems(
      approvalItems,
      incidentItems,
      taskItems
    );
    
    // 应用限制
    const limitedItems = allItems.slice(0, this.config.defaultLimit);
    
    // 计算摘要
    const summary = this.calculateSummary(approvalItems, incidentItems, taskItems);
    
    return {
      snapshotId: `inbox_${workspaceId || 'default'}_${now}`,
      workspaceId,
      generatedAt: now,
      items: limitedItems,
      summary,
      sort: this.config.defaultSort,
    };
  }
  
  /**
   * 获取 Inbox 项（按 ID）
   */
  async getInboxItem(itemId: string): Promise<InboxItem | null> {
    const snapshot = await this.getInboxSnapshot();
    return snapshot.items.find(i => i.id === itemId) || null;
  }
  
  /**
   * 获取摘要
   */
  async getInboxSummary(workspaceId?: string): Promise<InboxSummary> {
    const [approvalSummary, incidentSummary, taskSummary] = await Promise.all([
      this.dependencies.approvalInbox.getSummary(workspaceId),
      this.dependencies.incidentCenter.getSummary(workspaceId),
      this.dependencies.taskCenter.getSummary(workspaceId),
    ]);
    
    const pendingApprovals = approvalSummary.pendingApprovals;
    const openIncidents = incidentSummary.activeIncidents;
    const blockedTasks = taskSummary.blockedTasks;
    
    // 计算紧急项
    const criticalCount =
      approvalSummary.timeoutApprovals +
      incidentSummary.criticalCount;
    
    const highPriorityCount =
      approvalSummary.agedApprovals +
      incidentSummary.unacknowledgedIncidents +
      taskSummary.failedTasks;
    
    return {
      pendingApprovals,
      openIncidents,
      blockedTasks,
      pendingInterventions: 0, // TODO: 从 HumanLoop 获取
      criticalCount,
      highPriorityCount,
      totalCount: pendingApprovals + openIncidents + blockedTasks,
    };
  }
  
  /**
   * 获取待处理项（按严重级别排序）
   */
  async getPendingItems(workspaceId?: string, limit?: number): Promise<InboxItem[]> {
    const snapshot = await this.getInboxSnapshot(workspaceId);
    return snapshot.items.slice(0, limit ?? this.config.defaultLimit);
  }
  
  /**
   * 获取紧急项（critical + high）
   */
  async getUrgentItems(workspaceId?: string, limit?: number): Promise<InboxItem[]> {
    const snapshot = await this.getInboxSnapshot(workspaceId);
    
    const urgentItems = snapshot.items.filter(
      item => item.severity === 'critical' || item.severity === 'high'
    );
    
    return urgentItems.slice(0, limit ?? this.config.defaultLimit);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private calculateSummary(
    approvalItems: InboxItem[],
    incidentItems: InboxItem[],
    taskItems: InboxItem[]
  ): InboxSummary {
    const pendingApprovals = approvalItems.filter(i => i.status === 'pending').length;
    const openIncidents = incidentItems.filter(i => i.status === 'active' || i.status === 'acknowledged').length;
    const blockedTasks = taskItems.filter(i => i.status === 'blocked' || i.status === 'failed').length;
    
    const criticalCount = [
      ...approvalItems,
      ...incidentItems,
      ...taskItems,
    ].filter(i => i.severity === 'critical').length;
    
    const highPriorityCount = [
      ...approvalItems,
      ...incidentItems,
      ...taskItems,
    ].filter(i => i.severity === 'critical' || i.severity === 'high').length;
    
    return {
      pendingApprovals,
      openIncidents,
      blockedTasks,
      pendingInterventions: 0,
      criticalCount,
      highPriorityCount,
      totalCount: pendingApprovals + openIncidents + blockedTasks,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createInboxService(
  dependencies: InboxServiceDependencies,
  config?: InboxConfig
): InboxService {
  return new InboxService(dependencies, config);
}
