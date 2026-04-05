/**
 * Check Status Adapter
 * Phase 2B-1 - Check 状态适配器
 *
 * 职责：
 * - 将 GitHub Check 状态映射到 Operator 语义
 * - success → task completed
 * - failure → incident / attention
 * - in_progress → task running
 */
import type { GitHubCheckEvent, MappedInboxItem } from './github_types';
export interface CheckStatusAdapterConfig {
    /** 自动为 Failed Check 创建 Attention */
    autoCreateAttention?: boolean;
    /** Failed Check 的严重级别 */
    failedCheckSeverity?: 'low' | 'medium' | 'high' | 'critical';
    /** 忽略的 Check 名称模式 */
    ignoreCheckPatterns?: string[];
}
export declare class CheckStatusAdapter {
    private config;
    constructor(config?: CheckStatusAdapterConfig);
    /**
     * 适配 Check 事件
     */
    adaptCheckEvent(event: GitHubCheckEvent): {
        inboxItem?: MappedInboxItem;
        status: 'success' | 'failure' | 'in_progress' | 'queued';
    };
    /**
     * 映射 Check 状态
     */
    mapCheckStatus(status: string, conclusion: string | null): 'success' | 'failure' | 'in_progress' | 'queued';
    private shouldIgnore;
    private mapFailedCheckToInboxItem;
}
export declare function createCheckStatusAdapter(config?: CheckStatusAdapterConfig): CheckStatusAdapter;
