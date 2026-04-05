/**
 * Phase 3B-3: Timeline File Repository
 *
 * 文件持久化的 Timeline 存储：
 * - JSONL 追加日志
 * - 启动时加载
 * - 与 Incident 关联
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { getFileLock } from './file_lock.js';
const DEFAULT_CONFIG = {
    dataDir: './data/timeline',
    flushIntervalMs: 5000, // 5 秒
};
// ==================== Timeline File Repository ====================
export class TimelineFileRepository {
    config;
    events = [];
    jsonlPath;
    flushTimer = null;
    isLoaded = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.jsonlPath = join(process.cwd(), this.config.dataDir, 'timeline.jsonl');
    }
    // ==================== Initialization ====================
    async initialize() {
        await fs.mkdir(dirname(this.jsonlPath), { recursive: true });
        await this.loadFromDisk();
        this.isLoaded = true;
        // Start flush timer
        this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
        console.log(`[TimelineFileRepository] Initialized with ${this.events.length} events`);
    }
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
        console.log('[TimelineFileRepository] Shutdown complete');
    }
    async loadFromDisk() {
        try {
            const content = await fs.readFile(this.jsonlPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const event = JSON.parse(line);
                    this.events.push(event);
                }
                catch {
                    // Skip corrupted lines
                }
            }
            console.log(`[TimelineFileRepository] Loaded ${this.events.length} events from disk`);
        }
        catch {
            // File doesn't exist yet
            this.events.length = 0;
        }
    }
    // ==================== Write Operations ====================
    async addEvent(event) {
        const fileLock = getFileLock();
        await fileLock.withLock('timeline', async () => {
            this.events.push(event);
            await this.flushEvent(event);
        });
    }
    async flushEvent(event) {
        const line = JSON.stringify(event) + '\n';
        await fs.appendFile(this.jsonlPath, line, 'utf-8');
    }
    async flush() {
        // Events are flushed immediately on add
        // This method is for future batch optimization
    }
    // ==================== Read Operations ====================
    query(filters) {
        let results = [...this.events];
        if (filters.alert_name) {
            results = results.filter(e => e.alert_name === filters.alert_name);
        }
        if (filters.incident_id) {
            results = results.filter(e => e.incident_id === filters.incident_id);
        }
        if (filters.correlation_id) {
            results = results.filter(e => e.correlation_id === filters.correlation_id);
        }
        if (filters.limit) {
            results = results.slice(-filters.limit);
        }
        return results.reverse(); // Most recent first
    }
    getStats() {
        const by_type = {};
        for (const event of this.events) {
            by_type[event.type] = (by_type[event.type] || 0) + 1;
        }
        return {
            total: this.events.length,
            by_type,
        };
    }
}
// ==================== Singleton ====================
let instance = null;
export function getTimelineFileRepository() {
    if (!instance) {
        instance = new TimelineFileRepository();
    }
    return instance;
}
//# sourceMappingURL=timeline_file_repository.js.map