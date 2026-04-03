/**
 * Approval Data Source
 * Phase 2A-1R′A - 真实审批数据源
 * 
 * 职责：
 * - 提供审批数据读取接口
 * - 支持 pending / aged / timeout approvals 查询
 * - 支持按 ID 查询单个审批
 */

import type { ApprovalViewModel, ApprovalView, ApprovalStatus } from '../ux/control_types';

// ============================================================================
// 数据源接口
// ============================================================================

export interface ApprovalDataSource {
  /**
   * 获取审批视图
   */
  getApprovalView(): Promise<ApprovalView>;
  
  /**
   * 获取待处理审批列表
   */
  getPendingApprovals(limit?: number): Promise<ApprovalViewModel[]>;
  
  /**
   * 获取超时审批列表
   */
  getTimeoutApprovals(limit?: number): Promise<ApprovalViewModel[]>;
  
  /**
   * 获取审批瓶颈
   */
  getBottlenecks(): Promise<ApprovalView['bottlenecks']>;
  
  /**
   * 按 ID 获取审批
   */
  getApprovalById(approvalId: string): Promise<ApprovalViewModel | null>;
  
  /**
   * 获取审批统计
   */
  getApprovalSummary(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    timeout: number;
  }>;
}

// ============================================================================
// 配置
// ============================================================================

export interface ApprovalDataSourceConfig {
  /** 默认返回数量限制 */
  defaultLimit?: number;
  
  /** 超时阈值（毫秒） */
  timeoutThresholdMs?: number;
  
  /** 数据刷新间隔（毫秒） */
  refreshIntervalMs?: number;
}

// ============================================================================
// 内存实现（用于测试/降级）
// ============================================================================

export class InMemoryApprovalDataSource implements ApprovalDataSource {
  private config: Required<ApprovalDataSourceConfig>;
  private approvals: Map<string, ApprovalViewModel> = new Map();
  
  constructor(config: ApprovalDataSourceConfig = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? 50,
      timeoutThresholdMs: config.timeoutThresholdMs ?? 5 * 60 * 60 * 1000, // 5 小时
      refreshIntervalMs: config.refreshIntervalMs ?? 30000,
    };
  }
  
  async getApprovalView(): Promise<ApprovalView> {
    const allApprovals = Array.from(this.approvals.values());
    const now = Date.now();
    
    const pendingApprovals = allApprovals
      .filter(a => a.status === 'pending')
      .sort((a, b) => a.requestedAt - b.requestedAt);
    
    const timeoutApprovals = pendingApprovals.filter(a => a.ageMs > this.config.timeoutThresholdMs);
    
    const decidedApprovals = allApprovals
      .filter(a => a.status === 'approved' || a.status === 'rejected' || a.status === 'cancelled')
      .sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
    
    // 计算瓶颈
    const bottlenecks = this.calculateBottlenecks(pendingApprovals);
    
    return {
      pendingApprovals: pendingApprovals.slice(0, this.config.defaultLimit),
      bottlenecks,
      timeoutApprovals: timeoutApprovals.slice(0, this.config.defaultLimit),
      recentDecidedApprovals: decidedApprovals.slice(0, this.config.defaultLimit),
      totalApprovals: this.approvals.size,
      flowSummary: {
        approvalRate: allApprovals.filter(a => a.status === 'approved').length / Math.max(1, allApprovals.length),
        rejectionRate: allApprovals.filter(a => a.status === 'rejected').length / Math.max(1, allApprovals.length),
        avgDecisionTimeMs: this.calculateAvgDecisionTime(decidedApprovals),
      },
    };
  }
  
  async getPendingApprovals(limit?: number): Promise<ApprovalViewModel[]> {
    const allApprovals = Array.from(this.approvals.values());
    return allApprovals
      .filter(a => a.status === 'pending')
      .sort((a, b) => a.requestedAt - b.requestedAt)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getTimeoutApprovals(limit?: number): Promise<ApprovalViewModel[]> {
    const allApprovals = Array.from(this.approvals.values());
    return allApprovals
      .filter(a => a.status === 'pending' && a.ageMs > this.config.timeoutThresholdMs)
      .slice(0, limit ?? this.config.defaultLimit);
  }
  
  async getBottlenecks(): Promise<ApprovalView['bottlenecks']> {
    const pendingApprovals = await this.getPendingApprovals();
    return this.calculateBottlenecks(pendingApprovals);
  }
  
  async getApprovalById(approvalId: string): Promise<ApprovalViewModel | null> {
    return this.approvals.get(approvalId) || null;
  }
  
  async getApprovalSummary(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    timeout: number;
  }> {
    const allApprovals = Array.from(this.approvals.values());
    
    return {
      total: this.approvals.size,
      pending: allApprovals.filter(a => a.status === 'pending').length,
      approved: allApprovals.filter(a => a.status === 'approved').length,
      rejected: allApprovals.filter(a => a.status === 'rejected').length,
      timeout: allApprovals.filter(a => a.status === 'pending' && a.ageMs > this.config.timeoutThresholdMs).length,
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private calculateBottlenecks(pendingApprovals: ApprovalViewModel[]): ApprovalView['bottlenecks'] {
    const byType = new Map<string, ApprovalViewModel[]>();
    
    for (const approval of pendingApprovals) {
      const type = approval.scope;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(approval);
    }
    
    const bottlenecks: ApprovalView['bottlenecks'] = [];
    
    for (const [type, approvals] of byType.entries()) {
      const avgWaitTime = approvals.reduce((sum, a) => sum + a.ageMs, 0) / approvals.length;
      
      bottlenecks.push({
        type,
        pendingCount: approvals.length,
        avgWaitTimeMs: avgWaitTime,
      });
    }
    
    return bottlenecks.sort((a, b) => b.pendingCount - a.pendingCount);
  }
  
  private calculateAvgDecisionTime(decidedApprovals: ApprovalViewModel[]): number {
    if (decidedApprovals.length === 0) return 0;
    
    const total = decidedApprovals.reduce((sum, a) => {
      if (!a.decidedAt) return sum;
      return sum + (a.decidedAt - a.requestedAt);
    }, 0);
    
    return total / decidedApprovals.length;
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 添加测试审批
   */
  addApproval(approval: ApprovalViewModel): void {
    this.approvals.set(approval.approvalId, approval);
  }
  
  /**
   * 更新审批状态
   */
  updateApprovalStatus(approvalId: string, status: ApprovalStatus, approver?: string): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval) return false;
    
    approval.status = status;
    approval.approver = approver;
    approval.decidedAt = Date.now();
    this.approvals.set(approvalId, approval);
    return true;
  }
  
  /**
   * 清除所有审批
   */
  clear(): void {
    this.approvals.clear();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createApprovalDataSource(
  config?: ApprovalDataSourceConfig
): ApprovalDataSource {
  return new InMemoryApprovalDataSource(config);
}
