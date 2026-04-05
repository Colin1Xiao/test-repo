/**
 * Alerting 路由整合
 *
 * 整合所有 alerting 相关能力：
 * - Alert Ingest
 * - Alert Actions (acknowledge/escalate/link-incident/open-runbook)
 */
import { Router } from 'express';
import { getAlertIngestService } from '../alerting/alert_ingest.js';
import { getAlertActionHandler } from '../alerting/alert_actions.js';
import { getTimelineStore } from '../alerting/timeline_integration.js';
import { getIncidentFileRepository } from '../persistence/incident_file_repository.js';
export function createAlertingRoutes() {
    const router = Router();
    const ingestService = getAlertIngestService();
    const actionHandler = getAlertActionHandler();
    const timelineStore = getTimelineStore();
    const incidentRepo = getIncidentFileRepository(); // Use file-backed repository
    // ==================== Alert Ingest ====================
    router.post('/ingest', async (req, res) => {
        const alert_name = req.body.alert_name;
        const alert_value = req.body.alert_value;
        const resource = req.body.resource;
        const correlation_id = req.body.correlation_id;
        const metadata = req.body.metadata;
        if (!alert_name) {
            return res.status(400).json({ ok: false, error: 'Missing alert_name' });
        }
        const ingested = await ingestService.ingest({ alert_name, alert_value, resource, correlation_id, metadata });
        if (!ingested) {
            return res.status(200).json({ ok: true, suppressed: true, message: 'Alert suppressed (duplicate)' });
        }
        res.json({
            ok: true,
            suppressed: false,
            alert_name: ingested.alert_name,
            incident_id: ingested.incident_id,
            runbook_url: ingested.runbook_url,
            ingested_at: ingested.ingested_at,
        });
    });
    // ==================== Alert Actions ====================
    router.post('/:id/acknowledge', async (req, res) => {
        const alert_id = req.params.id;
        const reason = req.body.reason;
        const performed_by = req.body.performed_by;
        const result = await actionHandler.execute({
            alert_name: alert_id,
            action: 'acknowledge',
            performed_by: performed_by || 'api',
            reason,
        });
        res.json(result);
    });
    router.post('/:id/silence', async (req, res) => {
        const alert_id = req.params.id;
        const duration = req.body.duration;
        const reason = req.body.reason;
        const performed_by = req.body.performed_by;
        const result = await actionHandler.execute({
            alert_name: alert_id,
            action: 'silence',
            performed_by: performed_by || 'api',
            reason,
            metadata: { duration },
        });
        res.json(result);
    });
    router.post('/:id/escalate', async (req, res) => {
        const alert_id = req.params.id;
        const reason = req.body.reason;
        const performed_by = req.body.performed_by;
        const result = await actionHandler.execute({
            alert_name: alert_id,
            action: 'escalate',
            performed_by: performed_by || 'api',
            reason,
        });
        res.json(result);
    });
    router.post('/:id/link-incident', async (req, res) => {
        const alert_id = req.params.id;
        const incident_id = req.body.incident_id;
        const performed_by = req.body.performed_by;
        const result = await actionHandler.execute({
            alert_name: alert_id,
            action: 'link_incident',
            performed_by: performed_by || 'api',
            metadata: { incident_id },
        });
        res.json(result);
    });
    router.post('/:id/open-runbook', async (req, res) => {
        const alert_id = req.params.id;
        const performed_by = req.body.performed_by;
        const result = await actionHandler.execute({
            alert_name: alert_id,
            action: 'open_runbook',
            performed_by: performed_by || 'api',
        });
        res.json(result);
    });
    // ==================== Incident Query ====================
    router.get('/incidents', async (req, res) => {
        const statusParam = req.query.status;
        const limitParam = req.query.limit;
        const status = typeof statusParam === 'string' ? statusParam : undefined;
        const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
        const incidents = incidentRepo.query({ status, limit });
        res.json({ ok: true, incidents, count: incidents.length });
    });
    router.get('/incidents/:id', async (req, res) => {
        const id = req.params.id;
        const incident = incidentRepo.getById(id);
        if (!incident) {
            return res.status(404).json({ ok: false, error: 'Incident not found' });
        }
        res.json({ ok: true, incident });
    });
    router.patch('/incidents/:id', async (req, res) => {
        const id = req.params.id;
        const { status, description, metadata, updated_by } = req.body;
        const performer = updated_by || 'api';
        // Get previous status before update
        const previous = incidentRepo.getById(id);
        const previousStatus = previous?.status;
        const incident = await incidentRepo.update(id, { status, description, metadata, updated_by: performer });
        if (!incident) {
            return res.status(404).json({ ok: false, error: 'Incident not found' });
        }
        // Record status change in timeline
        if (status && previousStatus && previousStatus !== status) {
            timelineStore.addEvent({
                id: `event-${Date.now()}-${id}-status-${status}`,
                type: 'incident_updated',
                timestamp: Date.now(),
                incident_id: id,
                correlation_id: incident.correlation_id,
                performed_by: performer,
                metadata: {
                    status_change: { from: previousStatus, to: status },
                },
            });
        }
        res.json({ ok: true, incident });
    });
    // ==================== Timeline Query ====================
    router.get('/timeline', async (req, res) => {
        const alertNameParam = req.query.alert_name;
        const incidentIdParam = req.query.incident_id;
        const correlationIdParam = req.query.correlation_id;
        const limitParam = req.query.limit;
        const alert_name = typeof alertNameParam === 'string' ? alertNameParam : undefined;
        const incident_id = typeof incidentIdParam === 'string' ? incidentIdParam : undefined;
        const correlation_id = typeof correlationIdParam === 'string' ? correlationIdParam : undefined;
        const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
        const events = timelineStore.query({ alert_name, incident_id, correlation_id, limit });
        res.json({ ok: true, events, count: events.length });
    });
    // ==================== Action History ====================
    router.get('/actions', async (req, res) => {
        const limitParam = req.query.limit;
        const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
        const actions = actionHandler.getActionHistory(limit);
        res.json({ ok: true, actions, count: actions.length });
    });
    return router;
}
//# sourceMappingURL=alerting_routes.js.map