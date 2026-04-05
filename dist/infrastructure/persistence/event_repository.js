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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRfcmVwb3NpdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbmZyYXN0cnVjdHVyZS9wZXJzaXN0ZW5jZS9ldmVudF9yZXBvc2l0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaVBILHNEQUVDO0FBalBELDJEQUE2RjtBQUM3RiwyQ0FBNkI7QUFvRDdCLCtFQUErRTtBQUMvRSxtQkFBbUI7QUFDbkIsK0VBQStFO0FBRS9FLE1BQWEsZUFBZTtJQUcxQixZQUFZLE9BQWU7UUFDekIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFBLDhDQUEwQixFQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsRUFDNUIsYUFBYSxDQUNkLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQTRDO1FBQ3RELE1BQU0sTUFBTSxHQUF1QjtZQUNqQyxHQUFHLEtBQUs7WUFDUixTQUFTLEVBQUUsS0FBSztTQUNqQixDQUFDO1FBRUYsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ25ELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQ2pCLE9BQWUsRUFDZixNQUFxQztRQUVyQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFB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Q0FBQyxTQUFTLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDaEQsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzVDLFlBQVksRUFBRSxDQUFDO1lBQ2pCLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTyxZQUFZLENBQUM7SUFDdEIsQ0FBQztDQUNGO0FBaExELDBDQWdMQztBQUVELCtFQUErRTtBQUMvRSxtQkFBbUI7QUFDbkIsK0VBQStFO0FBRS9FLFNBQWdCLHFCQUFxQixDQUFDLE9BQWU7SUFDbkQsT0FBTyxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFdmVudCBSZXBvc2l0b3J5XG4gKiBQaGFzZSAyRS0xIC0g5LqL5Lu25oyB5LmF5YyW5a2Y5YKoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSBUcmFkaW5nIOS6i+S7tuWtmOWCqC/liqDovb1cbiAqIC0g5LqL5Lu25p+l6K+iXG4gKiAtIOS6i+S7tue7n+iuoVxuICovXG5cbmltcG9ydCB7IGNyZWF0ZUZpbGVQZXJzaXN0ZW5jZVN0b3JlLCB0eXBlIFBlcnNpc3RlbmNlUmVwb3NpdG9yeSB9IGZyb20gJy4vcGVyc2lzdGVuY2Vfc3RvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIFRyYWRpbmdFdmVudFR5cGUgPVxuICB8ICdyZWxlYXNlX3JlcXVlc3RlZCdcbiAgfCAnZGVwbG95bWVudF9wZW5kaW5nJ1xuICB8ICdkZXBsb3ltZW50X2ZhaWxlZCdcbiAgfCAnc3lzdGVtX2FsZXJ0J1xuICB8ICdyaXNrX2JyZWFjaCdcbiAgfCAnZXhlY3V0aW9uX2Fub21hbHknO1xuXG5leHBvcnQgdHlwZSBUcmFkaW5nU2V2ZXJpdHkgPSAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJztcblxuZXhwb3J0IGludGVyZmFjZSBUcmFkaW5nRXZlbnRSZWNvcmQge1xuICBldmVudElkOiBzdHJpbmc7XG4gIHR5cGU6IFRyYWRpbmdFdmVudFR5cGU7XG4gIHNldmVyaXR5OiBUcmFkaW5nU2V2ZXJpdHk7XG4gIHNvdXJjZToge1xuICAgIHN5c3RlbTogc3RyaW5nO1xuICAgIGNvbXBvbmVudDogc3RyaW5nO1xuICAgIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIH07XG4gIGFjdG9yOiB7XG4gICAgdXNlcklkOiBzdHJpbmc7XG4gICAgdXNlcm5hbWU6IHN0cmluZztcbiAgfTtcbiAgbWV0YWRhdGE6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIHRpbWVzdGFtcDogbnVtYmVyO1xuICBwcm9jZXNzZWQ6IGJvb2xlYW47XG4gIHByb2Nlc3NlZEF0PzogbnVtYmVyO1xuICByZXN1bHQ/OiB7XG4gICAgYXBwcm92YWxDcmVhdGVkPzogYm9vbGVhbjtcbiAgICBpbmNpZGVudENyZWF0ZWQ/OiBib29sZWFuO1xuICAgIGF1dG9BcHByb3ZlZD86IGJvb2xlYW47XG4gICAgaWdub3JlZD86IGJvb2xlYW47XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZlbnRRdWVyeSB7XG4gIHR5cGU/OiBUcmFkaW5nRXZlbnRUeXBlO1xuICBzZXZlcml0eT86IFRyYWRpbmdTZXZlcml0eTtcbiAgc291cmNlPzogc3RyaW5nO1xuICBzdGFydFRpbWU/OiBudW1iZXI7XG4gIGVuZFRpbWU/OiBudW1iZXI7XG4gIHByb2Nlc3NlZD86IGJvb2xlYW47XG4gIGxpbWl0PzogbnVtYmVyO1xuICBvZmZzZXQ/OiBudW1iZXI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEV2ZW50IFJlcG9zaXRvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEV2ZW50UmVwb3NpdG9yeSB7XG4gIHByaXZhdGUgcmVwb3NpdG9yeTogUGVyc2lzdGVuY2VSZXBvc2l0b3J5PFRyYWRpbmdFdmVudFJlY29yZD47XG5cbiAgY29uc3RydWN0b3IoZGF0YURpcjogc3RyaW5nKSB7XG4gICAgdGhpcy5yZXBvc2l0b3J5ID0gY3JlYXRlRmlsZVBlcnNpc3RlbmNlU3RvcmU8VHJhZGluZ0V2ZW50UmVjb3JkPihcbiAgICAgIHBhdGguam9pbihkYXRhRGlyLCAnZXZlbnRzJyksXG4gICAgICAnLmV2ZW50Lmpzb24nXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrZjlgqjkuovku7ZcbiAgICovXG4gIGFzeW5jIHN0b3JlKGV2ZW50OiBPbWl0PFRyYWRpbmdFdmVudFJlY29yZCwgJ3Byb2Nlc3NlZCc+KTogUHJvbWlzZTxUcmFkaW5nRXZlbnRSZWNvcmQ+IHtcbiAgICBjb25zdCByZWNvcmQ6IFRyYWRpbmdFdmVudFJlY29yZCA9IHtcbiAgICAgIC4uLmV2ZW50LFxuICAgICAgcHJvY2Vzc2VkOiBmYWxzZSxcbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy5yZXBvc2l0b3J5LnNhdmUocmVjb3JkLmV2ZW50SWQsIHJlY29yZCk7XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiDmoIforrDkuovku7blt7LlpITnkIZcbiAgICovXG4gIGFzeW5jIG1hcmtQcm9jZXNzZWQoXG4gICAgZXZlbnRJZDogc3RyaW5nLFxuICAgIHJlc3VsdD86IFRyYWRpbmdFdmVudFJlY29yZFsncmVzdWx0J11cbiAgKTogUHJvbWlzZTxUcmFkaW5nRXZlbnRSZWNvcmQgfCBudWxsPiB7XG4gICAgY29uc3QgcmVjb3JkID0gYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmxvYWQoZXZlbnRJZCk7XG4gICAgaWYgKCFyZWNvcmQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlY29yZC5wcm9jZXNzZWQgPSB0cnVlO1xuICAgIHJlY29yZC5wcm9jZXNzZWRBdCA9IERhdGUubm93KCk7XG4gICAgcmVjb3JkLnJlc3VsdCA9IHJlc3VsdDtcblxuICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5zYXZlKGV2ZW50SWQsIHJlY29yZCk7XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bkuovku7ZcbiAgICovXG4gIGFzeW5jIGdldEJ5SWQoZXZlbnRJZDogc3RyaW5nKTogUHJvbWlzZTxUcmFkaW5nRXZlbnRSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5sb2FkKGV2ZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouS6i+S7tlxuICAgKi9cbiAgYXN5bmMgcXVlcnkocXVlcnk6IEV2ZW50UXVlcnkpOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIGV2ZW50czogVHJhZGluZ0V2ZW50UmVjb3JkW107XG4gIH0+IHtcbiAgICBjb25zdCBhbGxFdmVudHMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgLy8g5bqU55So6L+H5ruk5ZmoXG4gICAgbGV0IGZpbHRlcmVkID0gYWxsRXZlbnRzLmZpbHRlcigoZXZlbnQpID0+IHtcbiAgICAgIGlmIChxdWVyeS50eXBlICYmIGV2ZW50LnR5cGUgIT09IHF1ZXJ5LnR5cGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LnNldmVyaXR5ICYmIGV2ZW50LnNldmVyaXR5ICE9PSBxdWVyeS5zZXZlcml0eSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuc291cmNlICYmIGV2ZW50LnNvdXJjZS5zeXN0ZW0gIT09IHF1ZXJ5LnNvdXJjZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuc3RhcnRUaW1lICYmIGV2ZW50LnRpbWVzdGFtcCA8IHF1ZXJ5LnN0YXJ0VGltZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuZW5kVGltZSAmJiBldmVudC50aW1lc3RhbXAgPiBxdWVyeS5lbmRUaW1lKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChxdWVyeS5wcm9jZXNzZWQgIT09IHVuZGVmaW5lZCAmJiBldmVudC5wcm9jZXNzZWQgIT09IHF1ZXJ5LnByb2Nlc3NlZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIC8vIOaMieaXtumXtOaOkuW6j++8iOacgOaWsOeahOWcqOWJje+8iVxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIudGltZXN0YW1wIC0gYS50aW1lc3RhbXApO1xuXG4gICAgY29uc3QgdG90YWwgPSBmaWx0ZXJlZC5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gcXVlcnkub2Zmc2V0IHx8IDA7XG4gICAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDA7XG4gICAgY29uc3QgZXZlbnRzID0gZmlsdGVyZWQuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBsaW1pdCk7XG5cbiAgICByZXR1cm4geyB0b3RhbCwgZXZlbnRzIH07XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W5pyq5aSE55CG5LqL5Lu2XG4gICAqL1xuICBhc3luYyBnZXRVbnByb2Nlc3NlZChsaW1pdDogbnVtYmVyID0gMTAwKTogUHJvbWlzZTxUcmFkaW5nRXZlbnRSZWNvcmRbXT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkoeyBwcm9jZXNzZWQ6IGZhbHNlLCBsaW1pdCB9KTtcbiAgICByZXR1cm4gcmVzdWx0LmV2ZW50cztcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bmnIDov5Hkuovku7ZcbiAgICovXG4gIGFzeW5jIGdldFJlY2VudChob3VyczogbnVtYmVyID0gMjQsIGxpbWl0OiBudW1iZXIgPSAxMDApOiBQcm9taXNlPFRyYWRpbmdFdmVudFJlY29yZFtdPiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBub3cgLSBob3VycyAqIDYwICogNjAgKiAxMDAwO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkoeyBzdGFydFRpbWUsIGxpbWl0IH0pO1xuICAgIHJldHVybiByZXN1bHQuZXZlbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPluS6i+S7tue7n+iuoVxuICAgKi9cbiAgYXN5bmMgZ2V0U3RhdHModGltZVJhbmdlTXM6IG51bWJlciA9IDI0ICogNjAgKiA2MCAqIDEwMDApOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIGJ5VHlwZTogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICBieVNldmVyaXR5OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgIGJ5U291cmNlOiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgIHByb2Nlc3NlZDogbnVtYmVyO1xuICAgIHVucHJvY2Vzc2VkOiBudW1iZXI7XG4gIH0+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGN1dG9mZiA9IG5vdyAtIHRpbWVSYW5nZU1zO1xuICAgIGNvbnN0IGFsbEV2ZW50cyA9IGF3YWl0IHRoaXMucmVwb3NpdG9yeS5saXN0KCk7XG5cbiAgICBjb25zdCByZWNlbnRFdmVudHMgPSBhbGxFdmVudHMuZmlsdGVyKChlKSA9PiBlLnRpbWVzdGFtcCA+PSBjdXRvZmYpO1xuICAgIGNvbnN0IGJ5VHlwZSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3QgYnlTZXZlcml0eSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3QgYnlTb3VyY2UgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIGxldCBwcm9jZXNzZWRDb3VudCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIHJlY2VudEV2ZW50cykge1xuICAgICAgYnlUeXBlLnNldChldmVudC50eXBlLCAoYnlUeXBlLmdldChldmVudC50eXBlKSB8fCAwKSArIDEpO1xuICAgICAgYnlTZXZlcml0eS5zZXQoZXZlbnQuc2V2ZXJpdHksIChieVNldmVyaXR5LmdldChldmVudC5zZXZlcml0eSkgfHwgMCkgKyAxKTtcbiAgICAgIGJ5U291cmNlLnNldChldmVudC5zb3VyY2Uuc3lzdGVtLCAoYnlTb3VyY2UuZ2V0KGV2ZW50LnNvdXJjZS5zeXN0ZW0pIHx8IDApICsgMSk7XG4gICAgICBpZiAoZXZlbnQucHJvY2Vzc2VkKSB7XG4gICAgICAgIHByb2Nlc3NlZENvdW50Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsOiByZWNlbnRFdmVudHMubGVuZ3RoLFxuICAgICAgYnlUeXBlLFxuICAgICAgYnlTZXZlcml0eSxcbiAgICAgIGJ5U291cmNlLFxuICAgICAgcHJvY2Vzc2VkOiBwcm9jZXNzZWRDb3VudCxcbiAgICAgIHVucHJvY2Vzc2VkOiByZWNlbnRFdmVudHMubGVuZ3RoIC0gcHJvY2Vzc2VkQ291bnQsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDliKDpmaTkuovku7ZcbiAgICovXG4gIGFzeW5jIGRlbGV0ZShldmVudElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnJlcG9zaXRvcnkuZGVsZXRlKGV2ZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOa4heeQhuaXp+S6i+S7tlxuICAgKi9cbiAgYXN5bmMgY2xlYW51cChtYXhBZ2VEYXlzOiBudW1iZXIgPSAzMCk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjdXRvZmYgPSBub3cgLSBtYXhBZ2VEYXlzICogMjQgKiA2MCAqIDYwICogMTAwMDtcbiAgICBjb25zdCBhbGxFdmVudHMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgbGV0IGRlbGV0ZWRDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBhbGxFdmVudHMpIHtcbiAgICAgIGlmIChldmVudC50aW1lc3RhbXAgPCBjdXRvZmYgJiYgZXZlbnQucHJvY2Vzc2VkKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5kZWxldGUoZXZlbnQuZXZlbnRJZCk7XG4gICAgICAgIGRlbGV0ZWRDb3VudCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkZWxldGVkQ291bnQ7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRmFjdG9yeSBGdW5jdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXZlbnRSZXBvc2l0b3J5KGRhdGFEaXI6IHN0cmluZyk6IEV2ZW50UmVwb3NpdG9yeSB7XG4gIHJldHVybiBuZXcgRXZlbnRSZXBvc2l0b3J5KGRhdGFEaXIpO1xufVxuIl19