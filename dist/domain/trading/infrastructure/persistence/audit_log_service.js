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
