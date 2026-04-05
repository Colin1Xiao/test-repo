/**
 * GitHub Connector
 * Phase 2B-1 - GitHub / PR Connector MVP
 *
 * 职责：
 * - 接收 GitHub Webhook 事件
 * - 轮询 GitHub API 获取 PR 状态
 * - 统一事件输入格式
 */
import type { GitHubEvent, GitHubWebhookPayload } from './github_types';
export interface GitHubConnectorConfig {
    /** GitHub API Token */
    apiToken?: string;
    /** Webhook Secret */
    webhookSecret?: string;
    /** 轮询间隔（毫秒） */
    pollingIntervalMs?: number;
    /** 启用轮询 */
    enablePolling?: boolean;
    /** 仓库列表 */
    repositories?: string[];
}
export interface GitHubConnector {
    /**
     * 处理 Webhook 事件
     */
    handleWebhook(payload: GitHubWebhookPayload, signature?: string): Promise<GitHubEvent[]>;
    /**
     * 轮询 PR 状态
     */
    pollPRs(): Promise<GitHubEvent[]>;
    /**
     * 轮询 Check 状态
     */
    pollChecks(): Promise<GitHubEvent[]>;
    /**
     * 获取 PR 详情
     */
    getPRDetails(owner: string, repo: string, prNumber: number): Promise<any>;
    /**
     * 提交 PR Review
     */
    submitReview(owner: string, repo: string, prNumber: number, review: {
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
        body?: string;
        commitId?: string;
    }): Promise<void>;
    /**
     * 合并 PR
     */
    mergePR(owner: string, repo: string, prNumber: number, options?: {
        mergeMethod?: 'merge' | 'squash' | 'rebase';
        commitTitle?: string;
        commitMessage?: string;
    }): Promise<void>;
    /**
     * 获取 PR Checks 状态
     */
    getPRChecks(owner: string, repo: string, prNumber: number): Promise<any>;
}
export declare class InMemoryGitHubConnector implements GitHubConnector {
    private config;
    private eventListeners;
    constructor(config?: GitHubConnectorConfig);
    handleWebhook(payload: GitHubWebhookPayload, signature?: string): Promise<GitHubEvent[]>;
    pollPRs(): Promise<GitHubEvent[]>;
    pollChecks(): Promise<GitHubEvent[]>;
    getPRDetails(owner: string, repo: string, prNumber: number): Promise<any>;
    submitReview(owner: string, repo: string, prNumber: number, review: {
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
        body?: string;
        commitId?: string;
    }): Promise<void>;
    mergePR(owner: string, repo: string, prNumber: number, options?: any): Promise<void>;
    getPRChecks(owner: string, repo: string, prNumber: number): Promise<any>;
    private verifySignature;
    private emitEvent;
    private startPolling;
    onEvent(listener: (event: GitHubEvent) => void): void;
}
export declare function createGitHubConnector(config?: GitHubConnectorConfig): GitHubConnector;
