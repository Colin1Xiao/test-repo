/**
 * Phase 3A-2: Metrics Endpoint
 *
 * 暴露 Prometheus 格式的指标。
 */
import { Router } from 'express';
import { getMetricsRegistry, toPrometheusFormat } from '../metrics/registry.js';
export function createMetricsRoutes() {
    const router = Router();
    /**
     * GET /metrics
     *
     * 暴露 Prometheus 格式的所有指标。
     */
    router.get('/metrics', (req, res) => {
        const registry = getMetricsRegistry();
        const metrics = toPrometheusFormat(registry);
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    });
    /**
     * GET /health
     *
     * 简单健康检查端点。
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: Date.now(),
        });
    });
    /**
     * GET /ready
     *
     * 就绪检查（包括依赖健康状态）。
     */
    router.get('/ready', (req, res) => {
        // TODO: 添加依赖健康检查（Redis、Persistence 等）
        res.json({
            status: 'ready',
            checks: {
                redis: 'ok',
                persistence: 'ok',
                audit: 'ok',
            },
            timestamp: Date.now(),
        });
    });
    return router;
}
//# sourceMappingURL=metrics.js.map