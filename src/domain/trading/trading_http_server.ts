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

import * as http from 'http';
import { URL } from 'url';
import { initializeTradingOpsPack, createReleaseRequestEvent, createSystemAlertEvent } from './trading_ops_pack';
import { createTradingRunbookActions, createAcknowledgeAction, createEscalateAction, createRecoveryAction } from './trading_runbook_actions';
import { createTradingRiskStateService } from './trading_risk_state_service';
import { createTradingDashboardProjection } from './trading_dashboard_projection';
import { createTradingEventIngest } from './trading_event_ingest';
import type { TradingEvent } from './trading_types';

// ============================================================================
// 配置
// ============================================================================

export interface TradingHttpServerConfig {
  port: number;
  basePath: string;
  environment?: 'testnet' | 'mainnet';
}

// ============================================================================
// 内存数据存储（简化实现）
// ============================================================================

class TradingDataStore {
  private approvals: any[] = [];
  private incidents: any[] = [];
  private releases: any[] = [];
  private alerts: any[] = [];

  addApproval(approval: any) {
    this.approvals.push({ ...approval, createdAt: Date.now() });
  }

  addIncident(incident: any) {
    this.incidents.push({ ...incident, createdAt: Date.now(), acknowledged: false, resolved: false });
  }

  getApprovals() {
    return this.approvals;
  }

  getIncidents() {
    return this.incidents;
  }

  acknowledgeIncident(incidentId: string) {
    const incident = this.incidents.find(i => i.incidentId === incidentId);
    if (incident) {
      incident.acknowledged = true;
      incident.acknowledgedAt = Date.now();
    }
  }

  resolveIncident(incidentId: string, resolution?: string) {
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

export class TradingHttpServer {
  private config: Required<TradingHttpServerConfig>;
  private server: http.Server | null = null;
  private tradingOps: any;
  private dataStore: TradingDataStore;
  private runbookActions: ReturnType<typeof createTradingRunbookActions>;
  private riskStateService: ReturnType<typeof createTradingRiskStateService>;
  private dashboardProjection: ReturnType<typeof createTradingDashboardProjection>;
  private eventIngest: ReturnType<typeof createTradingEventIngest>;

  constructor(config: TradingHttpServerConfig) {
    this.config = {
      port: config.port,
      basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
      environment: config.environment || 'mainnet',
    };

    this.tradingOps = initializeTradingOpsPack({
      environment: this.config.environment,
      autoCreateApproval: true,
      autoCreateIncident: true,
    });

    this.dataStore = new TradingDataStore();
    this.runbookActions = createTradingRunbookActions();
    this.riskStateService = createTradingRiskStateService();
    this.dashboardProjection = createTradingDashboardProjection();
    this.eventIngest = createTradingEventIngest();
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));
      this.server.listen(this.config.port, () => {
        console.log(`[TradingHttpServer] Listening on port ${this.config.port}`);
        console.log(`[TradingHttpServer] Endpoints:`);
        console.log(`  POST ${this.config.basePath}/trading/events`);
        console.log(`  POST ${this.config.basePath}/trading/webhooks/:source`);
        console.log(`  GET  ${this.config.basePath}/trading/events`);
        console.log(`  GET  ${this.config.basePath}/trading/events/stats`);
        console.log(`  GET  ${this.config.basePath}/trading/dashboard`);
        console.log(`  GET  ${this.config.basePath}/trading/dashboard/enhanced`);
        console.log(`  GET  ${this.config.basePath}/trading/incidents`);
        console.log(`  GET  ${this.config.basePath}/trading/approvals`);
        console.log(`  GET  ${this.config.basePath}/trading/risk-state`);
        console.log(`  POST ${this.config.basePath}/trading/incidents/:id/acknowledge`);
        console.log(`  POST ${this.config.basePath}/trading/incidents/:id/resolve`);
        console.log(`  POST ${this.config.basePath}/trading/runbook-actions`);
        console.log(`  GET  ${this.config.basePath}/trading/runbook-actions/:id`);
        console.log(`  POST ${this.config.basePath}/trading/runbook-actions/:id/execute`);
        console.log(`  POST ${this.config.basePath}/trading/risk-state/breach`);
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
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

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
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
      // Webhooks - GitHub
      else if (path === `${this.config.basePath}/trading/webhooks/github` && method === 'POST') {
        await this.handleGitHubWebhook(req, res);
      }
      // Webhooks - Trading System
      else if (path === `${this.config.basePath}/trading/webhooks/trading-system` && method === 'POST') {
        await this.handleTradingSystemWebhook(req, res);
      }
      // Webhooks - Monitoring
      else if (path === `${this.config.basePath}/trading/webhooks/monitoring` && method === 'POST') {
        await this.handleMonitoringWebhook(req, res);
      }
      // Dashboard
      else if (path === `${this.config.basePath}/trading/dashboard` && method === 'GET') {
        await this.handleGetDashboard(res);
      }
      // Enhanced Dashboard
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
      // Runbook Actions - Create
      else if (path === `${this.config.basePath}/trading/runbook-actions` && method === 'POST') {
        await this.handleCreateRunbookAction(req, res);
      }
      // Runbook Actions - Execute
      else if (path.match(/\/trading\/runbook-actions\/[^/]+\/execute/) && method === 'POST') {
        const actionId = path.split('/')[4];
        await this.handleExecuteRunbookAction(actionId, req, res);
      }
      // Get Runbook Action
      else if (path.match(/\/trading\/runbook-actions\//) && method === 'GET') {
        const actionId = path.split('/')[4];
        await this.handleGetRunbookAction(actionId, res);
      }
      // Risk State - Record Breach
      else if (path === `${this.config.basePath}/trading/risk-state/breach` && method === 'POST') {
        await this.handleRecordBreach(req, res);
      }
      else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[TradingHttpServer] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : String(error) }));
    }
  }

  private async handleTradingEvent(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    // 处理事件
    const event: TradingEvent = {
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

  private async handleGetDashboard(res: http.ServerResponse) {
    const snapshot = await this.tradingOps.operatorViews.buildDashboardSnapshot(
      this.dataStore.getApprovals(),
      this.dataStore.getIncidents(),
      [],
      []
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot));
  }

  private async handleGetIncidents(res: http.ServerResponse) {
    const incidents = await this.tradingOps.operatorViews.buildActiveIncidents(
      this.dataStore.getIncidents()
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(incidents));
  }

  private async handleGetApprovals(res: http.ServerResponse) {
    const approvals = await this.tradingOps.operatorViews.buildPendingApprovals(
      this.dataStore.getApprovals()
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(approvals));
  }

  private async handleGetRiskState(res: http.ServerResponse) {
    const riskState = this.riskStateService.getCurrentState();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(riskState));
  }

  private async handleGetEnhancedDashboard(res: http.ServerResponse) {
    const dashboard = await this.dashboardProjection.buildEnhancedDashboard(
      this.dataStore.getApprovals(),
      this.dataStore.getIncidents(),
      [],
      this.dataStore.getApprovals()
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboard));
  }

  private async handleGetEvents(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const severity = url.searchParams.get('severity');
    const source = url.searchParams.get('source');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const events = this.eventIngest.getEventHistory({ type, severity, source, limit });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events, count: events.length }));
  }

  private async handleGetEventsStats(res: http.ServerResponse) {
    const stats = this.eventIngest.getStats();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalEvents: stats.totalEvents,
      byType: Object.fromEntries(stats.byType),
      bySeverity: Object.fromEntries(stats.bySeverity),
      bySource: Object.fromEntries(stats.bySource),
      last24h: stats.last24h,
    }));
  }

  private async handleGitHubWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('github', 'github_actions', payload);

    // 处理解析后的事件
    if (result.eventsAccepted > 0) {
      const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
      for (const event of events.slice(-result.eventsAccepted)) {
        await this.tradingOps.processEvent(event);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleTradingSystemWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('trading_system', 'trading_core', payload);

    // 处理解析后的事件
    if (result.eventsAccepted > 0) {
      const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
      for (const event of events.slice(-result.eventsAccepted)) {
        await this.tradingOps.processEvent(event);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleMonitoringWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('monitoring', 'prometheus', payload);

    // 处理解析后的事件
    if (result.eventsAccepted > 0) {
      const events = this.eventIngest.getEventHistory({ limit: result.eventsAccepted });
      for (const event of events.slice(-result.eventsAccepted)) {
        await this.tradingOps.processEvent(event);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleExecuteRunbookAction(actionId: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.runbookActions.executeAction(actionId, payload.executedBy || 'system');

    // 如果执行成功，更新相关状态
    if (result.success) {
      const action = this.runbookActions.getActionHistory().find((a) => a.id === actionId);
      if (action && action.target.type === 'incident') {
        // 更新 Incident 状态
        if (action.type === 'acknowledge') {
          this.dataStore.acknowledgeIncident(action.target.id);
        } else if (action.type === 'request_recovery') {
          this.dataStore.resolveIncident(action.target.id, 'Recovery requested');
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleRecordBreach(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const breachId = this.riskStateService.recordBreach(
      payload.metric || 'unknown',
      payload.threshold || 'unknown',
      payload.value || 'unknown',
      payload.severity || 'medium'
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, breachId }));
  }

  private async handleCreateRunbookAction(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const action = this.runbookActions.createAction(
      payload.type,
      payload.target,
      payload.parameters
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, action }));
  }

  private async handleGetRunbookAction(actionId: string, res: http.ServerResponse) {
    const history = this.runbookActions.getActionHistory();
    const action = history.find((a) => a.id === actionId);

    if (!action) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Action not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(action));
  }

  private async handleAcknowledgeIncident(incidentId: string, res: http.ServerResponse) {
    // 更新数据状态
    this.dataStore.acknowledgeIncident(incidentId);

    // 创建 Runbook Action 记录
    const action = this.runbookActions.createAction('acknowledge', { type: 'incident', id: incidentId });
    await this.runbookActions.executeAction(action.id, 'system');

    // 记录风险状态
    this.riskStateService.recordBreach(
      `incident_${incidentId}`,
      'acknowledged',
      'true',
      'low'
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, acknowledged: true, actionId: action.id }));
  }

  private async handleResolveIncident(incidentId: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    this.dataStore.resolveIncident(incidentId, payload.resolution);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, resolved: true }));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createTradingHttpServer(config: TradingHttpServerConfig): TradingHttpServer {
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
