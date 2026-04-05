/**
 * Trading 业务路由整合
 * 
 * 整合所有 trading 相关能力：
 * - Approval
 * - Incident
 * - Replay
 * - Recovery
 * - Webhook
 */

import { Router, Request, Response } from 'express';
import { getAlertIngestService } from '../alerting/alert_ingest.js';
import { getTimelineStore } from '../alerting/timeline_integration.js';
import { getIncidentRepository } from '../alerting/incident_repository.js';

export function createTradingRoutes(): Router {
  const router = Router();
  const ingestService = getAlertIngestService();
  const timelineStore = getTimelineStore();
  const incidentRepo = getIncidentRepository();
  
  // ==================== Approval ====================
  
  router.post('/approvals/:id/resolve', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    timelineStore.recordRecoveryAction('approval_resolve', 'trading_service', {
      approval_id: id,
      action: 'resolve',
    });
    
    res.json({ ok: true, approval_id: id, status: 'resolved', timestamp: Date.now() });
  });
  
  // ==================== Incident ====================
  
  router.post('/incidents/:id/acknowledge', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    timelineStore.recordRecoveryAction('incident_acknowledge', 'trading_service', {
      incident_id: id,
      action: 'acknowledge',
    });
    
    res.json({ ok: true, incident_id: id, status: 'acknowledged', timestamp: Date.now() });
  });
  
  router.post('/incidents/:id/resolve', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    timelineStore.recordRecoveryAction('incident_resolve', 'trading_service', {
      incident_id: id,
      action: 'resolve',
    });
    
    res.json({ ok: true, incident_id: id, status: 'resolved', timestamp: Date.now() });
  });
  
  // ==================== Replay ====================
  
  router.post('/replay/run', async (req: Request, res: Response) => {
    const { target, dry_run } = req.body;
    
    timelineStore.recordRecoveryAction('replay_run', 'trading_service', {
      target,
      dry_run: dry_run || false,
    });
    
    res.json({
      ok: true,
      replay_id: `replay-${Date.now()}`,
      target,
      dry_run: dry_run || false,
      status: 'started',
      timestamp: Date.now(),
    });
  });
  
  // ==================== Recovery ====================
  
  router.post('/recovery/scan', async (req: Request, res: Response) => {
    const { scope } = req.body;
    
    timelineStore.recordRecoveryAction('recovery_scan', 'trading_service', { scope });
    
    res.json({ ok: true, scan_id: `scan-${Date.now()}`, scope, status: 'started', timestamp: Date.now() });
  });
  
  // ==================== Webhook ====================
  
  router.post('/webhooks/:provider/ingest', async (req: Request, res: Response) => {
    const provider: string = req.params.provider as string;
    const event: unknown = req.body.event;
    const data: unknown = req.body.data;
    const eventId: string = (req.headers['x-event-id'] as string) || `event-${Date.now()}`;
    
    const ingested = await ingestService.ingest({
      alert_name: 'WebhookIngestErrorSpike',
      alert_value: provider,
      resource: `webhook:${provider}`,
      correlation_id: eventId,
      metadata: { event, data, provider },
    });
    
    res.json({ ok: true, event_id: eventId, provider, ingested: !!ingested, timestamp: Date.now() });
  });
  
  // ==================== Timeline ====================
  
  router.get('/timeline', async (req: Request, res: Response) => {
    const alertNameParam = req.query.alert_name;
    const incidentIdParam = req.query.incident_id;
    const correlationIdParam = req.query.correlation_id;
    const limitParam = req.query.limit;
    
    const alert_name: string | undefined = typeof alertNameParam === 'string' ? alertNameParam : undefined;
    const incident_id: string | undefined = typeof incidentIdParam === 'string' ? incidentIdParam : undefined;
    const correlation_id: string | undefined = typeof correlationIdParam === 'string' ? correlationIdParam : undefined;
    const limit: number = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
    
    const events = timelineStore.query({ alert_name, incident_id, correlation_id, limit });
    
    res.json({ ok: true, events, count: events.length });
  });
  
  // ==================== Policy Audit ====================
  
  router.get('/policy-audit', async (req: Request, res: Response) => {
    res.json({ ok: true, audits: [], count: 0 });
  });
  
  // ==================== Dashboard ====================
  
  router.get('/dashboard', async (req: Request, res: Response) => {
    const stats = incidentRepo.getStats();
    
    res.json({
      ok: true,
      incidents: stats,
      alerts: {
        p0: stats.by_severity.P0,
        p1: stats.by_severity.P1,
        p2: stats.by_severity.P2,
        p3: stats.by_severity.P3,
      },
      timestamp: Date.now(),
    });
  });
  
  return router;
}
