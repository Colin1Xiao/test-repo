/**
 * P0 告警闭环：告警输入源对接
 *
 * 从现有监控系统/日志读取告警，送入 Alert Router
 */
import { getAlertRouter } from './alert_router.js';
import { getAlertActionHandler } from './alert_actions.js';
import { getTimelineStore } from './timeline_integration.js';
import { getIncidentFileRepository } from '../persistence/incident_file_repository.js';
// ==================== Alert Ingest Service ====================
export class AlertIngestService {
    router = getAlertRouter();
    actionHandler = getAlertActionHandler();
    timelineStore = getTimelineStore();
    incidentRepo = getIncidentFileRepository();
    recentAlerts = new Map(); // alert_key → timestamp
    config = {
        auto_route: true,
        auto_create_incident: true,
        auto_open_runbook: false,
        silence_duplicates: true,
        duplicate_window_ms: 5 * 60 * 1000, // 5 minutes
    };
    /**
     * Ingest a raw alert
     */
    async ingest(rawAlert) {
        const { alert_name, alert_value, resource, correlation_id, triggered_at, metadata } = rawAlert;
        // Validate alert definition exists
        const definition = this.router.getDefinition(alert_name);
        if (!definition) {
            console.warn(`Unknown alert: ${alert_name}`);
            return null;
        }
        // Check for duplicate
        if (this.config.silence_duplicates) {
            const key = this.getDuplicateKey(alert_name, resource, correlation_id);
            const lastSeen = this.recentAlerts.get(key);
            const now = triggered_at || Date.now();
            if (lastSeen && (now - lastSeen) < this.config.duplicate_window_ms) {
                console.log(`Duplicate alert suppressed: ${alert_name} (${now - lastSeen}ms < ${this.config.duplicate_window_ms}ms)`);
                return null;
            }
            this.recentAlerts.set(key, now);
        }
        // Record in timeline
        this.timelineStore.recordAlertTriggered(alert_name, alert_value, resource, correlation_id);
        // Route alert
        let incident_id;
        let runbook_url;
        if (this.config.auto_route) {
            const routed = this.router.route(alert_name, alert_value, resource, correlation_id);
            runbook_url = routed.runbook_url;
            // Record routing in timeline
            this.timelineStore.recordAlertRouted(routed);
            // Auto-create incident
            if (this.config.auto_create_incident && definition.incident_type) {
                // Check for existing incident (simple check by correlation_id)
                const existing = this.incidentRepo.query({
                    type: definition.incident_type,
                    correlation_id,
                    status: 'open'
                })[0];
                let incident;
                let created;
                if (existing) {
                    incident = existing;
                    created = false;
                    console.log(`Alert linked to existing incident: ${incident.id}`);
                }
                else {
                    incident = {
                        id: `incident-${Date.now()}-${definition.incident_type}`,
                        type: definition.incident_type,
                        severity: definition.severity,
                        status: 'open',
                        title: `${alert_name} - ${resource || 'Unknown resource'}`,
                        description: `Alert triggered: ${alert_name}`,
                        created_at: Date.now(),
                        created_by: 'alert_ingest_service',
                        updated_at: Date.now(),
                        correlation_id,
                        resource,
                        related_alerts: [alert_name],
                        related_incidents: [],
                        metadata: { ...metadata, alert_value },
                    };
                    await this.incidentRepo.create(incident);
                    created = true;
                    console.log(`Incident created: ${incident.id} for alert ${alert_name}`);
                }
                incident_id = incident.id;
                // Link alert to incident
                await this.actionHandler.execute({
                    alert_name,
                    action: 'link_incident',
                    performed_by: 'alert_ingest_service',
                    metadata: { incident_id: incident.id },
                });
                // Record in timeline
                this.timelineStore.recordIncidentLinked(incident.id, alert_name, 'alert_ingest_service');
            }
            // Auto-open runbook for P0 alerts
            if (this.config.auto_open_runbook && definition.severity === 'P0') {
                await this.actionHandler.execute({
                    alert_name,
                    action: 'open_runbook',
                    performed_by: 'alert_ingest_service',
                });
                console.log(`Runbook opened for P0 alert: ${alert_name}`);
            }
        }
        const ingested = {
            ...rawAlert,
            ingested_at: Date.now(),
            routed: this.config.auto_route,
            incident_id,
            runbook_url,
        };
        return ingested;
    }
    /**
     * Ingest multiple alerts (batch)
     */
    async ingestBatch(alerts) {
        const results = [];
        for (const alert of alerts) {
            const ingested = await this.ingest(alert);
            if (ingested) {
                results.push(ingested);
            }
        }
        return results;
    }
    /**
     * Get duplicate key
     */
    getDuplicateKey(alert_name, resource, correlation_id) {
        if (correlation_id) {
            return `${alert_name}:${correlation_id}`;
        }
        if (resource) {
            return `${alert_name}:${resource}`;
        }
        return alert_name;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Clear recent alerts (for testing)
     */
    clearRecentAlerts() {
        this.recentAlerts.clear();
    }
}
// ==================== Singleton ====================
let _service = null;
export function getAlertIngestService() {
    if (!_service) {
        _service = new AlertIngestService();
    }
    return _service;
}
export function resetAlertIngestService() {
    _service = null;
}
// ==================== Example Usage ====================
/**
 * Example: Ingest alert from monitoring system
 *
 * ```typescript
 * const ingestService = getAlertIngestService();
 *
 * // Simulate RedisDisconnected alert
 * const alert = await ingestService.ingest({
 *   alert_name: 'RedisDisconnected',
 *   alert_value: '0',
 *   resource: 'redis:primary',
 *   correlation_id: 'redis-001',
 *   metadata: { instance: 'redis-primary:6379' },
 * });
 *
 * console.log('Ingested:', alert);
 * ```
 */
//# sourceMappingURL=alert_ingest.js.map