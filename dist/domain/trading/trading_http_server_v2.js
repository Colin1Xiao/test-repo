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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhZGluZ19odHRwX3NlcnZlcl92Mi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9kb21haW4vdHJhZGluZy90cmFkaW5nX2h0dHBfc2VydmVyX3YyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaWlCSCwwREFFQztBQWppQkQsMkNBQTZCO0FBQzdCLDZCQUEwQjtBQUMxQiwyQ0FBNkI7QUFDN0IseURBQThEO0FBQzlELHVFQUF3RTtBQUN4RSw2RUFBNkU7QUFDN0UsaUZBQWtGO0FBQ2xGLGlFQUFrRTtBQUNsRSw4RkFBZ0c7QUFDaEcsOEZBQWdHO0FBQ2hHLHdGQUEwRjtBQUMxRiwwRkFBMkY7QUFjM0YsK0VBQStFO0FBQy9FLGNBQWM7QUFDZCwrRUFBK0U7QUFFL0UsTUFBYSxpQkFBaUI7SUFlNUIsWUFBWSxNQUErQjtRQWJuQyxXQUFNLEdBQXVCLElBQUksQ0FBQztRQWN4QyxJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRO1lBQ3hGLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVyxJQUFJLFNBQVM7WUFDNUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxNQUFNLEVBQUUsV0FBVyxFQUFFLGNBQWMsQ0FBQztTQUM5RixDQUFDO1FBRUYsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFBLDJDQUF3QixFQUFDO1lB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LENBQUM7UUFDOUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLE1BQU07S0FDMUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFcEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUIsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDcEIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRyYWRpbmcgSFRUUCBTZXJ2ZXIgVjJcbiAqIFBoYXNlIDJFLTEgLSDpm4bmiJDmjIHkuYXljJblrZjlgqhcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOS9v+eUqCBSZXBvc2l0b3JpZXMg5Luj5pu/5YaF5a2Y5a2Y5YKoXG4gKiAtIOmbhuaIkCBBdWRpdCBMb2cg6K6w5b2VXG4gKiAtIOaPkOS+myBUcmFkaW5nIERhc2hib2FyZCDnq6/ngrlcbiAqL1xuXG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBpbml0aWFsaXplVHJhZGluZ09wc1BhY2sgfSBmcm9tICcuL3RyYWRpbmdfb3BzX3BhY2snO1xuaW1wb3J0IHsgY3JlYXRlVHJhZGluZ1J1bmJvb2tBY3Rpb25zIH0gZnJvbSAnLi90cmFkaW5nX3J1bmJvb2tfYWN0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVUcmFkaW5nUmlza1N0YXRlU2VydmljZSB9IGZyb20gJy4vdHJhZGluZ19yaXNrX3N0YXRlX3NlcnZpY2UnO1xuaW1wb3J0IHsgY3JlYXRlVHJhZGluZ0Rhc2hib2FyZFByb2plY3Rpb24gfSBmcm9tICcuL3RyYWRpbmdfZGFzaGJvYXJkX3Byb2plY3Rpb24nO1xuaW1wb3J0IHsgY3JlYXRlVHJhZGluZ0V2ZW50SW5nZXN0IH0gZnJvbSAnLi90cmFkaW5nX2V2ZW50X2luZ2VzdCc7XG5pbXBvcnQgeyBjcmVhdGVBcHByb3ZhbFJlcG9zaXRvcnkgfSBmcm9tICcuLi8uLi9pbmZyYXN0cnVjdHVyZS9wZXJzaXN0ZW5jZS9hcHByb3ZhbF9yZXBvc2l0b3J5JztcbmltcG9ydCB7IGNyZWF0ZUluY2lkZW50UmVwb3NpdG9yeSB9IGZyb20gJy4uLy4uL2luZnJhc3RydWN0dXJlL3BlcnNpc3RlbmNlL2luY2lkZW50X3JlcG9zaXRvcnknO1xuaW1wb3J0IHsgY3JlYXRlRXZlbnRSZXBvc2l0b3J5IH0gZnJvbSAnLi4vLi4vaW5mcmFzdHJ1Y3R1cmUvcGVyc2lzdGVuY2UvZXZlbnRfcmVwb3NpdG9yeSc7XG5pbXBvcnQgeyBjcmVhdGVBdWRpdExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9pbmZyYXN0cnVjdHVyZS9wZXJzaXN0ZW5jZS9hdWRpdF9sb2dfc2VydmljZSc7XG5pbXBvcnQgdHlwZSB7IFRyYWRpbmdFdmVudCB9IGZyb20gJy4vdHJhZGluZ190eXBlcyc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWRpbmdIdHRwU2VydmVyQ29uZmlnIHtcbiAgcG9ydDogbnVtYmVyO1xuICBiYXNlUGF0aDogc3RyaW5nO1xuICBlbnZpcm9ubWVudD86ICd0ZXN0bmV0JyB8ICdtYWlubmV0JztcbiAgZGF0YURpcj86IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gSFRUUCBTZXJ2ZXJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFRyYWRpbmdIdHRwU2VydmVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFRyYWRpbmdIdHRwU2VydmVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdHJhZGluZ09wczogYW55O1xuICBwcml2YXRlIHJ1bmJvb2tBY3Rpb25zOiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVUcmFkaW5nUnVuYm9va0FjdGlvbnM+O1xuICBwcml2YXRlIHJpc2tTdGF0ZVNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdSaXNrU3RhdGVTZXJ2aWNlPjtcbiAgcHJpdmF0ZSBkYXNoYm9hcmRQcm9qZWN0aW9uOiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVUcmFkaW5nRGFzaGJvYXJkUHJvamVjdGlvbj47XG4gIHByaXZhdGUgZXZlbnRJbmdlc3Q6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVRyYWRpbmdFdmVudEluZ2VzdD47XG4gIFxuICAvLyBQZXJzaXN0ZW5jZSBSZXBvc2l0b3JpZXNcbiAgcHJpdmF0ZSBhcHByb3ZhbFJlcG9zaXRvcnk6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUFwcHJvdmFsUmVwb3NpdG9yeT47XG4gIHByaXZhdGUgaW5jaWRlbnRSZXBvc2l0b3J5OiBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVJbmNpZGVudFJlcG9zaXRvcnk+O1xuICBwcml2YXRlIGV2ZW50UmVwb3NpdG9yeTogUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRXZlbnRSZXBvc2l0b3J5PjtcbiAgcHJpdmF0ZSBhdWRpdExvZ1NlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUF1ZGl0TG9nU2VydmljZT47XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBUcmFkaW5nSHR0cFNlcnZlckNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgcG9ydDogY29uZmlnLnBvcnQsXG4gICAgICBiYXNlUGF0aDogY29uZmlnLmJhc2VQYXRoLmVuZHNXaXRoKCcvJykgPyBjb25maWcuYmFzZVBhdGguc2xpY2UoMCwgLTEpIDogY29uZmlnLmJhc2VQYXRoLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCB8fCAnbWFpbm5ldCcsXG4gICAgICBkYXRhRGlyOiBjb25maWcuZGF0YURpciB8fCBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuSE9NRSB8fCAnL3RtcCcsICcub3BlbmNsYXcnLCAndHJhZGluZy1kYXRhJyksXG4gICAgfTtcblxuICAgIHRoaXMudHJhZGluZ09wcyA9IGluaXRpYWxpemVUcmFkaW5nT3BzUGFjayh7XG4gICAgICBlbnZpcm9ubWVudDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICBhdXRvQ3JlYXRlQXBwcm92YWw6IHRydWUsXG4gICAgICBhdXRvQ3JlYXRlSW5jaWRlbnQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLnJ1bmJvb2tBY3Rpb25zID0gY3JlYXRlVHJhZGluZ1J1bmJvb2tBY3Rpb25zKCk7XG4gICAgdGhpcy5yaXNrU3RhdGVTZXJ2aWNlID0gY3JlYXRlVHJhZGluZ1Jpc2tTdGF0ZVNlcnZpY2UoKTtcbiAgICB0aGlzLmRhc2hib2FyZFByb2plY3Rpb24gPSBjcmVhdGVUcmFkaW5nRGFzaGJvYXJkUHJvamVjdGlvbigpO1xuICAgIHRoaXMuZXZlbnRJbmdlc3QgPSBjcmVhdGVUcmFkaW5nRXZlbnRJbmdlc3QoKTtcbiAgICBcbiAgICAvLyBJbml0aWFsaXplIFBlcnNpc3RlbmNlIFJlcG9zaXRvcmllc1xuICAgIHRoaXMuYXBwcm92YWxSZXBvc2l0b3J5ID0gY3JlYXRlQXBwcm92YWxSZXBvc2l0b3J5KHRoaXMuY29uZmlnLmRhdGFEaXIpO1xuICAgIHRoaXMuaW5jaWRlbnRSZXBvc2l0b3J5ID0gY3JlYXRlSW5jaWRlbnRSZXBvc2l0b3J5KHRoaXMuY29uZmlnLmRhdGFEaXIpO1xuICAgIHRoaXMuZXZlbnRSZXBvc2l0b3J5ID0gY3JlYXRlRXZlbnRSZXBvc2l0b3J5KHRoaXMuY29uZmlnLmRhdGFEaXIpO1xuICAgIHRoaXMuYXVkaXRMb2dTZXJ2aWNlID0gY3JlYXRlQXVkaXRMb2dTZXJ2aWNlKHRoaXMuY29uZmlnLmRhdGFEaXIpO1xuICB9XG5cbiAgYXN5bmMgc3RhcnQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuc2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy5oYW5kbGVSZXF1ZXN0LmJpbmQodGhpcykpO1xuICAgICAgdGhpcy5zZXJ2ZXIubGlzdGVuKHRoaXMuY29uZmlnLnBvcnQsICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coYFtUcmFkaW5nSHR0cFNlcnZlcl0gTGlzdGVuaW5nIG9uIHBvcnQgJHt0aGlzLmNvbmZpZy5wb3J0fWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1RyYWRpbmdIdHRwU2VydmVyXSBEYXRhIERpcmVjdG9yeTogJHt0aGlzLmNvbmZpZy5kYXRhRGlyfWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1RyYWRpbmdIdHRwU2VydmVyXSBFbmRwb2ludHM6YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ldmVudHNgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2V2ZW50c2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZXZlbnRzL3N0YXRzYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy93ZWJob29rcy86c291cmNlYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9kYXNoYm9hcmRgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2Rhc2hib2FyZC9lbmhhbmNlZGApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvaW5jaWRlbnRzYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9hcHByb3ZhbHNgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3Jpc2stc3RhdGVgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2luY2lkZW50cy86aWQvYWNrbm93bGVkZ2VgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2luY2lkZW50cy86aWQvcmVzb2x2ZWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBQT1NUICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcnVuYm9vay1hY3Rpb25zYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ydW5ib29rLWFjdGlvbnMvOmlkL2V4ZWN1dGVgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3Jpc2stc3RhdGUvYnJlYWNoYCk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5zZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2VydmVyKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5zZXJ2ZXIuY2xvc2UoKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW1RyYWRpbmdIdHRwU2VydmVyXSBTZXJ2ZXIgc3RvcHBlZCcpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICBjb25zdCBwYXRoID0gdXJsLnBhdGhuYW1lO1xuICAgIGNvbnN0IG1ldGhvZCA9IHJlcS5tZXRob2QgfHwgJ0dFVCc7XG5cbiAgICBjb25zb2xlLmxvZyhgW1RyYWRpbmdIdHRwU2VydmVyXSAke21ldGhvZH0gJHtwYXRofWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFRyYWRpbmcgRXZlbnRzIC0gRGlyZWN0XG4gICAgICBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvZXZlbnRzYCAmJiBtZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVRyYWRpbmdFdmVudChyZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBUcmFkaW5nIEV2ZW50cyAtIExpc3RcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2V2ZW50c2AgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEV2ZW50cyhyZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBUcmFkaW5nIEV2ZW50cyAtIFN0YXRzXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9ldmVudHMvc3RhdHNgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXRFdmVudHNTdGF0cyhyZXMpO1xuICAgICAgfVxuICAgICAgLy8gV2ViaG9va3NcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3dlYmhvb2tzL2dpdGh1YmAgJiYgbWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHaXRIdWJXZWJob29rKHJlcSwgcmVzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3dlYmhvb2tzL3RyYWRpbmctc3lzdGVtYCAmJiBtZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVRyYWRpbmdTeXN0ZW1XZWJob29rKHJlcSwgcmVzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3dlYmhvb2tzL21vbml0b3JpbmdgICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlTW9uaXRvcmluZ1dlYmhvb2socmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gRGFzaGJvYXJkXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9kYXNoYm9hcmRgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXREYXNoYm9hcmQocmVzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2Rhc2hib2FyZC9lbmhhbmNlZGAgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEVuaGFuY2VkRGFzaGJvYXJkKHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBJbmNpZGVudHNcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL2luY2lkZW50c2AgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEluY2lkZW50cyhyZXMpO1xuICAgICAgfVxuICAgICAgLy8gQXBwcm92YWxzXG4gICAgICBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vdHJhZGluZy9hcHByb3ZhbHNgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXRBcHByb3ZhbHMocmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIFJpc2sgU3RhdGVcbiAgICAgIGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS90cmFkaW5nL3Jpc2stc3RhdGVgICYmIG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVHZXRSaXNrU3RhdGUocmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIEFja25vd2xlZGdlIEluY2lkZW50XG4gICAgICBlbHNlIGlmIChwYXRoLm1hdGNoKC9cXC90cmFkaW5nXFwvaW5jaWRlbnRzXFwvW14vXStcXC9hY2tub3dsZWRnZS8pICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGNvbnN0IGluY2lkZW50SWQgPSBwYXRoLnNwbGl0KCcvJylbNF07XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlQWNrbm93bGVkZ2VJbmNpZGVudChpbmNpZGVudElkLCByZXMpO1xuICAgICAgfVxuICAgICAgLy8gUmVzb2x2ZSBJbmNpZGVudFxuICAgICAgZWxzZSBpZiAocGF0aC5tYXRjaCgvXFwvdHJhZGluZ1xcL2luY2lkZW50c1xcL1teL10rXFwvcmVzb2x2ZS8pICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGNvbnN0IGluY2lkZW50SWQgPSBwYXRoLnNwbGl0KCcvJylbNF07XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUmVzb2x2ZUluY2lkZW50KGluY2lkZW50SWQsIHJlcSwgcmVzKTtcbiAgICAgIH1cbiAgICAgIC8vIFJ1bmJvb2sgQWN0aW9uc1xuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcnVuYm9vay1hY3Rpb25zYCAmJiBtZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUNyZWF0ZVJ1bmJvb2tBY3Rpb24ocmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAocGF0aC5tYXRjaCgvXFwvdHJhZGluZ1xcL3J1bmJvb2stYWN0aW9uc1xcL1teL10rXFwvZXhlY3V0ZS8pICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbklkID0gcGF0aC5zcGxpdCgnLycpWzRdO1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUV4ZWN1dGVSdW5ib29rQWN0aW9uKGFjdGlvbklkLCByZXEsIHJlcyk7XG4gICAgICB9XG4gICAgICAvLyBSaXNrIFN0YXRlIEJyZWFjaFxuICAgICAgZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3RyYWRpbmcvcmlzay1zdGF0ZS9icmVhY2hgICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUmVjb3JkQnJlYWNoKHJlcSwgcmVzKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1RyYWRpbmdIdHRwU2VydmVyXSBFcnJvcjonLCBlcnJvcik7XG4gICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJywgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpIH0pKTtcbiAgICB9XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIEV2ZW50IEhhbmRsZXJzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVRyYWRpbmdFdmVudChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBldmVudDogVHJhZGluZ0V2ZW50ID0ge1xuICAgICAgdHlwZTogcGF5bG9hZC50eXBlLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgc2V2ZXJpdHk6IHBheWxvYWQuc2V2ZXJpdHkgfHwgJ21lZGl1bScsXG4gICAgICBzb3VyY2U6IHBheWxvYWQuc291cmNlIHx8IHsgc3lzdGVtOiAndHJhZGluZycsIGNvbXBvbmVudDogJ3Vua25vd24nLCBlbnZpcm9ubWVudDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgfSxcbiAgICAgIGFjdG9yOiBwYXlsb2FkLmFjdG9yIHx8IHsgdXNlcklkOiAnc3lzdGVtJywgdXNlcm5hbWU6ICdzeXN0ZW0nIH0sXG4gICAgICBtZXRhZGF0YTogcGF5bG9hZC5tZXRhZGF0YSB8fCB7fSxcbiAgICB9O1xuXG4gICAgLy8gU3RvcmUgZXZlbnQgdG8gcmVwb3NpdG9yeVxuICAgIGF3YWl0IHRoaXMuZXZlbnRSZXBvc2l0b3J5LnN0b3JlKHtcbiAgICAgIGV2ZW50SWQ6IGBldmVudF8ke0RhdGUubm93KCl9XyR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfWAsXG4gICAgICAuLi5ldmVudCxcbiAgICB9KTtcblxuICAgIC8vIEF1ZGl0IGxvZ1xuICAgIGF3YWl0IHRoaXMuYXVkaXRMb2dTZXJ2aWNlLmxvZyhcbiAgICAgICdldmVudF9jcmVhdGVkJyxcbiAgICAgIGV2ZW50LmFjdG9yLFxuICAgICAgeyB0eXBlOiAnZXZlbnQnLCBpZDogZXZlbnQudHlwZSB9LFxuICAgICAgeyBldmVudFR5cGU6IGV2ZW50LnR5cGUsIHNldmVyaXR5OiBldmVudC5zZXZlcml0eSB9LFxuICAgICAgeyBzdWNjZXNzOiB0cnVlIH1cbiAgICApO1xuXG4gICAgLy8gUHJvY2VzcyBldmVudCB0aHJvdWdoIHRyYWRpbmcgb3BzXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50cmFkaW5nT3BzLnByb2Nlc3NFdmVudChldmVudCk7XG5cbiAgICAvLyBTdG9yZSBhcHByb3ZhbCBpZiBjcmVhdGVkXG4gICAgaWYgKHJlc3VsdC5hcHByb3ZhbCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHByb3ZhbFJlcG9zaXRvcnkuY3JlYXRlKHJlc3VsdC5hcHByb3ZhbCk7XG4gICAgICBhd2FpdCB0aGlzLmF1ZGl0TG9nU2VydmljZS5sb2coXG4gICAgICAgICdhcHByb3ZhbF9jcmVhdGVkJyxcbiAgICAgICAgZXZlbnQuYWN0b3IsXG4gICAgICAgIHsgdHlwZTogJ2FwcHJvdmFsJywgaWQ6IHJlc3VsdC5hcHByb3ZhbC5hcHByb3ZhbElkIH0sXG4gICAgICAgIHsgc2NvcGU6IHJlc3VsdC5hcHByb3ZhbC5zY29wZSB9LFxuICAgICAgICB7IHN1Y2Nlc3M6IHRydWUgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBTdG9yZSBpbmNpZGVudCBpZiBjcmVhdGVkXG4gICAgaWYgKHJlc3VsdC5pbmNpZGVudCkge1xuICAgICAgYXdhaXQgdGhpcy5pbmNpZGVudFJlcG9zaXRvcnkuY3JlYXRlKHJlc3VsdC5pbmNpZGVudCk7XG4gICAgICBhd2FpdCB0aGlzLmF1ZGl0TG9nU2VydmljZS5sb2coXG4gICAgICAgICdpbmNpZGVudF9jcmVhdGVkJyxcbiAgICAgICAgZXZlbnQuYWN0b3IsXG4gICAgICAgIHsgdHlwZTogJ2luY2lkZW50JywgaWQ6IHJlc3VsdC5pbmNpZGVudC5pbmNpZGVudElkIH0sXG4gICAgICAgIHsgdHlwZTogcmVzdWx0LmluY2lkZW50LnR5cGUsIHNldmVyaXR5OiByZXN1bHQuaW5jaWRlbnQuc2V2ZXJpdHkgfSxcbiAgICAgICAgeyBzdWNjZXNzOiB0cnVlIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBhcHByb3ZhbENyZWF0ZWQ6ICEhcmVzdWx0LmFwcHJvdmFsLFxuICAgICAgaW5jaWRlbnRDcmVhdGVkOiAhIXJlc3VsdC5pbmNpZGVudCxcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEV2ZW50cyhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICBjb25zdCB0eXBlID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3R5cGUnKTtcbiAgICBjb25zdCBzZXZlcml0eSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdzZXZlcml0eScpO1xuICAgIGNvbnN0IHNvdXJjZSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdzb3VyY2UnKTtcbiAgICBjb25zdCBsaW1pdCA9IHBhcnNlSW50KHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdsaW1pdCcpIHx8ICcxMDAnLCAxMCk7XG5cbiAgICBjb25zdCBldmVudHMgPSBhd2FpdCB0aGlzLmV2ZW50UmVwb3NpdG9yeS5nZXRSZWNlbnQoMjQsIGxpbWl0KTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGV2ZW50cywgY291bnQ6IGV2ZW50cy5sZW5ndGggfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXRFdmVudHNTdGF0cyhyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IHRoaXMuZXZlbnRSZXBvc2l0b3J5LmdldFN0YXRzKCk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgdG90YWxFdmVudHM6IHN0YXRzLnRvdGFsLFxuICAgICAgYnlUeXBlOiBPYmplY3QuZnJvbUVudHJpZXMoc3RhdHMuYnlUeXBlKSxcbiAgICAgIGJ5U2V2ZXJpdHk6IE9iamVjdC5mcm9tRW50cmllcyhzdGF0cy5ieVNldmVyaXR5KSxcbiAgICAgIGJ5U291cmNlOiBPYmplY3QuZnJvbUVudHJpZXMoc3RhdHMuYnlTb3VyY2UpLFxuICAgICAgbGFzdDI0aDogc3RhdHMubGFzdDI0aCxcbiAgICAgIHByb2Nlc3NlZDogc3RhdHMucHJvY2Vzc2VkLFxuICAgICAgdW5wcm9jZXNzZWQ6IHN0YXRzLnVucHJvY2Vzc2VkLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gV2ViaG9vayBIYW5kbGVyc1xuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHaXRIdWJXZWJob29rKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXZlbnRJbmdlc3QuaW5nZXN0V2ViaG9vaygnZ2l0aHViJywgJ2dpdGh1Yl9hY3Rpb25zJywgcGF5bG9hZCk7XG5cbiAgICAvLyBBdWRpdCBsb2dcbiAgICBhd2FpdCB0aGlzLmF1ZGl0TG9nU2VydmljZS5sb2coXG4gICAgICAnd2ViaG9va19yZWNlaXZlZCcsXG4gICAgICB7IHVzZXJJZDogJ3N5c3RlbScsIHVzZXJuYW1lOiAnZ2l0aHViJyB9LFxuICAgICAgeyB0eXBlOiAnd2ViaG9vaycsIGlkOiAnZ2l0aHViX2FjdGlvbnMnIH0sXG4gICAgICB7IGV2ZW50c1Byb2Nlc3NlZDogcmVzdWx0LmV2ZW50c1Byb2Nlc3NlZCB9LFxuICAgICAgeyBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyB9XG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlVHJhZGluZ1N5c3RlbVdlYmhvb2socmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgYm9keTogYW55W10gPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keS5wdXNoKGNodW5rKTtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5ldmVudEluZ2VzdC5pbmdlc3RXZWJob29rKCd0cmFkaW5nX3N5c3RlbScsICd0cmFkaW5nX2NvcmUnLCBwYXlsb2FkKTtcblxuICAgIGF3YWl0IHRoaXMuYXVkaXRMb2dTZXJ2aWNlLmxvZyhcbiAgICAgICd3ZWJob29rX3JlY2VpdmVkJyxcbiAgICAgIHsgdXNlcklkOiAnc3lzdGVtJywgdXNlcm5hbWU6ICd0cmFkaW5nX3N5c3RlbScgfSxcbiAgICAgIHsgdHlwZTogJ3dlYmhvb2snLCBpZDogJ3RyYWRpbmdfY29yZScgfSxcbiAgICAgIHsgZXZlbnRzUHJvY2Vzc2VkOiByZXN1bHQuZXZlbnRzUHJvY2Vzc2VkIH0sXG4gICAgICB7IHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzIH1cbiAgICApO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNb25pdG9yaW5nV2ViaG9vayhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV2ZW50SW5nZXN0LmluZ2VzdFdlYmhvb2soJ21vbml0b3JpbmcnLCAncHJvbWV0aGV1cycsIHBheWxvYWQpO1xuXG4gICAgYXdhaXQgdGhpcy5hdWRpdExvZ1NlcnZpY2UubG9nKFxuICAgICAgJ3dlYmhvb2tfcmVjZWl2ZWQnLFxuICAgICAgeyB1c2VySWQ6ICdzeXN0ZW0nLCB1c2VybmFtZTogJ3Byb21ldGhldXMnIH0sXG4gICAgICB7IHR5cGU6ICd3ZWJob29rJywgaWQ6ICdwcm9tZXRoZXVzJyB9LFxuICAgICAgeyBldmVudHNQcm9jZXNzZWQ6IHJlc3VsdC5ldmVudHNQcm9jZXNzZWQgfSxcbiAgICAgIHsgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MgfVxuICAgICk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIERhc2hib2FyZCBIYW5kbGVyc1xuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXREYXNoYm9hcmQocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgW2FwcHJvdmFscywgaW5jaWRlbnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuYXBwcm92YWxSZXBvc2l0b3J5LnF1ZXJ5KHsgbGltaXQ6IDUwIH0pLFxuICAgICAgdGhpcy5pbmNpZGVudFJlcG9zaXRvcnkucXVlcnkoeyBsaW1pdDogNTAgfSksXG4gICAgXSk7XG5cbiAgICBjb25zdCBkYXNoYm9hcmQgPSBhd2FpdCB0aGlzLmRhc2hib2FyZFByb2plY3Rpb24uYnVpbGRFbmhhbmNlZERhc2hib2FyZChcbiAgICAgIGFwcHJvdmFscy5hcHByb3ZhbHMsXG4gICAgICBpbmNpZGVudHMuaW5jaWRlbnRzLFxuICAgICAgW10sXG4gICAgICBhcHByb3ZhbHMuYXBwcm92YWxzXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShkYXNoYm9hcmQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0RW5oYW5jZWREYXNoYm9hcmQocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgW2FwcHJvdmFscywgaW5jaWRlbnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuYXBwcm92YWxSZXBvc2l0b3J5LnF1ZXJ5KHsgbGltaXQ6IDUwIH0pLFxuICAgICAgdGhpcy5pbmNpZGVudFJlcG9zaXRvcnkucXVlcnkoeyBsaW1pdDogNTAgfSksXG4gICAgXSk7XG5cbiAgICBjb25zdCBkYXNoYm9hcmQgPSBhd2FpdCB0aGlzLmRhc2hib2FyZFByb2plY3Rpb24uYnVpbGRFbmhhbmNlZERhc2hib2FyZChcbiAgICAgIGFwcHJvdmFscy5hcHByb3ZhbHMsXG4gICAgICBpbmNpZGVudHMuaW5jaWRlbnRzLFxuICAgICAgW10sXG4gICAgICBhcHByb3ZhbHMuYXBwcm92YWxzXG4gICAgKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShkYXNoYm9hcmQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5jaWRlbnRzKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuaW5jaWRlbnRSZXBvc2l0b3J5LnF1ZXJ5KHsgbGltaXQ6IDEwMCB9KTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0QXBwcm92YWxzKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuYXBwcm92YWxSZXBvc2l0b3J5LnF1ZXJ5KHsgbGltaXQ6IDEwMCB9KTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0Umlza1N0YXRlKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHJpc2tTdGF0ZSA9IHRoaXMucmlza1N0YXRlU2VydmljZS5nZXRDdXJyZW50U3RhdGUoKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyaXNrU3RhdGUpKTtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gSW5jaWRlbnQgSGFuZGxlcnNcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlQWNrbm93bGVkZ2VJbmNpZGVudChpbmNpZGVudElkOiBzdHJpbmcsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGluY2lkZW50ID0gYXdhaXQgdGhpcy5pbmNpZGVudFJlcG9zaXRvcnkuYWNrbm93bGVkZ2UoaW5jaWRlbnRJZCwgJ3N5c3RlbScpO1xuXG4gICAgaWYgKCFpbmNpZGVudCkge1xuICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0luY2lkZW50IG5vdCBmb3VuZCcgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEF1ZGl0IGxvZ1xuICAgIGF3YWl0IHRoaXMuYXVkaXRMb2dTZXJ2aWNlLmxvZyhcbiAgICAgICdpbmNpZGVudF9hY2tub3dsZWRnZWQnLFxuICAgICAgeyB1c2VySWQ6ICdzeXN0ZW0nLCB1c2VybmFtZTogJ3N5c3RlbScgfSxcbiAgICAgIHsgdHlwZTogJ2luY2lkZW50JywgaWQ6IGluY2lkZW50SWQgfSxcbiAgICAgIHsgaW5jaWRlbnRUeXBlOiBpbmNpZGVudC50eXBlIH0sXG4gICAgICB7IHN1Y2Nlc3M6IHRydWUgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgcnVuYm9vayBhY3Rpb24gcmVjb3JkXG4gICAgY29uc3QgYWN0aW9uID0gdGhpcy5ydW5ib29rQWN0aW9ucy5jcmVhdGVBY3Rpb24oJ2Fja25vd2xlZGdlJywgeyB0eXBlOiAnaW5jaWRlbnQnLCBpZDogaW5jaWRlbnRJZCB9KTtcbiAgICBhd2FpdCB0aGlzLnJ1bmJvb2tBY3Rpb25zLmV4ZWN1dGVBY3Rpb24oYWN0aW9uLmlkLCAnc3lzdGVtJyk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBpbmNpZGVudElkLCBhY2tub3dsZWRnZWQ6IHRydWUsIGFjdGlvbklkOiBhY3Rpb24uaWQgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXNvbHZlSW5jaWRlbnQoaW5jaWRlbnRJZDogc3RyaW5nLCByZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBpbmNpZGVudCA9IGF3YWl0IHRoaXMuaW5jaWRlbnRSZXBvc2l0b3J5LnJlc29sdmUoaW5jaWRlbnRJZCwgJ3N5c3RlbScsIHBheWxvYWQucmVzb2x1dGlvbik7XG5cbiAgICBpZiAoIWluY2lkZW50KSB7XG4gICAgICByZXMud3JpdGVIZWFkKDQwNCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW5jaWRlbnQgbm90IGZvdW5kJyB9KSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQXVkaXQgbG9nXG4gICAgYXdhaXQgdGhpcy5hdWRpdExvZ1NlcnZpY2UubG9nKFxuICAgICAgJ2luY2lkZW50X3Jlc29sdmVkJyxcbiAgICAgIHsgdXNlcklkOiAnc3lzdGVtJywgdXNlcm5hbWU6ICdzeXN0ZW0nIH0sXG4gICAgICB7IHR5cGU6ICdpbmNpZGVudCcsIGlkOiBpbmNpZGVudElkIH0sXG4gICAgICB7IGluY2lkZW50VHlwZTogaW5jaWRlbnQudHlwZSwgcmVzb2x1dGlvbjogcGF5bG9hZC5yZXNvbHV0aW9uIH0sXG4gICAgICB7IHN1Y2Nlc3M6IHRydWUgfVxuICAgICk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBpbmNpZGVudElkLCByZXNvbHZlZDogdHJ1ZSB9KSk7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIFJ1bmJvb2sgQWN0aW9uIEhhbmRsZXJzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUNyZWF0ZVJ1bmJvb2tBY3Rpb24ocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgYm9keTogYW55W10gPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keS5wdXNoKGNodW5rKTtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3QgYWN0aW9uID0gdGhpcy5ydW5ib29rQWN0aW9ucy5jcmVhdGVBY3Rpb24oXG4gICAgICBwYXlsb2FkLnR5cGUsXG4gICAgICBwYXlsb2FkLnRhcmdldCxcbiAgICAgIHBheWxvYWQucGFyYW1ldGVyc1xuICAgICk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBhY3Rpb24gfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVFeGVjdXRlUnVuYm9va0FjdGlvbihhY3Rpb25JZDogc3RyaW5nLCByZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJ1bmJvb2tBY3Rpb25zLmV4ZWN1dGVBY3Rpb24oYWN0aW9uSWQsIHBheWxvYWQuZXhlY3V0ZWRCeSB8fCAnc3lzdGVtJyk7XG5cbiAgICAvLyBBdWRpdCBsb2cgZm9yIGhpZ2gtcmlzayBhY3Rpb25zXG4gICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICBjb25zdCBhY3Rpb24gPSB0aGlzLnJ1bmJvb2tBY3Rpb25zLmdldEFjdGlvbkhpc3RvcnkoKS5maW5kKChhKSA9PiBhLmlkID09PSBhY3Rpb25JZCk7XG4gICAgICBpZiAoYWN0aW9uKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuYXVkaXRMb2dTZXJ2aWNlLmxvZyhcbiAgICAgICAgICAncnVuYm9va19hY3Rpb25fZXhlY3V0ZWQnLFxuICAgICAgICAgIHsgdXNlcklkOiBwYXlsb2FkLmV4ZWN1dGVkQnkgfHwgJ3N5c3RlbScsIHVzZXJuYW1lOiBwYXlsb2FkLmV4ZWN1dGVkQnkgfHwgJ3N5c3RlbScgfSxcbiAgICAgICAgICB7IHR5cGU6ICdydW5ib29rX2FjdGlvbicsIGlkOiBhY3Rpb25JZCB9LFxuICAgICAgICAgIHsgYWN0aW9uVHlwZTogYWN0aW9uLnR5cGUsIHRhcmdldDogYWN0aW9uLnRhcmdldCB9LFxuICAgICAgICAgIHsgc3VjY2VzczogdHJ1ZSB9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG5cbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBSaXNrIFN0YXRlIEhhbmRsZXJzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlY29yZEJyZWFjaChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBicmVhY2hJZCA9IHRoaXMucmlza1N0YXRlU2VydmljZS5yZWNvcmRCcmVhY2goXG4gICAgICBwYXlsb2FkLm1ldHJpYyB8fCAndW5rbm93bicsXG4gICAgICBwYXlsb2FkLnRocmVzaG9sZCB8fCAndW5rbm93bicsXG4gICAgICBwYXlsb2FkLnZhbHVlIHx8ICd1bmtub3duJyxcbiAgICAgIHBheWxvYWQuc2V2ZXJpdHkgfHwgJ21lZGl1bSdcbiAgICApO1xuXG4gICAgLy8gQXVkaXQgbG9nXG4gICAgYXdhaXQgdGhpcy5hdWRpdExvZ1NlcnZpY2UubG9nKFxuICAgICAgJ3Jpc2tfYnJlYWNoX3JlY29yZGVkJyxcbiAgICAgIHsgdXNlcklkOiAnc3lzdGVtJywgdXNlcm5hbWU6ICdzeXN0ZW0nIH0sXG4gICAgICB7IHR5cGU6ICdyaXNrX2JyZWFjaCcsIGlkOiBicmVhY2hJZCB9LFxuICAgICAgeyBtZXRyaWM6IHBheWxvYWQubWV0cmljLCB2YWx1ZTogcGF5bG9hZC52YWx1ZSwgdGhyZXNob2xkOiBwYXlsb2FkLnRocmVzaG9sZCB9LFxuICAgICAgeyBzdWNjZXNzOiB0cnVlIH1cbiAgICApO1xuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgYnJlYWNoSWQgfSkpO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZhY3RvcnkgRnVuY3Rpb25cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRyYWRpbmdIdHRwU2VydmVyKGNvbmZpZzogVHJhZGluZ0h0dHBTZXJ2ZXJDb25maWcpOiBUcmFkaW5nSHR0cFNlcnZlciB7XG4gIHJldHVybiBuZXcgVHJhZGluZ0h0dHBTZXJ2ZXIoY29uZmlnKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gSW5kZXBlbmRlbnQgUnVuIEVudHJ5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBjb25zdCBzZXJ2ZXIgPSBjcmVhdGVUcmFkaW5nSHR0cFNlcnZlcih7XG4gICAgcG9ydDogcGFyc2VJbnQocHJvY2Vzcy5lbnYuUE9SVCB8fCAnMzAwNCcsIDEwKSxcbiAgICBiYXNlUGF0aDogcHJvY2Vzcy5lbnYuQkFTRV9QQVRIIHx8ICcvYXBpJyxcbiAgfSk7XG5cbiAgc2VydmVyLnN0YXJ0KCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG5cbiAgcHJvY2Vzcy5vbignU0lHSU5UJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHNlcnZlci5zdG9wKCk7XG4gICAgcHJvY2Vzcy5leGl0KDApO1xuICB9KTtcbn1cbiJdfQ==