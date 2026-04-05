/**
 * Attention Inbox
 * Phase 2A-2B - 关注项收件箱聚合
 *
 * 职责：
 * - 聚合 dashboard attention items
 * - 聚合 human loop interventions
 * - 聚合 high-severity recommendations
 * - 输出 InboxItem 列表
 */
import type { InboxItem } from '../types/inbox_types';
import type { DashboardSnapshot } from '../ux/dashboard_types';
import type { HumanLoopSnapshot } from '../ux/hitl_types';
export interface AttentionInboxConfig {
    /** 返回数量限制 */
    limit?: number;
}
export declare class AttentionInbox {
    private config;
    constructor(config?: AttentionInboxConfig);
    /**
     * 从 Dashboard 获取关注项
     */
    getFromDashboard(dashboard: DashboardSnapshot, workspaceId?: string): Promise<InboxItem[]>;
    /**
     * 从 HumanLoop 获取介入项
     */
    getFromHumanLoop(humanLoop: HumanLoopSnapshot, workspaceId?: string): Promise<InboxItem[]>;
    /**
     * 合并并去重
     */
    mergeItems(...itemArrays: InboxItem[][]): InboxItem[];
    private toInboxItem;
    private interventionToInboxItem;
}
export declare function createAttentionInbox(config?: AttentionInboxConfig): AttentionInbox;
