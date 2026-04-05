/**
 * CircleCI HTTP Server
 * Phase 2B-3B - CircleCI Connector HTTP 暴露层
 */
export interface CircleCIHttpServerConfig {
    port: number;
    basePath: string;
    apiToken?: string;
}
export declare class CircleCIHttpServer {
    private config;
    private server;
    private integration;
    constructor(config: CircleCIHttpServerConfig);
    start(): Promise<void>;
    private handleRequest;
    private handleWebhook;
    private handleGetApprovals;
    private handleGetIncidents;
    private handleAction;
}
