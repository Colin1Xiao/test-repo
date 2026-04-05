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
