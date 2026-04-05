/**
 * Trading HTTP Server
 * Phase 2D-1A - Trading Ops Pack HTTP 暴露层
 *
 * 职责：
 * - 提供 Trading Dashboard 端点
 * - 提供 Trading Incidents 端点
 * - 提供 Trading Approvals 端点
 * - 提供 Trading Risk State 端点
 */
export interface TradingHttpServerConfig {
    port: number;
    basePath: string;
    environment?: 'testnet' | 'mainnet';
}
export declare class TradingHttpServer {
    private config;
    private server;
    private tradingOps;
    private dataStore;
    private runbookActions;
    private riskStateService;
    private dashboardProjection;
    private eventIngest;
    constructor(config: TradingHttpServerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleRequest;
    private handleTradingEvent;
    private handleGetDashboard;
    private handleGetIncidents;
    private handleGetApprovals;
    private handleGetRiskState;
    private handleGetEnhancedDashboard;
    private handleGetEvents;
    private handleGetEventsStats;
    private handleGitHubWebhook;
    private handleTradingSystemWebhook;
    private handleMonitoringWebhook;
    private handleExecuteRunbookAction;
    private handleRecordBreach;
    private handleCreateRunbookAction;
    private handleGetRunbookAction;
    private handleAcknowledgeIncident;
    private handleResolveIncident;
}
export declare function createTradingHttpServer(config: TradingHttpServerConfig): TradingHttpServer;
