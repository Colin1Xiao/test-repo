/**
 * Phase 3B-3: Audit Log File Service
 *
 * 文件持久化的 Audit Log 服务
 */
import { getAuditFileRepository } from './audit_file_repository.js';
export class AuditLogFileService {
    fileRepo = null;
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        this.fileRepo = getAuditFileRepository();
        await this.fileRepo.initialize();
        this.initialized = true;
        console.log(`[AuditLogFileService] Initialized with ${this.fileRepo.getStats().total} events`);
    }
    async log(entry) {
        if (!this.fileRepo) {
            console.warn('[AuditLogFileService] Not initialized, skipping log');
            return;
        }
        const auditEvent = {
            id: `audit-${Date.now()}-${entry.object_id}-${entry.event_type}`,
            type: entry.event_type,
            timestamp: entry.timestamp || Date.now(),
            actor: entry.actor_id || 'system',
            action: entry.event_type,
            object_type: entry.object_type,
            object_id: entry.object_id,
            explanation: entry.metadata?.explanation,
            metadata: entry.metadata,
        };
        await this.fileRepo.addEvent(auditEvent);
    }
    async query(filters) {
        if (!this.fileRepo) {
            return [];
        }
        const events = this.fileRepo.query({
            action: filters.event_type,
            object_type: filters.object_type,
            object_id: filters.object_id,
            from: filters.from,
            to: filters.to,
            limit: filters.limit,
        });
        return events.map(e => ({
            event_type: e.type,
            object_type: e.object_type,
            object_id: e.object_id,
            timestamp: e.timestamp,
            actor_id: e.actor,
            metadata: e.metadata,
        }));
    }
    async cleanup(older_than_ms) {
        // File-based cleanup would require rewriting the file
        // For now, just return 0 (no cleanup)
        console.warn('[AuditLogFileService] Cleanup not implemented for file-based storage');
        return 0;
    }
    getStats() {
        if (!this.fileRepo) {
            return { total: 0, by_type: {}, by_actor: {} };
        }
        return this.fileRepo.getStats();
    }
}
// ==================== Singleton ====================
let instance = null;
export function getAuditLogFileService() {
    if (!instance) {
        instance = new AuditLogFileService();
    }
    return instance;
}
//# sourceMappingURL=audit_log_file_service.js.map