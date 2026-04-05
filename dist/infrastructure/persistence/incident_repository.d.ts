/**
 * Incident Repository
 * Phase 2E-1 - 事件持久化存储
 *
 * 职责：
 * - 事件数据存储/加载
 * - 事件状态管理
 * - 事件历史查询
 */
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface IncidentRecord {
    incidentId: string;
    type: string;
    severity: IncidentSeverity;
    description: string;
    status: 'active' | 'acknowledged' | 'resolved' | 'closed';
    metadata: {
        source: string;
        sourceType: string;
        sourceId: string;
        [key: string]: any;
    };
    createdAt: number;
    updatedAt: number;
    acknowledgedAt?: number;
    acknowledgedBy?: string;
    resolvedAt?: number;
    resolvedBy?: string;
    resolution?: string;
}
export interface IncidentQuery {
    status?: 'active' | 'acknowledged' | 'resolved' | 'closed';
    severity?: IncidentSeverity;
    source?: string;
    type?: string;
    limit?: number;
    offset?: number;
}
export declare class IncidentRepository {
    private repository;
    constructor(dataDir: string);
    /**
     * 创建事件
     */
    create(incident: Omit<IncidentRecord, 'createdAt' | 'updatedAt' | 'status'>): Promise<IncidentRecord>;
    /**
     * 获取事件
     */
    getById(incidentId: string): Promise<IncidentRecord | null>;
    /**
     * 更新事件状态
     */
    updateStatus(incidentId: string, status: IncidentRecord['status'], userId?: string, resolution?: string): Promise<IncidentRecord | null>;
    /**
     * 确认事件
     */
    acknowledge(incidentId: string, userId?: string): Promise<IncidentRecord | null>;
    /**
     * 解决事件
     */
    resolve(incidentId: string, userId?: string, resolution?: string): Promise<IncidentRecord | null>;
    /**
     * 关闭事件
     */
    close(incidentId: string): Promise<IncidentRecord | null>;
    /**
     * 查询事件
     */
    query(query: IncidentQuery): Promise<{
        total: number;
        incidents: IncidentRecord[];
    }>;
    /**
     * 获取活跃事件
     */
    getActive(limit?: number): Promise<IncidentRecord[]>;
    /**
     * 获取未确认事件
     */
    getUnacknowledged(limit?: number): Promise<IncidentRecord[]>;
    /**
     * 获取严重事件
     */
    getCritical(limit?: number): Promise<IncidentRecord[]>;
    /**
     * 获取事件统计
     */
    getStats(): Promise<{
        total: number;
        active: number;
        acknowledged: number;
        resolved: number;
        closed: number;
        critical: number;
    }>;
    /**
     * 删除事件
     */
    delete(incidentId: string): Promise<void>;
}
export declare function createIncidentRepository(dataDir: string): IncidentRepository;
