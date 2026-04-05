/**
 * Incident Center
 * Phase 2A-2B - 事件中心聚合
 *
 * 职责：
 * - 聚合 active incidents
 * - 聚合 ack-needed incidents
 * - 聚合 degraded services
 * - 输出 InboxItem 列表
 */
import type { InboxItem } from '../types/inbox_types';
import type { IncidentDataSource } from '../data/incident_data_source';
export interface IncidentCenterConfig {
    /** 返回数量限制 */
    limit?: number;
}
export declare class IncidentCenter {
    private config;
    private incidentDataSource;
    constructor(incidentDataSource: IncidentDataSource, config?: IncidentCenterConfig);
    /**
     * 获取事件 Inbox 项
     */
    getInboxItems(workspaceId?: string): Promise<InboxItem[]>;
    /**
     * 获取摘要
     */
    getSummary(workspaceId?: string): Promise<{
        activeIncidents: number;
        unacknowledgedIncidents: number;
        degradedServices: number;
        criticalCount: number;
    }>;
}
export declare function createIncidentCenter(incidentDataSource: IncidentDataSource, config?: IncidentCenterConfig): IncidentCenter;
