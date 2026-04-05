/**
 * Approval Repository
 * Phase 2E-1 - 审批持久化存储
 * 
 * 职责：
 * - 审批数据存储/加载
 * - 审批状态管理
 * - 审批历史查询
 */

import { createFilePersistenceStore, type PersistenceRepository } from './persistence_store';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface ApprovalRecord {
  approvalId: string;
  scope: string;
  reason: string;
  requestingAgent: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  metadata: {
    source: string;
    sourceType: string;
    sourceId: string;
    [key: string]: any;
  };
  createdAt: number;
  updatedAt: number;
  decidedAt?: number;
  decidedBy?: string;
  rejectionReason?: string;
}

export interface ApprovalQuery {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  source?: string;
  requestingAgent?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Approval Repository
// ============================================================================

export class ApprovalRepository {
  private repository: PersistenceRepository<ApprovalRecord>;

  constructor(dataDir: string) {
    this.repository = createFilePersistenceStore<ApprovalRecord>(
      path.join(dataDir, 'approvals'),
      '.approval.json'
    );
  }

  /**
   * 创建审批
   */
  async create(approval: Omit<ApprovalRecord, 'createdAt' | 'updatedAt'>): Promise<ApprovalRecord> {
    const now = Date.now();
    const record: ApprovalRecord = {
      ...approval,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(record.approvalId, record);
    return record;
  }

  /**
   * 获取审批
   */
  async getById(approvalId: string): Promise<ApprovalRecord | null> {
    return await this.repository.load(approvalId);
  }

  /**
   * 更新审批状态
   */
  async updateStatus(
    approvalId: string,
    status: ApprovalRecord['status'],
    decidedBy?: string,
    rejectionReason?: string
  ): Promise<ApprovalRecord | null> {
    const record = await this.getById(approvalId);
    if (!record) {
      return null;
    }

    record.status = status;
    record.decidedAt = Date.now();
    record.decidedBy = decidedBy;
    record.rejectionReason = rejectionReason;
    record.updatedAt = Date.now();

    await this.repository.save(approvalId, record);
    return record;
  }

  /**
   * 批准审批
   */
  async approve(approvalId: string, decidedBy?: string): Promise<ApprovalRecord | null> {
    return this.updateStatus(approvalId, 'approved', decidedBy);
  }

  /**
   * 拒绝审批
   */
  async reject(
    approvalId: string,
    decidedBy?: string,
    reason?: string
  ): Promise<ApprovalRecord | null> {
    return this.updateStatus(approvalId, 'rejected', decidedBy, reason);
  }

  /**
   * 取消审批
   */
  async cancel(approvalId: string): Promise<ApprovalRecord | null> {
    return this.updateStatus(approvalId, 'cancelled');
  }

  /**
   * 查询审批
   */
  async query(query: ApprovalQuery): Promise<{
    total: number;
    approvals: ApprovalRecord[];
  }> {
    const allApprovals = await this.repository.list();

    // 应用过滤器
    let filtered = allApprovals.filter((approval) => {
      if (query.status && approval.status !== query.status) {
        return false;
      }
      if (query.source && approval.metadata.source !== query.source) {
        return false;
      }
      if (query.requestingAgent && approval.requestingAgent !== query.requestingAgent) {
        return false;
      }
      return true;
    });

    // 按创建时间排序（最新的在前）
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const approvals = filtered.slice(offset, offset + limit);

    return { total, approvals };
  }

  /**
   * 获取待处理审批
   */
  async getPending(limit: number = 50): Promise<ApprovalRecord[]> {
    const result = await this.query({ status: 'pending', limit });
    return result.approvals;
  }

  /**
   * 获取超时审批
   */
  async getTimeout(timeoutThresholdMs: number = 6 * 60 * 60 * 1000): Promise<ApprovalRecord[]> {
    const now = Date.now();
    const pending = await this.getPending(1000);
    return pending.filter((a) => now - a.createdAt > timeoutThresholdMs);
  }

  /**
   * 获取审批统计
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  }> {
    const allApprovals = await this.repository.list();
    return {
      total: allApprovals.length,
      pending: allApprovals.filter((a) => a.status === 'pending').length,
      approved: allApprovals.filter((a) => a.status === 'approved').length,
      rejected: allApprovals.filter((a) => a.status === 'rejected').length,
      cancelled: allApprovals.filter((a) => a.status === 'cancelled').length,
    };
  }

  /**
   * 删除审批
   */
  async delete(approvalId: string): Promise<void> {
    await this.repository.delete(approvalId);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createApprovalRepository(dataDir: string): ApprovalRepository {
  return new ApprovalRepository(dataDir);
}
