"use strict";
/**
 * Audit Log Service
 * Phase 2E-2 - 审计日志服务
 *
 * 职责：
 * - 记录所有关键操作
 * - 提供审计查询接口
 * - 支持日志轮转
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
exports.AuditLogService = void 0;
exports.createAuditLogService = createAuditLogService;
const persistence_store_1 = require("./persistence_store");
const path = __importStar(require("path"));
// ============================================================================
// Audit Log Service
// ============================================================================
class AuditLogService {
    constructor(dataDir, maxLogAgeDays = 30) {
        this.repository = (0, persistence_store_1.createFilePersistenceStore)(path.join(dataDir, 'audit-logs'), '.log.json');
        this.maxLogAge = maxLogAgeDays * 24 * 60 * 60 * 1000;
    }
    /**
     * 记录审计日志
     */
    async log(action, actor, target, details, result, metadata) {
        const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            action,
            actor,
            target,
            details,
            result,
            metadata: metadata || {},
        };
        await this.repository.save(entry.id, entry);
        return entry.id;
    }
    /**
     * 查询审计日志
     */
    async query(query) {
        const allEntries = await this.repository.list();
        // 应用过滤器
        let filtered = allEntries.filter((entry) => {
            if (query.action && entry.action !== query.action) {
                return false;
            }
            if (query.actorId && entry.actor.userId !== query.actorId) {
                return false;
            }
            if (query.targetType && entry.target.type !== query.targetType) {
                return false;
            }
            if (query.targetId && entry.target.id !== query.targetId) {
                return false;
            }
            if (query.startTime && entry.timestamp < query.startTime) {
                return false;
            }
            if (query.endTime && entry.timestamp > query.endTime) {
                return false;
            }
            if (query.success !== undefined && entry.result.success !== query.success) {
                return false;
            }
            return true;
        });
        // 按时间排序（最新的在前）
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        const total = filtered.length;
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        const entries = filtered.slice(offset, offset + limit);
        return { total, entries };
    }
    /**
     * 获取特定目标的审计历史
     */
    async getTargetHistory(targetType, targetId, limit = 100) {
        const result = await this.query({
            targetType,
            targetId,
            limit,
        });
        return result.entries;
    }
    /**
     * 获取用户的操作历史
     */
    async getUserHistory(userId, limit = 100) {
        const result = await this.query({
            actorId: userId,
            limit,
        });
        return result.entries;
    }
    /**
     * 清理旧日志
     */
    async cleanup() {
        const now = Date.now();
        const cutoff = now - this.maxLogAge;
        const allEntries = await this.repository.list();
        let deletedCount = 0;
        for (const entry of allEntries) {
            if (entry.timestamp < cutoff) {
                await this.repository.delete(entry.id);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * 获取统计信息
     */
    async getStats(timeRangeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const cutoff = now - timeRangeMs;
        const allEntries = await this.repository.list();
        const recentEntries = allEntries.filter((e) => e.timestamp >= cutoff);
        const byAction = new Map();
        const byUser = new Map();
        let successCount = 0;
        for (const entry of recentEntries) {
            byAction.set(entry.action, (byAction.get(entry.action) || 0) + 1);
            byUser.set(entry.actor.userId, (byUser.get(entry.actor.userId) || 0) + 1);
            if (entry.result.success) {
                successCount++;
            }
        }
        const total = recentEntries.length;
        const successRate = total > 0 ? successCount / total : 0;
        return {
            total,
            byAction,
            byUser,
            successRate,
        };
    }
}
exports.AuditLogService = AuditLogService;
// ============================================================================
// Factory Function
// ============================================================================
function createAuditLogService(dataDir, maxLogAgeDays) {
    return new AuditLogService(dataDir, maxLogAgeDays);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaXRfbG9nX3NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5mcmFzdHJ1Y3R1cmUvcGVyc2lzdGVuY2UvYXVkaXRfbG9nX3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnUUgsc0RBS0M7QUFuUUQsMkRBQTZGO0FBQzdGLDJDQUE2QjtBQTBFN0IsK0VBQStFO0FBQy9FLG9CQUFvQjtBQUNwQiwrRUFBK0U7QUFFL0UsTUFBYSxlQUFlO0lBSTFCLFlBQVksT0FBZSxFQUFFLGdCQUF3QixFQUFFO1FBQ3JELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBQSw4Q0FBMEIsRUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLEVBQ2hDLFdBQVcsQ0FDWixDQUFDO1FBQ0YsSUFBSSxDQUFDLFNBQVMsR0FBRyxhQUFhLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQ3ZELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxHQUFHLENBQ1AsTUFBbUIsRUFDbkIsS0FBNEQsRUFDNUQsTUFBb0MsRUFDcEMsT0FBNEIsRUFDNUIsTUFBNEMsRUFDNUMsUUFBeUU7UUFFekUsTUFBTSxLQUFLLEdBQWtCO1lBQzNCLEVBQUUsRUFBRSxTQUFTLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDcEUsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDckIsTUFBTTtZQUNOLEtBQUs7WUFDTCxNQUFNO1lBQ04sT0FBTztZQUNQLE1BQU07WUFDTixRQUFRLEVBQUUsUUFBUSxJQUFJLEVBQUU7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XG4gKiBBdWRpdCBMb2cgU2VydmljZVxuICogUGhhc2UgMkUtMiAtIOWuoeiuoeaXpeW/l+acjeWKoVxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g6K6w5b2V5omA5pyJ5YWz6ZSu5pON5L2cXG4gKiAtIOaPkOS+m+WuoeiuoeafpeivouaOpeWPo1xuICogLSDmlK/mjIHml6Xlv5fova7ovaxcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVGaWxlUGVyc2lzdGVuY2VTdG9yZSwgdHlwZSBQZXJzaXN0ZW5jZVJlcG9zaXRvcnkgfSBmcm9tICcuL3BlcnNpc3RlbmNlX3N0b3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgdHlwZSBBdWRpdEFjdGlvbiA9XG4gIHwgJ3dlYmhvb2tfcmVjZWl2ZWQnXG4gIHwgJ2V2ZW50X2NyZWF0ZWQnXG4gIHwgJ2FwcHJvdmFsX2NyZWF0ZWQnXG4gIHwgJ2FwcHJvdmFsX2FwcHJvdmVkJ1xuICB8ICdhcHByb3ZhbF9yZWplY3RlZCdcbiAgfCAnaW5jaWRlbnRfY3JlYXRlZCdcbiAgfCAnaW5jaWRlbnRfYWNrbm93bGVkZ2VkJ1xuICB8ICdpbmNpZGVudF9yZXNvbHZlZCdcbiAgfCAncnVuYm9va19hY3Rpb25fY3JlYXRlZCdcbiAgfCAncnVuYm9va19hY3Rpb25fZXhlY3V0ZWQnXG4gIHwgJ3Jpc2tfYnJlYWNoX3JlY29yZGVkJ1xuICB8ICdyaXNrX2xldmVsX2NoYW5nZWQnXG4gIHwgJ2Nvbm5lY3Rvcl93cml0ZWJhY2snXG4gIHwgJ3JlcGxheV9wbGFuX2dlbmVyYXRlZCdcbiAgfCAncmVwbGF5X3N0YXJ0ZWQnXG4gIHwgJ3JlcGxheV9jb21wbGV0ZWQnXG4gIHwgJ3JlY292ZXJ5X3NjYW5fc3RhcnRlZCdcbiAgfCAncmVjb3Zlcnlfc2Nhbl9jb21wbGV0ZWQnXG4gIHwgJ3JlY292ZXJ5X3JlYnVpbGRfc3RhcnRlZCdcbiAgfCAncmVjb3ZlcnlfcmVidWlsZF9jb21wbGV0ZWQnXG4gIHwgJ2FwcHJvdmFsX3RpbWVvdXQnXG4gIHwgJ2luY2lkZW50X3RpbWVvdXQnXG4gIHwgJ3JlY292ZXJ5X3NjYW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1ZGl0TG9nRW50cnkge1xuICBpZDogc3RyaW5nO1xuICB0aW1lc3RhbXA6IG51bWJlcjtcbiAgYWN0aW9uOiBBdWRpdEFjdGlvbjtcbiAgYWN0b3I6IHtcbiAgICB1c2VySWQ6IHN0cmluZztcbiAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgIHNvdXJjZT86IHN0cmluZztcbiAgfTtcbiAgdGFyZ2V0OiB7XG4gICAgdHlwZTogc3RyaW5nO1xuICAgIGlkOiBzdHJpbmc7XG4gIH07XG4gIGRldGFpbHM6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIHJlc3VsdDoge1xuICAgIHN1Y2Nlc3M6IGJvb2xlYW47XG4gICAgZXJyb3I/OiBzdHJpbmc7XG4gIH07XG4gIG1ldGFkYXRhOiB7XG4gICAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICAgIHJlcXVlc3RJZD86IHN0cmluZztcbiAgICBpcEFkZHJlc3M/OiBzdHJpbmc7XG4gICAgY29ycmVsYXRpb25JZD86IHN0cmluZztcbiAgICByZWxhdGVkT2JqZWN0cz86IEFycmF5PHtcbiAgICAgIHR5cGU6IHN0cmluZztcbiAgICAgIGlkOiBzdHJpbmc7XG4gICAgICByZWxhdGlvbnNoaXA6ICdwYXJlbnQnIHwgJ2NoaWxkJyB8ICdyZWxhdGVkJztcbiAgICB9PjtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBdWRpdExvZ1F1ZXJ5IHtcbiAgYWN0aW9uPzogQXVkaXRBY3Rpb247XG4gIGFjdG9ySWQ/OiBzdHJpbmc7XG4gIHRhcmdldFR5cGU/OiBzdHJpbmc7XG4gIHRhcmdldElkPzogc3RyaW5nO1xuICBzdGFydFRpbWU/OiBudW1iZXI7XG4gIGVuZFRpbWU/OiBudW1iZXI7XG4gIHN1Y2Nlc3M/OiBib29sZWFuO1xuICBsaW1pdD86IG51bWJlcjtcbiAgb2Zmc2V0PzogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBBdWRpdCBMb2cgU2VydmljZVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgQXVkaXRMb2dTZXJ2aWNlIHtcbiAgcHJpdmF0ZSByZXBvc2l0b3J5OiBQZXJzaXN0ZW5jZVJlcG9zaXRvcnk8QXVkaXRMb2dFbnRyeT47XG4gIHByaXZhdGUgbWF4TG9nQWdlOiBudW1iZXI7IC8vIG1pbGxpc2Vjb25kc1xuXG4gIGNvbnN0cnVjdG9yKGRhdGFEaXI6IHN0cmluZywgbWF4TG9nQWdlRGF5czogbnVtYmVyID0gMzApIHtcbiAgICB0aGlzLnJlcG9zaXRvcnkgPSBjcmVhdGVGaWxlUGVyc2lzdGVuY2VTdG9yZTxBdWRpdExvZ0VudHJ5PihcbiAgICAgIHBhdGguam9pbihkYXRhRGlyLCAnYXVkaXQtbG9ncycpLFxuICAgICAgJy5sb2cuanNvbidcbiAgICApO1xuICAgIHRoaXMubWF4TG9nQWdlID0gbWF4TG9nQWdlRGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XG4gIH1cblxuICAvKipcbiAgICog6K6w5b2V5a6h6K6h5pel5b+XXG4gICAqL1xuICBhc3luYyBsb2coXG4gICAgYWN0aW9uOiBBdWRpdEFjdGlvbixcbiAgICBhY3RvcjogeyB1c2VySWQ6IHN0cmluZzsgdXNlcm5hbWU6IHN0cmluZzsgc291cmNlPzogc3RyaW5nIH0sXG4gICAgdGFyZ2V0OiB7IHR5cGU6IHN0cmluZzsgaWQ6IHN0cmluZyB9LFxuICAgIGRldGFpbHM6IFJlY29yZDxzdHJpbmcsIGFueT4sXG4gICAgcmVzdWx0OiB7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0sXG4gICAgbWV0YWRhdGE/OiB7IHNlc3Npb25JZD86IHN0cmluZzsgcmVxdWVzdElkPzogc3RyaW5nOyBpcEFkZHJlc3M/OiBzdHJpbmcgfVxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGVudHJ5OiBBdWRpdExvZ0VudHJ5ID0ge1xuICAgICAgaWQ6IGBhdWRpdF8ke0RhdGUubm93KCl9XyR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfWAsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBhY3Rpb24sXG4gICAgICBhY3RvcixcbiAgICAgIHRhcmdldCxcbiAgICAgIGRldGFpbHMsXG4gICAgICByZXN1bHQsXG4gICAgICBtZXRhZGF0YTogbWV0YWRhdGEgfHwge30sXG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5zYXZlKGVudHJ5LmlkLCBlbnRyeSk7XG4gICAgcmV0dXJuIGVudHJ5LmlkO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouWuoeiuoeaXpeW/l1xuICAgKi9cbiAgYXN5bmMgcXVlcnkocXVlcnk6IEF1ZGl0TG9nUXVlcnkpOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIGVudHJpZXM6IEF1ZGl0TG9nRW50cnlbXTtcbiAgfT4ge1xuICAgIGNvbnN0IGFsbEVudHJpZXMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgLy8g5bqU55So6L+H5ruk5ZmoXG4gICAgbGV0IGZpbHRlcmVkID0gYWxsRW50cmllcy5maWx0ZXIoKGVudHJ5KSA9PiB7XG4gICAgICBpZiAocXVlcnkuYWN0aW9uICYmIGVudHJ5LmFjdGlvbiAhPT0gcXVlcnkuYWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChxdWVyeS5hY3RvcklkICYmIGVudHJ5LmFjdG9yLnVzZXJJZCAhPT0gcXVlcnkuYWN0b3JJZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkudGFyZ2V0VHlwZSAmJiBlbnRyeS50YXJnZXQudHlwZSAhPT0gcXVlcnkudGFyZ2V0VHlwZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkudGFyZ2V0SWQgJiYgZW50cnkudGFyZ2V0LmlkICE9PSBxdWVyeS50YXJnZXRJZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuc3RhcnRUaW1lICYmIGVudHJ5LnRpbWVzdGFtcCA8IHF1ZXJ5LnN0YXJ0VGltZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuZW5kVGltZSAmJiBlbnRyeS50aW1lc3RhbXAgPiBxdWVyeS5lbmRUaW1lKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChxdWVyeS5zdWNjZXNzICE9PSB1bmRlZmluZWQgJiYgZW50cnkucmVzdWx0LnN1Y2Nlc3MgIT09IHF1ZXJ5LnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICAvLyDmjInml7bpl7TmjpLluo/vvIjmnIDmlrDnmoTlnKjliY3vvIlcbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLnRpbWVzdGFtcCAtIGEudGltZXN0YW1wKTtcblxuICAgIGNvbnN0IHRvdGFsID0gZmlsdGVyZWQubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IHF1ZXJ5Lm9mZnNldCB8fCAwO1xuICAgIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTAwO1xuICAgIGNvbnN0IGVudHJpZXMgPSBmaWx0ZXJlZC5zbGljZShvZmZzZXQsIG9mZnNldCArIGxpbWl0KTtcblxuICAgIHJldHVybiB7IHRvdGFsLCBlbnRyaWVzIH07XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W54m55a6a55uu5qCH55qE5a6h6K6h5Y6G5Y+yXG4gICAqL1xuICBhc3luYyBnZXRUYXJnZXRIaXN0b3J5KFxuICAgIHRhcmdldFR5cGU6IHN0cmluZyxcbiAgICB0YXJnZXRJZDogc3RyaW5nLFxuICAgIGxpbWl0OiBudW1iZXIgPSAxMDBcbiAgKTogUHJvbWlzZTxBdWRpdExvZ0VudHJ5W10+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnF1ZXJ5KHtcbiAgICAgIHRhcmdldFR5cGUsXG4gICAgICB0YXJnZXRJZCxcbiAgICAgIGxpbWl0LFxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQuZW50cmllcztcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bnlKjmiLfnmoTmk43kvZzljoblj7JcbiAgICovXG4gIGFzeW5jIGdldFVzZXJIaXN0b3J5KFxuICAgIHVzZXJJZDogc3RyaW5nLFxuICAgIGxpbWl0OiBudW1iZXIgPSAxMDBcbiAgKTogUHJvbWlzZTxBdWRpdExvZ0VudHJ5W10+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnF1ZXJ5KHtcbiAgICAgIGFjdG9ySWQ6IHVzZXJJZCxcbiAgICAgIGxpbWl0LFxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQuZW50cmllcztcbiAgfVxuXG4gIC8qKlxuICAgKiDmuIXnkIbml6fml6Xlv5dcbiAgICovXG4gIGFzeW5jIGNsZWFudXAoKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGN1dG9mZiA9IG5vdyAtIHRoaXMubWF4TG9nQWdlO1xuICAgIGNvbnN0IGFsbEVudHJpZXMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgbGV0IGRlbGV0ZWRDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBhbGxFbnRyaWVzKSB7XG4gICAgICBpZiAoZW50cnkudGltZXN0YW1wIDwgY3V0b2ZmKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5kZWxldGUoZW50cnkuaWQpO1xuICAgICAgICBkZWxldGVkQ291bnQrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZXRlZENvdW50O1xuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPlue7n+iuoeS/oeaBr1xuICAgKi9cbiAgYXN5bmMgZ2V0U3RhdHModGltZVJhbmdlTXM6IG51bWJlciA9IDI0ICogNjAgKiA2MCAqIDEwMDApOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIGJ5QWN0aW9uOiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgIGJ5VXNlcjogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICBzdWNjZXNzUmF0ZTogbnVtYmVyO1xuICB9PiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjdXRvZmYgPSBub3cgLSB0aW1lUmFuZ2VNcztcbiAgICBjb25zdCBhbGxFbnRyaWVzID0gYXdhaXQgdGhpcy5yZXBvc2l0b3J5Lmxpc3QoKTtcblxuICAgIGNvbnN0IHJlY2VudEVudHJpZXMgPSBhbGxFbnRyaWVzLmZpbHRlcigoZSkgPT4gZS50aW1lc3RhbXAgPj0gY3V0b2ZmKTtcbiAgICBjb25zdCBieUFjdGlvbiA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3QgYnlVc2VyID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcblxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgcmVjZW50RW50cmllcykge1xuICAgICAgYnlBY3Rpb24uc2V0KGVudHJ5LmFjdGlvbiwgKGJ5QWN0aW9uLmdldChlbnRyeS5hY3Rpb24pIHx8IDApICsgMSk7XG4gICAgICBieVVzZXIuc2V0KGVudHJ5LmFjdG9yLnVzZXJJZCwgKGJ5VXNlci5nZXQoZW50cnkuYWN0b3IudXNlcklkKSB8fCAwKSArIDEpO1xuICAgICAgaWYgKGVudHJ5LnJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRvdGFsID0gcmVjZW50RW50cmllcy5sZW5ndGg7XG4gICAgY29uc3Qgc3VjY2Vzc1JhdGUgPSB0b3RhbCA+IDAgPyBzdWNjZXNzQ291bnQgLyB0b3RhbCA6IDA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG90YWwsXG4gICAgICBieUFjdGlvbixcbiAgICAgIGJ5VXNlcixcbiAgICAgIHN1Y2Nlc3NSYXRlLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRmFjdG9yeSBGdW5jdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaXRMb2dTZXJ2aWNlKFxuICBkYXRhRGlyOiBzdHJpbmcsXG4gIG1heExvZ0FnZURheXM/OiBudW1iZXJcbik6IEF1ZGl0TG9nU2VydmljZSB7XG4gIHJldHVybiBuZXcgQXVkaXRMb2dTZXJ2aWNlKGRhdGFEaXIsIG1heExvZ0FnZURheXMpO1xufVxuIl19