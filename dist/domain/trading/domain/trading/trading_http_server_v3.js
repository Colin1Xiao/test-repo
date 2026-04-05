"use strict";
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
exports.TradingHttpServer = void 0;
exports.createTradingHttpServer = createTradingHttpServer;
// @ts-ignore
const http = __importStar(require("http"));
// @ts-ignore
const url_1 = require("url");
// @ts-ignore
const path = __importStar(require("path"));
const trading_ops_pack_1 = require("./trading_ops_pack");
const trading_runbook_actions_1 = require("./trading_runbook_actions");
const trading_risk_state_service_1 = require("./trading_risk_state_service");
const trading_dashboard_projection_1 = require("./trading_dashboard_projection");
const trading_event_ingest_1 = require("./trading_event_ingest");
const approval_repository_1 = require("../../infrastructure/persistence/approval_repository");
const incident_repository_1 = require("../../infrastructure/persistence/incident_repository");
const event_repository_1 = require("../../infrastructure/persistence/event_repository");
const audit_log_service_1 = require("../../infrastructure/persistence/audit_log_service");
const replay_engine_1 = require("../../infrastructure/persistence/replay_engine");
const recovery_engine_1 = require("../../infrastructure/persistence/recovery_engine");
const timeline_service_1 = require("../../infrastructure/persistence/timeline_service");
const policy_audit_service_1 = require("../../infrastructure/persistence/policy_audit_service");
const redis_client_1 = require("../../infrastructure/redis/redis_client");
const idempotency_manager_1 = require("../../infrastructure/idempotency/idempotency_manager");
const distributed_lock_1 = require("../../infrastructure/lock/distributed_lock");
const idempotency_middleware_1 = require("../../infrastructure/idempotency/idempotency_middleware");
// ============================================================================
// HTTP Server
// ============================================================================
class TradingHttpServer {
    constructor(config) {
        this.server = null;
        // Idempotency & Lock
        this.redis = null;
        this.idempotencyManager = null;
        this.distributedLock = null;
        this.idempotencyMiddleware = null;
        this.config = {
            port: config.port,
            basePath: config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath,
            environment: config.environment || 'mainnet',
            dataDir: config.dataDir || path.join(process.env.HOME || '/tmp', '.openclaw', 'trading-data'),
        };
        this.tradingOps = (0, trading_ops_pack_1.initializeTradingOpsPack)({
            environment: this.config.environment,
            autoCreateApproval: true,
            autoCreateIncident: true,
        });
        this.runbookActions = (0, trading_runbook_actions_1.createTradingRunbookActions)();
        this.riskStateService = (0, trading_risk_state_service_1.createTradingRiskStateService)();
        this.dashboardProjection = (0, trading_dashboard_projection_1.createTradingDashboardProjection)();
        this.eventIngest = (0, trading_event_ingest_1.createTradingEventIngest)();
        // Initialize Persistence Repositories
        this.approvalRepository = (0, approval_repository_1.createApprovalRepository)(this.config.dataDir);
        this.incidentRepository = (0, incident_repository_1.createIncidentRepository)(this.config.dataDir);
        this.eventRepository = (0, event_repository_1.createEventRepository)(this.config.dataDir);
        this.auditLogService = (0, audit_log_service_1.createAuditLogService)(this.config.dataDir);
        // Initialize Engines
        this.replayEngine = (0, replay_engine_1.createReplayEngine)(this.eventRepository, this.approvalRepository, this.incidentRepository);
        this.recoveryEngine = (0, recovery_engine_1.createRecoveryEngine)(this.approvalRepository, this.incidentRepository, this.eventRepository, this.auditLogService);
        // Initialize Services
        this.timelineService = (0, timeline_service_1.createTimelineService)(this.auditLogService, this.approvalRepository, this.incidentRepository, this.eventRepository);
        this.policyAuditService = (0, policy_audit_service_1.createPolicyAuditService)(this.auditLogService);
        // Initialize Idempotency & Lock (可选，Redis 可用时启用)
        this.initializeIdempotency();
    }
    /**
     * 初始化幂等性和锁
     */
    async initializeIdempotency() {
        try {
            const redisConfig = (0, redis_client_1.getDefaultRedisConfig)();
            this.redis = (0, redis_client_1.createRedisClient)(redisConfig);
            // 检查 Redis 连接
            const ping = await this.redis.ping();
            if (ping === 'PONG') {
                console.log('[TradingHttpServer] Redis connected');
                const keyGenerator = (0, idempotency_manager_1.createIdempotencyKeyGenerator)('openclaw');
                const lockGenerator = (0, distributed_lock_1.createLockKeyGenerator)('openclaw');
                this.idempotencyManager = (0, idempotency_manager_1.createIdempotencyManager)(this.redis);
                this.distributedLock = (0, distributed_lock_1.createDistributedLock)(this.redis, { defaultTtlMs: 30000 });
                this.idempotencyMiddleware = (0, idempotency_middleware_1.createIdempotencyMiddleware)({
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
            }
            else {
                console.warn('[TradingHttpServer] Redis ping failed, idempotency disabled');
            }
        }
        catch (error) {
            console.warn('[TradingHttpServer] Redis connection failed, idempotency disabled:', error);
        }
    }
    async start() {
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
    async stop() {
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
    async handleRequest(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
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
        }
        catch (error) {
            console.error('[TradingHttpServer] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : String(error) }));
        }
    }
    // ============================================================================
    // Event Handlers
    // ============================================================================
    async handleTradingEvent(req, res) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString());
        const event = {
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
        await this.auditLogService.log('event_created', event.actor, { type: 'event', id: event.type }, { eventType: event.type, severity: event.severity }, { success: true });
        // Process event through trading ops
        const result = await this.tradingOps.processEvent(event);
        // Store approval if created
        if (result.approval) {
            await this.approvalRepository.create(result.approval);
            await this.auditLogService.log('approval_created', event.actor, { type: 'approval', id: result.approval.approvalId }, { scope: result.approval.scope }, { success: true });
        }
        // Store incident if created
        if (result.incident) {
            await this.incidentRepository.create(result.incident);
            await this.auditLogService.log('incident_created', event.actor, { type: 'incident', id: result.incident.incidentId }, { type: result.incident.type, severity: result.incident.severity }, { success: true });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            approvalCreated: !!result.approval,
            incidentCreated: !!result.incident,
        }));
    }
    async handleGetEvents(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const type = url.searchParams.get('type');
        const severity = url.searchParams.get('severity');
        const source = url.searchParams.get('source');
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const events = await this.eventRepository.getRecent(24, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events, count: events.length }));
    }
    async handleGetEventsStats(res) {
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
    // Replay Engine Handlers
    // ============================================================================
    async handleReplayPlan(req, res) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const query = JSON.parse(Buffer.concat(chunks).toString());
        const plan = await this.replayEngine.generatePlan(query);
        // Audit log
        await this.auditLogService.log('replay_plan_generated', { userId: 'operator', username: 'operator' }, { type: 'replay_plan', id: `plan_${Date.now()}` }, { estimatedEvents: plan.estimatedEvents }, { success: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(plan));
    }
    async handleReplayRun(req, res) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const query = JSON.parse(Buffer.concat(chunks).toString());
        // 默认 dry-run 模式
        if (!query.mode) {
            query.mode = 'dry-run';
        }
        // 幂等保护（如果启用）
        if (this.idempotencyMiddleware) {
            const targetId = query.correlationId || `${query.targetType || 'unknown'}:${Date.now()}`;
            const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(req, 'replay', targetId);
            if (!shouldContinue) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(existingResponse));
                return;
            }
            try {
                const result = await this.executeReplayRunInternal(req, res, query);
                await this.idempotencyManager.complete(context.idempotencyKey, { response: result });
                if (context.lockAcquired && context.lockKey) {
                    await this.distributedLock.release(context.lockKey, context.ownerId);
                }
                return;
            }
            catch (error) {
                await this.idempotencyManager.fail(context.idempotencyKey, error);
                throw error;
            }
        }
        // 无幂等保护，直接执行
        const result = await this.executeReplayRunInternal(req, res, query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async executeReplayRunInternal(req, res, query) {
        // Audit log
        await this.auditLogService.log('replay_started', { userId: 'operator', username: 'operator' }, { type: 'replay', id: `replay_${Date.now()}` }, { mode: query.mode, correlationId: query.correlationId }, { success: true });
        const result = await this.replayEngine.replay(query);
        // Audit log
        await this.auditLogService.log('replay_completed', { userId: 'operator', username: 'operator' }, { type: 'replay', id: `replay_${Date.now()}` }, { eventsProcessed: result.eventsProcessed, mode: result.mode }, { success: result.success });
        return result;
    }
    // ============================================================================
    // Idempotent Handlers
    // ============================================================================
    /**
     * 处理 Approval Resolve（带幂等保护）
     */
    async handleResolveApproval(req, res, approvalId) {
        if (!this.idempotencyMiddleware) {
            // 无幂等保护，直接处理
            await this.resolveApprovalInternal(req, res, approvalId);
            return;
        }
        const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(req, 'approval', approvalId);
        if (!shouldContinue) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(existingResponse));
            return;
        }
        try {
            await this.resolveApprovalInternal(req, res, approvalId);
            // 完成幂等记录（简化实现）
            await this.idempotencyManager.complete(context.idempotencyKey, { response: { success: true } });
            // 释放锁
            if (context.lockAcquired && context.lockKey) {
                await this.distributedLock.release(context.lockKey, context.ownerId);
            }
        }
        catch (error) {
            await this.idempotencyManager.fail(context.idempotencyKey, error);
            throw error;
        }
    }
    async resolveApprovalInternal(req, res, approvalId) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const result = await this.approvalRepository.updateStatus(approvalId, payload.status || 'approved', payload.approver || 'system', payload.reason);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!result, approval: result }));
    }
    /**
     * 处理 Incident Acknowledge（带幂等保护）
     */
    async handleAcknowledgeIncident(req, res, incidentId) {
        if (!this.idempotencyMiddleware) {
            await this.acknowledgeIncidentInternal(req, res, incidentId);
            return;
        }
        const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(req, 'incident', incidentId);
        if (!shouldContinue) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(existingResponse));
            return;
        }
        try {
            await this.acknowledgeIncidentInternal(req, res, incidentId);
            await this.idempotencyManager.complete(context.idempotencyKey, { response: { success: true } });
            if (context.lockAcquired && context.lockKey) {
                await this.distributedLock.release(context.lockKey, context.ownerId);
            }
        }
        catch (error) {
            await this.idempotencyManager.fail(context.idempotencyKey, error);
            throw error;
        }
    }
    async acknowledgeIncidentInternal(req, res, incidentId) {
        const incident = await this.incidentRepository.acknowledge(incidentId, 'system');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!incident, incident }));
    }
    /**
     * 处理 Incident Resolve（带幂等保护）
     */
    async handleResolveIncident(req, res, incidentId) {
        if (!this.idempotencyMiddleware) {
            await this.resolveIncidentInternal(req, res, incidentId);
            return;
        }
        const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(req, 'incident', incidentId);
        if (!shouldContinue) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(existingResponse));
            return;
        }
        try {
            await this.resolveIncidentInternal(req, res, incidentId);
            await this.idempotencyManager.complete(context.idempotencyKey, { response: { success: true } });
            if (context.lockAcquired && context.lockKey) {
                await this.distributedLock.release(context.lockKey, context.ownerId);
            }
        }
        catch (error) {
            await this.idempotencyManager.fail(context.idempotencyKey, error);
            throw error;
        }
    }
    async resolveIncidentInternal(req, res, incidentId) {
        const body = [];
        for await (const chunk of req)
            body.push(chunk);
        const payload = JSON.parse(Buffer.concat(body).toString());
        const incident = await this.incidentRepository.resolve(incidentId, 'system', payload.resolution);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !!incident, incident }));
    }
    // ============================================================================
    // Dashboard Handlers
    // ============================================================================
    async handleGetDashboard(res) {
        const [approvals, incidents] = await Promise.all([
            this.approvalRepository.query({ limit: 50 }),
            this.incidentRepository.query({ limit: 50 }),
        ]);
        const dashboard = await this.dashboardProjection.buildEnhancedDashboard(approvals.approvals, incidents.incidents, [], approvals.approvals);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dashboard));
    }
    async handleGetIncidents(res) {
        const result = await this.incidentRepository.query({ limit: 100 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetApprovals(res) {
        const result = await this.approvalRepository.query({ limit: 100 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetRiskState(res) {
        const riskState = this.riskStateService.getCurrentState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(riskState));
    }
    // ============================================================================
    // Recovery Engine Handlers
    // ============================================================================
    async handleRecoveryScan(req, res) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const config = JSON.parse(Buffer.concat(chunks).toString());
        // 幂等保护（如果启用）
        if (this.idempotencyMiddleware) {
            const scope = config.scope || `global:${Date.now()}`;
            const { context, shouldContinue, existingResponse } = await this.idempotencyMiddleware.begin(req, 'recovery', scope);
            if (!shouldContinue) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(existingResponse));
                return;
            }
            try {
                const result = await this.executeRecoveryScanInternal(req, res, config);
                await this.idempotencyManager.complete(context.idempotencyKey, { response: result });
                if (context.lockAcquired && context.lockKey) {
                    await this.distributedLock.release(context.lockKey, context.ownerId);
                }
                return result;
            }
            catch (error) {
                await this.idempotencyManager.fail(context.idempotencyKey, error);
                throw error;
            }
        }
        // 无幂等保护，直接执行
        return await this.executeRecoveryScanInternal(req, res, config);
    }
    async executeRecoveryScanInternal(req, res, config) {
        // Audit log
        await this.auditLogService.log('recovery_scan_started', { userId: 'operator', username: 'operator' }, { type: 'recovery_scan', id: `scan_${Date.now()}` }, { config }, { success: true });
        const result = await this.recoveryEngine.scan();
        // Audit log
        await this.auditLogService.log('recovery_scan_completed', { userId: 'operator', username: 'operator' }, { type: 'recovery_scan', id: `scan_${Date.now()}` }, { recovered: result.recovered, orphanedCount: result.orphanedObjects.length }, { success: result.success });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return result;
    }
    async handleRecoveryRebuild(req, res) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const config = JSON.parse(Buffer.concat(chunks).toString());
        // Audit log
        await this.auditLogService.log('recovery_rebuild_started', { userId: 'operator', username: 'operator' }, { type: 'recovery_rebuild', id: `rebuild_${Date.now()}` }, { config, scope: config.scope }, { success: true });
        // 第一版先做扫描，rebuild 逻辑后续扩展
        const result = await this.recoveryEngine.scan();
        // Audit log
        await this.auditLogService.log('recovery_rebuild_completed', { userId: 'operator', username: 'operator' }, { type: 'recovery_rebuild', id: `rebuild_${Date.now()}` }, { recovered: result.recovered }, { success: result.success });
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
    async handleGetTimeline(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const query = {};
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');
        const actorId = url.searchParams.get('actorId');
        const targetType = url.searchParams.get('targetType');
        const targetId = url.searchParams.get('targetId');
        const correlationId = url.searchParams.get('correlationId');
        const sortOrder = url.searchParams.get('sortOrder');
        if (limit)
            query.limit = parseInt(limit, 10);
        if (offset)
            query.offset = parseInt(offset, 10);
        if (actorId)
            query.actorId = actorId;
        if (targetType)
            query.targetType = targetType;
        if (targetId)
            query.targetId = targetId;
        if (correlationId)
            query.correlationId = correlationId;
        if (sortOrder)
            query.sortOrder = sortOrder;
        const result = await this.timelineService.getTimeline(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetObjectTimeline(targetType, targetId, res) {
        const items = await this.timelineService.getObjectTimeline(targetType, targetId, 100);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ items, total: items.length }));
    }
    // ============================================================================
    // Policy Audit Handlers
    // ============================================================================
    async handleGetPolicyAudit(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const query = {};
        if (url.searchParams.get('limit'))
            query.limit = parseInt(url.searchParams.get('limit'), 10);
        if (url.searchParams.get('offset'))
            query.offset = parseInt(url.searchParams.get('offset'), 10);
        if (url.searchParams.get('actorId'))
            query.actorId = url.searchParams.get('actorId');
        if (url.searchParams.get('action'))
            query.action = url.searchParams.get('action');
        if (url.searchParams.get('targetType'))
            query.targetType = url.searchParams.get('targetType');
        if (url.searchParams.get('targetId'))
            query.targetId = url.searchParams.get('targetId');
        if (url.searchParams.get('decision'))
            query.decision = url.searchParams.get('decision');
        const result = await this.policyAuditService.query(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }
    async handleGetHighRiskAudit(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const timeRangeHours = parseInt(url.searchParams.get('timeRangeHours') || '24', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const entries = await this.policyAuditService.getHighRiskActions(timeRangeHours, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ entries, total: entries.length }));
    }
    async handleGetPolicyAuditStats(req, res) {
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        const timeRangeHours = parseInt(url.searchParams.get('timeRangeHours') || '24', 10);
        const stats = await this.policyAuditService.getDecisionStats(timeRangeHours);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }
}
exports.TradingHttpServer = TradingHttpServer;
// ============================================================================
// Factory Function
// ============================================================================
function createTradingHttpServer(config) {
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
