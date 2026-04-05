/**
 * Audit Log - 审计日志
 *
 * 职责：
 * 1. 记录结构化审计事件
 * 2. 支持查询、过滤、时间范围检索
 * 3. 支持按 task / agent / server / skill / severity 检索
 * 4. 与 HookBus、TaskStore、ApprovalBridge、Automation runtime 对接
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AuditEvent, AuditQuery, AuditEntityType } from './types';
/**
 * 审计日志配置
 */
export interface AuditLogConfig {
    /** 最大保留事件数 */
    maxEvents?: number;
    /** 最大保留时间（毫秒） */
    maxAgeMs?: number;
    /** 是否持久化 */
    enablePersistence?: boolean;
    /** 持久化路径 */
    persistPath?: string;
}
/**
 * 审计日志存储接口
 */
export interface IAuditLogStore {
    /**
     * 追加事件
     */
    append(event: AuditEvent): Promise<void>;
    /**
     * 查询事件
     */
    query(query: AuditQuery): Promise<AuditEvent[]>;
    /**
     * 获取任务审计轨迹
     */
    getTaskAuditTrail(taskId: string): Promise<AuditEvent[]>;
    /**
     * 获取实体审计轨迹
     */
    getEntityAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditEvent[]>;
    /**
     * 构建审计摘要
     */
    buildAuditSummary(startTime: number, endTime: number): Promise<{
        totalEvents: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
    }>;
}
export declare class AuditLog implements IAuditLogStore {
    private config;
    private events;
    private eventIndex;
    private taskIndex;
    private entityIndex;
    constructor(config?: AuditLogConfig);
    /**
     * 追加审计事件
     */
    append(event: AuditEvent): Promise<void>;
    /**
     * 查询审计事件
     */
    query(query: AuditQuery): Promise<AuditEvent[]>;
    /**
     * 获取任务审计轨迹
     */
    getTaskAuditTrail(taskId: string): Promise<AuditEvent[]>;
    /**
     * 获取实体审计轨迹
     */
    getEntityAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditEvent[]>;
    /**
     * 构建审计摘要
     */
    buildAuditSummary(startTime?: number, endTime?: number): Promise<{
        totalEvents: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
    }>;
    /**
     * 获取所有事件
     */
    getAllEvents(): AuditEvent[];
    /**
     * 清空审计日志
     */
    clear(): void;
    /**
     * 更新索引
     */
    private updateIndexes;
    /**
     * 清理旧事件
     */
    private cleanupOldEvents;
    /**
     * 从索引中移除事件
     */
    private removeFromIndexes;
    /**
     * 加载持久化数据
     */
    private loadFromPersistence;
    /**
     * 保存持久化数据
     */
    private saveToPersistence;
}
/**
 * 创建审计日志
 */
export declare function createAuditLog(config?: AuditLogConfig): AuditLog;
/**
 * 快速追加审计事件
 */
export declare function appendAuditEvent(auditLog: AuditLog, event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
