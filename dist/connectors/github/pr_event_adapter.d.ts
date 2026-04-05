/**
 * PR Event Adapter
 * Phase 2B-1 - PR 事件适配器
 *
 * 职责：
 * - 将 GitHub PR 事件转换为内部标准事件
 * - 映射 PR opened → task
 * - 映射 review requested → approval
 * - 映射 check failed → attention/incident
 */
import type { GitHubPREvent, GitHubCheckEvent, MappedTask, MappedApproval, MappedInboxItem } from './github_types';
export interface PREventAdapterConfig {
    /** 自动为 PR 创建 Task */
    autoCreateTask?: boolean;
    /** 自动为 Review Request 创建 Approval */
    autoCreateApproval?: boolean;
    /** 自动为 Failed Check 创建 Attention */
    autoCreateAttention?: boolean;
    /** 默认优先级 */
    defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
}
export declare class PREventAdapter {
    private config;
    constructor(config?: PREventAdapterConfig);
    /**
     * 适配 PR 事件
     */
    adaptPREvent(event: GitHubPREvent): {
        task?: MappedTask;
        approval?: MappedApproval;
        inboxItem?: MappedInboxItem;
    };
    /**
     * 适配 Check 事件
     */
    adaptCheckEvent(event: GitHubCheckEvent): {
        inboxItem?: MappedInboxItem;
    };
    private mapPRToTask;
    private mapReviewRequestToApproval;
    private mapPRToInboxItem;
    private mapFailedCheckToInboxItem;
}
export declare function createPREventAdapter(config?: PREventAdapterConfig): PREventAdapter;
