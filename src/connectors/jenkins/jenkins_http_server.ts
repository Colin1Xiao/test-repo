/**
 * Jenkins HTTP Server
 * Phase 2B-3A - Jenkins Connector HTTP 暴露层
 * 
 * 职责：
 * - 提供 Webhook 接收端点
 * - 提供 Operator API 端点
 */

import * as http from 'http';
import { URL } from 'url';
import {
  initializeJenkinsIntegration,
  createJenkinsWebhookHandler,
  createJenkinsActionHandler,
  type JenkinsIntegrationResult,
} from './jenkins_integration';

// ============================================================================
// 配置
// ============================================================================

export interface JenkinsHttpServerConfig {
  port: number;
  basePath: string;
  jenkinsBaseUrl?: string;
  jenkinsUsername?: string;
  jenkinsToken?: string;
}

// ============================================================================
// HTTP Server
// ============================================================================

export class JenkinsHttpServer {
  private config: Required<JenkinsHttpServerConfig>;
  private server: http.Server | null = null;
  private integration: JenkinsIntegrationResult;

  constructor(config: JenkinsHttpServerConfig) {
    this.config = {
      port: config.port,
      basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
      jenkinsBaseUrl: config.jenkinsBaseUrl || process.env.JENKINS_BASE_URL || 'http://localhost:8080',
      jenkinsUsername: config.jenkinsUsername || process.env.JENKINS_USERNAME || '',
      jenkinsToken: config.jenkinsToken || process.env.JENKINS_TOKEN || '',
    };

    // 初始化集成
    this.integration = initializeJenkinsIntegration({
      jenkinsBaseUrl: this.config.jenkinsBaseUrl,
      jenkinsUsername: this.config.jenkinsUsername,
      jenkinsToken: this.config.jenkinsToken,
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
  stop(): Promise<void> {
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
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    console.log(`[JenkinsHttpServer] ${req.method} ${path}`);

    try {
      if (path === `${this.config.basePath}/webhooks/jenkins` && req.method === 'POST') {
        await this.handleWebhook(req, res);
      } else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
        await this.handleGetApprovals(req, res);
      } else if (path === `${this.config.basePath}/operator/incidents` && req.method === 'GET') {
        await this.handleGetIncidents(req, res);
      } else if (path === `${this.config.basePath}/operator/actions` && req.method === 'POST') {
        await this.handleAction(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
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
  private async handleWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(body).toString());

    const webhookHandler = createJenkinsWebhookHandler(this.integration);
    const result = await webhookHandler(payload);

    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  /**
   * 处理获取审批列表
   */
  private async handleGetApprovals(req: http.IncomingMessage, res: http.ServerResponse) {
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
  private async handleGetIncidents(req: http.IncomingMessage, res: http.ServerResponse) {
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
  private async handleAction(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
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

    const actionHandler = createJenkinsActionHandler(this.integration);

    let result;
    if (actionType === 'approve') {
      result = await actionHandler.handleApprove(targetId, payload.actorId);
    } else if (actionType === 'reject') {
      result = await actionHandler.handleReject(targetId, payload.actorId, payload.reason);
    } else if (actionType === 'rerun') {
      result = await actionHandler.handleRerun(targetId);
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

export function createJenkinsHttpServer(config: JenkinsHttpServerConfig): JenkinsHttpServer {
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
