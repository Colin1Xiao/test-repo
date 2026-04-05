/**
 * Timeline Service
 * Phase 2E-3 - 操作员时间线服务
 * 
 * 职责：
 * - 聚合审批/事件/Replay/Recovery 等动作
 * - 提供统一时间线查询
 * - 支持按对象/关联 ID/操作者过滤
 */

import { createAuditLogService, type AuditLogEntry } from './audit_log_service';
import { createApprovalRepository } from './approval_repository';
import { createIncidentRepository } from './incident_repository';
import { createEventRepository } from './event_repository';

// ============================================================================
// 类型定义
// ============================================================================

export type TimelineItemType =
  | 'approval_created'
  | 'approval_approved'
  | 'approval_rejected'
  | 'incident_created'
  | 'incident_acknowledged'
  | 'incident_resolved'
  | 'event_created'
  | 'replay_started'
  | 'replay_completed'
  | 'recovery_scan_started'
  | 'recovery_scan_completed'
  | 'recovery_rebuild_started'
  | 'recovery_rebuild_completed'
  | 'webhook_received'
  | 'runbook_action_executed';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: number;
  actor: {
    userId: string;
    username: string;
  };
  target: {
    type: string;
    id: string;
  };
  result: {
    success: boolean;
    error?: string;
  };
  details: Record<string, any>;
  correlationId?: string;
  // 关联对象
  relatedObjects?: Array<{
    type: string;
    id: string;
    relationship: 'parent' | 'child' | 'related';
  }>;
}

export interface TimelineQuery {
  // 时间范围
  startTime?: number;
  endTime?: number;
  
  // 过滤条件
  itemTypes?: TimelineItemType[];
  actorId?: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  success?: boolean;
  
  // 分页
  limit?: number;
  offset?: number;
  
  // 排序
  sortOrder?: 'asc' | 'desc';
}

export interface TimelineResult {
  items: TimelineItem[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Timeline Service
// ============================================================================

export class TimelineService {
  private auditLogService: ReturnType<typeof createAuditLogService>;
  private approvalRepository: ReturnType<typeof createApprovalRepository>;
  private incidentRepository: ReturnType<typeof createIncidentRepository>;
  private eventRepository: ReturnType<typeof createEventRepository>;

  constructor(
    auditLogService: ReturnType<typeof createAuditLogService>,
    approvalRepository: ReturnType<typeof createApprovalRepository>,
    incidentRepository: ReturnType<typeof createIncidentRepository>,
    eventRepository: ReturnType<typeof createEventRepository>
  ) {
    this.auditLogService = auditLogService;
    this.approvalRepository = approvalRepository;
    this.incidentRepository = incidentRepository;
    this.eventRepository = eventRepository;
  }

  /**
   * 获取时间线
   */
  async getTimeline(query: TimelineQuery): Promise<TimelineResult> {
    // 从审计日志获取基础时间线
    const auditLogs = await this.auditLogService.query({
      startTime: query.startTime,
      endTime: query.endTime,
      limit: query.limit || 100,
      offset: query.offset || 0,
    });

    // 转换为时间线项
    const items: TimelineItem[] = auditLogs.entries.map((log) =>
      this.auditLogToTimelineItem(log)
    );

    // 应用过滤
    let filtered = items;

    if (query.itemTypes && query.itemTypes.length > 0) {
      filtered = filtered.filter((item) => query.itemTypes!.includes(item.type));
    }
    if (query.actorId) {
      filtered = filtered.filter((item) => item.actor.userId === query.actorId);
    }
    if (query.targetType) {
      filtered = filtered.filter((item) => item.target.type === query.targetType);
    }
    if (query.targetId) {
      filtered = filtered.filter((item) => item.target.id === query.targetId);
    }
    if (query.correlationId) {
      filtered = filtered.filter((item) => item.correlationId === query.correlationId);
    }
    if (query.success !== undefined) {
      filtered = filtered.filter((item) => item.result.success === query.success);
    }

    // 排序
    const sortOrder = query.sortOrder || 'desc';
    filtered.sort((a, b) =>
      sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

    // 分页
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      items: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  }

  /**
   * 获取对象的时间线
   */
  async getObjectTimeline(
    objectType: string,
    objectId: string,
    limit: number = 100
  ): Promise<TimelineItem[]> {
    const result = await this.getTimeline({
      targetType: objectType,
      targetId: objectId,
      limit,
      sortOrder: 'desc',
    });

    return result.items;
  }

  /**
   * 获取关联对象的时间线
   */
  async getRelatedTimeline(
    correlationId: string,
    limit: number = 100
  ): Promise<TimelineItem[]> {
    const result = await this.getTimeline({
      correlationId,
      limit,
      sortOrder: 'asc', // 关联对象按时间正序显示
    });

    return result.items;
  }

  /**
   * 获取审批生命周期链
   */
  async getApprovalLifecycleChain(approvalId: string): Promise<TimelineItem[]> {
    const items = await this.getObjectTimeline('approval', approvalId, 100);
    
    // 按时间正序排列，显示完整生命周期
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    return items;
  }

  /**
   * 获取事件生命周期链
   */
  async getIncidentLifecycleChain(incidentId: string): Promise<TimelineItem[]> {
    const items = await this.getObjectTimeline('incident', incidentId, 100);
    
    // 按时间正序排列，显示完整生命周期
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    return items;
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  /**
   * 审计日志转时间线项
   */
  private auditLogToTimelineItem(log: AuditLogEntry): TimelineItem {
    return {
      id: log.id,
      type: log.action as TimelineItemType,
      timestamp: log.timestamp,
      actor: {
        userId: log.actor.userId,
        username: log.actor.username,
      },
      target: {
        type: log.target.type,
        id: log.target.id,
      },
      result: {
        success: log.result.success,
        error: log.result.error,
      },
      details: log.details,
      correlationId: log.metadata?.correlationId,
      relatedObjects: log.metadata?.relatedObjects,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTimelineService(
  auditLogService: ReturnType<typeof createAuditLogService>,
  approvalRepository: ReturnType<typeof createApprovalRepository>,
  incidentRepository: ReturnType<typeof createIncidentRepository>,
  eventRepository: ReturnType<typeof createEventRepository>
): TimelineService {
  return new TimelineService(
    auditLogService,
    approvalRepository,
    incidentRepository,
    eventRepository
  );
}
