/**
 * Audit Log Service
 * Phase 2E-2 - 审计日志服务
 *
 * 职责：
 * - 记录所有关键操作
 * - 提供审计查询接口
 * - 支持日志轮转
 */
export type AuditAction = 'webhook_received' | 'event_created' | 'approval_created' | 'approval_approved' | 'approval_rejected' | 'incident_created' | 'incident_acknowledged' | 'incident_resolved' | 'runbook_action_created' | 'runbook_action_executed' | 'risk_breach_recorded' | 'risk_level_changed' | 'connector_writeback' | 'replay_plan_generated' | 'replay_started' | 'replay_completed' | 'recovery_scan_started' | 'recovery_scan_completed' | 'recovery_rebuild_started' | 'recovery_rebuild_completed' | 'approval_timeout' | 'incident_timeout' | 'recovery_scan';
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
export declare class AuditLogService {
    private repository;
    private maxLogAge;
    constructor(dataDir: string, maxLogAgeDays?: number);
    /**
     * 记录审计日志
     */
    log(action: AuditAction, actor: {
        userId: string;
        username: string;
        source?: string;
    }, target: {
        type: string;
        id: string;
    }, details: Record<string, any>, result: {
        success: boolean;
        error?: string;
    }, metadata?: {
        sessionId?: string;
        requestId?: string;
        ipAddress?: string;
    }): Promise<string>;
    /**
     * 查询审计日志
     */
    query(query: AuditLogQuery): Promise<{
        total: number;
        entries: AuditLogEntry[];
    }>;
    /**
     * 获取特定目标的审计历史
     */
    getTargetHistory(targetType: string, targetId: string, limit?: number): Promise<AuditLogEntry[]>;
    /**
     * 获取用户的操作历史
     */
    getUserHistory(userId: string, limit?: number): Promise<AuditLogEntry[]>;
    /**
     * 清理旧日志
     */
    cleanup(): Promise<number>;
    /**
     * 获取统计信息
     */
    getStats(timeRangeMs?: number): Promise<{
        total: number;
        byAction: Map<string, number>;
        byUser: Map<string, number>;
        successRate: number;
    }>;
}
export declare function createAuditLogService(dataDir: string, maxLogAgeDays?: number): AuditLogService;
