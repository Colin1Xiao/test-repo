"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingHttpServer = void 0;
exports.createTradingHttpServer = createTradingHttpServer;
const http = __importStar(require("http"));
const url_1 = require("url");
const trading_ops_pack_1 = require("./trading_ops_pack");
const trading_runbook_actions_1 = require("./trading_runbook_actions");
const trading_risk_state_service_1 = require("./trading_risk_state_service");
const trading_dashboard_projection_1 = require("./trading_dashboard_projection");
const trading_event_ingest_1 = require("./trading_event_ingest");
// ============================================================================
// 内存数据存储（简化实现）
// ============================================================================
class TradingDataStore {
    constructor() {
        this.approvals = [];
        this.incidents = [];
        this.releases = [];
        this.alerts = [];
    }
    addApproval(approval) {
        this.approvals.push({ ...approval, createdAt: Date.now() });
    }
    addIncident(incident) {
        this.incidents.push({ ...incident, createdAt: Date.now(), acknowledged: false, resolved: false });
    }
    getApprovals() {
        return this.approvals;
    }
    getIncidents() {
        return this.incidents;
    }
    acknowledgeIncident(incidentId) {
        const incident = this.incidents.find(i => i.incidentId === incidentId);
        if (incident) {
            incident.acknowledged = true;
            incident.acknowledgedAt = Date.now();
        }
    }
    resolveIncident(incidentId, resolution) {
        const incident = this.incidents.find(i => i.incidentId === incidentId);
        if (incident) {
            incident.resolved = true;
            incident.resolvedAt = Date.now();
            incident.resolution = resolution;
        }
    }
}
// ============================================================================
// HTTP Server
// ============================================================================
class TradingHttpServer {
    constructor(config) {
        this.server = null;
        this.config = {
            port: config.port,
            basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
            environment: config.environment || 'mainnet',
        };
        this.tradingOps = (0, trading_ops_pack_1.initializeTradingOpsPack)({
            environment: this.config.environment,
            autoCreateApproval: true,
            autoCreateIncident: true,
        });
        this.dataStore = new TradingDataStore();
        this.runbookActions = (0, trading_runbook_actions_1.createTradingRunbookActions)();
        this.riskStateService = (0, trading_risk_state_service_1.createTradingRiskStateService)();
        this.dashboardProjection = (0, trading_dashboard_projection_1.createTradingDashboardProjection)();
        this.eventIngest = (0, trading_event_ingest_1.createTradingEventIngest)();
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`[TradingHttpServer] Listening on port ${this.config.port}`);
                console.log(`[TradingHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/trading/events`);
                console.log(`  POST ${this.config.basePath}/trading/webhooks/:source`);
                console.log(`  GET  ${this.config.basePath}/trading/events`);
                console.log(`  GET  ${this.config.basePath}/trading/events/stats`);
                console.log(`  GET  ${this.config.basePath}/trading/dashboard`);
                console.log(`  GET  ${this.config.basePath}/trading/dashboard/enhanced`);
                console.log(`  GET  ${this.config.basePath}/trading/incidents`);
                console.log(`  GET  ${this.config.basePath}/trading/approvals`);
                console.log(`  GET  ${this.config.basePath}/trading/risk-state`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/acknowledge`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/resolve`);
                console.log(`  POST ${this.config.basePath}/trading/runbook-actions`);
                console.log(`  GET  ${this.config.basePath}/trading/runbook-actions/:id`);
                console.log(`  POST ${this.config.basePath}/trading/runbook-actions/:id/execute`);
                console.log(`  POST ${this.config.basePath}/trading/risk-state/breach`);
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close(() => {
                console.log('[TradingHttpServer] Server stopped');
                resolve();
            });
        });
    }
    async handleRequest(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        const method = req.method || 'GET';
        console.log(`[TradingHttpServer] ${method} ${path}`);
        try {
            // Trading Events - Direct
            if (path === `${this.config.basePath}/trading/events` && method === 'POST') {
                await this.handleTradingEvent(req, res);
            }
            // Trading Events - List
            else if (path === `${this.config.basePath}/trading/events` && method === 'GET') {
                await this.handleGetEvents(req, res);
            }
            // Trading Events - Stats
            else if (path === `${this.config.basePath}/trading/events/stats` && method === 'GET') {
                await this.handleGetEventsStats(res);
            }
            // Webhooks - GitHub
            else if (path === `${this.config.basePath}/trading/webhooks/github` && method === 'POST') {
                await this.handleGitHubWebhook(req, res);
            }
            // Webhooks - Trading System
            else if (path === `${this.config.basePath}/trading/webhooks/trading-system` && method === 'POST') {
                await this.handleTradingSystemWebhook(req, res);
            }
            // Webhooks - Monitoring
            else if (path === `${this.config.basePath}/trading/webhooks/monitoring` && method === 'POST') {
                await this.handleMonitoringWebhook(req, res);
            }
            // Dashboard
            else if (path === `${this.config.basePath}/trading/dashboard` && method === 'GET') {
                await this.handleGetDashboard(res);
            }
            // Enhanced Dashboard
            else if (path === `${this.config.basePath}/trading/dashboard/enhanced` && method === 'GET') {
                await this.handleGetEnhancedDashboard(res);
            }
            // Incidents
            else if (path === `${this.config.basePath}/trading/incidents` && method === 'GET') {
                await this.handleGetIncidents(res);
            }
            // Approvals
            else if (path === `${this.config.basePath}/trading/approvals` && method === 'GET') {
                await this.handleGetApprovals(res);
            }
            // Risk State
            else if (path === `${this.config.basePath}/trading/risk-state` && method === 'GET') {
                await this.handleGetRiskState(res);
            }
            // Acknowledge Incident
            else if (path.match(/\/trading\/incidents\/[^/]+\/acknowledge/) && method === 'POST') {
                const incidentId = path.split('/')[4];
                await this.handleAcknowledgeIncident(incidentId, res);
            }
            // Resolve Incident
            else if (path.match(/\/trading\/incidents\/[^/]+\/resolve/) && method === 'POST') {
                const incidentId = path.split('/')[4];
                await this.handleResolveIncident(incidentId, req, res);
            }
            // Runbook Actions - Create
            else if (path === `${this.config.basePath}/trading/runbook-actions` && method === 'POST') {
                await this.handleCreateRunbookAction(req, res);
            }
            // Runbook Actions - Execute
            else if (path.match(/\/trading\/runbook-actions\/[^/]+\/execute/) && method === 'POST') {
                const actionId = path.split('/')[4];
                await this.handleExecuteRunbookAction(actionId, req, res);
            }
            // Get Runbook Action
            else if (path.match(/\/trading\/runbook-actions\//) && method === 'GET') {
                const actionId = path.split('/')[4];
                await this.handleGetRunbookAction(actionId, res);
            }
            // Risk State - Record Breach
            else if (path === `${this.config.basePath}/trading/risk-state/breach` && method === 'POST') {
                await this.handleRecordBreach(req, res);
            }
            else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        }
        catch (error) {
            console.error('[TradingHttpServer] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : String(error) }));
        }
    }
    async handleTradingEvent(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        // 处理事件
        const event = {
            type: payload.type,
            timestamp: Date.now(),
            severity: payload.severity || 'medium',
            source: payload.source || { system: 'trading', component: 'unknown', environment: this.config.environment },
            actor: payload.actor || { userId: 'system', username: 'system' },
            metadata: payload.metadata || {},
        };
        const result = await this.tradingOps.processEvent(event);
        // 存储到 Data Store
        if (result.approval) {
            this.dataStore.addApproval(result.approval);
        }
        if (result.incident) {
            this.dataStore.addIncident(result.incident);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            approvalCreated: !!result.approval,
            incidentCreated: !!result.incident,
            autoApproved: result.autoApproved,
            ignored: result.ignored,
        }));
    }
    async handleGetDashboard(res) {
        const snapshot = await this.tradingOps.operatorViews.buildDashboardSnapshot(this.dataStore.getApprovals(), this.dataStore.getIncidents(), [], []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(snapshot));
    }
    async handleGetIncidents(res) {
        const incidents = await this.tradingOps.operatorViews.buildActiveIncidents(this.dataStore.getIncidents());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(incidents));
    }
    async handleGetApprovals(res) {
        const approvals = await this.tradingOps.operatorViews.buildPendingApprovals(this.dataStore.getApprovals());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(approvals));
    }
    async handleGetRiskState(res) {
        const riskState = this.riskStateService.getCurrentState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(riskState));
    }
    async handleGetEnhancedDashboard(res) {
        const dashboard = await this.dashboardProjection.buildEnhancedDashboard(this.dataStore.getApprovals(), this.dataStore.getIncidents(), [], this.dataStore.getApprovals());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dashboard));
    }
    async handleGetEvents(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const type = url.searchParams.get('type');
        const severity = url.searchParams.get('severity');
        const source = url.searchParams.get('source');
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const events = this.eventIngest.getEventHistory({ type, severity, source, limit });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events, count: events.length }));
    }
    async handleGetEventsStats(res) {
        const stats = this.eventIngest.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            totalEvents: stats.totalEvents,
            byType: Object.fromEntries(stats.byType),
            bySeverity: Object.fromEntries(stats.bySeverity),
            bySource: Object.fromEntries(stats.bySource),
            last24h: stats.last24h,
        }));
    }
    async handleGitHubWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('github', 'github_actions', payload);
        // 处理解析后的事件
        if (result.eventsAccepted > 0) {
            const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
            for (const event of events.slice(-result.eventsAccepted)) {
                await this.tradingOps.processEvent(event);
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleTradingSystemWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('trading_system', 'trading_core', payload);
        // 处理解析后的事件
        if (result.eventsAccepted > 0) {
            const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
            for (const event of events.slice(-result.eventsAccepted)) {
                await this.tradingOps.processEvent(event);
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleMonitoringWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('monitoring', 'prometheus', payload);
        // 处理解析后的事件
        if (result.eventsAccepted > 0) {
            const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
            for (const event of events.slice(-result.eventsAccepted)) {
                await this.tradingOps.processEvent(event);
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleExecuteRunbookAction(actionId, req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.runbookActions.executeAction(actionId, payload.executedBy || 'system');
        // 如果执行成功，更新相关状态
        if (result.success) {
            const action = this.runbookActions.getActionHistory().find((a) => a.id === actionId);
            if (action && action.target.type === 'incident') {
                // 更新 Incident 状态
                if (action.type === 'acknowledge') {
                    this.dataStore.acknowledgeIncident(action.target.id);
                }
                else if (action.type === 'request_recovery') {
                    this.dataStore.resolveIncident(action.target.id, 'Recovery requested');
                }
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleRecordBreach(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const breachId = this.riskStateService.recordBreach(payload.metric || 'unknown', payload.threshold || 'unknown', payload.value || 'unknown', payload.severity || 'medium');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, breachId }));
    }
    async handleCreateRunbookAction(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const action = this.runbookActions.createAction(payload.type, payload.target, payload.parameters);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action }));
    }
    async handleGetRunbookAction(actionId, res) {
        const history = this.runbookActions.getActionHistory();
        const action = history.find((a) => a.id === actionId);
        if (!action) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Action not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(action));
    }
    async handleAcknowledgeIncident(incidentId, res) {
        // 更新数据状态
        this.dataStore.acknowledgeIncident(incidentId);
        // 创建 Runbook Action 记录
        const action = this.runbookActions.createAction('acknowledge', { type: 'incident', id: incidentId });
        await this.runbookActions.executeAction(action.id, 'system');
        // 记录风险状态
        this.riskStateService.recordBreach(`incident_${incidentId}`, 'acknowledged', 'true', 'low');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, incidentId, acknowledged: true, actionId: action.id }));
    }
    async handleResolveIncident(incidentId, req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        this.dataStore.resolveIncident(incidentId, payload.resolution);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, incidentId, resolved: true }));
    }
}
exports.TradingHttpServer = TradingHttpServer;
// ============================================================================
// 工厂函数
// ============================================================================
function createTradingHttpServer(config) {
    return new TradingHttpServer(config);
}
// ============================================================================
// 独立运行入口
// ============================================================================
if (require.main === module) {
    const server = createTradingHttpServer({
        port: parseInt(process.env.PORT || '3004', 10),
        basePath: process.env.BASE_PATH || '/api',
    });
    server.start().catch(console.error);
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19odHRwX3NlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9kb21haW4vdHJhZGluZy90cmFkaW5nX2h0dHBfc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNmSCwwREFFQztBQXRmRCwyQ0FBNkI7QUFDN0IsNkJBQTBCO0FBQzFCLHlEQUFpSDtBQUNqSCx1RUFBNkk7QUFDN0ksNkVBQTZFO0FBQzdFLGlGQUFrRjtBQUNsRixpRUFBa0U7QUFhbEUsK0VBQStFO0FBQy9FLGVBQWU7QUFDZiwrRUFBK0U7QUFFL0UsTUFBTSxnQkFBZ0I7SUFBdEI7UUFDVSxjQUFTLEdBQVUsRUFBRSxDQUFDO1FBQ3RCLGNBQVMsR0FBVSxFQUFFLENBQUM7UUFDdEIsYUFBUSxHQUFVLEVBQUUsQ0FBQztRQUNyQixXQUFNLEdBQVUsRUFBRSxDQUFDO0lBa0M3QixDQUFDO0lBaENDLFdBQVcsQ0FBQyxRQUFhO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxRQUFRLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELFdBQVcsQ0FBQyxRQUFhO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxRQUFRLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3BHLENBQUM7SUFFRCxZQUFZO1FBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxZQUFZO1FBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxtQkFBbUIs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SyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVwQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM5QixNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVHJhZGluZyBIVFRQIFNlcnZlclxuICogUGhhc2UgMkQtMUEgLSBUcmFkaW5nIE9wcyBQYWNrIEhUVFAg5pq06Zyy5bGCXG4gKiBcbiAqIOiBjOi0o++8mlxuICogLSDmj5DkvpsgVHJhZGluZyBEYXNoYm9hcmQg56uv54K5XG4gKiAtIOaPkOS+myBUcmFkaW5nIEluY2lkZW50cyDnq6/ngrlcbiAqIC0g5o+Q5L6bIFRyYWRpbmcgQXBwcm92YWxzIOerr+eCuVxuICogLSDmj5DkvpsgVHJhZGluZyBSaXNrIFN0YXRlIOerr+eCuVxuICovXG5cbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgaW5pdGlhbGl6ZVRyYWRpbmdPcHNQYWNrLCBjcmVhdGVSZWxlYXNlUmVxdWVzdEV2ZW50LCBjcmVhdGVTeXN0ZW1BbGVydEV2ZW50IH0gZnJvbSAnLi90cmFkaW5nX29wc19wYWNrJztcbmltcG9ydCB7IGNyZWF0ZVRyYWRpbmdSdW5ib29rQWN0aW9ucywgY3JlYXRlQWNrbm93bGVkZ2VBY3Rpb24sIGNyZWF0ZUVzY2FsYXRlQWN0aW9uLCBjcmVhdGVSZWNvdmVyeUFjdGlvbiB9IGZyb20gJy4vdHJhZGluZ19ydW5ib29rX2FjdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlVHJhZGluZ1Jpc2tTdGF0ZVNlcnZpY2UgfSBmcm9tICcuL3RyYWRpbmdfcmlza19zdGF0ZV9zZXJ2aWNlJztcbmltcG9ydCB7IGNyZWF0ZVRyYWRpbmdEYXNoYm9hcmRQcm9qZWN0aW9uIH0gZnJvbSAnLi90cmFkaW5nX2Rhc2hib2FyZF9wcm9qZWN0aW9uJztcbmltcG9ydCB7IGNyZWF0ZVRyYWRpbmdFdmVudEluZ2VzdCB9IGZyb20gJy4vdHJhZGluZ19ldmVudF9pbmdlc3QnO1xuaW1wb3J0IHR5cGUgeyBUcmFkaW5nRXZlbnQgfSBmcm9tICcuL3RyYWRpbmdfdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDphY3nva5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFkaW5nSHR0cFNlcnZlckNvbmZpZyB7XG4gIHBvcnQ6IG51bWJlcjtcbiAgYmFzZVBhdGg6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ/OiAndGVzdG5ldCcgfCAnbWFpbm5ldCc7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOWGheWtmOaVsOaNruWtmOWCqO+8iOeugOWMluWunueOsO+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jbGFzcyBUcmFkaW5nRGF0YVN0b3JlIHtcbiAgcHJpdmF0ZSBhcHByb3ZhbHM6IGFueVtdID0gW107XG4gIHByaXZhdGUgaW5jaWRlbnRzOiBhbnlbXSA9IFtdO1xuICBwcml2YXRlIHJlbGVhc2VzOiBhbnlbXSA9IFtdO1xuICBwcml2YXRlIGFsZXJ0czogYW55W10gPSBbXTtcblxuICBhZGRBcHByb3ZhbChhcHByb3ZhbDogYW55KSB7XG4gICAgdGhpcy5hcHByb3ZhbHMucHVzaCh7IC4uLmFwcHJvdmFsLCBjcmVhdGVkQXQ6IERhdGUubm93KCkgfSk7XG4gIH1cblxuICBhZGRJbmNpZGVudChpbmNpZGVudDogYW55KSB7XG4gICAgdGhpcy5pbmNpZGVudHMucHVzaCh7IC4uLmluY2lkZW50LCBjcmVhdGVkQXQ6IERhdGUubm93KCksIGFja25vd2xlZGdlZDogZmFsc2UsIHJlc29sdmVkOiBmYWxzZSB9KTtcbiAgfVxuXG4gIGdldEFwcHJvdmFscygpIHtcbiAgICByZXR1cm4gdGhpcy5hcHByb3ZhbHM7XG4gIH1cblxuICBnZXRJbmNpZGVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5jaWRlbnRzO1xuICB9XG5cbiAgYWNrbm93bGVkZ2VJbmNpZGVudChpbmNpZGVudElkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBpbmNpZGVudCA9IHRoaXMuaW5jaWRlbnRzLmZpbmQoaSA9PiBpLmluY2lkZW50SWQgPT09IGluY2lkZW50SWQpO1xuICAgIGlmIChpbmNpZGVudCkge1xuICAgICAgaW5jaWRlbnQuYWNrbm93bGVkZ2VkID0gdHJ1ZTtcbiAgICAgIGluY2lkZW50LmFja25vd2xlZGdlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICB9XG4gIH1cblxuICByZXNvbHZlSW5jaWRlbnQoaW5jaWRlbnRJZDogc3RyaW5nLCByZXNvbHV0aW9uPzogc3RyaW5nKSB7XG4gICAgY29uc3QgaW5jaWRlbnQgPSB0aGlzLmluY2lkZW50cy5maW5kKGkgPT4gaS5pbmNpZGVudElkID09PSBpbmNpZGVudElkKTtcbiAgICBpZiAoaW5jaWRlbnQpIHtcbiAgICAgIGluY2lkZW50LnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgIGluY2lkZW50LnJlc29sdmVkQXQgPSBEYXRlLm5vdygpO1xuICAgICAgaW5jaWRlbnQucmVzb2x1dGlvbiA9IHJlc29sdXRpb247XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEhUVFAgU2VydmVyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBUcmFkaW5nSHR0cFNlcnZlciB7XG4gIHByaXZhdGUgY29uZmlnOiBSZXF1aXJlZDxUcmFkaW5nSHR0cFNlcnZlckNvbmZpZz47XG4gIHByaXZhdGUgc2VydmVyOiBodHRwLlNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRyYWRpbmdPcHM6IGFueTtcbiAgcHJpdmF0ZSBkYXRhU3RvcmU6IFRyYWRpbmdEYXRhU3RvcmU7XG4gIHByaXZhdGUgcnVuYm9va0FjdGlvbnM6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdSdW5ib29rQWN0aW9ucz47XG4gIHByaXZhdGUgcmlza1N0YXRlU2VydmljZTogUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlVHJhZGluZ1Jpc2tTdGF0ZVNlcnZpY2U+O1xuICBwcml2YXRlIGRhc2hib2FyZFByb2plY3Rpb246IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdEYXNoYm9hcmRQcm9qZWN0aW9uPjtcbiAgcHJpdmF0ZSBldmVudEluZ2VzdDogUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlVHJhZGluZ0V2ZW50SW5nZXN0PjtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFRyYWRpbmdIdHRwU2VydmVyQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBwb3J0OiBjb25maWcucG9ydCxcbiAgICAgIGJhc2VQYXRoOiBjb25maWcuYmFzZVBhdGguZW5kc1dpdGgoJy8nKSA/IGNvbmZpZy5iYXNlUGF0aC5zbGljZSgwLCAtMSkgOiBjb25maWcuYmFzZVBhdGgsXG4gICAgICBlbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50IHx8ICdtYWlubmV0JyxcbiAgICB9O1xuXG4gICAgdGhpcy50cmFkaW5nT3BzID0gaW5pdGlhbGl6ZVRyYWRpbmdPcHNQYWNrKHtcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgIGF1dG9DcmVhdGVBcHByb3ZhbDogdHJ1ZSxcbiAgICAgIGF1dG9DcmVhdGVJbmNpZGVudDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHRoaXMuZGF0YVN0b3JlID0gbmV3IFRyYWRpbmdEYXRhU3RvcmUoKTtcbiAgICB0aGlzLnJ1bmJvb2tBY3Rpb25zID0gY3JlYXRlVHJhZGluZ1J1bmJvb2tBY3Rpb25zKCk7XG4gICAgdGhpcy5yaXNrU3RhdGVTZXJ2aWNlID0gY3JlYXRlVHJhZGluZ1Jpc2tTdGF0ZVNlcnZpY2UoKTtcbiAgICB0aGlzLmRhc2hib2FyZFByb2plY3Rpb24gPSBjcmVhdGVUcmFkaW5nRGFzaGJvYXJkUHJvamVjdGlvbigpO1xuICAgIHRoaXMuZXZlbnRJbmdlc3QgPSBjcmVhdGVUcmFkaW5nRXZlbnRJbmdlc3QoKTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlUmVxdWVzdC5iaW5kKHRoaXMpKTtcbiAgICAgIHRoaXMuc2VydmVyLmxpc3Rlbih0aGlzLmNvbmZpZy5wb3J0LCAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbVHJhZGluZ0h0dHBTZXJ2ZXJdIExpc3RlbmluZyBvbiBwb3J0ICR7dGhpcy5jb25maWcucG9ydH1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtUcmFkaW5nSHR0cFNlcnZlcl0gRW5kcG9pbnRzOmApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBQT1NUICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZXZlbnRzYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy93ZWJob29rcy86c291cmNlYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ldmVudHNgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2V2ZW50cy9zdGF0c2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZGFzaGJvYXJkYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9kYXNoYm9hcmQvZW5oYW5jZWRgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2luY2lkZW50c2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvYXBwcm92YWxzYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9yaXNrLXN0YXRlYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9pbmNpZGVudHMvOmlkL2Fja25vd2xlZGdlYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9pbmNpZGVudHMvOmlkL3Jlc29sdmVgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3J1bmJvb2stYWN0aW9uc2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcnVuYm9vay1hY3Rpb25zLzppZGApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBQT1NUICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcnVuYm9vay1hY3Rpb25zLzppZC9leGVjdXRlYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9yaXNrLXN0YXRlL2JyZWFjaGApO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuc2VydmVyLm9uKCdlcnJvcicsIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNlcnZlcikge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2VydmVyLmNsb3NlKCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tUcmFkaW5nSHR0cFNlcnZlcl0gU2VydmVyIHN0b3BwZWQnKTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsIHx8ICcvJywgYGh0dHA6Ly8ke3JlcS5oZWFkZXJzLmhvc3R9YCk7XG4gICAgY29uc3QgcGF0aCA9IHVybC5wYXRobmFtZTtcbiAgICBjb25zdCBtZXRob2QgPSByZXEubWV0aG9kIHx8ICdHRVQnO1xuXG4gICAgY29uc29sZS5sb2coYFtUcmFkaW5nSHR0cFNlcnZlcl0gJHttZXRob2R9ICR7cGF0aH1gKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBUcmFkaW5nIEV2ZW50cyAtIERpcmVjdFxuICAgICAgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2V2ZW50c2AgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVUcmFkaW5nRXZlbnQocmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gVHJhZGluZyBFdmVudHMgLSBMaXN0XG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ldmVudHNgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXRFdmVudHMocmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gVHJhZGluZyBFdmVudHMgLSBTdGF0c1xuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZXZlbnRzL3N0YXRzYCAmJiBtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0RXZlbnRzU3RhdHMocmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIFdlYmhvb2tzIC0gR2l0SHViXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy93ZWJob29rcy9naXRodWJgICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2l0SHViV2ViaG9vayhyZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBXZWJob29rcyAtIFRyYWRpbmcgU3lzdGVtXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy93ZWJob29rcy90cmFkaW5nLXN5c3RlbWAgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVUcmFkaW5nU3lzdGVtV2ViaG9vayhyZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBXZWJob29rcyAtIE1vbml0b3JpbmdcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3dlYmhvb2tzL21vbml0b3JpbmdgICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlTW9uaXRvcmluZ1dlYmhvb2socmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gRGFzaGJvYXJkXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9kYXNoYm9hcmRgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXREYXNoYm9hcmQocmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIEVuaGFuY2VkIERhc2hib2FyZFxuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZGFzaGJvYXJkL2VuaGFuY2VkYCAmJiBtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0RW5oYW5jZWREYXNoYm9hcmQocmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIEluY2lkZW50c1xuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvaW5jaWRlbnRzYCAmJiBtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0SW5jaWRlbnRzKHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBBcHByb3ZhbHNcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2FwcHJvdmFsc2AgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEFwcHJvdmFscyhyZXMpO1xuICAgICAgfVxuICAgICAgLy8gUmlzayBTdGF0ZVxuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcmlzay1zdGF0ZWAgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldFJpc2tTdGF0ZShyZXMpO1xuICAgICAgfVxuICAgICAgLy8gQWNrbm93bGVkZ2UgSW5jaWRlbnRcbiAgICAgIGVsc2UgaWYgKHBhdGgubWF0Y2goL1xcL3RyYWRpbmdcXC9pbmNpZGVudHNcXC9bXi9dK1xcL2Fja25vd2xlZGdlLykgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgY29uc3QgaW5jaWRlbnRJZCA9IHBhdGguc3BsaXQoJy8nKVs0XTtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVBY2tub3dsZWRnZUluY2lkZW50KGluY2lkZW50SWQsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBSZXNvbHZlIEluY2lkZW50XG4gICAgICBlbHNlIGlmIChwYXRoLm1hdGNoKC9cXC90cmFkaW5nXFwvaW5jaWRlbnRzXFwvW14vXStcXC9yZXNvbHZlLykgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgY29uc3QgaW5jaWRlbnRJZCA9IHBhdGguc3BsaXQoJy8nKVs0XTtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVSZXNvbHZlSW5jaWRlbnQoaW5jaWRlbnRJZCwgcmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gUnVuYm9vayBBY3Rpb25zIC0gQ3JlYXRlXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ydW5ib29rLWFjdGlvbnNgICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlQ3JlYXRlUnVuYm9va0FjdGlvbihyZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBSdW5ib29rIEFjdGlvbnMgLSBFeGVjdXRlXG4gICAgICBlbHNlIGlmIChwYXRoLm1hdGNoKC9cXC90cmFkaW5nXFwvcnVuYm9vay1hY3Rpb25zXFwvW14vXStcXC9leGVjdXRlLykgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgY29uc3QgYWN0aW9uSWQgPSBwYXRoLnNwbGl0KCcvJylbNF07XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlRXhlY3V0ZVJ1bmJvb2tBY3Rpb24oYWN0aW9uSWQsIHJlcSwgcmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIEdldCBSdW5ib29rIEFjdGlvblxuICAgICAgZWxzZSBpZiAocGF0aC5tYXRjaCgvXFwvdHJhZGluZ1xcL3J1bmJvb2stYWN0aW9uc1xcLy8pICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgY29uc3QgYWN0aW9uSWQgPSBwYXRoLnNwbGl0KCcvJylbNF07XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0UnVuYm9va0FjdGlvbihhY3Rpb25JZCwgcmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIFJpc2sgU3RhdGUgLSBSZWNvcmQgQnJlYWNoXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9yaXNrLXN0YXRlL2JyZWFjaGAgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVSZWNvcmRCcmVhY2gocmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ05vdCBmb3VuZCcgfSkpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhZGluZ0h0dHBTZXJ2ZXJdIEVycm9yOicsIGVycm9yKTtcbiAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLCBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcikgfSkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlVHJhZGluZ0V2ZW50KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIC8vIOWkhOeQhuS6i+S7tlxuICAgIGNvbnN0IGV2ZW50OiBUcmFkaW5nRXZlbnQgPSB7XG4gICAgICB0eXBlOiBwYXlsb2FkLnR5cGUsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBzZXZlcml0eTogcGF5bG9hZC5zZXZlcml0eSB8fCAnbWVkaXVtJyxcbiAgICAgIHNvdXJjZTogcGF5bG9hZC5zb3VyY2UgfHwgeyBzeXN0ZW06ICd0cmFkaW5nJywgY29tcG9uZW50OiAndW5rbm93bicsIGVudmlyb25tZW50OiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCB9LFxuICAgICAgYWN0b3I6IHBheWxvYWQuYWN0b3IgfHwgeyB1c2VySWQ6ICdzeXN0ZW0nLCB1c2VybmFtZTogJ3N5c3RlbScgfSxcbiAgICAgIG1ldGFkYXRhOiBwYXlsb2FkLm1ldGFkYXRhIHx8IHt9LFxuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnRyYWRpbmdPcHMucHJvY2Vzc0V2ZW50KGV2ZW50KTtcblxuICAgIC8vIOWtmOWCqOWIsCBEYXRhIFN0b3JlXG4gICAgaWYgKHJlc3VsdC5hcHByb3ZhbCkge1xuICAgICAgdGhpcy5kYXRhU3RvcmUuYWRkQXBwcm92YWwocmVzdWx0LmFwcHJvdmFsKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5pbmNpZGVudCkge1xuICAgICAgdGhpcy5kYXRhU3RvcmUuYWRkSW5jaWRlbnQocmVzdWx0LmluY2lkZW50KTtcbiAgICB9XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGFwcHJvdmFsQ3JlYXRlZDogISFyZXN1bHQuYXBwcm92YWwsXG4gICAgICBpbmNpZGVudENyZWF0ZWQ6ICEhcmVzdWx0LmluY2lkZW50LFxuICAgICAgYXV0b0FwcHJvdmVkOiByZXN1bHQuYXV0b0FwcHJvdmVkLFxuICAgICAgaWdub3JlZDogcmVzdWx0Lmlnbm9yZWQsXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXREYXNoYm9hcmQocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3Qgc25hcHNob3QgPSBhd2FpdCB0aGlzLnRyYWRpbmdPcHMub3BlcmF0b3JWaWV3cy5idWlsZERhc2hib2FyZFNuYXBzaG90KFxuICAgICAgdGhpcy5kYXRhU3RvcmUuZ2V0QXBwcm92YWxzKCksXG4gICAgICB0aGlzLmRhdGFTdG9yZS5nZXRJbmNpZGVudHMoKSxcbiAgICAgIFtdLFxuICAgICAgW11cbiAgICApO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHNuYXBzaG90KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEluY2lkZW50cyhyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBpbmNpZGVudHMgPSBhd2FpdCB0aGlzLnRyYWRpbmdPcHMub3BlcmF0b3JWaWV3cy5idWlsZEFjdGl2ZUluY2lkZW50cyhcbiAgICAgIHRoaXMuZGF0YVN0b3JlLmdldEluY2lkZW50cygpXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShpbmNpZGVudHMpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0QXBwcm92YWxzKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGFwcHJvdmFscyA9IGF3YWl0IHRoaXMudHJhZGluZ09wcy5vcGVyYXRvclZpZXdzLmJ1aWxkUGVuZGluZ0FwcHJvdmFscyhcbiAgICAgIHRoaXMuZGF0YVN0b3JlLmdldEFwcHJvdmFscygpXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShhcHByb3ZhbHMpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0Umlza1N0YXRlKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHJpc2tTdGF0ZSA9IHRoaXMucmlza1N0YXRlU2VydmljZS5nZXRDdXJyZW50U3RhdGUoKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyaXNrU3RhdGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0RW5oYW5jZWREYXNoYm9hcmQocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gYXdhaXQgdGhpcy5kYXNoYm9hcmRQcm9qZWN0aW9uLmJ1aWxkRW5oYW5jZWREYXNoYm9hcmQoXG4gICAgICB0aGlzLmRhdGFTdG9yZS5nZXRBcHByb3ZhbHMoKSxcbiAgICAgIHRoaXMuZGF0YVN0b3JlLmdldEluY2lkZW50cygpLFxuICAgICAgW10sXG4gICAgICB0aGlzLmRhdGFTdG9yZS5nZXRBcHByb3ZhbHMoKVxuICAgICk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoZGFzaGJvYXJkKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEV2ZW50cyhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICBjb25zdCB0eXBlID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3R5cGUnKTtcbiAgICBjb25zdCBzZXZlcml0eSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdzZXZlcml0eScpO1xuICAgIGNvbnN0IHNvdXJjZSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdzb3VyY2UnKTtcbiAgICBjb25zdCBsaW1pdCA9IHBhcnNlSW50KHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdsaW1pdCcpIHx8ICcxMDAnLCAxMCk7XG5cbiAgICBjb25zdCBldmVudHMgPSB0aGlzLmV2ZW50SW5nZXN0LmdldEV2ZW50SGlzdG9yeSh7IHR5cGUsIHNldmVyaXR5LCBzb3VyY2UsIGxpbWl0IH0pO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXZlbnRzLCBjb3VudDogZXZlbnRzLmxlbmd0aCB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEV2ZW50c1N0YXRzKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHN0YXRzID0gdGhpcy5ldmVudEluZ2VzdC5nZXRTdGF0cygpO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHRvdGFsRXZlbnRzOiBzdGF0cy50b3RhbEV2ZW50cyxcbiAgICAgIGJ5VHlwZTogT2JqZWN0LmZyb21FbnRyaWVzKHN0YXRzLmJ5VHlwZSksXG4gICAgICBieVNldmVyaXR5OiBPYmplY3QuZnJvbUVudHJpZXMoc3RhdHMuYnlTZXZlcml0eSksXG4gICAgICBieVNvdXJjZTogT2JqZWN0LmZyb21FbnRyaWVzKHN0YXRzLmJ5U291cmNlKSxcbiAgICAgIGxhc3QyNGg6IHN0YXRzLmxhc3QyNGgsXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHaXRIdWJXZWJob29rKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXZlbnRJbmdlc3QuaW5nZXN0V2ViaG9vaygnZ2l0aHViJywgJ2dpdGh1Yl9hY3Rpb25zJywgcGF5bG9hZCk7XG5cbiAgICAvLyDlpITnkIbop6PmnpDlkI7nmoTkuovku7ZcbiAgICBpZiAocmVzdWx0LmV2ZW50c0FjY2VwdGVkID4gMCkge1xuICAgICAgY29uc3QgZXZlbnRzID0gdGhpcy5ldmVudEluZ2VzdC5nZXRFdmVudEhpc3RvcnkoeyBsaW1pdDogcmVzdWx0LmV2ZW50c0FjY2VwdGVkIH0pO1xuICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMuc2xpY2UoLXJlc3VsdC5ldmVudHNBY2NlcHRlZCkpIHtcbiAgICAgICAgYXdhaXQgdGhpcy50cmFkaW5nT3BzLnByb2Nlc3NFdmVudChldmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVUcmFkaW5nU3lzdGVtV2ViaG9vayhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV2ZW50SW5nZXN0LmluZ2VzdFdlYmhvb2soJ3RyYWRpbmdfc3lzdGVtJywgJ3RyYWRpbmdfY29yZScsIHBheWxvYWQpO1xuXG4gICAgLy8g5aSE55CG6Kej5p6Q5ZCO55qE5LqL5Lu2XG4gICAgaWYgKHJlc3VsdC5ldmVudHNBY2NlcHRlZCA+IDApIHtcbiAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuZXZlbnRJbmdlc3QuZ2V0RXZlbnRIaXN0b3J5KHsgbGltaXQ6IHJlc3VsdC5ldmVudHNBY2NlcHRlZCB9KTtcbiAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzLnNsaWNlKC1yZXN1bHQuZXZlbnRzQWNjZXB0ZWQpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMudHJhZGluZ09wcy5wcm9jZXNzRXZlbnQoZXZlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlTW9uaXRvcmluZ1dlYmhvb2socmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgYm9keTogYW55W10gPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keS5wdXNoKGNodW5rKTtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5ldmVudEluZ2VzdC5pbmdlc3RXZWJob29rKCdtb25pdG9yaW5nJywgJ3Byb21ldGhldXMnLCBwYXlsb2FkKTtcblxuICAgIC8vIOWkhOeQhuino+aekOWQjueahOS6i+S7tlxuICAgIGlmIChyZXN1bHQuZXZlbnRzQWNjZXB0ZWQgPiAwKSB7XG4gICAgICBjb25zdCBldmVudHMgPSB0aGlzLmV2ZW50SW5nZXN0LmdldEV2ZW50SGlzdG9yeSh7IGxpbWl0OiByZXN1bHQuZXZlbnRzQWNjZXB0ZWQgfSk7XG4gICAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cy5zbGljZSgtcmVzdWx0LmV2ZW50c0FjY2VwdGVkKSkge1xuICAgICAgICBhd2FpdCB0aGlzLnRyYWRpbmdPcHMucHJvY2Vzc0V2ZW50KGV2ZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUV4ZWN1dGVSdW5ib29rQWN0aW9uKGFjdGlvbklkOiBzdHJpbmcsIHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucnVuYm9va0FjdGlvbnMuZXhlY3V0ZUFjdGlvbihhY3Rpb25JZCwgcGF5bG9hZC5leGVjdXRlZEJ5IHx8ICdzeXN0ZW0nKTtcblxuICAgIC8vIOWmguaenOaJp+ihjOaIkOWKn++8jOabtOaWsOebuOWFs+eKtuaAgVxuICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5ydW5ib29rQWN0aW9ucy5nZXRBY3Rpb25IaXN0b3J5KCkuZmluZCgoYSkgPT4gYS5pZCA9PT0gYWN0aW9uSWQpO1xuICAgICAgaWYgKGFjdGlvbiAmJiBhY3Rpb24udGFyZ2V0LnR5cGUgPT09ICdpbmNpZGVudCcpIHtcbiAgICAgICAgLy8g5pu05pawIEluY2lkZW50IOeKtuaAgVxuICAgICAgICBpZiAoYWN0aW9uLnR5cGUgPT09ICdhY2tub3dsZWRnZScpIHtcbiAgICAgICAgICB0aGlzLmRhdGFTdG9yZS5hY2tub3dsZWRnZUluY2lkZW50KGFjdGlvbi50YXJnZXQuaWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbi50eXBlID09PSAncmVxdWVzdF9yZWNvdmVyeScpIHtcbiAgICAgICAgICB0aGlzLmRhdGFTdG9yZS5yZXNvbHZlSW5jaWRlbnQoYWN0aW9uLnRhcmdldC5pZCwgJ1JlY292ZXJ5IHJlcXVlc3RlZCcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZWNvcmRCcmVhY2gocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgYm9keTogYW55W10gPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keS5wdXNoKGNodW5rKTtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3QgYnJlYWNoSWQgPSB0aGlzLnJpc2tTdGF0ZVNlcnZpY2UucmVjb3JkQnJlYWNoKFxuICAgICAgcGF5bG9hZC5tZXRyaWMgfHwgJ3Vua25vd24nLFxuICAgICAgcGF5bG9hZC50aHJlc2hvbGQgfHwgJ3Vua25vd24nLFxuICAgICAgcGF5bG9hZC52YWx1ZSB8fCAndW5rbm93bicsXG4gICAgICBwYXlsb2FkLnNldmVyaXR5IHx8ICdtZWRpdW0nXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGJyZWFjaElkIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlQ3JlYXRlUnVuYm9va0FjdGlvbihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBhY3Rpb24gPSB0aGlzLnJ1bmJvb2tBY3Rpb25zLmNyZWF0ZUFjdGlvbihcbiAgICAgIHBheWxvYWQudHlwZSxcbiAgICAgIHBheWxvYWQudGFyZ2V0LFxuICAgICAgcGF5bG9hZC5wYXJhbWV0ZXJzXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGFjdGlvbiB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldFJ1bmJvb2tBY3Rpb24oYWN0aW9uSWQ6IHN0cmluZywgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgaGlzdG9yeSA9IHRoaXMucnVuYm9va0FjdGlvbnMuZ2V0QWN0aW9uSGlzdG9yeSgpO1xuICAgIGNvbnN0IGFjdGlvbiA9IGhpc3RvcnkuZmluZCgoYSkgPT4gYS5pZCA9PT0gYWN0aW9uSWQpO1xuXG4gICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdBY3Rpb24gbm90IGZvdW5kJyB9KSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KGFjdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBY2tub3dsZWRnZUluY2lkZW50KGluY2lkZW50SWQ6IHN0cmluZywgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgLy8g5pu05paw5pWw5o2u54q25oCBXG4gICAgdGhpcy5kYXRhU3RvcmUuYWNrbm93bGVkZ2VJbmNpZGVudChpbmNpZGVudElkKTtcblxuICAgIC8vIOWIm+W7uiBSdW5ib29rIEFjdGlvbiDorrDlvZVcbiAgICBjb25zdCBhY3Rpb24gPSB0aGlzLnJ1bmJvb2tBY3Rpb25zLmNyZWF0ZUFjdGlvbignYWNrbm93bGVkZ2UnLCB7IHR5cGU6ICdpbmNpZGVudCcsIGlkOiBpbmNpZGVudElkIH0pO1xuICAgIGF3YWl0IHRoaXMucnVuYm9va0FjdGlvbnMuZXhlY3V0ZUFjdGlvbihhY3Rpb24uaWQsICdzeXN0ZW0nKTtcblxuICAgIC8vIOiusOW9lemjjumZqeeKtuaAgVxuICAgIHRoaXMucmlza1N0YXRlU2VydmljZS5yZWNvcmRCcmVhY2goXG4gICAgICBgaW5jaWRlbnRfJHtpbmNpZGVudElkfWAsXG4gICAgICAnYWNrbm93bGVkZ2VkJyxcbiAgICAgICd0cnVlJyxcbiAgICAgICdsb3cnXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGluY2lkZW50SWQsIGFja25vd2xlZGdlZDogdHJ1ZSwgYWN0aW9uSWQ6IGFjdGlvbi5pZCB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlc29sdmVJbmNpZGVudChpbmNpZGVudElkOiBzdHJpbmcsIHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIHRoaXMuZGF0YVN0b3JlLnJlc29sdmVJbmNpZGVudChpbmNpZGVudElkLCBwYXlsb2FkLnJlc29sdXRpb24pO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgaW5jaWRlbnRJZCwgcmVzb2x2ZWQ6IHRydWUgfSkpO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVHJhZGluZ0h0dHBTZXJ2ZXIoY29uZmlnOiBUcmFkaW5nSHR0cFNlcnZlckNvbmZpZyk6IFRyYWRpbmdIdHRwU2VydmVyIHtcbiAgcmV0dXJuIG5ldyBUcmFkaW5nSHR0cFNlcnZlcihjb25maWcpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDni6znq4vov5DooYzlhaXlj6Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGNvbnN0IHNlcnZlciA9IGNyZWF0ZVRyYWRpbmdIdHRwU2VydmVyKHtcbiAgICBwb3J0OiBwYXJzZUludChwcm9jZXNzLmVudi5QT1JUIHx8ICczMDA0JywgMTApLFxuICAgIGJhc2VQYXRoOiBwcm9jZXNzLmVudi5CQVNFX1BBVEggfHwgJy9hcGknLFxuICB9KTtcblxuICBzZXJ2ZXIuc3RhcnQoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcblxuICBwcm9jZXNzLm9uKCdTSUdJTlQnLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgc2VydmVyLnN0b3AoKTtcbiAgICBwcm9jZXNzLmV4aXQoMCk7XG4gIH0pO1xufVxuIl19