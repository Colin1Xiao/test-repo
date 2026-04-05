/**
 * Phase 3B-3: Timeline File Repository
 *
 * 文件持久化的 Timeline 存储：
 * - JSONL 追加日志
 * - 启动时加载
 * - 与 Incident 关联
 */
import { TimelineEvent, TimelineQuery } from '../alerting/timeline_integration.js';
export interface TimelineFileRepositoryConfig {
    dataDir: string;
    flushIntervalMs: number;
}
export declare class TimelineFileRepository {
    private readonly config;
    private readonly events;
    private readonly jsonlPath;
    private flushTimer;
    private isLoaded;
    constructor(config?: Partial<TimelineFileRepositoryConfig>);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    private loadFromDisk;
    addEvent(event: TimelineEvent): Promise<void>;
    private flushEvent;
    private flush;
    query(filters: TimelineQuery): TimelineEvent[];
    getStats(): {
        total: number;
        by_type: Record<string, number>;
    };
}
export declare function getTimelineFileRepository(): TimelineFileRepository;
//# sourceMappingURL=timeline_file_repository.d.ts.map