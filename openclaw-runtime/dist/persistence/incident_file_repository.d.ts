/**
 * Phase 3B-2: Incident File Repository
 *
 * 文件持久化的 Incident 存储：
 * - JSONL 追加日志
 * - 快照加速恢复
 * - 文件锁并发控制
 * - 损坏数据防御
 */
import { Incident, IncidentUpdateRequest, IncidentQuery } from '../alerting/incident_repository.js';
export interface IncidentFileRepositoryConfig {
    dataDir: string;
    snapshotIntervalMs: number;
    backupCount: number;
}
export declare class IncidentFileRepository {
    private readonly config;
    private readonly incidents;
    private readonly timelineStore;
    private readonly jsonlPath;
    private readonly snapshotPath;
    private readonly backupDir;
    private readonly lockDir;
    private lastSnapshotAt;
    private isLoaded;
    constructor(config?: Partial<IncidentFileRepositoryConfig>);
    /**
     * Initialize repository
     */
    initialize(): Promise<void>;
    /**
     * Load incidents from disk
     */
    loadFromDisk(): Promise<void>;
    /**
     * Load from snapshot
     */
    private loadFromSnapshot;
    /**
     * Replay incremental events since snapshot
     */
    private replayIncrementalEvents;
    /**
     * Replay all events from jsonl
     */
    private replayAllEvents;
    /**
     * Read jsonl lines
     */
    private readJsonlLines;
    /**
     * Apply event to in-memory state
     */
    private applyEvent;
    /**
     * Create incident (with file lock)
     */
    create(incident: Incident): Promise<void>;
    /**
     * Update incident (with file lock)
     */
    update(incident_id: string, update: IncidentUpdateRequest): Promise<Incident | undefined>;
    /**
     * Append event to jsonl
     */
    private appendEvent;
    /**
     * Create snapshot
     */
    createSnapshot(): Promise<void>;
    /**
     * Backup old snapshot
     */
    private backupSnapshot;
    /**
     * Cleanup old backups
     */
    private cleanupBackups;
    /**
     * Maybe create snapshot
     */
    private maybeCreateSnapshot;
    /**
     * Get incident by ID
     */
    getById(incident_id: string): Incident | undefined;
    /**
     * Query incidents
     */
    query(filters: IncidentQuery): Incident[];
    /**
     * Get all incidents
     */
    getAll(): Incident[];
    /**
     * Repair corrupted data
     */
    repair(): Promise<number>;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        by_status: Record<string, number>;
    };
}
export declare function getIncidentFileRepository(): IncidentFileRepository;
//# sourceMappingURL=incident_file_repository.d.ts.map