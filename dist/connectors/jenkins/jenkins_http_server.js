"use strict";
/**
 * Jenkins HTTP Server
 * Phase 2B-3A - Jenkins Connector HTTP 暴露层
 *
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
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
exports.JenkinsHttpServer = void 0;
exports.createJenkinsHttpServer = createJenkinsHttpServer;
const http = __importStar(require("http"));
const url_1 = require("url");
const jenkins_integration_1 = require("./jenkins_integration");
// ============================================================================
// HTTP Server
// ============================================================================
class JenkinsHttpServer {
    constructor(config) {
        this.server = null;
        this.config = {
            port: config.port,
            basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
            jenkinsBaseUrl: config.jenkinsBaseUrl || process.env.JENKINS_BASE_URL || 'http://localhost:8080',
            jenkinsUsername: config.jenkinsUsername || process.env.JENKINS_USERNAME || '',
            jenkinsToken: config.jenkinsToken || process.env.JENKINS_TOKEN || '',
        };
        // 初始化集成
        this.integration = (0, jenkins_integration_1.initializeJenkinsIntegration)({
            jenkinsBaseUrl: this.config.jenkinsBaseUrl,
            jenkinsUsername: this.config.jenkinsUsername,
            jenkinsToken: this.config.jenkinsToken,
            verboseLogging: true,
        });
    }
    /**
     * 启动服务器
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`[JenkinsHttpServer] Listening on port ${this.config.port}`);
                console.log(`[JenkinsHttpServer] Base path: ${this.config.basePath}`);
                console.log(`[JenkinsHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/webhooks/jenkins`);
                console.log(`  GET  ${this.config.basePath}/operator/approvals`);
                console.log(`  GET  ${this.config.basePath}/operator/incidents`);
                console.log(`  POST ${this.config.basePath}/operator/actions`);
                resolve();
            });
            this.server.on('error', (err) => {
                console.error('[JenkinsHttpServer] Server error:', err);
                reject(err);
            });
        });
    }
    /**
     * 停止服务器
     */
    stop() {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close(() => {
                console.log('[JenkinsHttpServer] Server stopped');
                resolve();
            });
        });
    }
    /**
     * 处理 HTTP 请求
     */
    async handleRequest(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        console.log(`[JenkinsHttpServer] ${req.method} ${path}`);
        try {
            if (path === `${this.config.basePath}/webhooks/jenkins` && req.method === 'POST') {
                await this.handleWebhook(req, res);
            }
            else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
                await this.handleGetApprovals(req, res);
            }
            else if (path === `${this.config.basePath}/operator/incidents` && req.method === 'GET') {
                await this.handleGetIncidents(req, res);
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
            console.error('[JenkinsHttpServer] Error handling request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * 处理 Jenkins Webhook
     */
    async handleWebhook(req, res) {
        const body = [];
        for await (const chunk of req) {
            body.push(chunk);
        }
        const payload = JSON.parse(Buffer.concat(body).toString());
        const webhookHandler = (0, jenkins_integration_1.createJenkinsWebhookHandler)(this.integration);
        const result = await webhookHandler(payload);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    /**
     * 处理获取审批列表
     */
    async handleGetApprovals(req, res) {
        // 简化实现：返回空列表
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            approvals: [],
            summary: { total: 0, pending: 0, timeout: 0 },
        }));
    }
    /**
     * 处理获取事件列表
     */
    async handleGetIncidents(req, res) {
        // 简化实现：返回空列表
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            incidents: [],
            summary: { total: 0, active: 0, critical: 0 },
        }));
    }
    /**
     * 处理动作执行
     */
    async handleAction(req, res) {
        const body = [];
        for await (const chunk of req) {
            body.push(chunk);
        }
        const payload = JSON.parse(Buffer.concat(body).toString());
        const { actionType, targetType, targetId } = payload;
        if (!actionType || !targetType || !targetId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields' }));
            return;
        }
        const actionHandler = (0, jenkins_integration_1.createJenkinsActionHandler)(this.integration);
        let result;
        if (actionType === 'approve') {
            result = await actionHandler.handleApprove(targetId, payload.actorId);
        }
        else if (actionType === 'reject') {
            result = await actionHandler.handleReject(targetId, payload.actorId, payload.reason);
        }
        else if (actionType === 'rerun') {
            result = await actionHandler.handleRerun(targetId);
        }
        else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown action type: ${actionType}` }));
            return;
        }
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
}
exports.JenkinsHttpServer = JenkinsHttpServer;
// ============================================================================
// 工厂函数
// ============================================================================
function createJenkinsHttpServer(config) {
    return new JenkinsHttpServer(config);
}
// ============================================================================
// 独立运行入口
// ============================================================================
if (require.main === module) {
    const server = createJenkinsHttpServer({
        port: parseInt(process.env.PORT || '3001', 10),
        basePath: process.env.BASE_PATH || '/api',
    });
    server.start().catch(console.error);
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVua2luc19odHRwX3NlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25uZWN0b3JzL2plbmtpbnMvamVua2luc19odHRwX3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK01ILDBEQUVDO0FBL01ELDJDQUE2QjtBQUM3Qiw2QkFBMEI7QUFDMUIsK0RBSytCO0FBYy9CLCtFQUErRTtBQUMvRSxjQUFjO0FBQ2QsK0VBQStFO0FBRS9FLE1BQWEsaUJBQWlCO0lBSzVCLFlBQVksTUFBK0I7UUFIbkMsV0FBTSxHQUF1QixJQUFJLENBQUM7UUFJeEMsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtZQUNqQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUTtZQUN4RixjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLHVCQUF1QjtZQUNoRyxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLEVBQUU7WUFDN0UsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksRUFBRTtTQUNyRSxDQUFDO1FBRUYsUUFBUTtRQUNSLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBQSxrREFBNEIsRUFBQztZQUM5QyxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjO1lBQzFDLGVBQWUs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QVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDbEYsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBOUtELDhDQThLQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLHVCQUF1QixDQUFDLE1BQStCO0lBQ3JFLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRSxDQUFDO0lBQzVCLE1BQU0sTUFBTSxHQUFHLHVCQUF1QixDQUFDO1FBQ3JDLElBQUksRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksTUFBTSxFQUFFLEVBQUUsQ0FBQztRQUM5QyxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLElBQUksTUFBTTtLQUMxQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVwQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM5QixNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSmVua2lucyBIVFRQIFNlcnZlclxuICogUGhhc2UgMkItM0EgLSBKZW5raW5zIENvbm5lY3RvciBIVFRQIOaatOmcsuWxglxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5o+Q5L6bIFdlYmhvb2sg5o6l5pS256uv54K5XG4gKiAtIOaPkOS+myBPcGVyYXRvciBBUEkg56uv54K5XG4gKi9cblxuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IFVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQge1xuICBpbml0aWFsaXplSmVua2luc0ludGVncmF0aW9uLFxuICBjcmVhdGVKZW5raW5zV2ViaG9va0hhbmRsZXIsXG4gIGNyZWF0ZUplbmtpbnNBY3Rpb25IYW5kbGVyLFxuICB0eXBlIEplbmtpbnNJbnRlZ3JhdGlvblJlc3VsdCxcbn0gZnJvbSAnLi9qZW5raW5zX2ludGVncmF0aW9uJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgSmVua2luc0h0dHBTZXJ2ZXJDb25maWcge1xuICBwb3J0OiBudW1iZXI7XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG4gIGplbmtpbnNCYXNlVXJsPzogc3RyaW5nO1xuICBqZW5raW5zVXNlcm5hbWU/OiBzdHJpbmc7XG4gIGplbmtpbnNUb2tlbj86IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gSFRUUCBTZXJ2ZXJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEplbmtpbnNIdHRwU2VydmVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEplbmtpbnNIdHRwU2VydmVyQ29uZmlnPjtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgaW50ZWdyYXRpb246IEplbmtpbnNJbnRlZ3JhdGlvblJlc3VsdDtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEplbmtpbnNIdHRwU2VydmVyQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBwb3J0OiBjb25maWcucG9ydCxcbiAgICAgIGJhc2VQYXRoOiBjb25maWcuYmFzZVBhdGguZW5kc1dpdGgoJy8nKSA/IGNvbmZpZy5iYXNlUGF0aC5zbGljZSgwLCAtMSkgOiBjb25maWcuYmFzZVBhdGgsXG4gICAgICBqZW5raW5zQmFzZVVybDogY29uZmlnLmplbmtpbnNCYXNlVXJsIHx8IHByb2Nlc3MuZW52LkpFTktJTlNfQkFTRV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXG4gICAgICBqZW5raW5zVXNlcm5hbWU6IGNvbmZpZy5qZW5raW5zVXNlcm5hbWUgfHwgcHJvY2Vzcy5lbnYuSkVOS0lOU19VU0VSTkFNRSB8fCAnJyxcbiAgICAgIGplbmtpbnNUb2tlbjogY29uZmlnLmplbmtpbnNUb2tlbiB8fCBwcm9jZXNzLmVudi5KRU5LSU5TX1RPS0VOIHx8ICcnLFxuICAgIH07XG5cbiAgICAvLyDliJ3lp4vljJbpm4bmiJBcbiAgICB0aGlzLmludGVncmF0aW9uID0gaW5pdGlhbGl6ZUplbmtpbnNJbnRlZ3JhdGlvbih7XG4gICAgICBqZW5raW5zQmFzZVVybDogdGhpcy5jb25maWcuamVua2luc0Jhc2VVcmwsXG4gICAgICBqZW5raW5zVXNlcm5hbWU6IHRoaXMuY29uZmlnLmplbmtpbnNVc2VybmFtZSxcbiAgICAgIGplbmtpbnNUb2tlbjogdGhpcy5jb25maWcuamVua2luc1Rva2VuLFxuICAgICAgdmVyYm9zZUxvZ2dpbmc6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5ZCv5Yqo5pyN5Yqh5ZmoXG4gICAqL1xuICBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5zZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcih0aGlzLmhhbmRsZVJlcXVlc3QuYmluZCh0aGlzKSk7XG5cbiAgICAgIHRoaXMuc2VydmVyLmxpc3Rlbih0aGlzLmNvbmZpZy5wb3J0LCAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbSmVua2luc0h0dHBTZXJ2ZXJdIExpc3RlbmluZyBvbiBwb3J0ICR7dGhpcy5jb25maWcucG9ydH1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtKZW5raW5zSHR0cFNlcnZlcl0gQmFzZSBwYXRoOiAke3RoaXMuY29uZmlnLmJhc2VQYXRofWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0plbmtpbnNIdHRwU2VydmVyXSBFbmRwb2ludHM6YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vd2ViaG9va3MvamVua2luc2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2FwcHJvdmFsc2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBHRVQgICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2luY2lkZW50c2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICBQT1NUICR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2FjdGlvbnNgKTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuc2VydmVyLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0plbmtpbnNIdHRwU2VydmVyXSBTZXJ2ZXIgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlgZzmraLmnI3liqHlmahcbiAgICovXG4gIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2VydmVyKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnNlcnZlci5jbG9zZSgoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbSmVua2luc0h0dHBTZXJ2ZXJdIFNlcnZlciBzdG9wcGVkJyk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBIVFRQIOivt+axglxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCB8fCAnLycsIGBodHRwOi8vJHtyZXEuaGVhZGVycy5ob3N0fWApO1xuICAgIGNvbnN0IHBhdGggPSB1cmwucGF0aG5hbWU7XG5cbiAgICBjb25zb2xlLmxvZyhgW0plbmtpbnNIdHRwU2VydmVyXSAke3JlcS5tZXRob2R9ICR7cGF0aH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3dlYmhvb2tzL2plbmtpbnNgICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVdlYmhvb2socmVxLCByZXMpO1xuICAgICAgfSBlbHNlIGlmIChwYXRoID09PSBgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvYXBwcm92YWxzYCAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEFwcHJvdmFscyhyZXEsIHJlcyk7XG4gICAgICB9IGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9pbmNpZGVudHNgICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0SW5jaWRlbnRzKHJlcSwgcmVzKTtcbiAgICAgIH0gZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2FjdGlvbnNgICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUFjdGlvbihyZXEsIHJlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0plbmtpbnNIdHRwU2VydmVyXSBFcnJvciBoYW5kbGluZyByZXF1ZXN0OicsIGVycm9yKTtcbiAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBKZW5raW5zIFdlYmhvb2tcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlV2ViaG9vayhyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSB7XG4gICAgICBib2R5LnB1c2goY2h1bmspO1xuICAgIH1cbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3Qgd2ViaG9va0hhbmRsZXIgPSBjcmVhdGVKZW5raW5zV2ViaG9va0hhbmRsZXIodGhpcy5pbnRlZ3JhdGlvbik7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2ViaG9va0hhbmRsZXIocGF5bG9hZCk7XG5cbiAgICByZXMud3JpdGVIZWFkKHJlc3VsdC5zdWNjZXNzID8gMjAwIDogNDAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIbojrflj5blrqHmibnliJfooahcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0QXBwcm92YWxzKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuepuuWIl+ihqFxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICBhcHByb3ZhbHM6IFtdLFxuICAgICAgc3VtbWFyeTogeyB0b3RhbDogMCwgcGVuZGluZzogMCwgdGltZW91dDogMCB9LFxuICAgIH0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIbojrflj5bkuovku7bliJfooahcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5jaWRlbnRzKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuepuuWIl+ihqFxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpbmNpZGVudHM6IFtdLFxuICAgICAgc3VtbWFyeTogeyB0b3RhbDogMCwgYWN0aXZlOiAwLCBjcml0aWNhbDogMCB9LFxuICAgIH0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIbliqjkvZzmiafooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlQWN0aW9uKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIHtcbiAgICAgIGJvZHkucHVzaChjaHVuayk7XG4gICAgfVxuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoYm9keSkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCB7IGFjdGlvblR5cGUsIHRhcmdldFR5cGUsIHRhcmdldElkIH0gPSBwYXlsb2FkO1xuXG4gICAgaWYgKCFhY3Rpb25UeXBlIHx8ICF0YXJnZXRUeXBlIHx8ICF0YXJnZXRJZCkge1xuICAgICAgcmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGRzJyB9KSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aW9uSGFuZGxlciA9IGNyZWF0ZUplbmtpbnNBY3Rpb25IYW5kbGVyKHRoaXMuaW50ZWdyYXRpb24pO1xuXG4gICAgbGV0IHJlc3VsdDtcbiAgICBpZiAoYWN0aW9uVHlwZSA9PT0gJ2FwcHJvdmUnKSB7XG4gICAgICByZXN1bHQgPSBhd2FpdCBhY3Rpb25IYW5kbGVyLmhhbmRsZUFwcHJvdmUodGFyZ2V0SWQsIHBheWxvYWQuYWN0b3JJZCk7XG4gICAgfSBlbHNlIGlmIChhY3Rpb25UeXBlID09PSAncmVqZWN0Jykge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgYWN0aW9uSGFuZGxlci5oYW5kbGVSZWplY3QodGFyZ2V0SWQsIHBheWxvYWQuYWN0b3JJZCwgcGF5bG9hZC5yZWFzb24pO1xuICAgIH0gZWxzZSBpZiAoYWN0aW9uVHlwZSA9PT0gJ3JlcnVuJykge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgYWN0aW9uSGFuZGxlci5oYW5kbGVSZXJ1bih0YXJnZXRJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcy53cml0ZUhlYWQoNDAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBVbmtub3duIGFjdGlvbiB0eXBlOiAke2FjdGlvblR5cGV9YCB9KSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmVzLndyaXRlSGVhZChyZXN1bHQuc3VjY2VzcyA/IDIwMCA6IDQwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5bel5Y6C5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKZW5raW5zSHR0cFNlcnZlcihjb25maWc6IEplbmtpbnNIdHRwU2VydmVyQ29uZmlnKTogSmVua2luc0h0dHBTZXJ2ZXIge1xuICByZXR1cm4gbmV3IEplbmtpbnNIdHRwU2VydmVyKGNvbmZpZyk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOeLrOeri+i/kOihjOWFpeWPo1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgY29uc3Qgc2VydmVyID0gY3JlYXRlSmVua2luc0h0dHBTZXJ2ZXIoe1xuICAgIHBvcnQ6IHBhcnNlSW50KHByb2Nlc3MuZW52LlBPUlQgfHwgJzMwMDEnLCAxMCksXG4gICAgYmFzZVBhdGg6IHByb2Nlc3MuZW52LkJBU0VfUEFUSCB8fCAnL2FwaScsXG4gIH0pO1xuXG4gIHNlcnZlci5zdGFydCgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuXG4gIHByb2Nlc3Mub24oJ1NJR0lOVCcsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBzZXJ2ZXIuc3RvcCgpO1xuICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgfSk7XG59XG4iXX0=