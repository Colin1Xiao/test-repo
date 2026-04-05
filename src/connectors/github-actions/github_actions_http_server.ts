/**
 * GitHub Actions HTTP Server
 * Phase 2B-2-I-H - HTTP Surface Integration
 * 
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
 * - 集成到现有 Gateway
 */

import * as http from 'http';
import { URL } from 'url';
import {
  initializeGitHubActionsIntegration,
  createWebhookHandler,
  createActionHandler,
  GitHubActionsIntegrationResult,
} from './github_actions_integration';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubActionsHttpServerConfig {
  port: number;
  basePath: string;
  githubToken?: string;
  webhookSecret?: string;
}

// ============================================================================
// HTTP Server
// ============================================================================

export class GitHubActionsHttpServer {
  private config: Required<GitHubActionsHttpServerConfig>;
  private server: http.Server | null = null;
  private integration: GitHubActionsIntegrationResult;

  constructor(config: GitHubActionsHttpServerConfig) {
    this.config = {
      port: config.port,
      basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
      githubToken: config.githubToken || process.env.GITHUB_TOKEN || '',
      webhookSecret: config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || '',
    };

    // 初始化集成
    this.integration = initializeGitHubActionsIntegration({
      githubToken: this.config.githubToken,
      webhookSecret: this.config.webhookSecret,
      verboseLogging: true,
    });
  }

  /**
   * 启动服务器
   */
  start(): Promise<void> {
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
  stop(): Promise<void> {
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
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // 记录请求
    console.log(`[GitHubActionsHttpServer] ${req.method} ${path}`);

    try {
      // 路由匹配
      if (path === `${this.config.basePath}/webhooks/github` && req.method === 'POST') {
        await this.handleWebhook(req, res);
      } else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
        await this.handleGetApprovals(req, res);
      } else if (path === `${this.config.basePath}/operator/inbox` && req.method === 'GET') {
        await this.handleGetInbox(req, res);
      } else if (path === `${this.config.basePath}/operator/actions` && req.method === 'POST') {
        await this.handleAction(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
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
  private async handleWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    const rawBody = Buffer.concat(body);
    const payload = JSON.parse(rawBody.toString());

    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    // 调用 Webhook 处理器
    const webhookHandler = createWebhookHandler(this.integration);
    const result = await webhookHandler(payload, signature);

    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  /**
   * 处理获取审批列表
   */
  private async handleGetApprovals(req: http.IncomingMessage, res: http.ServerResponse) {
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
  private async handleGetInbox(req: http.IncomingMessage, res: http.ServerResponse) {
    // 合并 approvals 和 incidents
    const [approvalView, incidentSummary] = await Promise.all([
      this.integration.approvalDataSource.getApprovalView(),
      this.integration.incidentDataSource.getIncidentSummary(),
    ]);

    const items = [
      ...approvalView.pendingApprovals.map((a: any) => ({
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
  private async handleAction(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
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
      } else {
        // 降级：构造虚拟 sourceId
        sourceId = `unknown/unknown/deployments/${deploymentId}`;
      }
    }

    const actionHandler = createActionHandler(this.integration);

    let result;
    if (actionType === 'approve') {
      result = await actionHandler.handleApprove(sourceId, payload.actorId);
    } else if (actionType === 'reject') {
      result = await actionHandler.handleReject(sourceId, payload.actorId, reason);
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown action type: ${actionType}` }));
      return;
    }

    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubActionsHttpServer(
  config: GitHubActionsHttpServerConfig
): GitHubActionsHttpServer {
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
