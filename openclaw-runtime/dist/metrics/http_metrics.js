/**
 * Phase 3A-2: HTTP Metrics Middleware
 *
 * 自动采集 HTTP 请求指标。
 */
import { getMetricsRegistry } from './registry.js';
// ==================== Route Template Mapping ====================
// 将动态 URL 映射到模板化路由
const ROUTE_PATTERNS = [
    { pattern: /^\/trading\/approvals\/[^/]+\/resolve$/, template: '/trading/approvals/:id/resolve' },
    { pattern: /^\/trading\/approvals\/[^/]+\/acknowledge$/, template: '/trading/approvals/:id/acknowledge' },
    { pattern: /^\/trading\/incidents\/[^/]+\/resolve$/, template: '/trading/incidents/:id/resolve' },
    { pattern: /^\/trading\/incidents\/[^/]+\/acknowledge$/, template: '/trading/incidents/:id/acknowledge' },
    { pattern: /^\/trading\/recovery\/session\/[^/]+\/renew$/, template: '/trading/recovery/session/:id/renew' },
    { pattern: /^\/trading\/recovery\/session\/[^/]+\/complete$/, template: '/trading/recovery/session/:id/complete' },
    { pattern: /^\/trading\/recovery\/items\/[^/]+\/claim$/, template: '/trading/recovery/items/:id/claim' },
    { pattern: /^\/trading\/recovery\/items\/[^/]+\/complete$/, template: '/trading/recovery/items/:id/complete' },
    { pattern: /^\/trading\/webhooks\/[^/]+\/ingest$/, template: '/trading/webhooks/:provider/ingest' },
    { pattern: /^\/trading\/webhooks\/[^/]+\/replay$/, template: '/trading/webhooks/:provider/replay' },
];
function templateRoute(path) {
    for (const { pattern, template } of ROUTE_PATTERNS) {
        if (pattern.test(path)) {
            return template;
        }
    }
    // 如果没有匹配，返回原始路径（但应该记录警告）
    return path;
}
// ==================== Metrics ====================
const registry = getMetricsRegistry();
const httpRequestsTotal = registry.counter('http_requests_total', 'Total HTTP requests', ['method', 'route']);
const httpRequestsSuccessTotal = registry.counter('http_requests_success_total', 'Successful HTTP requests', ['method', 'route']);
const httpRequestsErrorTotal = registry.counter('http_requests_error_total', 'Failed HTTP requests', ['method', 'route', 'error_type']);
const httpRequestDurationSeconds = registry.histogram('http_request_duration_seconds', 'HTTP request latency in seconds', ['method', 'route'], [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
// ==================== Middleware ====================
export function httpMetricsMiddleware() {
    return (req, res, next) => {
        const start = Date.now();
        const method = req.method;
        const route = templateRoute(req.path);
        // Track in-progress (simplified - would need better tracking for production)
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const statusCode = res.statusCode;
            // Total requests
            httpRequestsTotal.inc({ method, route });
            // Duration
            httpRequestDurationSeconds.observe(duration, { method, route });
            // Success or error
            if (statusCode >= 200 && statusCode < 400) {
                httpRequestsSuccessTotal.inc({ method, route });
            }
            else {
                const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
                httpRequestsErrorTotal.inc({ method, route, error_type: errorType });
            }
        });
        next();
    };
}
// ==================== Coordination Metrics Helpers ====================
export function recordIdempotencyCreated(route) {
    const counter = registry.counter('idempotency_created_total', 'Idempotency records created', ['route']);
    counter.inc({ route });
}
export function recordIdempotencyHit(route) {
    const counter = registry.counter('idempotency_hit_total', 'Idempotency hits (duplicate requests)', ['route']);
    counter.inc({ route });
}
export function recordIdempotencyInProgress(route, delta) {
    const gauge = registry.gauge('idempotency_in_progress_total', 'In-progress idempotent requests', ['route']);
    if (delta > 0) {
        gauge.inc({ route });
    }
    else {
        gauge.dec({ route });
    }
}
export function recordLockAcquireSuccess(resource) {
    const counter = registry.counter('lock_acquire_success_total', 'Successful lock acquisitions', ['resource']);
    counter.inc({ resource });
}
export function recordLockAcquireFailure(resource, reason) {
    const counter = registry.counter('lock_acquire_failure_total', 'Failed lock acquisitions', ['resource', 'reason']);
    counter.inc({ resource, reason });
}
export function recordLockReleaseSuccess(resource) {
    const counter = registry.counter('lock_release_success_total', 'Successful lock releases', ['resource']);
    counter.inc({ resource });
}
export function recordLockContention(resource) {
    const counter = registry.counter('lock_contention_total', 'Lock contention events', ['resource']);
    counter.inc({ resource });
}
export function recordRecoverySessionStarted() {
    const counter = registry.counter('recovery_session_started_total', 'Recovery sessions started');
    counter.inc();
    const gauge = registry.gauge('recovery_session_in_progress', 'Active recovery sessions');
    gauge.inc();
}
export function recordRecoverySessionCompleted() {
    const counter = registry.counter('recovery_session_completed_total', 'Recovery sessions completed', ['status']);
    counter.inc({ status: 'success' });
    const gauge = registry.gauge('recovery_session_in_progress', 'Active recovery sessions');
    gauge.dec();
}
export function recordRecoveryItemClaimSuccess(itemType) {
    const counter = registry.counter('recovery_item_claim_success_total', 'Successful item claims', ['item_type']);
    counter.inc({ item_type: itemType });
}
export function recordRecoveryItemClaimFailure(itemType, reason) {
    const counter = registry.counter('recovery_item_claim_failure_total', 'Failed item claims', ['item_type', 'reason']);
    counter.inc({ item_type: itemType, reason });
}
export function recordStateTransitionAllowed(machine, from, to) {
    const counter = registry.counter('state_transition_allowed_total', 'Allowed state transitions', ['machine', 'from', 'to']);
    counter.inc({ machine, from, to });
}
export function recordStateTransitionRejected(machine, from, to, reason) {
    const counter = registry.counter('state_transition_rejected_total', 'Rejected state transitions', ['machine', 'from', 'to', 'reason']);
    counter.inc({ machine, from, to, reason });
}
export function recordRedisConnected(instance) {
    const gauge = registry.gauge('redis_connected', 'Redis connection status (1=connected)', ['instance']);
    gauge.set(1, { instance });
}
export function recordRedisDisconnected(instance) {
    const gauge = registry.gauge('redis_connected', 'Redis connection status (1=connected)', ['instance']);
    gauge.set(0, { instance });
}
export function recordAuditWriteSuccess(eventType) {
    const counter = registry.counter('audit_write_total', 'Audit log writes', ['event_type', 'success']);
    counter.inc({ event_type: eventType, success: 'true' });
}
export function recordAuditWriteFailure(eventType, reason) {
    const counter = registry.counter('audit_write_failed_total', 'Failed audit log writes', ['event_type', 'reason']);
    counter.inc({ event_type: eventType, reason });
}
//# sourceMappingURL=http_metrics.js.map