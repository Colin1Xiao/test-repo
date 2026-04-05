/**
 * Phase 3B-3: Audit Log File Service
 *
 * 文件持久化的 Audit Log 服务
 */
import { AuditLogService, AuditLogEntry } from './audit_log_service.js';
export declare class AuditLogFileService implements AuditLogService {
    private fileRepo;
    private initialized;
    initialize(): Promise<void>;
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
    getStats(): {
        total: number;
        by_type: Record<string, number>;
        by_actor: Record<string, number>;
    };
}
export declare function getAuditLogFileService(): AuditLogFileService;
//# sourceMappingURL=audit_log_file_service.d.ts.map