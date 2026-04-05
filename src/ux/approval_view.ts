/**
 * Approval View - 审批视图
 * 
 * 职责：
 * 1. 从 ApprovalBridge / AuditLog 生成审批视图
 * 2. 显示 pending approvals、超时审批、瓶颈审批
 * 3. 暴露 approve / reject / escalate 等控制动作
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  ApprovalViewModel,
  ApprovalView,
  ApprovalStatus,
  ViewFilter,
  ViewSort,
  ControlAction,
  ControlActionResult,
} from './control_types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 审批数据源
 */
export interface ApprovalDataSource {
  /** 获取待处理审批 */
  listPending(): Promise<any[]>;
  
  /** 获取审批历史 */
  listHistory(limit?: number): Promise<any[]>;
  
  /** 批准审批 */
  approve(approvalId: string, reason?: string): Promise<void>;
  
  /** 拒绝审批 */
  reject(approvalId: string, reason?: string): Promise<void>;
  
  /** 升级审批 */
  escalate(approvalId: string, reason?: string): Promise<void>;
}

/**
 * 审批视图构建器配置
 */
export interface ApprovalViewBuilderConfig {
  /** 最大待处理审批数 */
  maxPendingApprovals?: number;
  
  /** 超时阈值（毫秒） */
  timeoutThresholdMs?: number;
  
  /** 最近决定审批数 */
  recentDecidedCount?: number;
}

// ============================================================================
// 审批视图构建器
// ============================================================================

export class ApprovalViewBuilder {
  private config: Required<ApprovalViewBuilderConfig>;
  private approvalDataSource: ApprovalDataSource;
  
  constructor(
    approvalDataSource: ApprovalDataSource,
    config: ApprovalViewBuilderConfig = {}
  ) {
    this.config = {
      maxPendingApprovals: config.maxPendingApprovals ?? 50,
      timeoutThresholdMs: config.timeoutThresholdMs ?? 60 * 60 * 1000, // 1 小时
      recentDecidedCount: config.recentDecidedCount ?? 20,
    };
    this.approvalDataSource = approvalDataSource;
  }
  
  /**
   * 构建审批视图
   */
  async buildApprovalView(filter?: ViewFilter): Promise<ApprovalView> {
    // 获取待处理审批
    const pendingApprovals = await this.approvalDataSource.listPending();
    
    // 转换为视图模型
    const pendingViewModels = pendingApprovals.map(approval =>
      this.approvalToViewModel(approval)
    );
    
    // 过滤
    const filteredPending = this.filterApprovals(pendingViewModels, filter);
    
    // 限制数量
    const limitedPending = filteredPending.slice(0, this.config.maxPendingApprovals);
    
    // 识别超时审批
    const timeoutApprovals = limitedPending.filter(a =>
      a.ageMs > this.config.timeoutThresholdMs
    );
    
    // 获取审批瓶颈
    const bottlenecks = this.analyzeBottlenecks(limitedPending);
    
    // 获取最近决定的审批
    const history = await this.approvalDataSource.listHistory(this.config.recentDecidedCount);
    const recentDecided = history.map(approval => this.approvalToViewModel(approval));
    
    // 计算审批流摘要
    const flowSummary = this.calculateFlowSummary(history);
    
    return {
      pendingApprovals: limitedPending,
      bottlenecks,
      timeoutApprovals,
      recentDecidedApprovals: recentDecided,
      totalApprovals: pendingApprovals.length,
      flowSummary,
    };
  }
  
  /**
   * 列出待处理审批
   */
  async listPendingApprovals(filter?: ViewFilter): Promise<ApprovalViewModel[]> {
    const view = await this.buildApprovalView(filter);
    return view.pendingApprovals;
  }
  
  /**
   * 列出审批瓶颈
   */
  async listApprovalBottlenecks(): Promise<ApprovalView['bottlenecks']> {
    const view = await this.buildApprovalView();
    return view.bottlenecks;
  }
  
  /**
   * 总结审批流
   */
  async summarizeApprovalFlow(): Promise<ApprovalView['flowSummary']> {
    const view = await this.buildApprovalView();
    return view.flowSummary;
  }
  
  /**
   * 批准审批
   */
  async approve(approvalId: string, reason?: string): Promise<ControlActionResult> {
    try {
      await this.approvalDataSource.approve(approvalId, reason);
      
      return {
        success: true,
        actionType: 'approve',
        targetId: approvalId,
        message: `Approval ${approvalId} approved`,
        nextActions: ['escalate_approval'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'approve',
        targetId: approvalId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 拒绝审批
   */
  async reject(approvalId: string, reason?: string): Promise<ControlActionResult> {
    try {
      await this.approvalDataSource.reject(approvalId, reason);
      
      return {
        success: true,
        actionType: 'reject',
        targetId: approvalId,
        message: `Approval ${approvalId} rejected`,
        nextActions: [],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'reject',
        targetId: approvalId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 升级审批
   */
  async escalate(approvalId: string, reason?: string): Promise<ControlActionResult> {
    try {
      await this.approvalDataSource.escalate(approvalId, reason);
      
      return {
        success: true,
        actionType: 'escalate_approval',
        targetId: approvalId,
        message: `Approval ${approvalId} escalated`,
        nextActions: ['approve', 'reject'],
      };
    } catch (error) {
      return {
        success: false,
        actionType: 'escalate_approval',
        targetId: approvalId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 审批转换为视图模型
   */
  private approvalToViewModel(approval: any): ApprovalViewModel {
    const now = Date.now();
    const requestedAt = approval.requestedAt || approval.createdAt || Date.now();
    
    return {
      approvalId: approval.id,
      taskId: approval.taskId,
      scope: approval.scope || approval.type || 'general',
      requestedAt,
      ageMs: now - requestedAt,
      status: this.normalizeApprovalStatus(approval.status),
      reason: approval.reason || approval.description || 'Approval required',
      requestingAgent: approval.requestingAgent || approval.agentId || 'unknown',
      approver: approval.approver,
      decidedAt: approval.decidedAt || approval.resolvedAt,
    };
  }
  
  /**
   * 规范化审批状态
   */
  private normalizeApprovalStatus(status: string): ApprovalStatus {
    const validStatuses: ApprovalStatus[] = [
      'pending', 'approved', 'rejected', 'escalated', 'timeout', 'cancelled'
    ];
    
    if (validStatuses.includes(status as ApprovalStatus)) {
      return status as ApprovalStatus;
    }
    
    return 'pending';
  }
  
  /**
   * 过滤审批
   */
  private filterApprovals(
    approvals: ApprovalViewModel[],
    filter?: ViewFilter
  ): ApprovalViewModel[] {
    if (!filter) {
      return approvals;
    }
    
    let filtered = [...approvals];
    
    // 状态过滤
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(a => filter.status!.includes(a.status));
    }
    
    // Agent 过滤
    if (filter.agentId) {
      filtered = filtered.filter(a => a.requestingAgent === filter.agentId);
    }
    
    // 关键词过滤
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      filtered = filtered.filter(a =>
        a.scope.toLowerCase().includes(keyword) ||
        a.reason.toLowerCase().includes(keyword)
      );
    }
    
    return filtered;
  }
  
  /**
   * 分析审批瓶颈
   */
  private analyzeBottlenecks(
    approvals: ApprovalViewModel[]
  ): ApprovalView['bottlenecks'] {
    // 按类型分组
    const byType: Record<string, ApprovalViewModel[]> = {};
    
    for (const approval of approvals) {
      if (!byType[approval.scope]) {
        byType[approval.scope] = [];
      }
      byType[approval.scope].push(approval);
    }
    
    // 计算瓶颈
    const bottlenecks: ApprovalView['bottlenecks'] = [];
    
    for (const [type, typeApprovals] of Object.entries(byType)) {
      const totalWaitTime = typeApprovals.reduce((sum, a) => sum + a.ageMs, 0);
      const avgWaitTime = totalWaitTime / typeApprovals.length;
      
      bottlenecks.push({
        type,
        pendingCount: typeApprovals.length,
        avgWaitTimeMs: Math.round(avgWaitTime),
      });
    }
    
    // 按等待时间排序
    bottlenecks.sort((a, b) => b.avgWaitTimeMs - a.avgWaitTimeMs);
    
    return bottlenecks;
  }
  
  /**
   * 计算审批流摘要
   */
  private calculateFlowSummary(
    history: any[]
  ): ApprovalView['flowSummary'] {
    if (history.length === 0) {
      return undefined;
    }
    
    const approved = history.filter(h => h.status === 'approved').length;
    const rejected = history.filter(h => h.status === 'rejected').length;
    const total = approved + rejected;
    
    // 计算平均决定时间
    let totalDecisionTime = 0;
    let decisionCount = 0;
    
    for (const h of history) {
      if (h.decidedAt && h.requestedAt) {
        totalDecisionTime += h.decidedAt - h.requestedAt;
        decisionCount++;
      }
    }
    
    const avgDecisionTimeMs = decisionCount > 0
      ? Math.round(totalDecisionTime / decisionCount)
      : 0;
    
    return {
      approvalRate: total > 0 ? approved / total : 0,
      rejectionRate: total > 0 ? rejected / total : 0,
      avgDecisionTimeMs: avgDecisionTimeMs,
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建审批视图构建器
 */
export function createApprovalViewBuilder(
  approvalDataSource: ApprovalDataSource,
  config?: ApprovalViewBuilderConfig
): ApprovalViewBuilder {
  return new ApprovalViewBuilder(approvalDataSource, config);
}

/**
 * 快速构建审批视图
 */
export async function buildApprovalView(
  approvalDataSource: ApprovalDataSource,
  filter?: ViewFilter
): Promise<ApprovalView> {
  const builder = new ApprovalViewBuilder(approvalDataSource);
  return await builder.buildApprovalView(filter);
}
