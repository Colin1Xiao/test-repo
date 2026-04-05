/**
 * CircleCI HTTP Server
 * Phase 2B-3B - CircleCI Connector HTTP 暴露层
 */

import * as http from 'http';
import { URL } from 'url';
import {
  initializeCircleCIIntegration,
  createCircleCIWebhookHandler,
  createCircleCIActionHandler,
} from './circleci_integration';

export interface CircleCIHttpServerConfig {
  port: number;
  basePath: string;
  apiToken?: string;
}

export class CircleCIHttpServer {
  private config: Required<CircleCIHttpServerConfig>;
  private server: http.Server | null = null;
  private integration: any;

  constructor(config: CircleCIHttpServerConfig) {
    this.config = {
      port: config.port,
      basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
      apiToken: config.apiToken || process.env.CIRCLECI_TOKEN || 'mock-token',
    };

    this.integration = initializeCircleCIIntegration({
      apiToken: this.config.apiToken,
      verboseLogging: true,
    });
  }

  async start(): Promise<void> {
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

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    console.log(`[CircleCIHttpServer] ${req.method} ${path}`);

    try {
      if (path === `${this.config.basePath}/webhooks/circleci` && req.method === 'POST') {
        await this.handleWebhook(req, res);
      } else if (path === `${this.config.basePath}/operator/approvals` && req.method === 'GET') {
        await this.handleGetApprovals(res);
      } else if (path === `${this.config.basePath}/operator/incidents` && req.method === 'GET') {
        await this.handleGetIncidents(res);
      } else if (path === `${this.config.basePath}/operator/actions` && req.method === 'POST') {
        await this.handleAction(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[CircleCIHttpServer] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const webhookHandler = createCircleCIWebhookHandler(this.integration);
    const result = await webhookHandler(payload);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleGetApprovals(res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ approvals: [], summary: { total: 0, pending: 0 } }));
  }

  private async handleGetIncidents(res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ incidents: [], summary: { total: 0, active: 0 } }));
  }

  private async handleAction(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const actionHandler = createCircleCIActionHandler(this.integration);
    let result;

    if (payload.actionType === 'approve') {
      result = await actionHandler.handleApprove(payload.targetId, payload.actorId);
    } else if (payload.actionType === 'reject') {
      result = await actionHandler.handleReject(payload.targetId, payload.actorId, payload.reason);
    } else if (payload.actionType === 'rerun') {
      result = await actionHandler.handleRerun(payload.targetId);
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown action type' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
}

if (require.main === module) {
  const server = new CircleCIHttpServer({
    port: parseInt(process.env.PORT || '3002', 10),
    basePath: process.env.BASE_PATH || '/api',
  });
  server.start().catch(console.error);
  process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
}
