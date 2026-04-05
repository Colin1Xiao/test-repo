/**
 * Timeline Service
 * Phase 2E-3 - 操作员时间线服务
 *
 * 职责：
 * - 聚合审批/事件/Replay/Recovery 等动作
 * - 提供统一时间线查询
 * - 支持按对象/关联 ID/操作者过滤
 */
import { createAuditLogService } from './audit_log_service';
import { createApprovalRepository } from './approval_repository';
import { createIncidentRepository } from './incident_repository';
import { createEventRepository } from './event_repository';
export type TimelineItemType = 'approval_created' | 'approval_approved' | 'approval_rejected' | 'incident_created' | 'incident_acknowledged' | 'incident_resolved' | 'event_created' | 'replay_started' | 'replay_completed' | 'recovery_scan_started' | 'recovery_scan_completed' | 'recovery_rebuild_started' | 'recovery_rebuild_completed' | 'webhook_received' | 'runbook_action_executed';
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
    relatedObjects?: Array<{
        type: string;
        id: string;
        relationship: 'parent' | 'child' | 'related';
    }>;
}
export interface TimelineQuery {
    startTime?: number;
    endTime?: number;
    itemTypes?: TimelineItemType[];
    actorId?: string;
    targetType?: string;
    targetId?: string;
    correlationId?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
    sortOrder?: 'asc' | 'desc';
}
export interface TimelineResult {
    items: TimelineItem[];
    total: number;
    hasMore: boolean;
}
export declare class TimelineService {
    private auditLogService;
    private approvalRepository;
    private incidentRepository;
    private eventRepository;
    constructor(auditLogService: ReturnType<typeof createAuditLogService>, approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>, eventRepository: ReturnType<typeof createEventRepository>);
    /**
     * 获取时间线
     */
    getTimeline(query: TimelineQuery): Promise<TimelineResult>;
    /**
     * 获取对象的时间线
     */
    getObjectTimeline(objectType: string, objectId: string, limit?: number): Promise<TimelineItem[]>;
    /**
     * 获取关联对象的时间线
     */
    getRelatedTimeline(correlationId: string, limit?: number): Promise<TimelineItem[]>;
    /**
     * 获取审批生命周期链
     */
    getApprovalLifecycleChain(approvalId: string): Promise<TimelineItem[]>;
    /**
     * 获取事件生命周期链
     */
    getIncidentLifecycleChain(incidentId: string): Promise<TimelineItem[]>;
    /**
     * 审计日志转时间线项
     */
    private auditLogToTimelineItem;
}
export declare function createTimelineService(auditLogService: ReturnType<typeof createAuditLogService>, approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>, eventRepository: ReturnType<typeof createEventRepository>): TimelineService;
