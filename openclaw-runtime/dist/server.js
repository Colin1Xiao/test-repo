/**
 * 业务服务运行面：统一启动入口
 *
 * 整合所有能力到单一可启动服务：
 * - Trading 路由 (approval/incident/replay/recovery/webhook)
 * - Alerting 路由 (ingest/actions)
 * - Observability (health/metrics/config)
 * - Coordination (lock/idempotency)
 * - Timeline / Incident / Audit
 */
import express from 'express';
import { getConfig, loadConfig } from './config/runtime_config.js';
import { createMetricsRoutes } from './http/metrics.js';
import { createTradingRoutes } from './http/trading_routes.js';
import { createAlertingRoutes } from './http/alerting_routes.js';
import { httpMetricsMiddleware } from './metrics/http_metrics.js';
import { getIncidentFileRepository } from './persistence/incident_file_repository.js';
// ==================== Create Server ====================
export function createServer() {
    const app = express();
    // Middleware
    app.use(express.json());
    app.use(httpMetricsMiddleware());
    // Routes
    app.use('/health', createHealthRoute());
    app.use('/metrics', createMetricsRoutes());
    app.use('/config', createConfigRoute());
    app.use('/trading', createTradingRoutes());
    app.use('/alerting', createAlertingRoutes());
    // Recovery routes are initialized separately in startServer
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            error: 'Not Found',
            message: `Route ${req.method} ${req.path} not found`,
        });
    });
    // Error handler
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
        });
    });
    return app;
}
// ==================== Health Route ====================
function createHealthRoute() {
    const router = express.Router();
    router.get('/', (req, res) => {
        const config = getConfig();
        res.json({
            ok: true,
            status: 'live',
            version: config.NODE_ENV,
            timestamp: Date.now(),
        });
    });
    return router;
}
// ==================== Config Route ====================
function createConfigRoute() {
    const router = express.Router();
    router.get('/', (req, res) => {
        const config = getConfig();
        // Return non-sensitive config
        res.json({
            NODE_ENV: config.NODE_ENV,
            PORT: config.PORT,
            REDIS_KEY_PREFIX: config.REDIS_KEY_PREFIX,
            ENABLE_DISTRIBUTED_LOCK: config.ENABLE_DISTRIBUTED_LOCK,
            ENABLE_IDEMPOTENCY: config.ENABLE_IDEMPOTENCY,
            ENABLE_REPLAY: config.ENABLE_REPLAY,
            ENABLE_RECOVERY_SCAN: config.ENABLE_RECOVERY_SCAN,
            STRICT_COORDINATION_REQUIRED: config.STRICT_COORDINATION_REQUIRED,
            FALLBACK_ON_REDIS_DOWN: config.FALLBACK_ON_REDIS_DOWN,
            LOG_LEVEL: config.LOG_LEVEL,
            METRICS_ENABLED: config.METRICS_ENABLED,
        });
    });
    return router;
}
// ==================== Start Server ====================
export async function startServer() {
    // Note: This function is now async due to repository initialization
    // Load configuration
    const config = loadConfig();
    const serverConfig = {
        port: config.PORT,
        host: config.HOST || 'localhost',
        nodeEnv: config.NODE_ENV,
        metricsEnabled: config.METRICS_ENABLED,
        metricsPort: config.METRICS_PORT,
    };
    // Initialize file-backed repositories
    console.log('[Server] Initializing IncidentFileRepository...');
    const incidentRepo = getIncidentFileRepository();
    await incidentRepo.initialize();
    console.log(`[Server] IncidentFileRepository ready: ${incidentRepo.getStats().total} incidents loaded`);
    console.log('[Server] Initializing TimelineFileRepository...');
    const { getTimelineStore } = await import('./alerting/timeline_integration.js');
    const timelineStore = getTimelineStore();
    await timelineStore.initialize();
    console.log(`[Server] TimelineFileRepository ready: ${timelineStore.getStats().total} events loaded`);
    console.log('[Server] Initializing AuditFileRepository...');
    const { getAuditLogFileService } = await import('./persistence/audit_log_file_service.js');
    const auditService = getAuditLogFileService();
    await auditService.initialize();
    console.log(`[Server] AuditFileRepository ready: ${auditService.getStats().total} events loaded`);
    console.log('[Server] Initializing FileLock...');
    const { getFileLock } = await import('./persistence/file_lock.js');
    const fileLock = getFileLock();
    await fileLock.initialize();
    console.log(`[Server] FileLock ready: ${JSON.stringify(fileLock.getStats())}`);
    // Create and start server
    const app = createServer();
    app.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw Runtime Service Started                ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: ${serverConfig.nodeEnv.padEnd(42)} ║
║  Host: ${serverConfig.host.padEnd(47)} ║
║  Port: ${String(serverConfig.port).padEnd(48)} ║
║  Metrics: ${serverConfig.metricsEnabled ? 'Enabled' : 'Disabled'}${serverConfig.metricsEnabled && serverConfig.metricsPort ? ` (${serverConfig.metricsPort})` : ''}${' '.repeat(36 - (serverConfig.metricsEnabled ? 8 : 10))} ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║  - GET  /health                                           ║
║  - GET  /metrics                                          ║
║  - GET  /config                                           ║
║  - POST /trading/approvals/:id/resolve                    ║
║  - POST /trading/incidents/:id/acknowledge                ║
║  - POST /trading/incidents/:id/resolve                    ║
║  - POST /trading/replay/run                               ║
║  - POST /trading/recovery/scan                            ║
║  - POST /trading/webhooks/:provider/ingest                ║
║  - POST /alerting/ingest                                  ║
║  - POST /alerting/:id/acknowledge                         ║
║  - POST /alerting/:id/escalate                            ║
║  - POST /alerting/:id/link-incident                       ║
║  - POST /alerting/:id/open-runbook                        ║
╚═══════════════════════════════════════════════════════════╝
    `);
    });
}
// ==================== Main Entry ====================
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ES module entry check
const isMainModule = process.argv[1] && process.argv[1].endsWith('server.js');
if (isMainModule) {
    startServer().catch(console.error);
}
//# sourceMappingURL=server.js.map