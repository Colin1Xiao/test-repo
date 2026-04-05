/**
 * P0 告警闭环：Incident Repository 集成
 *
 * Incident 持久化与防重复创建：
 * - 相同 alert/correlation/resource 防重复建 incident
 * - 已存在 incident 时自动挂接
 */
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export interface Incident {
    id: string;
    type: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    title: string;
    description?: string;
    created_at: number;
    created_by: string;
    updated_at: number;
    updated_by?: string;
    resolved_at?: number;
    resolved_by?: string;
    correlation_id?: string;
    resource?: string;
    related_alerts: string[];
    related_incidents?: string[];
    metadata?: Record<string, unknown>;
}
export interface IncidentCreateRequest {
    type: string;
    severity: IncidentSeverity;
    title: string;
    description?: string;
    correlation_id?: string;
    resource?: string;
    alert_name?: string;
    created_by: string;
    metadata?: Record<string, unknown>;
}
export interface IncidentUpdateRequest {
    status?: IncidentStatus;
    description?: string;
    related_incidents?: string[];
    metadata?: Record<string, unknown>;
    updated_by: string;
}
export interface IncidentQuery {
    type?: string;
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    correlation_id?: string;
    resource?: string;
    alert_name?: string;
    created_from?: number;
    created_to?: number;
    limit?: number;
}
export declare class IncidentRepository {
    private incidents;
    private byCorrelation;
    private byResource;
    private byAlert;
    private byStatus;
    private timelineStore;
    /**
     * Create or get existing incident
     *
     * 防重复逻辑：
     * 1. 检查相同 correlation_id 的 open incident
     * 2. 检查相同 resource 的 open incident（同类型）
     * 3. 检查相同 alert 的 open incident（5 分钟内）
     */
    createOrGet(request: IncidentCreateRequest): {
        incident: Incident;
        created: boolean;
    };
    /**
     * Find existing open incident
     */
    private findExistingIncident;
    /**
     * Save incident to repository
     */
    private save;
    /**
     * Update incident
     */
    update(incident_id: string, request: IncidentUpdateRequest): Incident | undefined;
    /**
     * Get incident by ID
     */
    getById(incident_id: string): Incident | undefined;
    /**
     * Query incidents
     */
    query(filters: IncidentQuery): Incident[];
    /**
     * Get open incidents
     */
    getOpen(limit?: number): Incident[];
    /**
     * Get investigating incidents
     */
    getInvestigating(limit?: number): Incident[];
    /**
     * Get incidents by correlation ID
     */
    getByCorrelation(correlation_id: string, limit?: number): Incident[];
    /**
     * Get incidents by resource
     */
    getByResource(resource: string, limit?: number): Incident[];
    /**
     * Get incidents by alert name
     */
    getByAlert(alert_name: string, limit?: number): Incident[];
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        open: number;
        investigating: number;
        resolved: number;
        closed: number;
        by_severity: Record<IncidentSeverity, number>;
        by_type: Record<string, number>;
    };
    /**
     * Clear all incidents (for testing)
     */
    clear(): void;
}
export declare function getIncidentRepository(): IncidentRepository;
export declare function resetIncidentRepository(): void;
//# sourceMappingURL=incident_repository.d.ts.map