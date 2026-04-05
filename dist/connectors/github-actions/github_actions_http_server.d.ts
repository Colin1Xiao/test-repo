/**
 * GitHub Actions HTTP Server
 * Phase 2B-2-I-H - HTTP Surface Integration
 *
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
 * - 集成到现有 Gateway
 */
export interface GitHubActionsHttpServerConfig {
    port: number;
    basePath: string;
    githubToken?: string;
    webhookSecret?: string;
}
export declare class GitHubActionsHttpServer {
    private config;
    private server;
    private integration;
    constructor(config: GitHubActionsHttpServerConfig);
    /**
     * 启动服务器
     */
    start(): Promise<void>;
    /**
     * 停止服务器
     */
    stop(): Promise<void>;
    /**
     * 处理 HTTP 请求
     */
    private handleRequest;
    /**
     * 处理 GitHub Webhook
     */
    private handleWebhook;
    /**
     * 处理获取审批列表
     */
    private handleGetApprovals;
    /**
     * 处理获取 Inbox
     */
    private handleGetInbox;
    /**
     * 处理动作执行
     */
    private handleAction;
}
export declare function createGitHubActionsHttpServer(config: GitHubActionsHttpServerConfig): GitHubActionsHttpServer;
