/**
 * Audit Log Service Interface
 *
 * Phase 2E-5: Automation & Observability
 */
export interface AuditLogEntry {
    event_type: string;
    object_type: string;
    object_id: string;
    timestamp?: number;
    actor_id?: string;
    metadata?: Record<string, unknown>;
}
export interface AuditLogService {
    log(entry: AuditLogEntry): Promise<void>;
    query(filters: {
        event_type?: string;
        object_type?: string;
        object_id?: string;
        from?: number;
        to?: number;
        limit?: number;
    }): Promise<AuditLogEntry[]>;
    cleanup(older_than_ms: number): Promise<number>;
}
//# sourceMappingURL=audit_log_service.d.ts.map