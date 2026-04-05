"use strict";
/**
 * Event Repository
 * Phase 2E-1 - 事件持久化存储
 *
 * 职责：
 * - Trading 事件存储/加载
 * - 事件查询
 * - 事件统计
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRepository = void 0;
exports.createEventRepository = createEventRepository;
const persistence_store_1 = require("./persistence_store");
const path = __importStar(require("path"));
// ============================================================================
// Event Repository
// ============================================================================
class EventRepository {
    constructor(dataDir) {
        this.repository = (0, persistence_store_1.createFilePersistenceStore)(path.join(dataDir, 'events'), '.event.json');
    }
    /**
     * 存储事件
     */
    async store(event) {
        const record = {
            ...event,
            processed: false,
        };
        await this.repository.save(record.eventId, record);
        return record;
    }
    /**
     * 标记事件已处理
     */
    async markProcessed(eventId, result) {
        const record = await this.repository.load(eventId);
        if (!record) {
            return null;
        }
        record.processed = true;
        record.processedAt = Date.now();
        record.result = result;
        await this.repository.save(eventId, record);
        return record;
    }
    /**
     * 获取事件
     */
    async getById(eventId) {
        return await this.repository.load(eventId);
    }
    /**
     * 查询事件
     */
    async query(query) {
        const allEvents = await this.repository.list();
        // 应用过滤器
        let filtered = allEvents.filter((event) => {
            if (query.type && event.type !== query.type) {
                return false;
            }
            if (query.severity && event.severity !== query.severity) {
                return false;
            }
            if (query.source && event.source.system !== query.source) {
                return false;
            }
            if (query.startTime && event.timestamp < query.startTime) {
                return false;
            }
            if (query.endTime && event.timestamp > query.endTime) {
                return false;
            }
            if (query.processed !== undefined && event.processed !== query.processed) {
                return false;
            }
            return true;
        });
        // 按时间排序（最新的在前）
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        const total = filtered.length;
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        const events = filtered.slice(offset, offset + limit);
        return { total, events };
    }
    /**
     * 获取未处理事件
     */
    async getUnprocessed(limit = 100) {
        const result = await this.query({ processed: false, limit });
        return result.events;
    }
    /**
     * 获取最近事件
     */
    async getRecent(hours = 24, limit = 100) {
        const now = Date.now();
        const startTime = now - hours * 60 * 60 * 1000;
        const result = await this.query({ startTime, limit });
        return result.events;
    }
    /**
     * 获取事件统计
     */
    async getStats(timeRangeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const cutoff = now - timeRangeMs;
        const allEvents = await this.repository.list();
        const recentEvents = allEvents.filter((e) => e.timestamp >= cutoff);
        const byType = new Map();
        const bySeverity = new Map();
        const bySource = new Map();
        let processedCount = 0;
        for (const event of recentEvents) {
            byType.set(event.type, (byType.get(event.type) || 0) + 1);
            bySeverity.set(event.severity, (bySeverity.get(event.severity) || 0) + 1);
            bySource.set(event.source.system, (bySource.get(event.source.system) || 0) + 1);
            if (event.processed) {
                processedCount++;
            }
        }
        return {
            total: recentEvents.length,
            byType,
            bySeverity,
            bySource,
            processed: processedCount,
            unprocessed: recentEvents.length - processedCount,
        };
    }
    /**
     * 删除事件
     */
    async delete(eventId) {
        await this.repository.delete(eventId);
    }
    /**
     * 清理旧事件
     */
    async cleanup(maxAgeDays = 30) {
        const now = Date.now();
        const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
        const allEvents = await this.repository.list();
        let deletedCount = 0;
        for (const event of allEvents) {
            if (event.timestamp < cutoff && event.processed) {
                await this.repository.delete(event.eventId);
                deletedCount++;
            }
        }
        return deletedCount;
    }
}
exports.EventRepository = EventRepository;
// ============================================================================
// Factory Function
// ============================================================================
function createEventRepository(dataDir) {
    return new EventRepository(dataDir);
}
