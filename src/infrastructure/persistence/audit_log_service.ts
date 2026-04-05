/**
 * Audit Log Service
 * Phase 2E-2 - 审计日志服务
 * 
 * 职责：
 * - 记录所有关键操作
 * - 提供审计查询接口
 * - 支持日志轮转
 */

import { createFilePersistenceStore, type PersistenceRepository } from './persistence_store';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export type AuditAction =
  | 'webhook_received'
  | 'event_created'
  | 'approval_created'
  | 'approval_approved'
  | 'approval_rejected'
  | 'incident_created'
  | 'incident_acknowledged'
  | 'incident_resolved'
  | 'runbook_action_created'
  | 'runbook_action_executed'
  | 'risk_breach_recorded'
  | 'risk_level_changed'
  | 'connector_writeback'
  | 'replay_plan_generated'
  | 'replay_started'
  | 'replay_completed'
  | 'recovery_scan_started'
  | 'recovery_scan_completed'
  | 'recovery_rebuild_started'
  | 'recovery_rebuild_completed'
  | 'approval_timeout'
  | 'incident_timeout'
  | 'recovery_scan';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  actor: {
    userId: string;
    username: string;
    source?: string;
  };
  target: {
    type: string;
    id: string;
  };
  details: Record<string, any>;
  result: {
    success: boolean;
    error?: string;
  };
  metadata: {
    sessionId?: string;
    requestId?: string;
    ipAddress?: string;
    correlationId?: string;
    relatedObjects?: Array<{
      type: string;
      id: string;
      relationship: 'parent' | 'child' | 'related';
    }>;
  };
}

export interface AuditLogQuery {
  action?: AuditAction;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  startTime?: number;
  endTime?: number;
  success?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Audit Log Service
// ============================================================================

export class AuditLogService {
  private repository: PersistenceRepository<AuditLogEntry>;
  private maxLogAge: number; // milliseconds

  constructor(dataDir: string, maxLogAgeDays: number = 30) {
    this.repository = createFilePersistenceStore<AuditLogEntry>(
      path.join(dataDir, 'audit-logs'),
      '.log.json'
    );
    this.maxLogAge = maxLogAgeDays * 24 * 60 * 60 * 1000;
  }

  /**
   * 记录审计日志
   */
  async log(
    action: AuditAction,
    actor: { userId: string; username: string; source?: string },
    target: { type: string; id: string },
    details: Record<string, any>,
    result: { success: boolean; error?: string },
    metadata?: { sessionId?: string; requestId?: string; ipAddress?: string }
  ): Promise<string> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action,
      actor,
      target,
      details,
      result,
      metadata: metadata || {},
    };

    await this.repository.save(entry.id, entry);
    return entry.id;
  }

  /**
   * 查询审计日志
   */
  async query(query: AuditLogQuery): Promise<{
    total: number;
    entries: AuditLogEntry[];
  }> {
    const allEntries = await this.repository.list();

    // 应用过滤器
    let filtered = allEntries.filter((entry) => {
      if (query.action && entry.action !== query.action) {
        return false;
      }
      if (query.actorId && entry.actor.userId !== query.actorId) {
        return false;
      }
      if (query.targetType && entry.target.type !== query.targetType) {
        return false;
      }
      if (query.targetId && entry.target.id !== query.targetId) {
        return false;
      }
      if (query.startTime && entry.timestamp < query.startTime) {
        return false;
      }
      if (query.endTime && entry.timestamp > query.endTime) {
        return false;
      }
      if (query.success !== undefined && entry.result.success !== query.success) {
        return false;
      }
      return true;
    });

    // 按时间排序（最新的在前）
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const entries = filtered.slice(offset, offset + limit);

    return { total, entries };
  }

  /**
   * 获取特定目标的审计历史
   */
  async getTargetHistory(
    targetType: string,
    targetId: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const result = await this.query({
      targetType,
      targetId,
      limit,
    });
    return result.entries;
  }

  /**
   * 获取用户的操作历史
   */
  async getUserHistory(
    userId: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const result = await this.query({
      actorId: userId,
      limit,
    });
    return result.entries;
  }

  /**
   * 清理旧日志
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.maxLogAge;
    const allEntries = await this.repository.list();

    let deletedCount = 0;
    for (const entry of allEntries) {
      if (entry.timestamp < cutoff) {
        await this.repository.delete(entry.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 获取统计信息
   */
  async getStats(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<{
    total: number;
    byAction: Map<string, number>;
    byUser: Map<string, number>;
    successRate: number;
  }> {
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    const allEntries = await this.repository.list();

    const recentEntries = allEntries.filter((e) => e.timestamp >= cutoff);
    const byAction = new Map<string, number>();
    const byUser = new Map<string, number>();
    let successCount = 0;

    for (const entry of recentEntries) {
      byAction.set(entry.action, (byAction.get(entry.action) || 0) + 1);
      byUser.set(entry.actor.userId, (byUser.get(entry.actor.userId) || 0) + 1);
      if (entry.result.success) {
        successCount++;
      }
    }

    const total = recentEntries.length;
    const successRate = total > 0 ? successCount / total : 0;

    return {
      total,
      byAction,
      byUser,
      successRate,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAuditLogService(
  dataDir: string,
  maxLogAgeDays?: number
): AuditLogService {
  return new AuditLogService(dataDir, maxLogAgeDays);
}
