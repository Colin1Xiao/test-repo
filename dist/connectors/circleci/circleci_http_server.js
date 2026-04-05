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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2lyY2xlY2lfaHR0cF9zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9jaXJjbGVjaS9jaXJjbGVjaV9odHRwX3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQ0FBNkI7QUFDN0IsNkJBQTBCO0FBQzFCLGlFQUlnQztBQVFoQyxNQUFhLGtCQUFrQjtJQUs3QixZQUFZLE1BQWdDO1FBSHBDLFdBQU0sR0FBdUIsSUFBSSxDQUFDO1FBSXhDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVE7WUFDeEYsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLElBQUksWUFBWTtTQUN4RSxDQUFDO1FBRUYsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFBLG9EQUE2QixFQUFDO1lBQy9DLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVE7WUFDOUIsY0FBYyxFQUFFLElBQUk7U0FDckIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1QsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZ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QUUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaXJjbGVDSSBIVFRQIFNlcnZlclxuICogUGhhc2UgMkItM0IgLSBDaXJjbGVDSSBDb25uZWN0b3IgSFRUUCDmmrTpnLLlsYJcbiAqL1xuXG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCB7XG4gIGluaXRpYWxpemVDaXJjbGVDSUludGVncmF0aW9uLFxuICBjcmVhdGVDaXJjbGVDSVdlYmhvb2tIYW5kbGVyLFxuICBjcmVhdGVDaXJjbGVDSUFjdGlvbkhhbmRsZXIsXG59IGZyb20gJy4vY2lyY2xlY2lfaW50ZWdyYXRpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIENpcmNsZUNJSHR0cFNlcnZlckNvbmZpZyB7XG4gIHBvcnQ6IG51bWJlcjtcbiAgYmFzZVBhdGg6IHN0cmluZztcbiAgYXBpVG9rZW4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDaXJjbGVDSUh0dHBTZXJ2ZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q2lyY2xlQ0lIdHRwU2VydmVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgaW50ZWdyYXRpb246IGFueTtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IENpcmNsZUNJSHR0cFNlcnZlckNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgcG9ydDogY29uZmlnLnBvcnQsXG4gICAgICBiYXNlUGF0aDogY29uZmlnLmJhc2VQYXRoLmVuZHNXaXRoKCcvJykgPyBjb25maWcuYmFzZVBhdGguc2xpY2UoMCwgLTEpIDogY29uZmlnLmJhc2VQYXRoLFxuICAgICAgYXBpVG9rZW46IGNvbmZpZy5hcGlUb2tlbiB8fCBwcm9jZXNzLmVudi5DSVJDTEVDSV9UT0tFTiB8fCAnbW9jay10b2tlbicsXG4gICAgfTtcblxuICAgIHRoaXMuaW50ZWdyYXRpb24gPSBpbml0aWFsaXplQ2lyY2xlQ0lJbnRlZ3JhdGlvbih7XG4gICAgICBhcGlUb2tlbjogdGhpcy5jb25maWcuYXBpVG9rZW4sXG4gICAgICB2ZXJib3NlTG9nZ2luZzogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlUmVxdWVzdC5iaW5kKHRoaXMpKTtcbiAgICAgIHRoaXMuc2VydmVyLmxpc3Rlbih0aGlzLmNvbmZpZy5wb3J0LCAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ2lyY2xlQ0lIdHRwU2VydmVyXSBMaXN0ZW5pbmcgb24gcG9ydCAke3RoaXMuY29uZmlnLnBvcnR9YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ2lyY2xlQ0lIdHRwU2VydmVyXSBFbmRwb2ludHM6YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vd2ViaG9va3MvY2lyY2xlY2lgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9hcHByb3ZhbHNgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgR0VUICAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9pbmNpZGVudHNgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9hY3Rpb25zYCk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5zZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICBjb25zdCBwYXRoID0gdXJsLnBhdGhuYW1lO1xuXG4gICAgY29uc29sZS5sb2coYFtDaXJjbGVDSUh0dHBTZXJ2ZXJdICR7cmVxLm1ldGhvZH0gJHtwYXRofWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vd2ViaG9va3MvY2lyY2xlY2lgICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVdlYmhvb2socmVxLCByZXMpO1xuICAgICAgfSBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvYXBwcm92YWxzYCAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEFwcHJvdmFscyhyZXMpO1xuICAgICAgfSBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvaW5jaWRlbnRzYCAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEluY2lkZW50cyhyZXMpO1xuICAgICAgfSBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvYWN0aW9uc2AgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlQWN0aW9uKHJlcSwgcmVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ05vdCBmb3VuZCcgfSkpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ2lyY2xlQ0lIdHRwU2VydmVyXSBFcnJvcjonLCBlcnJvcik7XG4gICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyB9KSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVXZWJob29rKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkucHVzaChjaHVuayk7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChib2R5KS50b1N0cmluZygpKTtcblxuICAgIGNvbnN0IHdlYmhvb2tIYW5kbGVyID0gY3JlYXRlQ2lyY2xlQ0lXZWJob29rSGFuZGxlcih0aGlzLmludGVncmF0aW9uKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3ZWJob29rSGFuZGxlcihwYXlsb2FkKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0QXBwcm92YWxzKHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGFwcHJvdmFsczogW10sIHN1bW1hcnk6IHsgdG90YWw6IDAsIHBlbmRpbmc6IDAgfSB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEluY2lkZW50cyhyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBpbmNpZGVudHM6IFtdLCBzdW1tYXJ5OiB7IHRvdGFsOiAwLCBhY3RpdmU6IDAgfSB9KSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGhhbmRsZUFjdGlvbihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5LnB1c2goY2h1bmspO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBhY3Rpb25IYW5kbGVyID0gY3JlYXRlQ2lyY2xlQ0lBY3Rpb25IYW5kbGVyKHRoaXMuaW50ZWdyYXRpb24pO1xuICAgIGxldCByZXN1bHQ7XG5cbiAgICBpZiAocGF5bG9hZC5hY3Rpb25UeXBlID09PSAnYXBwcm92ZScpIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGFjdGlvbkhhbmRsZXIuaGFuZGxlQXBwcm92ZShwYXlsb2FkLnRhcmdldElkLCBwYXlsb2FkLmFjdG9ySWQpO1xuICAgIH0gZWxzZSBpZiAocGF5bG9hZC5hY3Rpb25UeXBlID09PSAncmVqZWN0Jykge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgYWN0aW9uSGFuZGxlci5oYW5kbGVSZWplY3QocGF5bG9hZC50YXJnZXRJZCwgcGF5bG9hZC5hY3RvcklkLCBwYXlsb2FkLnJlYXNvbik7XG4gICAgfSBlbHNlIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdyZXJ1bicpIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGFjdGlvbkhhbmRsZXIuaGFuZGxlUmVydW4ocGF5bG9hZC50YXJnZXRJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcy53cml0ZUhlYWQoNDAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdVbmtub3duIGFjdGlvbiB0eXBlJyB9KSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBjb25zdCBzZXJ2ZXIgPSBuZXcgQ2lyY2xlQ0lIdHRwU2VydmVyKHtcbiAgICBwb3J0OiBwYXJzZUludChwcm9jZXNzLmVudi5QT1JUIHx8ICczMDAyJywgMTApLFxuICAgIGJhc2VQYXRoOiBwcm9jZXNzLmVudi5CQVNFX1BBVEggfHwgJy9hcGknLFxuICB9KTtcbiAgc2VydmVyLnN0YXJ0KCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gIHByb2Nlc3Mub24oJ1NJR0lOVCcsIGFzeW5jICgpID0+IHsgYXdhaXQgc2VydmVyLnN0b3AoKTsgcHJvY2Vzcy5leGl0KDApOyB9KTtcbn1cbiJdfQ==