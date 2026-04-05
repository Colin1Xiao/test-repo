/**
 * Jenkins HTTP Server
 * Phase 2B-3A - Jenkins Connector HTTP 暴露层
 *
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
 */
export interface JenkinsHttpServerConfig {
    port: number;
    basePath: string;
    jenkinsBaseUrl?: string;
    jenkinsUsername?: string;
    jenkinsToken?: string;
}
export declare class JenkinsHttpServer {
    private config;
    private server;
    private integration;
    constructor(config: JenkinsHttpServerConfig);
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
     * 处理 Jenkins Webhook
     */
    private handleWebhook;
    /**
     * 处理获取审批列表
     */
    private handleGetApprovals;
    /**
     * 处理获取事件列表
     */
    private handleGetIncidents;
    /**
     * 处理动作执行
     */
    private handleAction;
}
export declare function createJenkinsHttpServer(config: JenkinsHttpServerConfig): JenkinsHttpServer;
