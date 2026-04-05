/**
 * Trading HTTP Server V3
 * Phase 2E-2 - 集成 Replay/Recovery Engine
 * 
 * 职责：
 * - 提供 Trading Dashboard 端点
 * - 提供 Replay Engine 端点
 * - 提供 Recovery Engine 端点
 * - 集成审计日志
 */

// @ts-ignore
import * as http from 'http';
// @ts-ignore
import { URL } from 'url';
// @ts-ignore
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
import { createReplayEngine, type ReplayQuery, type ReplayMode } from '../../infrastructure/persistence/replay_engine';
import { createRecoveryEngine } from '../../infrastructure/persistence/recovery_engine';
import { createTimelineService } from '../../infrastructure/persistence/timeline_service';
import { createPolicyAuditService } from '../../infrastructure/persistence/policy_audit_service';
import { createRedisClient, getDefaultRedisConfig } from '../../infrastructure/redis/redis_client';
import { createIdempotencyManager, createIdempotencyKeyGenerator } from '../../infrastructure/idempotency/idempotency_manager';
import { createDistributedLock, createLockKeyGenerator } from '../../infrastructure/lock/distributed_lock';
import { createIdempotencyMiddleware } from '../../infrastructure/idempotency/idempotency_middleware';
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
  
  // Engines
  private replayEngine: ReturnType<typeof createReplayEngine>;
  private recoveryEngine: ReturnType<typeof createRecoveryEngine>;
  private timelineService: ReturnType<typeof createTimelineService>;
  private policyAuditService: ReturnType<typeof createPolicyAuditService>;
  
  // Idempotency & Lock
  private redis: ReturnType<typeof createRedisClient> | null = null;
  private idempotencyManager: ReturnType<typeof createIdempotencyManager> | null = null;
  private distributedLock: ReturnType<typeof createDistributedLock> | null = null;
  private idempotencyMiddleware: ReturnType<typeof createIdempotencyMiddleware> | null = null;

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
    
    // Initialize Engines
    this.replayEngine = createReplayEngine(
      this.eventRepository,
      this.approvalRepository,
      this.incidentRepository
    );
    
    this.recoveryEngine = createRecoveryEngine(
      this.approvalRepository,
      this.incidentRepository,
      this.eventRepository,
      this.auditLogService
    );
    
    // Initialize Services
    this.timelineService = createTimelineService(
      this.auditLogService,
      this.approvalRepository,
      this.incidentRepository,
      this.eventRepository
    );
    
    this.policyAuditService = createPolicyAuditService(
      this.auditLogService
    );
    
    // Initialize Idempotency & Lock (可选，Redis 可用时启用)
    this.initializeIdempotency();
  }
  
  /**
   * 初始化幂等性和锁
   */
  private async initializeIdempotency(): Promise<void> {
    try {
      const redisConfig = getDefaultRedisConfig();
      this.redis = createRedisClient(redisConfig);
      
      // 检查 Redis 连接
      const ping = await this.redis.ping();
      if (ping === 'PONG') {
        console.log('[TradingHttpServer] Redis connected');
        
        const keyGenerator = createIdempotencyKeyGenerator('openclaw');
        const lockGenerator = createLockKeyGenerator('openclaw');
        
        this.idempotencyManager = createIdempotencyManager(this.redis);
        this.distributedLock = createDistributedLock(this.redis, { defaultTtlMs: 30000 });
        
        this.idempotencyMiddleware = createIdempotencyMiddleware({
          keyGenerator,
          lockGenerator,
          idempotencyManager: this.idempotencyManager,
          lock: this.distributedLock,
          lockTtlMs: 30000,
          auditLog: async (event) => {
            console.log('[IdempotencyAudit]', event.type, event.key, event.ownerId || '');
          },
        });
        
        console.log('[TradingHttpServer] Idempotency & Lock enabled');
      } else {
        console.warn('[TradingHttpServer] Redis ping failed, idempotency disabled');
      }
    } catch (error) {
      console.warn('[TradingHttpServer] Redis connection failed, idempotency disabled:', error);
    }
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
        console.log(`  POST ${this.config.basePath}/trading/replay/plan`);
        console.log(`  POST ${this.config.basePath}/trading/replay/run`);
        console.log(`  POST ${this.config.basePath}/trading/recovery/scan`);
        console.log(`  POST ${this.config.basePath}/trading/recovery/rebuild`);
        console.log(`  GET  ${this.config.basePath}/trading/timeline`);
        console.log(`  GET  ${this.config.basePath}/trading/timeline/:targetType/:targetId`);
        console.log(`  GET  ${this.config.basePath}/trading/policy-audit`);
        console.log(`  GET  ${this.config.basePath}/trading/policy-audit/high-risk`);
        console.log(`  GET  ${this.config.basePath}/trading/policy-audit/stats`);
        console.log(`  GET  ${this.config.basePath}/trading/dashboard`);
        console.log(`  GET  ${this.config.basePath}/trading/incidents`);
        console.log(`  GET  ${this.config.basePath}/trading/approvals`);
        console.log(`  GET  ${this.config.basePath}/trading/risk-state`);
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
      // Trading Events
      if (path === `${this.config.basePath}/trading/events` && method === 'POST') {
        await this.handleTradingEvent(req, res);
      }
      else if (path === `${this.config.basePath}/trading/events` && method === 'GET') {
        await this.handleGetEvents(req, res);
      }
      else if (path === `${this.config.basePath}/trading/events/stats` && method === 'GET') {
        await this.handleGetEventsStats(res);
      }
      // Replay Engine
      else if (path === `${this.config.basePath}/trading/replay/plan` && method === 'POST') {
        await this.handleReplayPlan(req, res);
      }
      else if (path === `${this.config.basePath}/trading/replay/run` && method === 'POST') {
        await this.handleReplayRun(req, res);
      }
      // Recovery Engine
      else if (path === `${this.config.basePath}/trading/recovery/scan` && method === 'POST') {
        await this.handleRecoveryScan(req, res);
      }
      else if (path === `${this.config.basePath}/trading/recovery/rebuild` && method === 'POST') {
        await this.handleRecoveryRebuild(req, res);
      }
      // Timeline
      else if (path === `${this.config.basePath}/trading/timeline` && method === 'GET') {
        await this.handleGetTimeline(req, res);
      }
      else if (path.match(/\/trading\/timeline\/[^/]+\/[^/]+/) && method === 'GET') {
        const parts = path.split('/');
        const targetType = parts[4];
        const targetId = parts[5];
        await this.handleGetObjectTimeline(targetType, targetId, res);
      }
      // Policy Audit
      else if (path === `${this.config.basePath}/trading/policy-audit` && method === 'GET') {
        await this.handleGetPolicyAudit(req, res);
      }
      else if (path === `${this.config.basePath}/trading/policy-audit/high-risk` && method === 'GET') {
        await this.handleGetHighRiskAudit(req, res);
      }
      else if (path === `${this.config.basePath}/trading/policy-audit/stats` && method === 'GET') {
        await this.handleGetPolicyAuditStats(req, res);
      }
      // Dashboard
      else if (path === `${this.config.basePath}/trading/dashboard` && method === 'GET') {
        await this.handleGetDashboard(res);
      }
      else if (path === `${this.config.basePath}/trading/incidents` && method === 'GET') {
        await this.handleGetIncidents(res);
      }
      else if (path === `${this.config.basePath}/trading/approvals` && method === 'GET') {
        await this.handleGetApprovals(res);
      }
      else if (path === `${this.config.basePath}/trading/risk-state` && method === 'GET') {
        await this.handleGetRiskState(res);
      }
      // Approval Resolve (带幂等保护)
      else if (path.match(/\/trading\/approvals\/[^/]+\/resolve/) && method === 'POST') {
        const parts = path.split('/');
        const approvalId = parts[4];
        await this.handleResolveApproval(req, res, approvalId);
      }
      // Incident Acknowledge (带幂等保护)
      else if (path.match(/\/trading\/incidents\/[^/]+\/acknowledge/) && method === 'POST') {
        const parts = path.split('/');
        const incidentId = parts[4];
        await this.handleAcknowledgeIncident(req, res, incidentId);
      }
      // Incident Resolve (带幂等保护)
      else if (path.match(/\/trading\/incidents\/[^/]+\/resolve/) && method === 'POST') {
        const parts = path.split('/');
        const incidentId = parts[4];
        await this.handleResolveIncident(req, res, incidentId);
      }
      // Webhooks (带幂等保护)
      else if (path.match(/\/trading\/webhooks\//) && method === 'POST') {
        await this.handleWebhook(req, res);
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
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString());

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
      ...(event as any),
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
      last24h: (stats as any).last24h,
      processed: stats.processed,
      unprocessed: stats.unprocessed,
    }));
  }

  // ============================================================================
  // Replay Engine Handlers
  // ============================================================================

  private async handleReplayPlan(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const query: Omit<ReplayQuery, 'mode'> = JSON.parse(Buffer.concat(chunks).toString());

    const plan = await this.replayEngine.generatePlan(query);

    // Audit log
    await this.auditLogService.log(
      'replay_plan_generated',
      { userId: 'operator', username: 'operator' },
      { type: 'replay_plan', id: `plan_${Date.now()}` },
      { estimatedEvents: plan.estimatedEvents },
      { success: true }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(plan));
  }

  private async handleReplayRun(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const query: ReplayQuery = JSON.parse(Buffer.concat(chunks).toString());

    // 默认 dry-run 模式
    if (!query.mode) {
      query.mode = 'dry-run';
    }

    // 幂等保护（如果启用）
    if (this.idempotencyMiddleware) {
      const targetId = query.correlationId || `${query.targetType || 'unknown'}:${Date.now()}`;
      const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(
        req,
        'replay',
        targetId
      );

      if (!shouldContinue) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(existingResponse));
        return;
      }

      try {
        const result = await this.executeReplayRunInternal(req, res, query);
        await this.idempotencyManager!.complete(context.idempotencyKey, { response: result });
        if (context.lockAcquired && context.lockKey) {
          await this.distributedLock!.release(context.lockKey, context.ownerId);
        }
        return;
      } catch (error) {
        await this.idempotencyManager!.fail(context.idempotencyKey, error as Error);
        throw error;
      }
    }

    // 无幂等保护，直接执行
    const result = await this.executeReplayRunInternal(req, res, query);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async executeReplayRunInternal(req: http.IncomingMessage, res: http.ServerResponse, query: ReplayQuery) {
    // Audit log
    await this.auditLogService.log(
      'replay_started',
      { userId: 'operator', username: 'operator' },
      { type: 'replay', id: `replay_${Date.now()}` },
      { mode: query.mode, correlationId: query.correlationId },
      { success: true }
    );

    const result = await this.replayEngine.replay(query);

    // Audit log
    await this.auditLogService.log(
      'replay_completed',
      { userId: 'operator', username: 'operator' },
      { type: 'replay', id: `replay_${Date.now()}` },
      { eventsProcessed: result.eventsProcessed, mode: result.mode },
      { success: result.success }
    );

    return result;
  }

  // ============================================================================
  // Idempotent Handlers
  // ============================================================================
  
  /**
   * 处理 Approval Resolve（带幂等保护）
   */
  private async handleResolveApproval(req: http.IncomingMessage, res: http.ServerResponse, approvalId: string) {
    if (!this.idempotencyMiddleware) {
      // 无幂等保护，直接处理
      await this.resolveApprovalInternal(req, res, approvalId);
      return;
    }
    
    const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(
      req,
      'approval',
      approvalId
    );
    
    if (!shouldContinue) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(existingResponse));
      return;
    }
    
    try {
      await this.resolveApprovalInternal(req, res, approvalId);
      
      // 完成幂等记录（简化实现）
      await this.idempotencyManager!.complete(context.idempotencyKey, { response: { success: true } });
      
      // 释放锁
      if (context.lockAcquired && context.lockKey) {
        await this.distributedLock!.release(context.lockKey, context.ownerId);
      }
    } catch (error) {
      await this.idempotencyManager!.fail(context.idempotencyKey, error as Error);
      throw error;
    }
  }
  
  private async resolveApprovalInternal(req: http.IncomingMessage, res: http.ServerResponse, approvalId: string) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());
    
    const result = await this.approvalRepository.updateStatus(
      approvalId,
      payload.status || 'approved',
      payload.approver || 'system',
      payload.reason
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: !!result, approval: result }));
  }
  
  /**
   * 处理 Incident Acknowledge（带幂等保护）
   */
  private async handleAcknowledgeIncident(req: http.IncomingMessage, res: http.ServerResponse, incidentId: string) {
    if (!this.idempotencyMiddleware) {
      await this.acknowledgeIncidentInternal(req, res, incidentId);
      return;
    }
    
    const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(
      req,
      'incident',
      incidentId
    );
    
    if (!shouldContinue) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(existingResponse));
      return;
    }
    
    try {
      await this.acknowledgeIncidentInternal(req, res, incidentId);
      await this.idempotencyManager!.complete(context.idempotencyKey, { response: { success: true } });
      if (context.lockAcquired && context.lockKey) {
        await this.distributedLock!.release(context.lockKey, context.ownerId);
      }
    } catch (error) {
      await this.idempotencyManager!.fail(context.idempotencyKey, error as Error);
      throw error;
    }
  }
  
  private async acknowledgeIncidentInternal(req: http.IncomingMessage, res: http.ServerResponse, incidentId: string) {
    const incident = await this.incidentRepository.acknowledge(incidentId, 'system');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: !!incident, incident }));
  }
  
  /**
   * 处理 Incident Resolve（带幂等保护）
   */
  private async handleResolveIncident(req: http.IncomingMessage, res: http.ServerResponse, incidentId: string) {
    if (!this.idempotencyMiddleware) {
      await this.resolveIncidentInternal(req, res, incidentId);
      return;
    }
    
    const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(
      req,
      'incident',
      incidentId
    );
    
    if (!shouldContinue) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(existingResponse));
      return;
    }
    
    try {
      await this.resolveIncidentInternal(req, res, incidentId);
      await this.idempotencyManager!.complete(context.idempotencyKey, { response: { success: true } });
      if (context.lockAcquired && context.lockKey) {
        await this.distributedLock!.release(context.lockKey, context.ownerId);
      }
    } catch (error) {
      await this.idempotencyManager!.fail(context.idempotencyKey, error as Error);
      throw error;
    }
  }
  
  private async resolveIncidentInternal(req: http.IncomingMessage, res: http.ServerResponse, incidentId: string) {
    const body: any[] = [];
    for await (const chunk of req) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());
    
    const incident = await this.incidentRepository.resolve(incidentId, 'system', payload.resolution);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: !!incident, incident }));
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
  // Recovery Engine Handlers
  // ============================================================================

  private async handleRecoveryScan(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const config = JSON.parse(Buffer.concat(chunks).toString());

    // 幂等保护（如果启用）
    if (this.idempotencyMiddleware) {
      const scope = config.scope || `global:${Date.now()}`;
      const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(
        req,
        'recovery',
        scope
      );

      if (!shouldContinue) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(existingResponse));
        return;
      }

      try {
        const result = await this.executeRecoveryScanInternal(req, res, config);
        await this.idempotencyManager!.complete(context.idempotencyKey, { response: result });
        if (context.lockAcquired && context.lockKey) {
          await this.distributedLock!.release(context.lockKey, context.ownerId);
        }
        return result;
      } catch (error) {
        await this.idempotencyManager!.fail(context.idempotencyKey, error as Error);
        throw error;
      }
    }

    // 无幂等保护，直接执行
    return await this.executeRecoveryScanInternal(req, res, config);
  }

  private async executeRecoveryScanInternal(req: http.IncomingMessage, res: http.ServerResponse, config: any) {
    // Audit log
    await this.auditLogService.log(
      'recovery_scan_started',
      { userId: 'operator', username: 'operator' },
      { type: 'recovery_scan', id: `scan_${Date.now()}` },
      { config },
      { success: true }
    );

    const result = await this.recoveryEngine.scan();

    // Audit log
    await this.auditLogService.log(
      'recovery_scan_completed',
      { userId: 'operator', username: 'operator' },
      { type: 'recovery_scan', id: `scan_${Date.now()}` },
      { recovered: result.recovered, orphanedCount: result.orphanedObjects.length },
      { success: result.success }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return result;
  }

  private async handleRecoveryRebuild(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const config = JSON.parse(Buffer.concat(chunks).toString());

    // Audit log
    await this.auditLogService.log(
      'recovery_rebuild_started',
      { userId: 'operator', username: 'operator' },
      { type: 'recovery_rebuild', id: `rebuild_${Date.now()}` },
      { config, scope: config.scope },
      { success: true }
    );

    // 第一版先做扫描，rebuild 逻辑后续扩展
    const result = await this.recoveryEngine.scan();

    // Audit log
    await this.auditLogService.log(
      'recovery_rebuild_completed',
      { userId: 'operator', username: 'operator' },
      { type: 'recovery_rebuild', id: `rebuild_${Date.now()}` },
      { recovered: result.recovered },
      { success: result.success }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: result.success,
      summary: result.summary,
      note: 'Rebuild functionality will be expanded in future versions',
    }));
  }

  // ============================================================================
  // Timeline Handlers
  // ============================================================================

  private async handleGetTimeline(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const query: any = {};
    
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const actorId = url.searchParams.get('actorId');
    const targetType = url.searchParams.get('targetType');
    const targetId = url.searchParams.get('targetId');
    const correlationId = url.searchParams.get('correlationId');
    const sortOrder = url.searchParams.get('sortOrder');
    
    if (limit) query.limit = parseInt(limit, 10);
    if (offset) query.offset = parseInt(offset, 10);
    if (actorId) query.actorId = actorId;
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = targetId;
    if (correlationId) query.correlationId = correlationId;
    if (sortOrder) query.sortOrder = sortOrder as 'asc' | 'desc';
    
    const result = await this.timelineService.getTimeline(query);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleGetObjectTimeline(targetType: string, targetId: string, res: http.ServerResponse) {
    const items = await this.timelineService.getObjectTimeline(targetType, targetId, 100);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items, total: items.length }));
  }

  // ============================================================================
  // Policy Audit Handlers
  // ============================================================================

  private async handleGetPolicyAudit(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const query: any = {};
    
    if (url.searchParams.get('limit')) query.limit = parseInt(url.searchParams.get('limit')!, 10);
    if (url.searchParams.get('offset')) query.offset = parseInt(url.searchParams.get('offset')!, 10);
    if (url.searchParams.get('actorId')) query.actorId = url.searchParams.get('actorId');
    if (url.searchParams.get('action')) query.action = url.searchParams.get('action');
    if (url.searchParams.get('targetType')) query.targetType = url.searchParams.get('targetType');
    if (url.searchParams.get('targetId')) query.targetId = url.searchParams.get('targetId');
    if (url.searchParams.get('decision')) query.decision = url.searchParams.get('decision');
    
    const result = await this.policyAuditService.query(query);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleGetHighRiskAudit(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const timeRangeHours = parseInt(url.searchParams.get('timeRangeHours') || '24', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    const entries = await this.policyAuditService.getHighRiskActions(timeRangeHours, limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ entries, total: entries.length }));
  }

  private async handleGetPolicyAuditStats(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const timeRangeHours = parseInt(url.searchParams.get('timeRangeHours') || '24', 10);
    
    const stats = await this.policyAuditService.getDecisionStats(timeRangeHours);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
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
    port: parseInt(process.env.PORT || '3005', 10),
    basePath: process.env.BASE_PATH || '/api',
  });

  server.start().catch(console.error);

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}