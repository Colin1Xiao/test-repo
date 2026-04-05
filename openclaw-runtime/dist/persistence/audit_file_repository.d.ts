/**
 * Phase 3B-3: Audit File Repository
 *
 * 文件持久化的 Audit 存储：
 * - JSONL 追加日志
 * - 启动时加载
 * - 与 Incident/Timeline 关联
 */
export interface AuditEvent {
    id: string;
    type: string;
    timestamp: number;
    actor: string;
    action: string;
    object_type: string;
    object_id: string;
    correlation_id?: string;
    explanation?: string;
    metadata?: Record<string, unknown>;
    related_events?: string[];
}
export interface AuditQuery {
    actor?: string;
    action?: string;
    object_type?: string;
    object_id?: string;
    correlation_id?: string;
    from?: number;
    to?: number;
    limit?: number;
}
export interface AuditFileRepositoryConfig {
    dataDir: string;
    flushIntervalMs: number;
}
export declare class AuditFileRepository {
    private readonly config;
    private readonly events;
    private readonly jsonlPath;
    private flushTimer;
    private isLoaded;
    constructor(config?: Partial<AuditFileRepositoryConfig>);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    private loadFromDisk;
    addEvent(event: AuditEvent): Promise<void>;
    private flushEvent;
    private flush;
    query(filters: AuditQuery): AuditEvent[];
    getById(event_id: string): AuditEvent | undefined;
    getByObject(object_id: string, limit?: number): AuditEvent[];
    getByCorrelation(correlation_id: string, limit?: number): AuditEvent[];
    getRecent(limit?: number): AuditEvent[];
    getStats(): {
        total: number;
        by_type: Record<string, number>;
        by_actor: Record<string, number>;
    };
    clear(): void;
}
export declare function getAuditFileRepository(): AuditFileRepository;
//# sourceMappingURL=audit_file_repository.d.ts.map