"use strict";
/**
 * Approval View - 审批视图
 *
 * 职责：
 * 1. 从 ApprovalBridge / AuditLog 生成审批视图
 * 2. 显示 pending approvals、超时审批、瓶颈审批
 * 3. 暴露 approve / reject / escalate 等控制动作
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalViewBuilder = void 0;
exports.createApprovalViewBuilder = createApprovalViewBuilder;
exports.buildApprovalView = buildApprovalView;
// ============================================================================
// 审批视图构建器
// ============================================================================
class ApprovalViewBuilder {
    constructor(approvalDataSource, config = {}) {
        this.config = {
            maxPendingApprovals: config.maxPendingApprovals ?? 50,
            timeoutThresholdMs: config.timeoutThresholdMs ?? 60 * 60 * 1000, // 1 小时
            recentDecidedCount: config.recentDecidedCount ?? 20,
        };
        this.approvalDataSource = approvalDataSource;
    }
    /**
     * 构建审批视图
     */
    async buildApprovalView(filter) {
        // 获取待处理审批
        const pendingApprovals = await this.approvalDataSource.listPending();
        // 转换为视图模型
        const pendingViewModels = pendingApprovals.map(approval => this.approvalToViewModel(approval));
        // 过滤
        const filteredPending = this.filterApprovals(pendingViewModels, filter);
        // 限制数量
        const limitedPending = filteredPending.slice(0, this.config.maxPendingApprovals);
        // 识别超时审批
        const timeoutApprovals = limitedPending.filter(a => a.ageMs > this.config.timeoutThresholdMs);
        // 获取审批瓶颈
        const bottlenecks = this.analyzeBottlenecks(limitedPending);
        // 获取最近决定的审批
        const history = await this.approvalDataSource.listHistory(this.config.recentDecidedCount);
        const recentDecided = history.map(approval => this.approvalToViewModel(approval));
        // 计算审批流摘要
        const flowSummary = this.calculateFlowSummary(history);
        return {
            pendingApprovals: limitedPending,
            bottlenecks,
            timeoutApprovals,
            recentDecidedApprovals: recentDecided,
            totalApprovals: pendingApprovals.length,
            flowSummary,
        };
    }
    /**
     * 列出待处理审批
     */
    async listPendingApprovals(filter) {
        const view = await this.buildApprovalView(filter);
        return view.pendingApprovals;
    }
    /**
     * 列出审批瓶颈
     */
    async listApprovalBottlenecks() {
        const view = await this.buildApprovalView();
        return view.bottlenecks;
    }
    /**
     * 总结审批流
     */
    async summarizeApprovalFlow() {
        const view = await this.buildApprovalView();
        return view.flowSummary;
    }
    /**
     * 批准审批
     */
    async approve(approvalId, reason) {
        try {
            await this.approvalDataSource.approve(approvalId, reason);
            return {
                success: true,
                actionType: 'approve',
                targetId: approvalId,
                message: `Approval ${approvalId} approved`,
                nextActions: ['escalate_approval'],
            };
        }
        catch (error) {
            return {
                success: false,
                actionType: 'approve',
                targetId: approvalId,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * 拒绝审批
     */
    async reject(approvalId, reason) {
        try {
            await this.approvalDataSource.reject(approvalId, reason);
            return {
                success: true,
                actionType: 'reject',
                targetId: approvalId,
                message: `Approval ${approvalId} rejected`,
                nextActions: [],
            };
        }
        catch (error) {
            return {
                success: false,
                actionType: 'reject',
                targetId: approvalId,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * 升级审批
     */
    async escalate(approvalId, reason) {
        try {
            await this.approvalDataSource.escalate(approvalId, reason);
            return {
                success: true,
                actionType: 'escalate_approval',
                targetId: approvalId,
                message: `Approval ${approvalId} escalated`,
                nextActions: ['approve', 'reject'],
            };
        }
        catch (error) {
            return {
                success: false,
                actionType: 'escalate_approval',
                targetId: approvalId,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 审批转换为视图模型
     */
    approvalToViewModel(approval) {
        const now = Date.now();
        const requestedAt = approval.requestedAt || approval.createdAt || Date.now();
        return {
            approvalId: approval.id,
            taskId: approval.taskId,
            scope: approval.scope || approval.type || 'general',
            requestedAt,
            ageMs: now - requestedAt,
            status: this.normalizeApprovalStatus(approval.status),
            reason: approval.reason || approval.description || 'Approval required',
            requestingAgent: approval.requestingAgent || approval.agentId || 'unknown',
            approver: approval.approver,
            decidedAt: approval.decidedAt || approval.resolvedAt,
        };
    }
    /**
     * 规范化审批状态
     */
    normalizeApprovalStatus(status) {
        const validStatuses = [
            'pending', 'approved', 'rejected', 'escalated', 'timeout', 'cancelled'
        ];
        if (validStatuses.includes(status)) {
            return status;
        }
        return 'pending';
    }
    /**
     * 过滤审批
     */
    filterApprovals(approvals, filter) {
        if (!filter) {
            return approvals;
        }
        let filtered = [...approvals];
        // 状态过滤
        if (filter.status && filter.status.length > 0) {
            filtered = filtered.filter(a => filter.status.includes(a.status));
        }
        // Agent 过滤
        if (filter.agentId) {
            filtered = filtered.filter(a => a.requestingAgent === filter.agentId);
        }
        // 关键词过滤
        if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            filtered = filtered.filter(a => a.scope.toLowerCase().includes(keyword) ||
                a.reason.toLowerCase().includes(keyword));
        }
        return filtered;
    }
    /**
     * 分析审批瓶颈
     */
    analyzeBottlenecks(approvals) {
        // 按类型分组
        const byType = {};
        for (const approval of approvals) {
            if (!byType[approval.scope]) {
                byType[approval.scope] = [];
            }
            byType[approval.scope].push(approval);
        }
        // 计算瓶颈
        const bottlenecks = [];
        for (const [type, typeApprovals] of Object.entries(byType)) {
            const totalWaitTime = typeApprovals.reduce((sum, a) => sum + a.ageMs, 0);
            const avgWaitTime = totalWaitTime / typeApprovals.length;
            bottlenecks.push({
                type,
                pendingCount: typeApprovals.length,
                avgWaitTimeMs: Math.round(avgWaitTime),
            });
        }
        // 按等待时间排序
        bottlenecks.sort((a, b) => b.avgWaitTimeMs - a.avgWaitTimeMs);
        return bottlenecks;
    }
    /**
     * 计算审批流摘要
     */
    calculateFlowSummary(history) {
        if (history.length === 0) {
            return undefined;
        }
        const approved = history.filter(h => h.status === 'approved').length;
        const rejected = history.filter(h => h.status === 'rejected').length;
        const total = approved + rejected;
        // 计算平均决定时间
        let totalDecisionTime = 0;
        let decisionCount = 0;
        for (const h of history) {
            if (h.decidedAt && h.requestedAt) {
                totalDecisionTime += h.decidedAt - h.requestedAt;
                decisionCount++;
            }
        }
        const avgDecisionTimeMs = decisionCount > 0
            ? Math.round(totalDecisionTime / decisionCount)
            : 0;
        return {
            approvalRate: total > 0 ? approved / total : 0,
            rejectionRate: total > 0 ? rejected / total : 0,
            avgDecisionTimeMs: avgDecisionTimeMs,
        };
    }
}
exports.ApprovalViewBuilder = ApprovalViewBuilder;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建审批视图构建器
 */
function createApprovalViewBuilder(approvalDataSource, config) {
    return new ApprovalViewBuilder(approvalDataSource, config);
}
/**
 * 快速构建审批视图
 */
async function buildApprovalView(approvalDataSource, filter) {
    const builder = new ApprovalViewBuilder(approvalDataSource);
    return await builder.buildApprovalView(filter);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwcm92YWxfdmlldy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91eC9hcHByb3ZhbF92aWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7OztHQVVHOzs7QUE0V0gsOERBS0M7QUFLRCw4Q0FNQztBQTFVRCwrRUFBK0U7QUFDL0UsVUFBVTtBQUNWLCtFQUErRTtBQUUvRSxNQUFhLG1CQUFtQjtJQUk5QixZQUNFLGtCQUFzQyxFQUN0QyxTQUFvQyxFQUFFO1FBRXRDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CLElBQUksRUFBRTtZQUNyRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLEVBQUUsT0FBTztZQUN4RSxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCLElBQUksRUFBRTtTQUNwRCxDQUFDO1FBQ0YsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO0lBQy9DLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxNQUFtQjtRQUN6QyxVQUFVO1FBQ1YsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUVyRSxVQUFVO1FBQ1YsTUFBTSxpQkFBaUIsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FDeEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUNuQyxDQUFDO1FBRUYsS0FBSztRQUNMLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFeEUsT0FBTztRQUNQLE1BQU0sY0FBYyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENB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OztHQUVHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQ3ZDLGtCQUFzQyxFQUN0QyxNQUFrQztJQUVsQyxPQUFPLElBQUksbUJBQW1CLENBQUMsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDN0QsQ0FBQztBQUVEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxrQkFBc0MsRUFDdEMsTUFBbUI7SUFFbkIsTUFBTSxPQUFPLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzVELE9BQU8sTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDakQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXBwcm92YWwgVmlldyAtIOWuoeaJueinhuWbvlxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOS7jiBBcHByb3ZhbEJyaWRnZSAvIEF1ZGl0TG9nIOeUn+aIkOWuoeaJueinhuWbvlxuICogMi4g5pi+56S6IHBlbmRpbmcgYXBwcm92YWxz44CB6LaF5pe25a6h5om544CB55O26aKI5a6h5om5XG4gKiAzLiDmmrTpnLIgYXBwcm92ZSAvIHJlamVjdCAvIGVzY2FsYXRlIOetieaOp+WItuWKqOS9nFxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIEFwcHJvdmFsVmlld01vZGVsLFxuICBBcHByb3ZhbFZpZXcsXG4gIEFwcHJvdmFsU3RhdHVzLFxuICBWaWV3RmlsdGVyLFxuICBWaWV3U29ydCxcbiAgQ29udHJvbEFjdGlvbixcbiAgQ29udHJvbEFjdGlvblJlc3VsdCxcbn0gZnJvbSAnLi9jb250cm9sX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5a6h5om55pWw5o2u5rqQXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXBwcm92YWxEYXRhU291cmNlIHtcbiAgLyoqIOiOt+WPluW+heWkhOeQhuWuoeaJuSAqL1xuICBsaXN0UGVuZGluZygpOiBQcm9taXNlPGFueVtdPjtcbiAgXG4gIC8qKiDojrflj5blrqHmibnljoblj7IgKi9cbiAgbGlzdEhpc3RvcnkobGltaXQ/OiBudW1iZXIpOiBQcm9taXNlPGFueVtdPjtcbiAgXG4gIC8qKiDmibnlh4blrqHmibkgKi9cbiAgYXBwcm92ZShhcHByb3ZhbElkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG4gIFxuICAvKiog5ouS57ud5a6h5om5ICovXG4gIHJlamVjdChhcHByb3ZhbElkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG4gIFxuICAvKiog5Y2H57qn5a6h5om5ICovXG4gIGVzY2FsYXRlKGFwcHJvdmFsSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuLyoqXG4gKiDlrqHmibnop4blm77mnoTlu7rlmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcHByb3ZhbFZpZXdCdWlsZGVyQ29uZmlnIHtcbiAgLyoqIOacgOWkp+W+heWkhOeQhuWuoeaJueaVsCAqL1xuICBtYXhQZW5kaW5nQXBwcm92YWxzPzogbnVtYmVyO1xuICBcbiAgLyoqIOi2heaXtumYiOWAvO+8iOavq+enku+8iSAqL1xuICB0aW1lb3V0VGhyZXNob2xkTXM/OiBudW1iZXI7XG4gIFxuICAvKiog5pyA6L+R5Yaz5a6a5a6h5om55pWwICovXG4gIHJlY2VudERlY2lkZWRDb3VudD86IG51bWJlcjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5a6h5om56KeG5Zu+5p6E5bu65ZmoXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBBcHByb3ZhbFZpZXdCdWlsZGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEFwcHJvdmFsVmlld0J1aWxkZXJDb25maWc+O1xuICBwcml2YXRlIGFwcHJvdmFsRGF0YVNvdXJjZTogQXBwcm92YWxEYXRhU291cmNlO1xuICBcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwcm92YWxEYXRhU291cmNlOiBBcHByb3ZhbERhdGFTb3VyY2UsXG4gICAgY29uZmlnOiBBcHByb3ZhbFZpZXdCdWlsZGVyQ29uZmlnID0ge31cbiAgKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBtYXhQZW5kaW5nQXBwcm92YWxzOiBjb25maWcubWF4UGVuZGluZ0FwcHJvdmFscyA/PyA1MCxcbiAgICAgIHRpbWVvdXRUaHJlc2hvbGRNczogY29uZmlnLnRpbWVvdXRUaHJlc2hvbGRNcyA/PyA2MCAqIDYwICogMTAwMCwgLy8gMSDlsI/ml7ZcbiAgICAgIHJlY2VudERlY2lkZWRDb3VudDogY29uZmlnLnJlY2VudERlY2lkZWRDb3VudCA/PyAyMCxcbiAgICB9O1xuICAgIHRoaXMuYXBwcm92YWxEYXRhU291cmNlID0gYXBwcm92YWxEYXRhU291cmNlO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65a6h5om56KeG5Zu+XG4gICAqL1xuICBhc3luYyBidWlsZEFwcHJvdmFsVmlldyhmaWx0ZXI/OiBWaWV3RmlsdGVyKTogUHJvbWlzZTxBcHByb3ZhbFZpZXc+IHtcbiAgICAvLyDojrflj5blvoXlpITnkIblrqHmiblcbiAgICBjb25zdCBwZW5kaW5nQXBwcm92YWxzID0gYXdhaXQgdGhpcy5hcHByb3ZhbERhdGFTb3VyY2UubGlzdFBlbmRpbmcoKTtcbiAgICBcbiAgICAvLyDovazmjaLkuLrop4blm77mqKHlnotcbiAgICBjb25zdCBwZW5kaW5nVmlld01vZGVscyA9IHBlbmRpbmdBcHByb3ZhbHMubWFwKGFwcHJvdmFsID0+XG4gICAgICB0aGlzLmFwcHJvdmFsVG9WaWV3TW9kZWwoYXBwcm92YWwpXG4gICAgKTtcbiAgICBcbiAgICAvLyDov4fmu6RcbiAgICBjb25zdCBmaWx0ZXJlZFBlbmRpbmcgPSB0aGlzLmZpbHRlckFwcHJvdmFscyhwZW5kaW5nVmlld01vZGVscywgZmlsdGVyKTtcbiAgICBcbiAgICAvLyDpmZDliLbmlbDph49cbiAgICBjb25zdCBsaW1pdGVkUGVuZGluZyA9IGZpbHRlcmVkUGVuZGluZy5zbGljZSgwLCB0aGlzLmNvbmZpZy5tYXhQZW5kaW5nQXBwcm92YWxzKTtcbiAgICBcbiAgICAvLyDor4bliKvotoXml7blrqHmiblcbiAgICBjb25zdCB0aW1lb3V0QXBwcm92YWxzID0gbGltaXRlZFBlbmRpbmcuZmlsdGVyKGEgPT5cbiAgICAgIGEuYWdlTXMgPiB0aGlzLmNvbmZpZy50aW1lb3V0VGhyZXNob2xkTXNcbiAgICApO1xuICAgIFxuICAgIC8vIOiOt+WPluWuoeaJueeTtumiiFxuICAgIGNvbnN0IGJvdHRsZW5lY2tzID0gdGhpcy5hbmFseXplQm90dGxlbmVja3MobGltaXRlZFBlbmRpbmcpO1xuICAgIFxuICAgIC8vIOiOt+WPluacgOi/keWGs+WumueahOWuoeaJuVxuICAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCB0aGlzLmFwcHJvdmFsRGF0YVNvdXJjZS5saXN0SGlzdG9yeSh0aGlzLmNvbmZpZy5yZWNlbnREZWNpZGVkQ291bnQpO1xuICAgIGNvbnN0IHJlY2VudERlY2lkZWQgPSBoaXN0b3J5Lm1hcChhcHByb3ZhbCA9PiB0aGlzLmFwcHJvdmFsVG9WaWV3TW9kZWwoYXBwcm92YWwpKTtcbiAgICBcbiAgICAvLyDorqHnrpflrqHmibnmtYHmkZjopoFcbiAgICBjb25zdCBmbG93U3VtbWFyeSA9IHRoaXMuY2FsY3VsYXRlRmxvd1N1bW1hcnkoaGlzdG9yeSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHBlbmRpbmdBcHByb3ZhbHM6IGxpbWl0ZWRQZW5kaW5nLFxuICAgICAgYm90dGxlbmVja3MsXG4gICAgICB0aW1lb3V0QXBwcm92YWxzLFxuICAgICAgcmVjZW50RGVjaWRlZEFwcHJvdmFsczogcmVjZW50RGVjaWRlZCxcbiAgICAgIHRvdGFsQXBwcm92YWxzOiBwZW5kaW5nQXBwcm92YWxzLmxlbmd0aCxcbiAgICAgIGZsb3dTdW1tYXJ5LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJflh7rlvoXlpITnkIblrqHmiblcbiAgICovXG4gIGFzeW5jIGxpc3RQZW5kaW5nQXBwcm92YWxzKGZpbHRlcj86IFZpZXdGaWx0ZXIpOiBQcm9taXNlPEFwcHJvdmFsVmlld01vZGVsW10+IHtcbiAgICBjb25zdCB2aWV3ID0gYXdhaXQgdGhpcy5idWlsZEFwcHJvdmFsVmlldyhmaWx0ZXIpO1xuICAgIHJldHVybiB2aWV3LnBlbmRpbmdBcHByb3ZhbHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJflh7rlrqHmibnnk7bpoohcbiAgICovXG4gIGFzeW5jIGxpc3RBcHByb3ZhbEJvdHRsZW5lY2tzKCk6IFByb21pc2U8QXBwcm92YWxWaWV3Wydib3R0bGVuZWNrcyddPiB7XG4gICAgY29uc3QgdmlldyA9IGF3YWl0IHRoaXMuYnVpbGRBcHByb3ZhbFZpZXcoKTtcbiAgICByZXR1cm4gdmlldy5ib3R0bGVuZWNrcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaAu+e7k+WuoeaJuea1gVxuICAgKi9cbiAgYXN5bmMgc3VtbWFyaXplQXBwcm92YWxGbG93KCk6IFByb21pc2U8QXBwcm92YWxWaWV3WydmbG93U3VtbWFyeSddPiB7XG4gICAgY29uc3QgdmlldyA9IGF3YWl0IHRoaXMuYnVpbGRBcHByb3ZhbFZpZXcoKTtcbiAgICByZXR1cm4gdmlldy5mbG93U3VtbWFyeTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaJueWHhuWuoeaJuVxuICAgKi9cbiAgYXN5bmMgYXBwcm92ZShhcHByb3ZhbElkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8Q29udHJvbEFjdGlvblJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcHJvdmFsRGF0YVNvdXJjZS5hcHByb3ZlKGFwcHJvdmFsSWQsIHJlYXNvbik7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGFjdGlvblR5cGU6ICdhcHByb3ZlJyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsSWQsXG4gICAgICAgIG1lc3NhZ2U6IGBBcHByb3ZhbCAke2FwcHJvdmFsSWR9IGFwcHJvdmVkYCxcbiAgICAgICAgbmV4dEFjdGlvbnM6IFsnZXNjYWxhdGVfYXBwcm92YWwnXSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBhY3Rpb25UeXBlOiAnYXBwcm92ZScsXG4gICAgICAgIHRhcmdldElkOiBhcHByb3ZhbElkLFxuICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmi5Lnu53lrqHmiblcbiAgICovXG4gIGFzeW5jIHJlamVjdChhcHByb3ZhbElkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8Q29udHJvbEFjdGlvblJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcHJvdmFsRGF0YVNvdXJjZS5yZWplY3QoYXBwcm92YWxJZCwgcmVhc29uKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgYWN0aW9uVHlwZTogJ3JlamVjdCcsXG4gICAgICAgIHRhcmdldElkOiBhcHByb3ZhbElkLFxuICAgICAgICBtZXNzYWdlOiBgQXBwcm92YWwgJHthcHByb3ZhbElkfSByZWplY3RlZGAsXG4gICAgICAgIG5leHRBY3Rpb25zOiBbXSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBhY3Rpb25UeXBlOiAncmVqZWN0JyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsSWQsXG4gICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9O1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOWNh+e6p+WuoeaJuVxuICAgKi9cbiAgYXN5bmMgZXNjYWxhdGUoYXBwcm92YWxJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPENvbnRyb2xBY3Rpb25SZXN1bHQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5hcHByb3ZhbERhdGFTb3VyY2UuZXNjYWxhdGUoYXBwcm92YWxJZCwgcmVhc29uKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgYWN0aW9uVHlwZTogJ2VzY2FsYXRlX2FwcHJvdmFsJyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsSWQsXG4gICAgICAgIG1lc3NhZ2U6IGBBcHByb3ZhbCAke2FwcHJvdmFsSWR9IGVzY2FsYXRlZGAsXG4gICAgICAgIG5leHRBY3Rpb25zOiBbJ2FwcHJvdmUnLCAncmVqZWN0J10sXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgYWN0aW9uVHlwZTogJ2VzY2FsYXRlX2FwcHJvdmFsJyxcbiAgICAgICAgdGFyZ2V0SWQ6IGFwcHJvdmFsSWQsXG4gICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9O1xuICAgIH1cbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOWuoeaJuei9rOaNouS4uuinhuWbvuaooeWei1xuICAgKi9cbiAgcHJpdmF0ZSBhcHByb3ZhbFRvVmlld01vZGVsKGFwcHJvdmFsOiBhbnkpOiBBcHByb3ZhbFZpZXdNb2RlbCB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXF1ZXN0ZWRBdCA9IGFwcHJvdmFsLnJlcXVlc3RlZEF0IHx8IGFwcHJvdmFsLmNyZWF0ZWRBdCB8fCBEYXRlLm5vdygpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBhcHByb3ZhbElkOiBhcHByb3ZhbC5pZCxcbiAgICAgIHRhc2tJZDogYXBwcm92YWwudGFza0lkLFxuICAgICAgc2NvcGU6IGFwcHJvdmFsLnNjb3BlIHx8IGFwcHJvdmFsLnR5cGUgfHwgJ2dlbmVyYWwnLFxuICAgICAgcmVxdWVzdGVkQXQsXG4gICAgICBhZ2VNczogbm93IC0gcmVxdWVzdGVkQXQsXG4gICAgICBzdGF0dXM6IHRoaXMubm9ybWFsaXplQXBwcm92YWxTdGF0dXMoYXBwcm92YWwuc3RhdHVzKSxcbiAgICAgIHJlYXNvbjogYXBwcm92YWwucmVhc29uIHx8IGFwcHJvdmFsLmRlc2NyaXB0aW9uIHx8ICdBcHByb3ZhbCByZXF1aXJlZCcsXG4gICAgICByZXF1ZXN0aW5nQWdlbnQ6IGFwcHJvdmFsLnJlcXVlc3RpbmdBZ2VudCB8fCBhcHByb3ZhbC5hZ2VudElkIHx8ICd1bmtub3duJyxcbiAgICAgIGFwcHJvdmVyOiBhcHByb3ZhbC5hcHByb3ZlcixcbiAgICAgIGRlY2lkZWRBdDogYXBwcm92YWwuZGVjaWRlZEF0IHx8IGFwcHJvdmFsLnJlc29sdmVkQXQsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOinhOiMg+WMluWuoeaJueeKtuaAgVxuICAgKi9cbiAgcHJpdmF0ZSBub3JtYWxpemVBcHByb3ZhbFN0YXR1cyhzdGF0dXM6IHN0cmluZyk6IEFwcHJvdmFsU3RhdHVzIHtcbiAgICBjb25zdCB2YWxpZFN0YXR1c2VzOiBBcHByb3ZhbFN0YXR1c1tdID0gW1xuICAgICAgJ3BlbmRpbmcnLCAnYXBwcm92ZWQnLCAncmVqZWN0ZWQnLCAnZXNjYWxhdGVkJywgJ3RpbWVvdXQnLCAnY2FuY2VsbGVkJ1xuICAgIF07XG4gICAgXG4gICAgaWYgKHZhbGlkU3RhdHVzZXMuaW5jbHVkZXMoc3RhdHVzIGFzIEFwcHJvdmFsU3RhdHVzKSkge1xuICAgICAgcmV0dXJuIHN0YXR1cyBhcyBBcHByb3ZhbFN0YXR1cztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuICdwZW5kaW5nJztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOi/h+a7pOWuoeaJuVxuICAgKi9cbiAgcHJpdmF0ZSBmaWx0ZXJBcHByb3ZhbHMoXG4gICAgYXBwcm92YWxzOiBBcHByb3ZhbFZpZXdNb2RlbFtdLFxuICAgIGZpbHRlcj86IFZpZXdGaWx0ZXJcbiAgKTogQXBwcm92YWxWaWV3TW9kZWxbXSB7XG4gICAgaWYgKCFmaWx0ZXIpIHtcbiAgICAgIHJldHVybiBhcHByb3ZhbHM7XG4gICAgfVxuICAgIFxuICAgIGxldCBmaWx0ZXJlZCA9IFsuLi5hcHByb3ZhbHNdO1xuICAgIFxuICAgIC8vIOeKtuaAgei/h+a7pFxuICAgIGlmIChmaWx0ZXIuc3RhdHVzICYmIGZpbHRlci5zdGF0dXMubGVuZ3RoID4gMCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoYSA9PiBmaWx0ZXIuc3RhdHVzIS5pbmNsdWRlcyhhLnN0YXR1cykpO1xuICAgIH1cbiAgICBcbiAgICAvLyBBZ2VudCDov4fmu6RcbiAgICBpZiAoZmlsdGVyLmFnZW50SWQpIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKGEgPT4gYS5yZXF1ZXN0aW5nQWdlbnQgPT09IGZpbHRlci5hZ2VudElkKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5YWz6ZSu6K+N6L+H5rukXG4gICAgaWYgKGZpbHRlci5rZXl3b3JkKSB7XG4gICAgICBjb25zdCBrZXl3b3JkID0gZmlsdGVyLmtleXdvcmQudG9Mb3dlckNhc2UoKTtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKGEgPT5cbiAgICAgICAgYS5zY29wZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGtleXdvcmQpIHx8XG4gICAgICAgIGEucmVhc29uLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5d29yZClcbiAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIhuaekOWuoeaJueeTtumiiFxuICAgKi9cbiAgcHJpdmF0ZSBhbmFseXplQm90dGxlbmVja3MoXG4gICAgYXBwcm92YWxzOiBBcHByb3ZhbFZpZXdNb2RlbFtdXG4gICk6IEFwcHJvdmFsVmlld1snYm90dGxlbmVja3MnXSB7XG4gICAgLy8g5oyJ57G75Z6L5YiG57uEXG4gICAgY29uc3QgYnlUeXBlOiBSZWNvcmQ8c3RyaW5nLCBBcHByb3ZhbFZpZXdNb2RlbFtdPiA9IHt9O1xuICAgIFxuICAgIGZvciAoY29uc3QgYXBwcm92YWwgb2YgYXBwcm92YWxzKSB7XG4gICAgICBpZiAoIWJ5VHlwZVthcHByb3ZhbC5zY29wZV0pIHtcbiAgICAgICAgYnlUeXBlW2FwcHJvdmFsLnNjb3BlXSA9IFtdO1xuICAgICAgfVxuICAgICAgYnlUeXBlW2FwcHJvdmFsLnNjb3BlXS5wdXNoKGFwcHJvdmFsKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6K6h566X55O26aKIXG4gICAgY29uc3QgYm90dGxlbmVja3M6IEFwcHJvdmFsVmlld1snYm90dGxlbmVja3MnXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgW3R5cGUsIHR5cGVBcHByb3ZhbHNdIG9mIE9iamVjdC5lbnRyaWVzKGJ5VHlwZSkpIHtcbiAgICAgIGNvbnN0IHRvdGFsV2FpdFRpbWUgPSB0eXBlQXBwcm92YWxzLnJlZHVjZSgoc3VtLCBhKSA9PiBzdW0gKyBhLmFnZU1zLCAwKTtcbiAgICAgIGNvbnN0IGF2Z1dhaXRUaW1lID0gdG90YWxXYWl0VGltZSAvIHR5cGVBcHByb3ZhbHMubGVuZ3RoO1xuICAgICAgXG4gICAgICBib3R0bGVuZWNrcy5wdXNoKHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgcGVuZGluZ0NvdW50OiB0eXBlQXBwcm92YWxzLmxlbmd0aCxcbiAgICAgICAgYXZnV2FpdFRpbWVNczogTWF0aC5yb3VuZChhdmdXYWl0VGltZSksXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5oyJ562J5b6F5pe26Ze05o6S5bqPXG4gICAgYm90dGxlbmVja3Muc29ydCgoYSwgYikgPT4gYi5hdmdXYWl0VGltZU1zIC0gYS5hdmdXYWl0VGltZU1zKTtcbiAgICBcbiAgICByZXR1cm4gYm90dGxlbmVja3M7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpflrqHmibnmtYHmkZjopoFcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlRmxvd1N1bW1hcnkoXG4gICAgaGlzdG9yeTogYW55W11cbiAgKTogQXBwcm92YWxWaWV3WydmbG93U3VtbWFyeSddIHtcbiAgICBpZiAoaGlzdG9yeS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGFwcHJvdmVkID0gaGlzdG9yeS5maWx0ZXIoaCA9PiBoLnN0YXR1cyA9PT0gJ2FwcHJvdmVkJykubGVuZ3RoO1xuICAgIGNvbnN0IHJlamVjdGVkID0gaGlzdG9yeS5maWx0ZXIoaCA9PiBoLnN0YXR1cyA9PT0gJ3JlamVjdGVkJykubGVuZ3RoO1xuICAgIGNvbnN0IHRvdGFsID0gYXBwcm92ZWQgKyByZWplY3RlZDtcbiAgICBcbiAgICAvLyDorqHnrpflubPlnYflhrPlrprml7bpl7RcbiAgICBsZXQgdG90YWxEZWNpc2lvblRpbWUgPSAwO1xuICAgIGxldCBkZWNpc2lvbkNvdW50ID0gMDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGggb2YgaGlzdG9yeSkge1xuICAgICAgaWYgKGguZGVjaWRlZEF0ICYmIGgucmVxdWVzdGVkQXQpIHtcbiAgICAgICAgdG90YWxEZWNpc2lvblRpbWUgKz0gaC5kZWNpZGVkQXQgLSBoLnJlcXVlc3RlZEF0O1xuICAgICAgICBkZWNpc2lvbkNvdW50Kys7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF2Z0RlY2lzaW9uVGltZU1zID0gZGVjaXNpb25Db3VudCA+IDBcbiAgICAgID8gTWF0aC5yb3VuZCh0b3RhbERlY2lzaW9uVGltZSAvIGRlY2lzaW9uQ291bnQpXG4gICAgICA6IDA7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGFwcHJvdmFsUmF0ZTogdG90YWwgPiAwID8gYXBwcm92ZWQgLyB0b3RhbCA6IDAsXG4gICAgICByZWplY3Rpb25SYXRlOiB0b3RhbCA+IDAgPyByZWplY3RlZCAvIHRvdGFsIDogMCxcbiAgICAgIGF2Z0RlY2lzaW9uVGltZU1zOiBhdmdEZWNpc2lvblRpbWVNcyxcbiAgICB9O1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOS+v+aNt+WHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOWIm+W7uuWuoeaJueinhuWbvuaehOW7uuWZqFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXBwcm92YWxWaWV3QnVpbGRlcihcbiAgYXBwcm92YWxEYXRhU291cmNlOiBBcHByb3ZhbERhdGFTb3VyY2UsXG4gIGNvbmZpZz86IEFwcHJvdmFsVmlld0J1aWxkZXJDb25maWdcbik6IEFwcHJvdmFsVmlld0J1aWxkZXIge1xuICByZXR1cm4gbmV3IEFwcHJvdmFsVmlld0J1aWxkZXIoYXBwcm92YWxEYXRhU291cmNlLCBjb25maWcpO1xufVxuXG4vKipcbiAqIOW/q+mAn+aehOW7uuWuoeaJueinhuWbvlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRBcHByb3ZhbFZpZXcoXG4gIGFwcHJvdmFsRGF0YVNvdXJjZTogQXBwcm92YWxEYXRhU291cmNlLFxuICBmaWx0ZXI/OiBWaWV3RmlsdGVyXG4pOiBQcm9taXNlPEFwcHJvdmFsVmlldz4ge1xuICBjb25zdCBidWlsZGVyID0gbmV3IEFwcHJvdmFsVmlld0J1aWxkZXIoYXBwcm92YWxEYXRhU291cmNlKTtcbiAgcmV0dXJuIGF3YWl0IGJ1aWxkZXIuYnVpbGRBcHByb3ZhbFZpZXcoZmlsdGVyKTtcbn1cbiJdfQ==