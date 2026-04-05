"use strict";
/**
 * Approval Repository
 * Phase 2E-1 - 审批持久化存储
 *
 * 职责：
 * - 审批数据存储/加载
 * - 审批状态管理
 * - 审批历史查询
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
exports.ApprovalRepository = void 0;
exports.createApprovalRepository = createApprovalRepository;
const persistence_store_1 = require("./persistence_store");
const path = __importStar(require("path"));
// ============================================================================
// Approval Repository
// ============================================================================
class ApprovalRepository {
    constructor(dataDir) {
        this.repository = (0, persistence_store_1.createFilePersistenceStore)(path.join(dataDir, 'approvals'), '.approval.json');
    }
    /**
     * 创建审批
     */
    async create(approval) {
        const now = Date.now();
        const record = {
            ...approval,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.save(record.approvalId, record);
        return record;
    }
    /**
     * 获取审批
     */
    async getById(approvalId) {
        return await this.repository.load(approvalId);
    }
    /**
     * 更新审批状态
     */
    async updateStatus(approvalId, status, decidedBy, rejectionReason) {
        const record = await this.getById(approvalId);
        if (!record) {
            return null;
        }
        record.status = status;
        record.decidedAt = Date.now();
        record.decidedBy = decidedBy;
        record.rejectionReason = rejectionReason;
        record.updatedAt = Date.now();
        await this.repository.save(approvalId, record);
        return record;
    }
    /**
     * 批准审批
     */
    async approve(approvalId, decidedBy) {
        return this.updateStatus(approvalId, 'approved', decidedBy);
    }
    /**
     * 拒绝审批
     */
    async reject(approvalId, decidedBy, reason) {
        return this.updateStatus(approvalId, 'rejected', decidedBy, reason);
    }
    /**
     * 取消审批
     */
    async cancel(approvalId) {
        return this.updateStatus(approvalId, 'cancelled');
    }
    /**
     * 查询审批
     */
    async query(query) {
        const allApprovals = await this.repository.list();
        // 应用过滤器
        let filtered = allApprovals.filter((approval) => {
            if (query.status && approval.status !== query.status) {
                return false;
            }
            if (query.source && approval.metadata.source !== query.source) {
                return false;
            }
            if (query.requestingAgent && approval.requestingAgent !== query.requestingAgent) {
                return false;
            }
            return true;
        });
        // 按创建时间排序（最新的在前）
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        const total = filtered.length;
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        const approvals = filtered.slice(offset, offset + limit);
        return { total, approvals };
    }
    /**
     * 获取待处理审批
     */
    async getPending(limit = 50) {
        const result = await this.query({ status: 'pending', limit });
        return result.approvals;
    }
    /**
     * 获取超时审批
     */
    async getTimeout(timeoutThresholdMs = 6 * 60 * 60 * 1000) {
        const now = Date.now();
        const pending = await this.getPending(1000);
        return pending.filter((a) => now - a.createdAt > timeoutThresholdMs);
    }
    /**
     * 获取审批统计
     */
    async getStats() {
        const allApprovals = await this.repository.list();
        return {
            total: allApprovals.length,
            pending: allApprovals.filter((a) => a.status === 'pending').length,
            approved: allApprovals.filter((a) => a.status === 'approved').length,
            rejected: allApprovals.filter((a) => a.status === 'rejected').length,
            cancelled: allApprovals.filter((a) => a.status === 'cancelled').length,
        };
    }
    /**
     * 删除审批
     */
    async delete(approvalId) {
        await this.repository.delete(approvalId);
    }
}
exports.ApprovalRepository = ApprovalRepository;
// ============================================================================
// Factory Function
// ============================================================================
function createApprovalRepository(dataDir) {
    return new ApprovalRepository(dataDir);
}
