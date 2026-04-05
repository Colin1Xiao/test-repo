"use strict";
/**
 * Incident Repository
 * Phase 2E-1 - 事件持久化存储
 *
 * 职责：
 * - 事件数据存储/加载
 * - 事件状态管理
 * - 事件历史查询
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
exports.IncidentRepository = void 0;
exports.createIncidentRepository = createIncidentRepository;
const persistence_store_1 = require("./persistence_store");
const path = __importStar(require("path"));
// ============================================================================
// Incident Repository
// ============================================================================
class IncidentRepository {
    constructor(dataDir) {
        this.repository = (0, persistence_store_1.createFilePersistenceStore)(path.join(dataDir, 'incidents'), '.incident.json');
    }
    /**
     * 创建事件
     */
    async create(incident) {
        const now = Date.now();
        const record = {
            ...incident,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.save(record.incidentId, record);
        return record;
    }
    /**
     * 获取事件
     */
    async getById(incidentId) {
        return await this.repository.load(incidentId);
    }
    /**
     * 更新事件状态
     */
    async updateStatus(incidentId, status, userId, resolution) {
        const record = await this.getById(incidentId);
        if (!record) {
            return null;
        }
        record.status = status;
        record.updatedAt = Date.now();
        if (status === 'acknowledged') {
            record.acknowledgedAt = Date.now();
            record.acknowledgedBy = userId;
        }
        else if (status === 'resolved') {
            record.resolvedAt = Date.now();
            record.resolvedBy = userId;
            record.resolution = resolution;
        }
        await this.repository.save(incidentId, record);
        return record;
    }
    /**
     * 确认事件
     */
    async acknowledge(incidentId, userId) {
        return this.updateStatus(incidentId, 'acknowledged', userId);
    }
    /**
     * 解决事件
     */
    async resolve(incidentId, userId, resolution) {
        return this.updateStatus(incidentId, 'resolved', userId, resolution);
    }
    /**
     * 关闭事件
     */
    async close(incidentId) {
        return this.updateStatus(incidentId, 'closed');
    }
    /**
     * 查询事件
     */
    async query(query) {
        const allIncidents = await this.repository.list();
        // 应用过滤器
        let filtered = allIncidents.filter((incident) => {
            if (query.status && incident.status !== query.status) {
                return false;
            }
            if (query.severity && incident.severity !== query.severity) {
                return false;
            }
            if (query.source && incident.metadata.source !== query.source) {
                return false;
            }
            if (query.type && incident.type !== query.type) {
                return false;
            }
            return true;
        });
        // 按创建时间排序（最新的在前）
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        const total = filtered.length;
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        const incidents = filtered.slice(offset, offset + limit);
        return { total, incidents };
    }
    /**
     * 获取活跃事件
     */
    async getActive(limit = 50) {
        const result = await this.query({ status: 'active', limit });
        return result.incidents;
    }
    /**
     * 获取未确认事件
     */
    async getUnacknowledged(limit = 50) {
        const result = await this.query({ status: 'active', limit });
        return result.incidents.filter((i) => !i.acknowledgedAt);
    }
    /**
     * 获取严重事件
     */
    async getCritical(limit = 50) {
        const result = await this.query({ severity: 'critical', limit });
        return result.incidents;
    }
    /**
     * 获取事件统计
     */
    async getStats() {
        const allIncidents = await this.repository.list();
        return {
            total: allIncidents.length,
            active: allIncidents.filter((i) => i.status === 'active').length,
            acknowledged: allIncidents.filter((i) => i.status === 'acknowledged').length,
            resolved: allIncidents.filter((i) => i.status === 'resolved').length,
            closed: allIncidents.filter((i) => i.status === 'closed').length,
            critical: allIncidents.filter((i) => i.severity === 'critical').length,
        };
    }
    /**
     * 删除事件
     */
    async delete(incidentId) {
        await this.repository.delete(incidentId);
    }
}
exports.IncidentRepository = IncidentRepository;
// ============================================================================
// Factory Function
// ============================================================================
function createIncidentRepository(dataDir) {
    return new IncidentRepository(dataDir);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jaWRlbnRfcmVwb3NpdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbmZyYXN0cnVjdHVyZS9wZXJzaXN0ZW5jZS9pbmNpZGVudF9yZXBvc2l0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb09ILDREQUVDO0FBcE9ELDJEQUE2RjtBQUM3RiwyQ0FBNkI7QUFzQzdCLCtFQUErRTtBQUMvRSxzQkFBc0I7QUFDdEIsK0VBQStFO0FBRS9FLE1BQWEsa0JBQWtCO0lBRzdCLFlBQVksT0FBZTtRQUN6QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUEsOENBQTBCLEVBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxFQUMvQixnQkFBZ0IsQ0FDakIsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBb0U7UUFDL0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sTUFBTSxHQUFtQjtZQUM3QixHQUFHLFFBQVE7WUFDWCxNQUFNLEVBQUUsUUFBUTtZQUNoQixTQUFTLEVBQUUsR0FBRztZQUNkLFNBQVMsRUFBRSxHQUFHO1NBQ2YsQ0FBQztRQUVGLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN0RCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQWtCO1FBQzlCLE9BQU8sTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsWUFBWSxDQUNoQixV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Q29udGVudCI6WyIvKipcbiAqIEluY2lkZW50IFJlcG9zaXRvcnlcbiAqIFBoYXNlIDJFLTEgLSDkuovku7bmjIHkuYXljJblrZjlgqhcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOS6i+S7tuaVsOaNruWtmOWCqC/liqDovb1cbiAqIC0g5LqL5Lu254q25oCB566h55CGXG4gKiAtIOS6i+S7tuWOhuWPsuafpeivolxuICovXG5cbmltcG9ydCB7IGNyZWF0ZUZpbGVQZXJzaXN0ZW5jZVN0b3JlLCB0eXBlIFBlcnNpc3RlbmNlUmVwb3NpdG9yeSB9IGZyb20gJy4vcGVyc2lzdGVuY2Vfc3RvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCB0eXBlIEluY2lkZW50U2V2ZXJpdHkgPSAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJztcblxuZXhwb3J0IGludGVyZmFjZSBJbmNpZGVudFJlY29yZCB7XG4gIGluY2lkZW50SWQ6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzZXZlcml0eTogSW5jaWRlbnRTZXZlcml0eTtcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgc3RhdHVzOiAnYWN0aXZlJyB8ICdhY2tub3dsZWRnZWQnIHwgJ3Jlc29sdmVkJyB8ICdjbG9zZWQnO1xuICBtZXRhZGF0YToge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuICAgIHNvdXJjZVR5cGU6IHN0cmluZztcbiAgICBzb3VyY2VJZDogc3RyaW5nO1xuICAgIFtrZXk6IHN0cmluZ106IGFueTtcbiAgfTtcbiAgY3JlYXRlZEF0OiBudW1iZXI7XG4gIHVwZGF0ZWRBdDogbnVtYmVyO1xuICBhY2tub3dsZWRnZWRBdD86IG51bWJlcjtcbiAgYWNrbm93bGVkZ2VkQnk/OiBzdHJpbmc7XG4gIHJlc29sdmVkQXQ/OiBudW1iZXI7XG4gIHJlc29sdmVkQnk/OiBzdHJpbmc7XG4gIHJlc29sdXRpb24/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5jaWRlbnRRdWVyeSB7XG4gIHN0YXR1cz86ICdhY3RpdmUnIHwgJ2Fja25vd2xlZGdlZCcgfCAncmVzb2x2ZWQnIHwgJ2Nsb3NlZCc7XG4gIHNldmVyaXR5PzogSW5jaWRlbnRTZXZlcml0eTtcbiAgc291cmNlPzogc3RyaW5nO1xuICB0eXBlPzogc3RyaW5nO1xuICBsaW1pdD86IG51bWJlcjtcbiAgb2Zmc2V0PzogbnVtYmVyO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBJbmNpZGVudCBSZXBvc2l0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBJbmNpZGVudFJlcG9zaXRvcnkge1xuICBwcml2YXRlIHJlcG9zaXRvcnk6IFBlcnNpc3RlbmNlUmVwb3NpdG9yeTxJbmNpZGVudFJlY29yZD47XG5cbiAgY29uc3RydWN0b3IoZGF0YURpcjogc3RyaW5nKSB7XG4gICAgdGhpcy5yZXBvc2l0b3J5ID0gY3JlYXRlRmlsZVBlcnNpc3RlbmNlU3RvcmU8SW5jaWRlbnRSZWNvcmQ+KFxuICAgICAgcGF0aC5qb2luKGRhdGFEaXIsICdpbmNpZGVudHMnKSxcbiAgICAgICcuaW5jaWRlbnQuanNvbidcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIm+W7uuS6i+S7tlxuICAgKi9cbiAgYXN5bmMgY3JlYXRlKGluY2lkZW50OiBPbWl0PEluY2lkZW50UmVjb3JkLCAnY3JlYXRlZEF0JyB8ICd1cGRhdGVkQXQnIHwgJ3N0YXR1cyc+KTogUHJvbWlzZTxJbmNpZGVudFJlY29yZD4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3QgcmVjb3JkOiBJbmNpZGVudFJlY29yZCA9IHtcbiAgICAgIC4uLmluY2lkZW50LFxuICAgICAgc3RhdHVzOiAnYWN0aXZlJyxcbiAgICAgIGNyZWF0ZWRBdDogbm93LFxuICAgICAgdXBkYXRlZEF0OiBub3csXG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5zYXZlKHJlY29yZC5pbmNpZGVudElkLCByZWNvcmQpO1xuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W5LqL5Lu2XG4gICAqL1xuICBhc3luYyBnZXRCeUlkKGluY2lkZW50SWQ6IHN0cmluZyk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5sb2FkKGluY2lkZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOabtOaWsOS6i+S7tueKtuaAgVxuICAgKi9cbiAgYXN5bmMgdXBkYXRlU3RhdHVzKFxuICAgIGluY2lkZW50SWQ6IHN0cmluZyxcbiAgICBzdGF0dXM6IEluY2lkZW50UmVjb3JkWydzdGF0dXMnXSxcbiAgICB1c2VySWQ/OiBzdHJpbmcsXG4gICAgcmVzb2x1dGlvbj86IHN0cmluZ1xuICApOiBQcm9taXNlPEluY2lkZW50UmVjb3JkIHwgbnVsbD4ge1xuICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHRoaXMuZ2V0QnlJZChpbmNpZGVudElkKTtcbiAgICBpZiAoIXJlY29yZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmVjb3JkLnN0YXR1cyA9IHN0YXR1cztcbiAgICByZWNvcmQudXBkYXRlZEF0ID0gRGF0ZS5ub3coKTtcblxuICAgIGlmIChzdGF0dXMgPT09ICdhY2tub3dsZWRnZWQnKSB7XG4gICAgICByZWNvcmQuYWNrbm93bGVkZ2VkQXQgPSBEYXRlLm5vdygpO1xuICAgICAgcmVjb3JkLmFja25vd2xlZGdlZEJ5ID0gdXNlcklkO1xuICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSAncmVzb2x2ZWQnKSB7XG4gICAgICByZWNvcmQucmVzb2x2ZWRBdCA9IERhdGUubm93KCk7XG4gICAgICByZWNvcmQucmVzb2x2ZWRCeSA9IHVzZXJJZDtcbiAgICAgIHJlY29yZC5yZXNvbHV0aW9uID0gcmVzb2x1dGlvbjtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnJlcG9zaXRvcnkuc2F2ZShpbmNpZGVudElkLCByZWNvcmQpO1xuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICAvKipcbiAgICog56Gu6K6k5LqL5Lu2XG4gICAqL1xuICBhc3luYyBhY2tub3dsZWRnZShpbmNpZGVudElkOiBzdHJpbmcsIHVzZXJJZD86IHN0cmluZyk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlU3RhdHVzKGluY2lkZW50SWQsICdhY2tub3dsZWRnZWQnLCB1c2VySWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOino+WGs+S6i+S7tlxuICAgKi9cbiAgYXN5bmMgcmVzb2x2ZShcbiAgICBpbmNpZGVudElkOiBzdHJpbmcsXG4gICAgdXNlcklkPzogc3RyaW5nLFxuICAgIHJlc29sdXRpb24/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxJbmNpZGVudFJlY29yZCB8IG51bGw+IHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVTdGF0dXMoaW5jaWRlbnRJZCwgJ3Jlc29sdmVkJywgdXNlcklkLCByZXNvbHV0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlhbPpl63kuovku7ZcbiAgICovXG4gIGFzeW5jIGNsb3NlKGluY2lkZW50SWQ6IHN0cmluZyk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlU3RhdHVzKGluY2lkZW50SWQsICdjbG9zZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6Lkuovku7ZcbiAgICovXG4gIGFzeW5jIHF1ZXJ5KHF1ZXJ5OiBJbmNpZGVudFF1ZXJ5KTogUHJvbWlzZTx7XG4gICAgdG90YWw6IG51bWJlcjtcbiAgICBpbmNpZGVudHM6IEluY2lkZW50UmVjb3JkW107XG4gIH0+IHtcbiAgICBjb25zdCBhbGxJbmNpZGVudHMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgLy8g5bqU55So6L+H5ruk5ZmoXG4gICAgbGV0IGZpbHRlcmVkID0gYWxsSW5jaWRlbnRzLmZpbHRlcigoaW5jaWRlbnQpID0+IHtcbiAgICAgIGlmIChxdWVyeS5zdGF0dXMgJiYgaW5jaWRlbnQuc3RhdHVzICE9PSBxdWVyeS5zdGF0dXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LnNldmVyaXR5ICYmIGluY2lkZW50LnNldmVyaXR5ICE9PSBxdWVyeS5zZXZlcml0eSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuc291cmNlICYmIGluY2lkZW50Lm1ldGFkYXRhLnNvdXJjZSAhPT0gcXVlcnkuc291cmNlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChxdWVyeS50eXBlICYmIGluY2lkZW50LnR5cGUgIT09IHF1ZXJ5LnR5cGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICAvLyDmjInliJvlu7rml7bpl7TmjpLluo/vvIjmnIDmlrDnmoTlnKjliY3vvIlcbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdCAtIGEuY3JlYXRlZEF0KTtcblxuICAgIGNvbnN0IHRvdGFsID0gZmlsdGVyZWQubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IHF1ZXJ5Lm9mZnNldCB8fCAwO1xuICAgIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTAwO1xuICAgIGNvbnN0IGluY2lkZW50cyA9IGZpbHRlcmVkLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgbGltaXQpO1xuXG4gICAgcmV0dXJuIHsgdG90YWwsIGluY2lkZW50cyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPlua0u+i3g+S6i+S7tlxuICAgKi9cbiAgYXN5bmMgZ2V0QWN0aXZlKGxpbWl0OiBudW1iZXIgPSA1MCk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmRbXT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkoeyBzdGF0dXM6ICdhY3RpdmUnLCBsaW1pdCB9KTtcbiAgICByZXR1cm4gcmVzdWx0LmluY2lkZW50cztcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bmnKrnoa7orqTkuovku7ZcbiAgICovXG4gIGFzeW5jIGdldFVuYWNrbm93bGVkZ2VkKGxpbWl0OiBudW1iZXIgPSA1MCk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmRbXT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkoeyBzdGF0dXM6ICdhY3RpdmUnLCBsaW1pdCB9KTtcbiAgICByZXR1cm4gcmVzdWx0LmluY2lkZW50cy5maWx0ZXIoKGkpID0+ICFpLmFja25vd2xlZGdlZEF0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5bkuKXph43kuovku7ZcbiAgICovXG4gIGFzeW5jIGdldENyaXRpY2FsKGxpbWl0OiBudW1iZXIgPSA1MCk6IFByb21pc2U8SW5jaWRlbnRSZWNvcmRbXT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkoeyBzZXZlcml0eTogJ2NyaXRpY2FsJywgbGltaXQgfSk7XG4gICAgcmV0dXJuIHJlc3VsdC5pbmNpZGVudHM7XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W5LqL5Lu257uf6K6hXG4gICAqL1xuICBhc3luYyBnZXRTdGF0cygpOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIGFjdGl2ZTogbnVtYmVyO1xuICAgIGFja25vd2xlZGdlZDogbnVtYmVyO1xuICAgIHJlc29sdmVkOiBudW1iZXI7XG4gICAgY2xvc2VkOiBudW1iZXI7XG4gICAgY3JpdGljYWw6IG51bWJlcjtcbiAgfT4ge1xuICAgIGNvbnN0IGFsbEluY2lkZW50cyA9IGF3YWl0IHRoaXMucmVwb3NpdG9yeS5saXN0KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsOiBhbGxJbmNpZGVudHMubGVuZ3RoLFxuICAgICAgYWN0aXZlOiBhbGxJbmNpZGVudHMuZmlsdGVyKChpKSA9PiBpLnN0YXR1cyA9PT0gJ2FjdGl2ZScpLmxlbmd0aCxcbiAgICAgIGFja25vd2xlZGdlZDogYWxsSW5jaWRlbnRzLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09ICdhY2tub3dsZWRnZWQnKS5sZW5ndGgsXG4gICAgICByZXNvbHZlZDogYWxsSW5jaWRlbnRzLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09ICdyZXNvbHZlZCcpLmxlbmd0aCxcbiAgICAgIGNsb3NlZDogYWxsSW5jaWRlbnRzLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09ICdjbG9zZWQnKS5sZW5ndGgsXG4gICAgICBjcml0aWNhbDogYWxsSW5jaWRlbnRzLmZpbHRlcigoaSkgPT4gaS5zZXZlcml0eSA9PT0gJ2NyaXRpY2FsJykubGVuZ3RoLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5Yig6Zmk5LqL5Lu2XG4gICAqL1xuICBhc3luYyBkZWxldGUoaW5jaWRlbnRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmRlbGV0ZShpbmNpZGVudElkKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGYWN0b3J5IEZ1bmN0aW9uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbmNpZGVudFJlcG9zaXRvcnkoZGF0YURpcjogc3RyaW5nKTogSW5jaWRlbnRSZXBvc2l0b3J5IHtcbiAgcmV0dXJuIG5ldyBJbmNpZGVudFJlcG9zaXRvcnkoZGF0YURpcik7XG59XG4iXX0=