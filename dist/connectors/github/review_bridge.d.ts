/**
 * Review Bridge
 * Phase 2B-1 - PR Review 桥接
 *
 * 职责：
 * - 将 Operator Approval 动作回写到 GitHub PR Review
 * - approve → APPROVE review
 * - reject → REQUEST_CHANGES review
 * - merge → merge PR
 */
import type { GitHubConnector } from './github_connector';
export interface ReviewBridgeConfig {
    /** 默认 Review 留言 */
    defaultReviewBody?: string;
    /** Merge 方法 */
    defaultMergeMethod?: 'merge' | 'squash' | 'rebase';
    /** 需要至少一个 Approve 才能 Merge */
    requireApprovalBeforeMerge?: boolean;
}
export declare class ReviewBridge {
    private config;
    private githubConnector;
    constructor(githubConnector: GitHubConnector, config?: ReviewBridgeConfig);
    /**
     * 处理 Approve 动作
     */
    handleApprove(owner: string, repo: string, prNumber: number, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Reject 动作
     */
    handleReject(owner: string, repo: string, prNumber: number, actorId?: string, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 处理 Merge 动作
     */
    handleMerge(owner: string, repo: string, prNumber: number, actorId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare function createReviewBridge(githubConnector: GitHubConnector, config?: ReviewBridgeConfig): ReviewBridge;
