"use strict";
/**
 * CircleCI HTTP Server
 * Phase 2B-3B - CircleCI Connector HTTP 暴露层
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
exports.CircleCIHttpServer = void 0;
const http = __importStar(require("http"));
const url_1 = require("url");
const circleci_integration_1 = require("./circleci_integration");
class CircleCIHttpServer {
    constructor(config) {
        this.server = null;
        this.config = {
            port: config.port,
            basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
            apiToken: config.apiToken || process.env.CIRCLECI_TOKEN || 'mock-token',
        };
        this.integration = (0, circleci_integration_1.initializeCircleCIIntegration)({
            apiToken: this.config.apiToken,
            verboseLogging: true,
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`[CircleCIHttpServer] Listening on port ${this.config.port}`);
                console.log(`[CircleCIHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/webhooks/circleci`);
                console.log(`  GET  ${this.config.basePath}/operator/approvals`);
                console.log(`  GET  ${this.config.basePath}/operator/incidents`);
                console.log(`  POST ${this.config.basePath}/operator/actions`);
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    async handleRequest(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        console.log(`[CircleCIHttpServer] ${req.method} ${path}`);
        try {
            if (path === `${this.config.basePath}/webhooks/circleci` && req.method === 'POST') {
                await this.handleWebhook(req, res);
            }
            else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
                await this.handleGetApprovals(res);
            }
            else if (path === `${this.config.basePath}/operator/incidents` && req.method === 'GET') {
                await this.handleGetIncidents(res);
            }
            else if (path === `${this.config.basePath}/operator/actions` && req.method === 'POST') {
                await this.handleAction(req, res);
            }
            else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        }
        catch (error) {
            console.error('[CircleCIHttpServer] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
    async handleWebhook(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const webhookHandler = (0, circleci_integration_1.createCircleCIWebhookHandler)(this.integration);
        const result = await webhookHandler(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetApprovals(res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ approvals: [], summary: { total: 0, pending: 0 } }));
    }
    async handleGetIncidents(res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ incidents: [], summary: { total: 0, active: 0 } }));
    }
    async handleAction(req, res) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const actionHandler = (0, circleci_integration_1.createCircleCIActionHandler)(this.integration);
        let result;
        if (payload.actionType === 'approve') {
            result = await actionHandler.handleApprove(payload.targetId, payload.actorId);
        }
        else if (payload.actionType === 'reject') {
            result = await actionHandler.handleReject(payload.targetId, payload.actorId, payload.reason);
        }
        else if (payload.actionType === 'rerun') {
            result = await actionHandler.handleRerun(payload.targetId);
        }
        else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unknown action type' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
}
exports.CircleCIHttpServer = CircleCIHttpServer;
if (require.main === module) {
    const server = new CircleCIHttpServer({
        port: parseInt(process.env.PORT || '3002', 10),
        basePath: process.env.BASE_PATH || '/api',
    });
    server.start().catch(console.error);
    process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
}
