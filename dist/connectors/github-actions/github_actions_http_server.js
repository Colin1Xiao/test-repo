"use strict";
/**
 * GitHub Actions HTTP Server
 * Phase 2B-2-I-H - HTTP Surface Integration
 *
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
 * - 集成到现有 Gateway
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
exports.GitHubActionsHttpServer = void 0;
exports.createGitHubActionsHttpServer = createGitHubActionsHttpServer;
const http = __importStar(require("http"));
const url_1 = require("url");
const github_actions_integration_1 = require("./github_actions_integration");
// ============================================================================
// HTTP Server
// ============================================================================
class GitHubActionsHttpServer {
    constructor(config) {
        this.server = null;
        this.config = {
            port: config.port,
            basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
            githubToken: config.githubToken || process.env.GITHUB_TOKEN || '',
            webhookSecret: config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || '',
        };
        // 初始化集成
        this.integration = (0, github_actions_integration_1.initializeGitHubActionsIntegration)({
            githubToken: this.config.githubToken,
            webhookSecret: this.config.webhookSecret,
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
                console.log(`[GitHubActionsHttpServer] Listening on port ${this.config.port}`);
                console.log(`[GitHubActionsHttpServer] Base path: ${this.config.basePath}`);
                console.log(`[GitHubActionsHttpServer] Endpoints:`);
                console.log(`  POST ${this.config.basePath}/webhooks/github`);
                console.log(`  GET  ${this.config.basePath}/operator/approvals`);
                console.log(`  GET  ${this.config.basePath}/operator/inbox`);
                console.log(`  POST ${this.config.basePath}/operator/actions`);
                resolve();
            });
            this.server.on('error', (err) => {
                console.error('[GitHubActionsHttpServer] Server error:', err);
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
                console.log('[GitHubActionsHttpServer] Server stopped');
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
        // 记录请求
        console.log(`[GitHubActionsHttpServer] ${req.method} ${path}`);
        try {
            // 路由匹配
            if (path === `${this.config.basePath}/webhooks/github` && req.method === 'POST') {
                await this.handleWebhook(req, res);
            }
            else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
                await this.handleGetApprovals(req, res);
            }
            else if (path === `${this.config.basePath}/operator/inbox` && req.method === 'GET') {
                await this.handleGetInbox(req, res);
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
            console.error('[GitHubActionsHttpServer] Error handling request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * 处理 GitHub Webhook
     */
    async handleWebhook(req, res) {
        const body = [];
        for await (const chunk of req) {
            body.push(chunk);
        }
        const rawBody = Buffer.concat(body);
        const payload = JSON.parse(rawBody.toString());
        const signature = req.headers['x-hub-signature-256'];
        // 调用 Webhook 处理器
        const webhookHandler = (0, github_actions_integration_1.createWebhookHandler)(this.integration);
        const result = await webhookHandler(payload, signature);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    /**
     * 处理获取审批列表
     */
    async handleGetApprovals(req, res) {
        const approvalView = await this.integration.approvalDataSource.getApprovalView();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            approvals: approvalView.pendingApprovals,
            summary: {
                total: approvalView.totalApprovals,
                pending: approvalView.pendingApprovals.length,
                timeout: approvalView.timeoutApprovals.length,
            },
        }));
    }
    /**
     * 处理获取 Inbox
     */
    async handleGetInbox(req, res) {
        // 合并 approvals 和 incidents
        const [approvalView, incidentSummary] = await Promise.all([
            this.integration.approvalDataSource.getApprovalView(),
            this.integration.incidentDataSource.getIncidentSummary(),
        ]);
        const items = [
            ...approvalView.pendingApprovals.map((a) => ({
                id: a.approvalId,
                type: 'approval',
                scope: a.scope,
                status: a.status,
                metadata: a.metadata,
            })),
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            summary: {
                pendingApprovals: approvalView.pendingApprovals.length,
                activeIncidents: incidentSummary.active,
                total: approvalView.pendingApprovals.length + incidentSummary.active,
            },
            items,
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
        const { actionType, targetType, targetId, reason } = payload;
        if (!actionType || !targetType || !targetId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields: actionType, targetType, targetId' }));
            return;
        }
        // 将 approvalId 转换为 sourceId 格式
        // github_deployment_12345 → owner/repo/deployments/12345
        let sourceId = targetId;
        if (targetId.startsWith('github_deployment_')) {
            const deploymentId = targetId.replace('github_deployment_', '');
            // 从数据源获取真实 sourceId
            const approval = await this.integration.approvalDataSource.getApprovalById(targetId);
            if (approval && approval.metadata?.sourceId) {
                sourceId = approval.metadata.sourceId;
            }
            else {
                // 降级：构造虚拟 sourceId
                sourceId = `unknown/unknown/deployments/${deploymentId}`;
            }
        }
        const actionHandler = (0, github_actions_integration_1.createActionHandler)(this.integration);
        let result;
        if (actionType === 'approve') {
            result = await actionHandler.handleApprove(sourceId, payload.actorId);
        }
        else if (actionType === 'reject') {
            result = await actionHandler.handleReject(sourceId, payload.actorId, reason);
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
exports.GitHubActionsHttpServer = GitHubActionsHttpServer;
// ============================================================================
// 工厂函数
// ============================================================================
function createGitHubActionsHttpServer(config) {
    return new GitHubActionsHttpServer(config);
}
// ============================================================================
// 独立运行入口
// ============================================================================
if (require.main === module) {
    const server = createGitHubActionsHttpServer({
        port: parseInt(process.env.PORT || '3000', 10),
        basePath: process.env.BASE_PATH || '/api',
    });
    server.start().catch(console.error);
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViX2FjdGlvbnNfaHR0cF9zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9naXRodWItYWN0aW9ucy9naXRodWJfYWN0aW9uc19odHRwX3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXVQSCxzRUFJQztBQXpQRCwyQ0FBNkI7QUFDN0IsNkJBQTBCO0FBQzFCLDZFQUtzQztBQWF0QywrRUFBK0U7QUFDL0UsY0FBYztBQUNkLCtFQUErRTtBQUUvRSxNQUFhLHVCQUF1QjtJQUtsQyxZQUFZLE1BQXFDO1FBSHpDLFdBQU0sR0FBdUIsSUFBSSxDQUFDO1FBSXhDLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVE7WUFDeEYsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksRUFBRTtZQUNqRSxhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixJQUFJLEVBQUU7U0FDL0UsQ0FBQztRQUVGLFFBQVE7UUFDUixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUEsK0RBQWtDLEVBQUM7WUFDcEQsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVztZQUNwQyxhQUFhLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhO1lBQ3hDLGNBQWMsRUFBRSxJQUFJO1NBQ3JCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUs7UUFDSCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRS9ELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtnQkFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQ0FBK0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUMvRSxPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQzVFLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLENBQUMsQ0FBQztnQkFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxrQkFBa0IsQ0FBQyxDQUFDO2dCQUM5RCxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLHFCQUFxQixDQUFDLENBQUM7Z0JBQ2pFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsaUJBQWlCLENBQUMsQ0FBQztnQkFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxtQkFBbUIsQ0FBQyxDQUFDO2dCQUMvRCxPQUFPLEVBQUUsQ0FBQztZQUNaLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQzlCLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQzlELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNkLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJO1FBQ0YsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sRUFBRSxDQUFDO2dCQUNWLE9BQU87WUFDVCxDQUFDO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFO2dCQUNyQixPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7Z0JBQ3hELE9BQU8sRUFBRSxDQUFDO1lBQ1osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBeUIsRUFBRSxHQUF3QjtRQUM3RSxNQUFNLEdBQUcsR0FBRyxJQUFJLFNBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRSxVQUFVLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNsRSxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBRTFCLE9BQU87UUFDUCxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixHQUFHLENBQUMsTUFBTSxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7UUFFL0QsSUFBSSxDQUFDO1lBQ0gsT0FBTztZQUNQLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLGtCQUFrQixJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssTUFBTSxFQUFFLENBQUM7Z0JBQ2hGLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDckMsQ0FBQztpQkFBTSxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxxQkFBcUIsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUN6RixNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDMUMsQ0FBQztpQkFBTSxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxpQkFBaUIsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUNyRixNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3RDLENBQUM7aUJBQU0sSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsbUJBQW1CLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDeEYsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNwQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO2dCQUMzRCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2xELENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsbURBQW1ELEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1lBQzNELEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDckIsS0FBSyxFQUFFLHVCQUF1QjtnQkFDOUIsT0FBTyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7YUFDaEUsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUF5QixFQUFFLEdBQXdCO1FBQzdFLE1BQU0sSUFBSSxHQUFVLEVBQUUsQ0FBQztRQUN2QixJQUFJLEtBQUssRUFBRSxNQUFNLEtBQUssSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25CLENBQUM7UUFDRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFFL0MsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBdUIsQ0FBQztRQUUzRSxpQkFBaUI7UUFDakIsTUFBTSxjQUFjLEdBQUcsSUFBQSxpREFBb0IsRUFBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDOUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxjQUFjLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUF5QixFQUFFLEdBQXdCO1FBQ2xGLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUVqRixHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDM0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3JCLFNBQVMsRUFBRSxZQUFZLENBQUMsZ0JBQWdCO1lBQ3hDLE9BQU8sRUFBRTtnQkFDUCxLQUFLLEVBQUUsWUFBWSxDQUFDLGNBQWM7Z0JBQ2xDLE9BQU8sRUFBRSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsTUFBTTtnQkFDN0MsT0FBTyxFQUFFLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNO2FBQzlDO1NBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsY0FBYyxDQUFDLEdBQXlCLEVBQUUsR0FBd0I7UUFDOUUsMkJBQTJCO1FBQzNCLE1BQU0sQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ3hELElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsZUFBZSxFQUFFO1lBQ3JELElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLEVBQUU7U0FDekQsQ0FBQyxDQUFDO1FBRUgsTUFBTSxLQUFLLEdBQUc7WUFDWixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ2hELEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSztnQkFDZCxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07Z0JBQ2hCLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUTthQUNyQixDQUFDLENBQUM7U0FDSixDQUFDO1FBRUYsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBQzNELEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNyQixPQUFPLEVBQUU7Z0JBQ1AsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLGdCQUFnQixDQUFDLE1BQU07Z0JBQ3RELGVBQWUsRUFBRSxlQUFlLENBQUMsTUFBTTtnQkFDdkMsS0FBSyxFQUFFLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDLE1BQU07YUFDckU7WUFDRCxLQUFLO1NBQ04sQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsWUFBWSxDQUFDLEdBQXlCLEVBQUUsR0FBd0I7UUFDNUUsTUFBTSxJQUFJLEdBQVUsRUFBRSxDQUFDO1FBQ3ZCLElBQUksS0FBSyxFQUFFLE1BQU0sS0FBSyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkIsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTNELE1BQU0sRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFFN0QsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzVDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztZQUMzRCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsMkRBQTJELEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEcsT0FBTztRQUNULENBQUM7UUFFRCwrQkFBK0I7UUFDL0IseURBQXlEO1FBQ3pELElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN4QixJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO1lBQzlDLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDaEUsb0JBQW9CO1lBQ3BCLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckYsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQztnQkFDNUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ3hDLENBQUM7aUJBQU0sQ0FBQztnQkFDTixtQkFBbUI7Z0JBQ25CLFFBQVEsR0FBRywrQkFBK0IsWUFBWSxFQUFFLENBQUM7WUFDM0QsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFBLGdEQUFtQixFQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU1RCxJQUFJLE1BQU0sQ0FBQztRQUNYLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzdCLE1BQU0sR0FBRyxNQUFNLGFBQWEsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4RSxDQUFDO2FBQU0sSUFBSSxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbkMsTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMvRSxDQUFDO2FBQU0sQ0FBQztZQUNOLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztZQUMzRCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsd0JBQXdCLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3pFLE9BQU87UUFDVCxDQUFDO1FBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDbEYsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBdk5ELDBEQXVOQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDZCQUE2QixDQUMzQyxNQUFxQztJQUVyQyxPQUFPLElBQUksdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUVELCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUUsQ0FBQztJQUM1QixNQUFNLE1BQU0sR0FBRyw2QkFBNkIsQ0FBQztRQUMzQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLE1BQU0sRUFBRSxFQUFFLENBQUM7UUFDOUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLE1BQU07S0FDMUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFcEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUIsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDcEIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEdpdEh1YiBBY3Rpb25zIEhUVFAgU2VydmVyXG4gKiBQaGFzZSAyQi0yLUktSCAtIEhUVFAgU3VyZmFjZSBJbnRlZ3JhdGlvblxuICogXG4gKiDogYzotKPvvJpcbiAqIC0g5o+Q5L6bIFdlYmhvb2sg5o6l5pS256uv54K5XG4gKiAtIOaPkOS+myBPcGVyYXRvciBBUEkg56uv54K5XG4gKiAtIOmbhuaIkOWIsOeOsOaciSBHYXRld2F5XG4gKi9cblxuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IFVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQge1xuICBpbml0aWFsaXplR2l0SHViQWN0aW9uc0ludGVncmF0aW9uLFxuICBjcmVhdGVXZWJob29rSGFuZGxlcixcbiAgY3JlYXRlQWN0aW9uSGFuZGxlcixcbiAgR2l0SHViQWN0aW9uc0ludGVncmF0aW9uUmVzdWx0LFxufSBmcm9tICcuL2dpdGh1Yl9hY3Rpb25zX2ludGVncmF0aW9uJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6YWN572uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXJDb25maWcge1xuICBwb3J0OiBudW1iZXI7XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG4gIGdpdGh1YlRva2VuPzogc3RyaW5nO1xuICB3ZWJob29rU2VjcmV0Pzogc3RyaW5nO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBIVFRQIFNlcnZlclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8R2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXJDb25maWc+O1xuICBwcml2YXRlIHNlcnZlcjogaHR0cC5TZXJ2ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpbnRlZ3JhdGlvbjogR2l0SHViQWN0aW9uc0ludGVncmF0aW9uUmVzdWx0O1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXJDb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHBvcnQ6IGNvbmZpZy5wb3J0LFxuICAgICAgYmFzZVBhdGg6IGNvbmZpZy5iYXNlUGF0aC5lbmRzV2l0aCgnLycpID8gY29uZmlnLmJhc2VQYXRoLnNsaWNlKDAsIC0xKSA6IGNvbmZpZy5iYXNlUGF0aCxcbiAgICAgIGdpdGh1YlRva2VuOiBjb25maWcuZ2l0aHViVG9rZW4gfHwgcHJvY2Vzcy5lbnYuR0lUSFVCX1RPS0VOIHx8ICcnLFxuICAgICAgd2ViaG9va1NlY3JldDogY29uZmlnLndlYmhvb2tTZWNyZXQgfHwgcHJvY2Vzcy5lbnYuR0lUSFVCX1dFQkhPT0tfU0VDUkVUIHx8ICcnLFxuICAgIH07XG5cbiAgICAvLyDliJ3lp4vljJbpm4bmiJBcbiAgICB0aGlzLmludGVncmF0aW9uID0gaW5pdGlhbGl6ZUdpdEh1YkFjdGlvbnNJbnRlZ3JhdGlvbih7XG4gICAgICBnaXRodWJUb2tlbjogdGhpcy5jb25maWcuZ2l0aHViVG9rZW4sXG4gICAgICB3ZWJob29rU2VjcmV0OiB0aGlzLmNvbmZpZy53ZWJob29rU2VjcmV0LFxuICAgICAgdmVyYm9zZUxvZ2dpbmc6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5ZCv5Yqo5pyN5Yqh5ZmoXG4gICAqL1xuICBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5zZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcih0aGlzLmhhbmRsZVJlcXVlc3QuYmluZCh0aGlzKSk7XG5cbiAgICAgIHRoaXMuc2VydmVyLmxpc3Rlbih0aGlzLmNvbmZpZy5wb3J0LCAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXJdIExpc3RlbmluZyBvbiBwb3J0ICR7dGhpcy5jb25maWcucG9ydH1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtHaXRIdWJBY3Rpb25zSHR0cFNlcnZlcl0gQmFzZSBwYXRoOiAke3RoaXMuY29uZmlnLmJhc2VQYXRofWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0dpdEh1YkFjdGlvbnNIdHRwU2VydmVyXSBFbmRwb2ludHM6YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIFBPU1QgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vd2ViaG9va3MvZ2l0aHViYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvYXBwcm92YWxzYCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgIEdFVCAgJHt0aGlzLmNvbmZpZy5iYXNlUGF0aH0vb3BlcmF0b3IvaW5ib3hgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgUE9TVCAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9hY3Rpb25zYCk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnNlcnZlci5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tHaXRIdWJBY3Rpb25zSHR0cFNlcnZlcl0gU2VydmVyIGVycm9yOicsIGVycik7XG4gICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5YGc5q2i5pyN5Yqh5ZmoXG4gICAqL1xuICBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNlcnZlcikge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZXJ2ZXIuY2xvc2UoKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0dpdEh1YkFjdGlvbnNIdHRwU2VydmVyXSBTZXJ2ZXIgc3RvcHBlZCcpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIYgSFRUUCDor7fmsYJcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICBjb25zdCBwYXRoID0gdXJsLnBhdGhuYW1lO1xuXG4gICAgLy8g6K6w5b2V6K+35rGCXG4gICAgY29uc29sZS5sb2coYFtHaXRIdWJBY3Rpb25zSHR0cFNlcnZlcl0gJHtyZXEubWV0aG9kfSAke3BhdGh9YCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g6Lev55Sx5Yy56YWNXG4gICAgICBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L3dlYmhvb2tzL2dpdGh1YmAgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlV2ViaG9vayhyZXEsIHJlcyk7XG4gICAgICB9IGVsc2UgaWYgKHBhdGggPT09IGAke3RoaXMuY29uZmlnLmJhc2VQYXRofS9vcGVyYXRvci9hcHByb3ZhbHNgICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlR2V0QXBwcm92YWxzKHJlcSwgcmVzKTtcbiAgICAgIH0gZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2luYm94YCAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUdldEluYm94KHJlcSwgcmVzKTtcbiAgICAgIH0gZWxzZSBpZiAocGF0aCA9PT0gYCR7dGhpcy5jb25maWcuYmFzZVBhdGh9L29wZXJhdG9yL2FjdGlvbnNgICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZUFjdGlvbihyZXEsIHJlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0dpdEh1YkFjdGlvbnNIdHRwU2VydmVyXSBFcnJvciBoYW5kbGluZyByZXF1ZXN0OicsIGVycm9yKTtcbiAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhiBHaXRIdWIgV2ViaG9va1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVXZWJob29rKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IGJvZHk6IGFueVtdID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIHtcbiAgICAgIGJvZHkucHVzaChjaHVuayk7XG4gICAgfVxuICAgIGNvbnN0IHJhd0JvZHkgPSBCdWZmZXIuY29uY2F0KGJvZHkpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKHJhd0JvZHkudG9TdHJpbmcoKSk7XG5cbiAgICBjb25zdCBzaWduYXR1cmUgPSByZXEuaGVhZGVyc1sneC1odWItc2lnbmF0dXJlLTI1NiddIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIC8vIOiwg+eUqCBXZWJob29rIOWkhOeQhuWZqFxuICAgIGNvbnN0IHdlYmhvb2tIYW5kbGVyID0gY3JlYXRlV2ViaG9va0hhbmRsZXIodGhpcy5pbnRlZ3JhdGlvbik7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2ViaG9va0hhbmRsZXIocGF5bG9hZCwgc2lnbmF0dXJlKTtcblxuICAgIHJlcy53cml0ZUhlYWQocmVzdWx0LnN1Y2Nlc3MgPyAyMDAgOiA0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkhOeQhuiOt+WPluWuoeaJueWIl+ihqFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXRBcHByb3ZhbHMocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgY29uc3QgYXBwcm92YWxWaWV3ID0gYXdhaXQgdGhpcy5pbnRlZ3JhdGlvbi5hcHByb3ZhbERhdGFTb3VyY2UuZ2V0QXBwcm92YWxWaWV3KCk7XG5cbiAgICByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgYXBwcm92YWxzOiBhcHByb3ZhbFZpZXcucGVuZGluZ0FwcHJvdmFscyxcbiAgICAgIHN1bW1hcnk6IHtcbiAgICAgICAgdG90YWw6IGFwcHJvdmFsVmlldy50b3RhbEFwcHJvdmFscyxcbiAgICAgICAgcGVuZGluZzogYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMubGVuZ3RoLFxuICAgICAgICB0aW1lb3V0OiBhcHByb3ZhbFZpZXcudGltZW91dEFwcHJvdmFscy5sZW5ndGgsXG4gICAgICB9LFxuICAgIH0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpITnkIbojrflj5YgSW5ib3hcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5ib3gocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKSB7XG4gICAgLy8g5ZCI5bm2IGFwcHJvdmFscyDlkowgaW5jaWRlbnRzXG4gICAgY29uc3QgW2FwcHJvdmFsVmlldywgaW5jaWRlbnRTdW1tYXJ5XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuaW50ZWdyYXRpb24uYXBwcm92YWxEYXRhU291cmNlLmdldEFwcHJvdmFsVmlldygpLFxuICAgICAgdGhpcy5pbnRlZ3JhdGlvbi5pbmNpZGVudERhdGFTb3VyY2UuZ2V0SW5jaWRlbnRTdW1tYXJ5KCksXG4gICAgXSk7XG5cbiAgICBjb25zdCBpdGVtcyA9IFtcbiAgICAgIC4uLmFwcHJvdmFsVmlldy5wZW5kaW5nQXBwcm92YWxzLm1hcCgoYTogYW55KSA9PiAoe1xuICAgICAgICBpZDogYS5hcHByb3ZhbElkLFxuICAgICAgICB0eXBlOiAnYXBwcm92YWwnLFxuICAgICAgICBzY29wZTogYS5zY29wZSxcbiAgICAgICAgc3RhdHVzOiBhLnN0YXR1cyxcbiAgICAgICAgbWV0YWRhdGE6IGEubWV0YWRhdGEsXG4gICAgICB9KSksXG4gICAgXTtcblxuICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICBzdW1tYXJ5OiB7XG4gICAgICAgIHBlbmRpbmdBcHByb3ZhbHM6IGFwcHJvdmFsVmlldy5wZW5kaW5nQXBwcm92YWxzLmxlbmd0aCxcbiAgICAgICAgYWN0aXZlSW5jaWRlbnRzOiBpbmNpZGVudFN1bW1hcnkuYWN0aXZlLFxuICAgICAgICB0b3RhbDogYXBwcm92YWxWaWV3LnBlbmRpbmdBcHByb3ZhbHMubGVuZ3RoICsgaW5jaWRlbnRTdW1tYXJ5LmFjdGl2ZSxcbiAgICAgIH0sXG4gICAgICBpdGVtcyxcbiAgICB9KSk7XG4gIH1cblxuICAvKipcbiAgICog5aSE55CG5Yqo5L2c5omn6KGMXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGhhbmRsZUFjdGlvbihyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5OiBhbnlbXSA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSB7XG4gICAgICBib2R5LnB1c2goY2h1bmspO1xuICAgIH1cbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuY29uY2F0KGJvZHkpLnRvU3RyaW5nKCkpO1xuXG4gICAgY29uc3QgeyBhY3Rpb25UeXBlLCB0YXJnZXRUeXBlLCB0YXJnZXRJZCwgcmVhc29uIH0gPSBwYXlsb2FkO1xuXG4gICAgaWYgKCFhY3Rpb25UeXBlIHx8ICF0YXJnZXRUeXBlIHx8ICF0YXJnZXRJZCkge1xuICAgICAgcmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiBhY3Rpb25UeXBlLCB0YXJnZXRUeXBlLCB0YXJnZXRJZCcgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIOWwhiBhcHByb3ZhbElkIOi9rOaNouS4uiBzb3VyY2VJZCDmoLzlvI9cbiAgICAvLyBnaXRodWJfZGVwbG95bWVudF8xMjM0NSDihpIgb3duZXIvcmVwby9kZXBsb3ltZW50cy8xMjM0NVxuICAgIGxldCBzb3VyY2VJZCA9IHRhcmdldElkO1xuICAgIGlmICh0YXJnZXRJZC5zdGFydHNXaXRoKCdnaXRodWJfZGVwbG95bWVudF8nKSkge1xuICAgICAgY29uc3QgZGVwbG95bWVudElkID0gdGFyZ2V0SWQucmVwbGFjZSgnZ2l0aHViX2RlcGxveW1lbnRfJywgJycpO1xuICAgICAgLy8g5LuO5pWw5o2u5rqQ6I635Y+W55yf5a6eIHNvdXJjZUlkXG4gICAgICBjb25zdCBhcHByb3ZhbCA9IGF3YWl0IHRoaXMuaW50ZWdyYXRpb24uYXBwcm92YWxEYXRhU291cmNlLmdldEFwcHJvdmFsQnlJZCh0YXJnZXRJZCk7XG4gICAgICBpZiAoYXBwcm92YWwgJiYgYXBwcm92YWwubWV0YWRhdGE/LnNvdXJjZUlkKSB7XG4gICAgICAgIHNvdXJjZUlkID0gYXBwcm92YWwubWV0YWRhdGEuc291cmNlSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyDpmY3nuqfvvJrmnoTpgKDomZrmi58gc291cmNlSWRcbiAgICAgICAgc291cmNlSWQgPSBgdW5rbm93bi91bmtub3duL2RlcGxveW1lbnRzLyR7ZGVwbG95bWVudElkfWA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aW9uSGFuZGxlciA9IGNyZWF0ZUFjdGlvbkhhbmRsZXIodGhpcy5pbnRlZ3JhdGlvbik7XG5cbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmIChhY3Rpb25UeXBlID09PSAnYXBwcm92ZScpIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGFjdGlvbkhhbmRsZXIuaGFuZGxlQXBwcm92ZShzb3VyY2VJZCwgcGF5bG9hZC5hY3RvcklkKTtcbiAgICB9IGVsc2UgaWYgKGFjdGlvblR5cGUgPT09ICdyZWplY3QnKSB7XG4gICAgICByZXN1bHQgPSBhd2FpdCBhY3Rpb25IYW5kbGVyLmhhbmRsZVJlamVjdChzb3VyY2VJZCwgcGF5bG9hZC5hY3RvcklkLCByZWFzb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXMud3JpdGVIZWFkKDQwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgVW5rbm93biBhY3Rpb24gdHlwZTogJHthY3Rpb25UeXBlfWAgfSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJlcy53cml0ZUhlYWQocmVzdWx0LnN1Y2Nlc3MgPyAyMDAgOiA0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOW3peWOguWHveaVsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXIoXG4gIGNvbmZpZzogR2l0SHViQWN0aW9uc0h0dHBTZXJ2ZXJDb25maWdcbik6IEdpdEh1YkFjdGlvbnNIdHRwU2VydmVyIHtcbiAgcmV0dXJuIG5ldyBHaXRIdWJBY3Rpb25zSHR0cFNlcnZlcihjb25maWcpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDni6znq4vov5DooYzlhaXlj6Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGNvbnN0IHNlcnZlciA9IGNyZWF0ZUdpdEh1YkFjdGlvbnNIdHRwU2VydmVyKHtcbiAgICBwb3J0OiBwYXJzZUludChwcm9jZXNzLmVudi5QT1JUIHx8ICczMDAwJywgMTApLFxuICAgIGJhc2VQYXRoOiBwcm9jZXNzLmVudi5CQVNFX1BBVEggfHwgJy9hcGknLFxuICB9KTtcblxuICBzZXJ2ZXIuc3RhcnQoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcblxuICBwcm9jZXNzLm9uKCdTSUdJTlQnLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgc2VydmVyLnN0b3AoKTtcbiAgICBwcm9jZXNzLmV4aXQoMCk7XG4gIH0pO1xufVxuIl19