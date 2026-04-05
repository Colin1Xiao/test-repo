/**
 * Approval Inbox
 * Phase 2A-2B - 审批收件箱聚合
 *
 * 职责：
 * - 聚合 pending approvals
 * - 聚合 aged approvals
 * - 聚合 timeout-risk approvals
 * - 输出 InboxItem 列表
 */
import type { InboxItem } from '../types/inbox_types';
import type { ApprovalDataSource } from '../data/approval_data_source';
export interface ApprovalInboxConfig {
    /** 超时阈值（毫秒） */
    timeoutThresholdMs?: number;
    /** 老化阈值（毫秒） */
    agedThresholdMs?: number;
    /** 返回数量限制 */
    limit?: number;
}
export declare class ApprovalInbox {
    private config;
    private approvalDataSource;
    constructor(approvalDataSource: ApprovalDataSource, config?: ApprovalInboxConfig);
    /**
     * 获取审批 Inbox 项
     */
    getInboxItems(workspaceId?: string): Promise<InboxItem[]>;
    /**
     * 获取摘要
     */
    getSummary(workspaceId?: string): Promise<{
        pendingApprovals: number;
        agedApprovals: number;
        timeoutApprovals: number;
    }>;
    private calculateSeverity;
    private formatAge;
}
export declare function createApprovalInbox(approvalDataSource: ApprovalDataSource, config?: ApprovalInboxConfig): ApprovalInbox;
