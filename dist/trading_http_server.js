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
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`[TradingHttpServer] Listening on port ${this.config.port}`);
                console.log(`[TradingHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/trading/events`);
                console.log(`  GET  ${this.config.basePath}/trading/dashboard`);
                console.log(`  GET  ${this.config.basePath}/trading/incidents`);
                console.log(`  GET  ${this.config.basePath}/trading/approvals`);
                console.log(`  GET  ${this.config.basePath}/trading/risk-state`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/acknowledge`);
                console.log(`  POST ${this.config.basePath}/trading/incidents/:id/resolve`);
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
            // Trading Events
            if (path === `${this.config.basePath}/trading/events` && method === 'POST') {
                await this.handleTradingEvent(req, res);
            }
            // Dashboard
            else if (path === `${this.config.basePath}/trading/dashboard` && method === 'GET') {
                await this.handleGetDashboard(res);
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
        const riskState = await this.tradingOps.operatorViews.buildRiskState([]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(riskState));
    }
    async handleAcknowledgeIncident(incidentId, res) {
        this.dataStore.acknowledgeIncident(incidentId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, incidentId, acknowledged: true }));
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
