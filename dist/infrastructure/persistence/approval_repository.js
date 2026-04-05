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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwcm92YWxfcmVwb3NpdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbmZyYXN0cnVjdHVyZS9wZXJzaXN0ZW5jZS9hcHByb3ZhbF9yZXBvc2l0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNE1ILDREQUVDO0FBNU1ELDJEQUE2RjtBQUM3RiwyQ0FBNkI7QUFpQzdCLCtFQUErRTtBQUMvRSxzQkFBc0I7QUFDdEIsK0VBQStFO0FBRS9FLE1BQWEsa0JBQWtCO0lBRzdCLFlBQVksT0FBZTtRQUN6QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUEsOENBQTBCLEVBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxFQUMvQixnQkFBZ0IsQ0FDakIsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBeUQ7UUFDcEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sTUFBTSxHQUFtQjtZQUM3QixHQUFHLFFBQVE7WUFDWCxTQUFTLEVBQUUsR0FBRztZQUNkLFNBQVMsRUFBRSxHQUFHO1NBQ2YsQ0FBQztRQUVGLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN0RCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQWtCO1FBQzlCLE9BQU8sTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsWUFBWSxDQUNoQixVQUFrQixFQUNsQixNQUFnQyxFQUNo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QUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDLENBQUMsTUFBTTtTQUN2RSxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFrQjtRQUM3QixNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7Q0FDRjtBQTlKRCxnREE4SkM7QUFFRCwrRUFBK0U7QUFDL0UsbUJBQW1CO0FBQ25CLCtFQUErRTtBQUUvRSxTQUFnQix3QkFBd0IsQ0FBQyxPQUFlO0lBQ3RELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBcHByb3ZhbCBSZXBvc2l0b3J5XG4gKiBQaGFzZSAyRS0xIC0g5a6h5om55oyB5LmF5YyW5a2Y5YKoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDlrqHmibnmlbDmja7lrZjlgqgv5Yqg6L29XG4gKiAtIOWuoeaJueeKtuaAgeeuoeeQhlxuICogLSDlrqHmibnljoblj7Lmn6Xor6JcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVGaWxlUGVyc2lzdGVuY2VTdG9yZSwgdHlwZSBQZXJzaXN0ZW5jZVJlcG9zaXRvcnkgfSBmcm9tICcuL3BlcnNpc3RlbmNlX3N0b3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOexu+Wei+WumuS5iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcHJvdmFsUmVjb3JkIHtcbiAgYXBwcm92YWxJZDogc3RyaW5nO1xuICBzY29wZTogc3RyaW5nO1xuICByZWFzb246IHN0cmluZztcbiAgcmVxdWVzdGluZ0FnZW50OiBzdHJpbmc7XG4gIHN0YXR1czogJ3BlbmRpbmcnIHwgJ2FwcHJvdmVkJyB8ICdyZWplY3RlZCcgfCAnY2FuY2VsbGVkJztcbiAgbWV0YWRhdGE6IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICBzb3VyY2VUeXBlOiBzdHJpbmc7XG4gICAgc291cmNlSWQ6IHN0cmluZztcbiAgICBba2V5OiBzdHJpbmddOiBhbnk7XG4gIH07XG4gIGNyZWF0ZWRBdDogbnVtYmVyO1xuICB1cGRhdGVkQXQ6IG51bWJlcjtcbiAgZGVjaWRlZEF0PzogbnVtYmVyO1xuICBkZWNpZGVkQnk/OiBzdHJpbmc7XG4gIHJlamVjdGlvblJlYXNvbj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHByb3ZhbFF1ZXJ5IHtcbiAgc3RhdHVzPzogJ3BlbmRpbmcnIHwgJ2FwcHJvdmVkJyB8ICdyZWplY3RlZCcgfCAnY2FuY2VsbGVkJztcbiAgc291cmNlPzogc3RyaW5nO1xuICByZXF1ZXN0aW5nQWdlbnQ/OiBzdHJpbmc7XG4gIGxpbWl0PzogbnVtYmVyO1xuICBvZmZzZXQ/OiBudW1iZXI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEFwcHJvdmFsIFJlcG9zaXRvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEFwcHJvdmFsUmVwb3NpdG9yeSB7XG4gIHByaXZhdGUgcmVwb3NpdG9yeTogUGVyc2lzdGVuY2VSZXBvc2l0b3J5PEFwcHJvdmFsUmVjb3JkPjtcblxuICBjb25zdHJ1Y3RvcihkYXRhRGlyOiBzdHJpbmcpIHtcbiAgICB0aGlzLnJlcG9zaXRvcnkgPSBjcmVhdGVGaWxlUGVyc2lzdGVuY2VTdG9yZTxBcHByb3ZhbFJlY29yZD4oXG4gICAgICBwYXRoLmpvaW4oZGF0YURpciwgJ2FwcHJvdmFscycpLFxuICAgICAgJy5hcHByb3ZhbC5qc29uJ1xuICAgICk7XG4gIH1cblxuICAvKipcbiAgICog5Yib5bu65a6h5om5XG4gICAqL1xuICBhc3luYyBjcmVhdGUoYXBwcm92YWw6IE9taXQ8QXBwcm92YWxSZWNvcmQsICdjcmVhdGVkQXQnIHwgJ3VwZGF0ZWRBdCc+KTogUHJvbWlzZTxBcHByb3ZhbFJlY29yZD4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3QgcmVjb3JkOiBBcHByb3ZhbFJlY29yZCA9IHtcbiAgICAgIC4uLmFwcHJvdmFsLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICB1cGRhdGVkQXQ6IG5vdyxcbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy5yZXBvc2l0b3J5LnNhdmUocmVjb3JkLmFwcHJvdmFsSWQsIHJlY29yZCk7XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5blrqHmiblcbiAgICovXG4gIGFzeW5jIGdldEJ5SWQoYXBwcm92YWxJZDogc3RyaW5nKTogUHJvbWlzZTxBcHByb3ZhbFJlY29yZCB8IG51bGw+IHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmxvYWQoYXBwcm92YWxJZCk7XG4gIH1cblxuICAvKipcbiAgICog5pu05paw5a6h5om554q25oCBXG4gICAqL1xuICBhc3luYyB1cGRhdGVTdGF0dXMoXG4gICAgYXBwcm92YWxJZDogc3RyaW5nLFxuICAgIHN0YXR1czogQXBwcm92YWxSZWNvcmRbJ3N0YXR1cyddLFxuICAgIGRlY2lkZWRCeT86IHN0cmluZyxcbiAgICByZWplY3Rpb25SZWFzb24/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxBcHByb3ZhbFJlY29yZCB8IG51bGw+IHtcbiAgICBjb25zdCByZWNvcmQgPSBhd2FpdCB0aGlzLmdldEJ5SWQoYXBwcm92YWxJZCk7XG4gICAgaWYgKCFyZWNvcmQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlY29yZC5zdGF0dXMgPSBzdGF0dXM7XG4gICAgcmVjb3JkLmRlY2lkZWRBdCA9IERhdGUubm93KCk7XG4gICAgcmVjb3JkLmRlY2lkZWRCeSA9IGRlY2lkZWRCeTtcbiAgICByZWNvcmQucmVqZWN0aW9uUmVhc29uID0gcmVqZWN0aW9uUmVhc29uO1xuICAgIHJlY29yZC51cGRhdGVkQXQgPSBEYXRlLm5vdygpO1xuXG4gICAgYXdhaXQgdGhpcy5yZXBvc2l0b3J5LnNhdmUoYXBwcm92YWxJZCwgcmVjb3JkKTtcbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgLyoqXG4gICAqIOaJueWHhuWuoeaJuVxuICAgKi9cbiAgYXN5bmMgYXBwcm92ZShhcHByb3ZhbElkOiBzdHJpbmcsIGRlY2lkZWRCeT86IHN0cmluZyk6IFByb21pc2U8QXBwcm92YWxSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlU3RhdHVzKGFwcHJvdmFsSWQsICdhcHByb3ZlZCcsIGRlY2lkZWRCeSk7XG4gIH1cblxuICAvKipcbiAgICog5ouS57ud5a6h5om5XG4gICAqL1xuICBhc3luYyByZWplY3QoXG4gICAgYXBwcm92YWxJZDogc3RyaW5nLFxuICAgIGRlY2lkZWRCeT86IHN0cmluZyxcbiAgICByZWFzb24/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxBcHByb3ZhbFJlY29yZCB8IG51bGw+IHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVTdGF0dXMoYXBwcm92YWxJZCwgJ3JlamVjdGVkJywgZGVjaWRlZEJ5LCByZWFzb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWPlua2iOWuoeaJuVxuICAgKi9cbiAgYXN5bmMgY2FuY2VsKGFwcHJvdmFsSWQ6IHN0cmluZyk6IFByb21pc2U8QXBwcm92YWxSZWNvcmQgfCBudWxsPiB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlU3RhdHVzKGFwcHJvdmFsSWQsICdjYW5jZWxsZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LlrqHmiblcbiAgICovXG4gIGFzeW5jIHF1ZXJ5KHF1ZXJ5OiBBcHByb3ZhbFF1ZXJ5KTogUHJvbWlzZTx7XG4gICAgdG90YWw6IG51bWJlcjtcbiAgICBhcHByb3ZhbHM6IEFwcHJvdmFsUmVjb3JkW107XG4gIH0+IHtcbiAgICBjb25zdCBhbGxBcHByb3ZhbHMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuXG4gICAgLy8g5bqU55So6L+H5ruk5ZmoXG4gICAgbGV0IGZpbHRlcmVkID0gYWxsQXBwcm92YWxzLmZpbHRlcigoYXBwcm92YWwpID0+IHtcbiAgICAgIGlmIChxdWVyeS5zdGF0dXMgJiYgYXBwcm92YWwuc3RhdHVzICE9PSBxdWVyeS5zdGF0dXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LnNvdXJjZSAmJiBhcHByb3ZhbC5tZXRhZGF0YS5zb3VyY2UgIT09IHF1ZXJ5LnNvdXJjZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkucmVxdWVzdGluZ0FnZW50ICYmIGFwcHJvdmFsLnJlcXVlc3RpbmdBZ2VudCAhPT0gcXVlcnkucmVxdWVzdGluZ0FnZW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgLy8g5oyJ5Yib5bu65pe26Ze05o6S5bqP77yI5pyA5paw55qE5Zyo5YmN77yJXG4gICAgZmlsdGVyZWQuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQgLSBhLmNyZWF0ZWRBdCk7XG5cbiAgICBjb25zdCB0b3RhbCA9IGZpbHRlcmVkLmxlbmd0aDtcbiAgICBjb25zdCBvZmZzZXQgPSBxdWVyeS5vZmZzZXQgfHwgMDtcbiAgICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwMDtcbiAgICBjb25zdCBhcHByb3ZhbHMgPSBmaWx0ZXJlZC5zbGljZShvZmZzZXQsIG9mZnNldCArIGxpbWl0KTtcblxuICAgIHJldHVybiB7IHRvdGFsLCBhcHByb3ZhbHMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5blvoXlpITnkIblrqHmiblcbiAgICovXG4gIGFzeW5jIGdldFBlbmRpbmcobGltaXQ6IG51bWJlciA9IDUwKTogUHJvbWlzZTxBcHByb3ZhbFJlY29yZFtdPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5xdWVyeSh7IHN0YXR1czogJ3BlbmRpbmcnLCBsaW1pdCB9KTtcbiAgICByZXR1cm4gcmVzdWx0LmFwcHJvdmFscztcbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5botoXml7blrqHmiblcbiAgICovXG4gIGFzeW5jIGdldFRpbWVvdXQodGltZW91dFRocmVzaG9sZE1zOiBudW1iZXIgPSA2ICogNjAgKiA2MCAqIDEwMDApOiBQcm9taXNlPEFwcHJvdmFsUmVjb3JkW10+IHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHBlbmRpbmcgPSBhd2FpdCB0aGlzLmdldFBlbmRpbmcoMTAwMCk7XG4gICAgcmV0dXJuIHBlbmRpbmcuZmlsdGVyKChhKSA9PiBub3cgLSBhLmNyZWF0ZWRBdCA+IHRpbWVvdXRUaHJlc2hvbGRNcyk7XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W5a6h5om557uf6K6hXG4gICAqL1xuICBhc3luYyBnZXRTdGF0cygpOiBQcm9taXNlPHtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIHBlbmRpbmc6IG51bWJlcjtcbiAgICBhcHByb3ZlZDogbnVtYmVyO1xuICAgIHJlamVjdGVkOiBudW1iZXI7XG4gICAgY2FuY2VsbGVkOiBudW1iZXI7XG4gIH0+IHtcbiAgICBjb25zdCBhbGxBcHByb3ZhbHMgPSBhd2FpdCB0aGlzLnJlcG9zaXRvcnkubGlzdCgpO1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbDogYWxsQXBwcm92YWxzLmxlbmd0aCxcbiAgICAgIHBlbmRpbmc6IGFsbEFwcHJvdmFscy5maWx0ZXIoKGEpID0+IGEuc3RhdHVzID09PSAncGVuZGluZycpLmxlbmd0aCxcbiAgICAgIGFwcHJvdmVkOiBhbGxBcHByb3ZhbHMuZmlsdGVyKChhKSA9PiBhLnN0YXR1cyA9PT0gJ2FwcHJvdmVkJykubGVuZ3RoLFxuICAgICAgcmVqZWN0ZWQ6IGFsbEFwcHJvdmFscy5maWx0ZXIoKGEpID0+IGEuc3RhdHVzID09PSAncmVqZWN0ZWQnKS5sZW5ndGgsXG4gICAgICBjYW5jZWxsZWQ6IGFsbEFwcHJvdmFscy5maWx0ZXIoKGEpID0+IGEuc3RhdHVzID09PSAnY2FuY2VsbGVkJykubGVuZ3RoLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5Yig6Zmk5a6h5om5XG4gICAqL1xuICBhc3luYyBkZWxldGUoYXBwcm92YWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmRlbGV0ZShhcHByb3ZhbElkKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGYWN0b3J5IEZ1bmN0aW9uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBcHByb3ZhbFJlcG9zaXRvcnkoZGF0YURpcjogc3RyaW5nKTogQXBwcm92YWxSZXBvc2l0b3J5IHtcbiAgcmV0dXJuIG5ldyBBcHByb3ZhbFJlcG9zaXRvcnkoZGF0YURpcik7XG59XG4iXX0=