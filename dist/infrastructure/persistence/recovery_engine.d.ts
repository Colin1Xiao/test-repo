/**
 * Recovery Engine
 * Phase 2E-2B - 状态恢复引擎
 *
 * 职责：
 * - 启动时扫描持久层
 * - 恢复 pending approvals
 * - 恢复 active incidents
 * - 识别 orphan/stale 对象
 * - 写入 recovery audit log
 */
import { createApprovalRepository } from './approval_repository';
import { createIncidentRepository } from './incident_repository';
import { createEventRepository } from './event_repository';
import { createAuditLogService } from './audit_log_service';
export interface RecoveryResult {
    success: boolean;
    scanCompleted: boolean;
    recovered: {
        approvals: {
            pending: number;
            total: number;
        };
        incidents: {
            active: number;
            acknowledged: number;
            resolved: number;
            total: number;
        };
        events: {
            total: number;
            last24h: number;
        };
    };
    orphanedObjects: Array<{
        type: string;
        id: string;
        reason: string;
    }>;
    staleObjects: Array<{
        type: string;
        id: string;
        age: number;
        status: string;
    }>;
    errors: Array<{
        type: string;
        error: string;
    }>;
    summary: string;
}
export interface RecoveryConfig {
    approvalTimeoutMs?: number;
    incidentTimeoutMs?: number;
    maxRecoverApprovals?: number;
    maxRecoverIncidents?: number;
}
export declare class RecoveryEngine {
    private approvalRepository;
    private incidentRepository;
    private eventRepository;
    private auditLogService;
    private config;
    constructor(approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>, eventRepository: ReturnType<typeof createEventRepository>, auditLogService: ReturnType<typeof createAuditLogService>, config?: RecoveryConfig);
    /**
     * 执行恢复扫描
     */
    scan(): Promise<RecoveryResult>;
    /**
     * 恢复待处理审批
     */
    recoverPendingApprovals(): Promise<{
        recovered: number;
        total: number;
    }>;
    /**
     * 恢复活跃事件
     */
    recoverActiveIncidents(): Promise<{
        recovered: {
            active: number;
            acknowledged: number;
            resolved: number;
        };
        total: number;
    }>;
    /**
     * 扫描审批
     */
    private scanApprovals;
    /**
     * 扫描事件
     */
    private scanIncidents;
    /**
     * 扫描事件存储
     */
    private scanEvents;
    /**
     * 识别孤儿对象
     */
    private identifyOrphanedObjects;
    /**
     * 识别过期对象
     */
    private identifyStaleObjects;
    /**
     * 生成摘要
     */
    private generateSummary;
}
export declare function createRecoveryEngine(approvalRepository: ReturnType<typeof createApprovalRepository>, incidentRepository: ReturnType<typeof createIncidentRepository>, eventRepository: ReturnType<typeof createEventRepository>, auditLogService: ReturnType<typeof createAuditLogService>, config?: RecoveryConfig): RecoveryEngine;
