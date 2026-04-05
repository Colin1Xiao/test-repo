/**
 * Trading HTTP Server V2
 * Phase 2E-1 - 集成持久化存储
 * 
 * 职责：
 * - 使用 Repositories 代替内存存储
 * - 集成 Audit Log 记录
 * - 提供 Trading Dashboard 端点
 */

import * as http from 'http';
import { URL } from 'url';
import * as path from 'path';
import { initializeTradingOpsPack } from './trading_ops_pack';
import { createTradingRunbookActions } from './trading_runbook_actions';
import { createTradingRiskStateService } from './trading_risk_state_service';
import { createTradingDashboardProjection } from './trading_dashboard_projection';
import { createTradingEventIngest } from './trading_event_ingest';
import { createApprovalRepository } from '../../infrastructure/persistence/approval_repository';
import { createIncidentRepository } from '../../infrastructure/persistence/incident_repository';
import { createEventRepository } from '../../infrastructure/persistence/event_repository';
import { createAuditLogService } from '../../infrastructure/persistence/audit_log_service';
import type { TradingEvent } from './trading_types';

// ============================================================================
// 配置
// ============================================================================

export interface TradingHttpServerConfig {
  port: number;
  basePath: string;
  environment?: 'testnet' | 'mainnet';
  dataDir?: string;
}

// ============================================================================
// HTTP Server
// ============================================================================

export class TradingHttpServer {
  private config: Required<TradingHttpServerConfig>;
  private server: http.Server | null = null;
  private tradingOps: any;
  private runbookActions: ReturnType<typeof createTradingRunbookActions>;
  private riskStateService: ReturnType<typeof createTradingRiskStateService>;
  private dashboardProjection: ReturnType<typeof createTradingDashboardProjection>;
  private eventIngest: ReturnType<typeof createTradingEventIngest>;
  
  // Persistence Repositories
  private approvalRepository: ReturnType<typeof createApprovalRepository>;
  private incidentRepository: ReturnType<typeof createIncidentRepository>;
  private eventRepository: ReturnType<typeof createEventRepository>;
  private auditLogService: ReturnType<typeof createAuditLogService>;

  constructor(config: TradingHttpServerConfig) {
    this.config = {
      port: config.port,
      basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
      environment: config.environment || 'mainnet',
      dataDir: config.dataDir || path.join(process.env.HOME || '/tmp', '.openclaw', 'trading-data'),
    };

    this.tradingOps = initializeTradingOpsPack({
      environment: this.config.environment,
      autoCreateApproval: true,
      autoCreateIncident: true,
    });

    this.runbookActions = createTradingRunbookActions();
    this.riskStateService = createTradingRiskStateService();
    this.dashboardProjection = createTradingDashboardProjection();
    this.eventIngest = createTradingEventIngest();
    
    // Initialize Persistence Repositories
    this.approvalRepository = createApprovalRepository(this.config.dataDir);
    this.incidentRepository = createIncidentRepository(this.config.dataDir);
    this.eventRepository = createEventRepository(this.config.dataDir);
    this.auditLogService = createAuditLogService(this.config.dataDir);
  }

  async start(): Promise<void> {
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
    } catch (error) {
      console.error('[TradingHttpServer] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : String(error) }));
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private async handleTradingEvent(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const event: TradingEvent = {
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
    await this.auditLogService.log(
      'event_created',
      event.actor,
      { type: 'event', id: event.type },
      { eventType: event.type, severity: event.severity },
      { success: true }
    );

    // Process event through trading ops
    const result = await this.tradingOps.processEvent(event);

    // Store approval if created
    if (result.approval) {
      await this.approvalRepository.create(result.approval);
      await this.auditLogService.log(
        'approval_created',
        event.actor,
        { type: 'approval', id: result.approval.approvalId },
        { scope: result.approval.scope },
        { success: true }
      );
    }

    // Store incident if created
    if (result.incident) {
      await this.incidentRepository.create(result.incident);
      await this.auditLogService.log(
        'incident_created',
        event.actor,
        { type: 'incident', id: result.incident.incidentId },
        { type: result.incident.type, severity: result.incident.severity },
        { success: true }
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      approvalCreated: !!result.approval,
      incidentCreated: !!result.incident,
    }));
  }

  private async handleGetEvents(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const severity = url.searchParams.get('severity');
    const source = url.searchParams.get('source');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const events = await this.eventRepository.getRecent(24, limit);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events, count: events.length }));
  }

  private async handleGetEventsStats(res: http.ServerResponse) {
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

  private async handleGitHubWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('github', 'github_actions', payload);

    // Audit log
    await this.auditLogService.log(
      'webhook_received',
      { userId: 'system', username: 'github' },
      { type: 'webhook', id: 'github_actions' },
      { eventsProcessed: result.eventsProcessed },
      { success: result.success }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleTradingSystemWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('trading_system', 'trading_core', payload);

    await this.auditLogService.log(
      'webhook_received',
      { userId: 'system', username: 'trading_system' },
      { type: 'webhook', id: 'trading_core' },
      { eventsProcessed: result.eventsProcessed },
      { success: result.success }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleMonitoringWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.eventIngest.ingestWebhook('monitoring', 'prometheus', payload);

    await this.auditLogService.log(
      'webhook_received',
      { userId: 'system', username: 'prometheus' },
      { type: 'webhook', id: 'prometheus' },
      { eventsProcessed: result.eventsProcessed },
      { success: result.success }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  // ============================================================================
  // Dashboard Handlers
  // ============================================================================

  private async handleGetDashboard(res: http.ServerResponse) {
    const [approvals, incidents] = await Promise.all([
      this.approvalRepository.query({ limit: 50 }),
      this.incidentRepository.query({ limit: 50 }),
    ]);

    const dashboard = await this.dashboardProjection.buildEnhancedDashboard(
      approvals.approvals,
      incidents.incidents,
      [],
      approvals.approvals
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboard));
  }

  private async handleGetEnhancedDashboard(res: http.ServerResponse) {
    const [approvals, incidents] = await Promise.all([
      this.approvalRepository.query({ limit: 50 }),
      this.incidentRepository.query({ limit: 50 }),
    ]);

    const dashboard = await this.dashboardProjection.buildEnhancedDashboard(
      approvals.approvals,
      incidents.incidents,
      [],
      approvals.approvals
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboard));
  }

  private async handleGetIncidents(res: http.ServerResponse) {
    const result = await this.incidentRepository.query({ limit: 100 });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleGetApprovals(res: http.ServerResponse) {
    const result = await this.approvalRepository.query({ limit: 100 });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleGetRiskState(res: http.ServerResponse) {
    const riskState = this.riskStateService.getCurrentState();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(riskState));
  }

  // ============================================================================
  // Incident Handlers
  // ============================================================================

  private async handleAcknowledgeIncident(incidentId: string, res: http.ServerResponse) {
    const incident = await this.incidentRepository.acknowledge(incidentId, 'system');

    if (!incident) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Incident not found' }));
      return;
    }

    // Audit log
    await this.auditLogService.log(
      'incident_acknowledged',
      { userId: 'system', username: 'system' },
      { type: 'incident', id: incidentId },
      { incidentType: incident.type },
      { success: true }
    );

    // Create runbook action record
    const action = this.runbookActions.createAction('acknowledge', { type: 'incident', id: incidentId });
    await this.runbookActions.executeAction(action.id, 'system');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, acknowledged: true, actionId: action.id }));
  }

  private async handleResolveIncident(incidentId: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const incident = await this.incidentRepository.resolve(incidentId, 'system', payload.resolution);

    if (!incident) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Incident not found' }));
      return;
    }

    // Audit log
    await this.auditLogService.log(
      'incident_resolved',
      { userId: 'system', username: 'system' },
      { type: 'incident', id: incidentId },
      { incidentType: incident.type, resolution: payload.resolution },
      { success: true }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, resolved: true }));
  }

  // ============================================================================
  // Runbook Action Handlers
  // ============================================================================

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

  private async handleExecuteRunbookAction(actionId: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());

    const result = await this.runbookActions.executeAction(actionId, payload.executedBy || 'system');

    // Audit log for high-risk actions
    if (result.success) {
      const action = this.runbookActions.getActionHistory().find((a) => a.id === actionId);
      if (action) {
        await this.auditLogService.log(
          'runbook_action_executed',
          { userId: payload.executedBy || 'system', username: payload.executedBy || 'system' },
          { type: 'runbook_action', id: actionId },
          { actionType: action.type, target: action.target },
          { success: true }
        );
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  // ============================================================================
  // Risk State Handlers
  // ============================================================================

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

    // Audit log
    await this.auditLogService.log(
      'risk_breach_recorded',
      { userId: 'system', username: 'system' },
      { type: 'risk_breach', id: breachId },
      { metric: payload.metric, value: payload.value, threshold: payload.threshold },
      { success: true }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, breachId }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTradingHttpServer(config: TradingHttpServerConfig): TradingHttpServer {
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
