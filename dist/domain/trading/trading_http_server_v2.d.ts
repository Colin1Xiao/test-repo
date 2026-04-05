/**
 * Trading HTTP Server V2
 * Phase 2E-1 - 集成持久化存储
 *
 * 职责：
 * - 使用 Repositories 代替内存存储
 * - 集成 Audit Log 记录
 * - 提供 Trading Dashboard 端点
 */
export interface TradingHttpServerConfig {
    port: number;
    basePath: string;
    environment?: 'testnet' | 'mainnet';
    dataDir?: string;
}
export declare class TradingHttpServer {
    private config;
    private server;
    private tradingOps;
    private runbookActions;
    private riskStateService;
    private dashboardProjection;
    private eventIngest;
    private approvalRepository;
    private incidentRepository;
    private eventRepository;
    private auditLogService;
    constructor(config: TradingHttpServerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleRequest;
    private handleTradingEvent;
    private handleGetEvents;
    private handleGetEventsStats;
    private handleGitHubWebhook;
    private handleTradingSystemWebhook;
    private handleMonitoringWebhook;
    private handleGetDashboard;
    private handleGetEnhancedDashboard;
    private handleGetIncidents;
    private handleGetApprovals;
    private handleGetRiskState;
    private handleAcknowledgeIncident;
    private handleResolveIncident;
    private handleCreateRunbookAction;
    private handleExecuteRunbookAction;
    private handleRecordBreach;
}
export declare function createTradingHttpServer(config: TradingHttpServerConfig): TradingHttpServer;
