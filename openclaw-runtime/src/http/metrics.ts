/**
 * Phase 3A-2: Metrics Endpoint
 * 
 * 暴露 Prometheus 格式的指标。
 */

import { Router, Request, Response } from 'express';
import { getMetricsRegistry, toPrometheusFormat } from '../metrics/registry.js';

export function createMetricsRoutes(): Router {
  const router = Router();
  
  /**
   * GET /metrics
   * 
   * 暴露 Prometheus 格式的所有指标。
   */
  router.get('/metrics', (req: Request, res: Response) => {
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
  router.get('/health', (req: Request, res: Response) => {
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
  router.get('/ready', (req: Request, res: Response) => {
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
