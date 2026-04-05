/**
 * Phase 3B-3: Audit File Repository
 *
 * 文件持久化的 Audit 存储：
 * - JSONL 追加日志
 * - 启动时加载
 * - 与 Incident/Timeline 关联
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { getFileLock } from './file_lock.js';
const DEFAULT_CONFIG = {
    dataDir: './data/audit',
    flushIntervalMs: 5000, // 5 秒
};
// ==================== Audit File Repository ====================
export class AuditFileRepository {
    config;
    events = [];
    jsonlPath;
    flushTimer = null;
    isLoaded = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.jsonlPath = join(process.cwd(), this.config.dataDir, 'audit.jsonl');
    }
    // ==================== Initialization ====================
    async initialize() {
        await fs.mkdir(dirname(this.jsonlPath), { recursive: true });
        await this.loadFromDisk();
        this.isLoaded = true;
        // Start flush timer
        this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
        console.log(`[AuditFileRepository] Initialized with ${this.events.length} events`);
    }
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
        console.log('[AuditFileRepository] Shutdown complete');
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
                    console.warn(`[AuditFileRepository] Skipped corrupted line`);
                }
            }
            console.log(`[AuditFileRepository] Loaded ${this.events.length} events from disk`);
        }
        catch {
            // File doesn't exist yet
            this.events.length = 0;
        }
    }
    // ==================== Write Operations ====================
    async addEvent(event) {
        const fileLock = getFileLock();
        await fileLock.withLock('audit', async () => {
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
        if (filters.actor) {
            results = results.filter(e => e.actor === filters.actor);
        }
        if (filters.action) {
            results = results.filter(e => e.action === filters.action);
        }
        if (filters.object_type) {
            results = results.filter(e => e.object_type === filters.object_type);
        }
        if (filters.object_id) {
            results = results.filter(e => e.object_id === filters.object_id);
        }
        if (filters.correlation_id) {
            results = results.filter(e => e.correlation_id === filters.correlation_id);
        }
        if (filters.from) {
            results = results.filter(e => e.timestamp >= filters.from);
        }
        if (filters.to) {
            results = results.filter(e => e.timestamp <= filters.to);
        }
        if (filters.limit) {
            results = results.slice(-filters.limit);
        }
        return results.reverse(); // Most recent first
    }
    getById(event_id) {
        return this.events.find(e => e.id === event_id);
    }
    getByObject(object_id, limit = 100) {
        return this.query({ object_id, limit });
    }
    getByCorrelation(correlation_id, limit = 100) {
        return this.query({ correlation_id, limit });
    }
    getRecent(limit = 100) {
        return this.query({ limit });
    }
    getStats() {
        const by_type = {};
        const by_actor = {};
        for (const event of this.events) {
            by_type[event.type] = (by_type[event.type] || 0) + 1;
            by_actor[event.actor] = (by_actor[event.actor] || 0) + 1;
        }
        return {
            total: this.events.length,
            by_type,
            by_actor,
        };
    }
    clear() {
        this.events.length = 0;
    }
}
// ==================== Singleton ====================
let instance = null;
export function getAuditFileRepository() {
    if (!instance) {
        instance = new AuditFileRepository();
    }
    return instance;
}
//# sourceMappingURL=audit_file_repository.js.map