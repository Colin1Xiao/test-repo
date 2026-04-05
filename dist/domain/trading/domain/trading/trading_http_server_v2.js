"use strict";
/**
 * Trading HTTP Server V2
 * Phase 2E-1 - 集成持久化存储
 *
 * 职责：
 * - 使用 Repositories 代替内存存储
 * - 集成 Audit Log 记录
 * - 提供 Trading Dashboard 端点
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
const path = __importStar(require("path"));
const trading_ops_pack_1 = require("./trading_ops_pack");
const trading_runbook_actions_1 = require("./trading_runbook_actions");
const trading_risk_state_service_1 = require("./trading_risk_state_service");
const trading_dashboard_projection_1 = require("./trading_dashboard_projection");
const trading_event_ingest_1 = require("./trading_event_ingest");
const approval_repository_1 = require("../../infrastructure/persistence/approval_repository");
const incident_repository_1 = require("../../infrastructure/persistence/incident_repository");
const event_repository_1 = require("../../infrastructure/persistence/event_repository");
const audit_log_service_1 = require("../../infrastructure/persistence/audit_log_service");
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
            dataDir: config.dataDir || path.join(process.env.HOME || '/tmp', '.openclaw', 'trading-data'),
        };
        this.tradingOps = (0, trading_ops_pack_1.initializeTradingOpsPack)({
            environment: this.config.environment,
            autoCreateApproval: true,
            autoCreateIncident: true,
        });
        this.runbookActions = (0, trading_runbook_actions_1.createTradingRunbookActions)();
        this.riskStateService = (0, trading_risk_state_service_1.createTradingRiskStateService)();
        this.dashboardProjection = (0, trading_dashboard_projection_1.createTradingDashboardProjection)();
        this.eventIngest = (0, trading_event_ingest_1.createTradingEventIngest)();
        // Initialize Persistence Repositories
        this.approvalRepository = (0, approval_repository_1.createApprovalRepository)(this.config.dataDir);
        this.incidentRepository = (0, incident_repository_1.createIncidentRepository)(this.config.dataDir);
        this.eventRepository = (0, event_repository_1.createEventRepository)(this.config.dataDir);
        this.auditLogService = (0, audit_log_service_1.createAuditLogService)(this.config.dataDir);
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`[TradingHttpServer] Listening on port ${this.config.port}`);
                console.log(`[TradingHttpServer] Data Directory: ${this.config.dataDir}`);
                console.log(`[TradingHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/trading/events`);
                console.log(`  GET  ${this.config.basePath}/trading/events`);
                console.log(`  GET  ${this.config.basePath}/trading/events/stats`);
                console.log(`  POST ${this.config.basePath}/trading/webhooks/:source`);
                console.log(`  GET  ${this.config.basePath}/trading/dashboard`);
                console.log(`  GET  ${this.config.basePath}/trading/dashboard/enhanced`);
                console.log(`  GET  ${this.config.basePath}/trading/incidents`);
                console.log(`  GET  ${this.config.basePath}/trading/approvals`);
                console.log(`  GET  ${this.config.basePath}/trading/risk-state`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/acknowledge`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/resolve`);
                console.log(`  POST ${this.config.basePath}/trading/runbook-actions`);
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
            // Webhooks
            else if (path === `${this.config.basePath}/trading/webhooks/github` && method === 'POST') {
                await this.handleGitHubWebhook(req, res);
            }
            else if (path === `${this.config.basePath}/trading/webhooks/trading-system` && method === 'POST') {
                await this.handleTradingSystemWebhook(req, res);
            }
            else if (path === `${this.config.basePath}/trading/webhooks/monitoring` && method === 'POST') {
                await this.handleMonitoringWebhook(req, res);
            }
            // Dashboard
            else if (path === `${this.config.basePath}/trading/dashboard` && method === 'GET') {
                await this.handleGetDashboard(res);
            }
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
            // Runbook Actions
            else if (path === `${this.config.basePath}/trading/runbook-actions` && method === 'POST') {
                await this.handleCreateRunbookAction(req, res);
            }
            else if (path.match(/\/trading\/runbook-actions\/[^/]+\/execute/) && method === 'POST') {
                const actionId = path.split('/')[4];
                await this.handleExecuteRunbookAction(actionId, req, res);
            }
            // Risk State Breach
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
    // ============================================================================
    // Event Handlers
    // ============================================================================
    async handleTradingEvent(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const event = {
            type: payload.type,
            timestamp: Date.now(),
            severity: payload.severity || 'medium',
            source: payload.source || { system: 'trading', component: 'unknown', environment: this.config.environment },
            actor: payload.actor || { userId: 'system', username: 'system' },
            metadata: payload.metadata || {},
        };
        // Store event to repository
        await this.eventRepository.store({
            eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...event,
        });
        // Audit log
        await this.auditLogService.log('event_created', event.actor, { type: 'event', id: event.type }, { eventType: event.type, severity: event.severity }, { success: true });
        // Process event through trading ops
        const result = await this.tradingOps.processEvent(event);
        // Store approval if created
        if (result.approval) {
            await this.approvalRepository.create(result.approval);
            await this.auditLogService.log('approval_created', event.actor, { type: 'approval', id: result.approval.approvalId }, { scope: result.approval.scope }, { success: true });
        }
        // Store incident if created
        if (result.incident) {
            await this.incidentRepository.create(result.incident);
            await this.auditLogService.log('incident_created', event.actor, { type: 'incident', id: result.incident.incidentId }, { type: result.incident.type, severity: result.incident.severity }, { success: true });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            approvalCreated: !!result.approval,
            incidentCreated: !!result.incident,
        }));
    }
    async handleGetEvents(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const type = url.searchParams.get('type');
        const severity = url.searchParams.get('severity');
        const source = url.searchParams.get('source');
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const events = await this.eventRepository.getRecent(24, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events, count: events.length }));
    }
    async handleGetEventsStats(res) {
        const stats = await this.eventRepository.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            totalEvents: stats.total,
            byType: Object.fromEntries(stats.byType),
            bySeverity: Object.fromEntries(stats.bySeverity),
            bySource: Object.fromEntries(stats.bySource),
            last24h: stats.last24h,
            processed: stats.processed,
            unprocessed: stats.unprocessed,
        }));
    }
    // ============================================================================
    // Webhook Handlers
    // ============================================================================
    async handleGitHubWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('github', 'github_actions', payload);
        // Audit log
        await this.auditLogService.log('webhook_received', { userId: 'system', username: 'github' }, { type: 'webhook', id: 'github_actions' }, { eventsProcessed: result.eventsProcessed }, { success: result.success });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleTradingSystemWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('trading_system', 'trading_core', payload);
        await this.auditLogService.log('webhook_received', { userId: 'system', username: 'trading_system' }, { type: 'webhook', id: 'trading_core' }, { eventsProcessed: result.eventsProcessed }, { success: result.success });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleMonitoringWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.eventIngest.ingestWebhook('monitoring', 'prometheus', payload);
        await this.auditLogService.log('webhook_received', { userId: 'system', username: 'prometheus' }, { type: 'webhook', id: 'prometheus' }, { eventsProcessed: result.eventsProcessed }, { success: result.success });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    // ============================================================================
    // Dashboard Handlers
    // ============================================================================
    async handleGetDashboard(res) {
        const [approvals, incidents] = await Promise.all([
            this.approvalRepository.query({ limit: 50 }),
            this.incidentRepository.query({ limit: 50 }),
        ]);
        const dashboard = await this.dashboardProjection.buildEnhancedDashboard(approvals.approvals, incidents.incidents, [], approvals.approvals);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dashboard));
    }
    async handleGetEnhancedDashboard(res) {
        const [approvals, incidents] = await Promise.all([
            this.approvalRepository.query({ limit: 50 }),
            this.incidentRepository.query({ limit: 50 }),
        ]);
        const dashboard = await this.dashboardProjection.buildEnhancedDashboard(approvals.approvals, incidents.incidents, [], approvals.approvals);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dashboard));
    }
    async handleGetIncidents(res) {
        const result = await this.incidentRepository.query({ limit: 100 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetApprovals(res) {
        const result = await this.approvalRepository.query({ limit: 100 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetRiskState(res) {
        const riskState = this.riskStateService.getCurrentState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(riskState));
    }
    // ============================================================================
    // Incident Handlers
    // ============================================================================
    async handleAcknowledgeIncident(incidentId, res) {
        const incident = await this.incidentRepository.acknowledge(incidentId, 'system');
        if (!incident) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Incident not found' }));
            return;
        }
        // Audit log
        await this.auditLogService.log('incident_acknowledged', { userId: 'system', username: 'system' }, { type: 'incident', id: incidentId }, { incidentType: incident.type }, { success: true });
        // Create runbook action record
        const action = this.runbookActions.createAction('acknowledge', { type: 'incident', id: incidentId });
        await this.runbookActions.executeAction(action.id, 'system');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, incidentId, acknowledged: true, actionId: action.id }));
    }
    async handleResolveIncident(incidentId, req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const incident = await this.incidentRepository.resolve(incidentId, 'system', payload.resolution);
        if (!incident) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Incident not found' }));
            return;
        }
        // Audit log
        await this.auditLogService.log('incident_resolved', { userId: 'system', username: 'system' }, { type: 'incident', id: incidentId }, { incidentType: incident.type, resolution: payload.resolution }, { success: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, incidentId, resolved: true }));
    }
    // ============================================================================
    // Runbook Action Handlers
    // ============================================================================
    async handleCreateRunbookAction(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const action = this.runbookActions.createAction(payload.type, payload.target, payload.parameters);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action }));
    }
    async handleExecuteRunbookAction(actionId, req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.runbookActions.executeAction(actionId, payload.executedBy || 'system');
        // Audit log for high-risk actions
        if (result.success) {
            const action = this.runbookActions.getActionHistory().find((a) => a.id === actionId);
            if (action) {
                await this.auditLogService.log('runbook_action_executed', { userId: payload.executedBy || 'system', username: payload.executedBy || 'system' }, { type: 'runbook_action', id: actionId }, { actionType: action.type, target: action.target }, { success: true });
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    // ============================================================================
    // Risk State Handlers
    // ============================================================================
    async handleRecordBreach(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const breachId = this.riskStateService.recordBreach(payload.metric || 'unknown', payload.threshold || 'unknown', payload.value || 'unknown', payload.severity || 'medium');
        // Audit log
        await this.auditLogService.log('risk_breach_recorded', { userId: 'system', username: 'system' }, { type: 'risk_breach', id: breachId }, { metric: payload.metric, value: payload.value, threshold: payload.threshold }, { success: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, breachId }));
    }
}
exports.TradingHttpServer = TradingHttpServer;
// ============================================================================
// Factory Function
// ============================================================================
function createTradingHttpServer(config) {
    return new TradingHttpServer(config);
}
// ============================================================================
// Independent Run Entry
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
