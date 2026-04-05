/**
 * Inbox Service
 * Phase 2A-2B - 统一收件箱服务
 *
 * 职责：
 * - 聚合 ApprovalInbox / IncidentCenter / TaskCenter / AttentionInbox
 * - 输出统一 InboxSnapshot
 * - 支持过滤和排序
 */
import type { InboxItem, InboxSnapshot, InboxSummary, InboxService as InboxServiceInterface, InboxConfig } from '../types/inbox_types';
import { ApprovalInbox } from './approval_inbox';
import { IncidentCenter } from './incident_center';
import { TaskCenter } from './task_center';
import { AttentionInbox } from './attention_inbox';
export interface InboxServiceDependencies {
    approvalInbox: ApprovalInbox;
    incidentCenter: IncidentCenter;
    taskCenter: TaskCenter;
    attentionInbox: AttentionInbox;
}
export declare class InboxService implements InboxServiceInterface {
    private config;
    private dependencies;
    constructor(dependencies: InboxServiceDependencies, config?: InboxConfig);
    /**
     * 获取 Inbox 快照
     */
    getInboxSnapshot(workspaceId?: string): Promise<InboxSnapshot>;
    /**
     * 获取 Inbox 项（按 ID）
     */
    getInboxItem(itemId: string): Promise<InboxItem | null>;
    /**
     * 获取摘要
     */
    getInboxSummary(workspaceId?: string): Promise<InboxSummary>;
    /**
     * 获取待处理项（按严重级别排序）
     */
    getPendingItems(workspaceId?: string, limit?: number): Promise<InboxItem[]>;
    /**
     * 获取紧急项（critical + high）
     */
    getUrgentItems(workspaceId?: string, limit?: number): Promise<InboxItem[]>;
    private calculateSummary;
}
export declare function createInboxService(dependencies: InboxServiceDependencies, config?: InboxConfig): InboxService;
