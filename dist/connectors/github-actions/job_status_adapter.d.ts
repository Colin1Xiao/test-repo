/**
 * Job Status Adapter
 * Phase 2B-2 - Job/Check 状态适配器（轻量版）
 *
 * 职责：
 * - 将 failed check/job → Attention/Incident
 */
import type { CheckRunEvent, MappedActionsInboxItem } from './github_actions_types';
export interface JobStatusAdapterConfig {
    autoCreateAttention?: boolean;
    failedJobSeverity?: 'low' | 'medium' | 'high' | 'critical';
    ignoreJobs?: string[];
}
export declare class JobStatusAdapter {
    private config;
    constructor(config?: JobStatusAdapterConfig);
    /**
     * 适配 Check Run 事件
     */
    adaptCheckRunEvent(event: CheckRunEvent): {
        inboxItem?: MappedActionsInboxItem;
    };
    private mapFailedCheckToInboxItem;
}
export declare function createJobStatusAdapter(config?: JobStatusAdapterConfig): JobStatusAdapter;
