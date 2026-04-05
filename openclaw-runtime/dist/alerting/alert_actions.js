/**
 * P0: Alert Action API
 *
 * 告警处置动作：acknowledge / silence / escalate / link_incident / open_runbook
 */
import { getAlertRouter } from './alert_router.js';
// ==================== Alert Action Handler ====================
export class AlertActionHandler {
    activeSilences = new Map();
    incidentLinks = new Map();
    runbookSessions = new Map();
    escalationRecords = [];
    actionHistory = [];
    router = getAlertRouter();
    /**
     * Execute an alert action
     */
    async execute(request) {
        const { alert_name, action, performed_by, reason, metadata } = request;
        // Validate alert exists
        const definition = this.router.getDefinition(alert_name);
        if (!definition) {
            return {
                success: false,
                action,
                alert_name,
                performed_at: Date.now(),
                message: `Unknown alert: ${alert_name}`,
            };
        }
        let response;
        switch (action) {
            case 'acknowledge':
                response = await this.acknowledge(alert_name, performed_by, reason);
                break;
            case 'silence':
                response = await this.silence(alert_name, performed_by, metadata);
                break;
            case 'escalate':
                response = await this.escalate(alert_name, performed_by, reason);
                break;
            case 'link_incident':
                response = await this.linkIncident(alert_name, performed_by, metadata);
                break;
            case 'open_runbook':
                response = await this.openRunbook(alert_name, performed_by);
                break;
            default:
                return {
                    success: false,
                    action,
                    alert_name,
                    performed_at: Date.now(),
                    message: `Unknown action: ${action}`,
                };
        }
        // Record action
        this.actionHistory.push(response);
        return response;
    }
    /**
     * Acknowledge an alert
     */
    async acknowledge(alert_name, performed_by, reason) {
        return {
            success: true,
            action: 'acknowledge',
            alert_name,
            performed_at: Date.now(),
            message: `Alert ${alert_name} acknowledged by ${performed_by}`,
            metadata: { acknowledged_by: performed_by, reason },
        };
    }
    /**
     * Silence an alert
     */
    async silence(alert_name, performed_by, config) {
        const duration = config?.expires_at ? config.expires_at - Date.now() : 3600000; // Default 1 hour
        const expires_at = config?.expires_at || Date.now() + duration;
        const silence = {
            alert_name,
            silenced_by: performed_by,
            silenced_at: Date.now(),
            expires_at,
            reason: config?.reason || 'Manual silence',
        };
        this.activeSilences.set(`${alert_name}:${performed_by}`, silence);
        return {
            success: true,
            action: 'silence',
            alert_name,
            performed_at: Date.now(),
            message: `Alert ${alert_name} silenced until ${new Date(expires_at).toISOString()}`,
            metadata: { expires_at: expires_at, reason: silence.reason },
        };
    }
    /**
     * Escalate an alert
     */
    async escalate(alert_name, performed_by, reason) {
        const definition = this.router.getDefinition(alert_name);
        if (!definition) {
            return {
                success: false,
                action: 'escalate',
                alert_name,
                performed_at: Date.now(),
                message: `Unknown alert: ${alert_name}`,
            };
        }
        const escalation_policy = definition.escalation_policy || 'default';
        const escalated_to = this.getEscalationTarget(escalation_policy);
        const record = {
            alert_name,
            escalated_from: performed_by,
            escalated_to: escalated_to,
            escalated_at: Date.now(),
            reason: reason || 'Manual escalation',
        };
        this.escalationRecords.push(record);
        return {
            success: true,
            action: 'escalate',
            alert_name,
            performed_at: Date.now(),
            message: `Alert ${alert_name} escalated to ${escalated_to}`,
            metadata: { escalated_to, escalation_policy: escalation_policy },
        };
    }
    /**
     * Link alert to an incident
     */
    async linkIncident(alert_name, performed_by, metadata) {
        const definition = this.router.getDefinition(alert_name);
        if (!definition) {
            return {
                success: false,
                action: 'link_incident',
                alert_name,
                performed_at: Date.now(),
                message: `Unknown alert: ${alert_name}`,
            };
        }
        const incident_id = metadata?.incident_id || `incident-${Date.now()}-${alert_name}`;
        const incident_type = metadata?.incident_type || definition.incident_type || 'general';
        const existing = this.incidentLinks.get(incident_id);
        if (existing) {
            // Add alert to existing incident
            if (!existing.related_alerts.includes(alert_name)) {
                existing.related_alerts.push(alert_name);
            }
        }
        else {
            // Create new incident
            const incident = {
                incident_id,
                incident_type,
                created_at: Date.now(),
                created_by: performed_by,
                status: 'open',
                correlation_id: metadata?.correlation_id,
                related_alerts: [alert_name],
            };
            this.incidentLinks.set(incident_id, incident);
        }
        return {
            success: true,
            action: 'link_incident',
            alert_name,
            performed_at: Date.now(),
            message: `Alert ${alert_name} linked to incident ${incident_id}`,
            metadata: { incident_id, incident_type },
        };
    }
    /**
     * Open runbook for an alert
     */
    async openRunbook(alert_name, performed_by) {
        const definition = this.router.getDefinition(alert_name);
        if (!definition) {
            return {
                success: false,
                action: 'open_runbook',
                alert_name,
                performed_at: Date.now(),
                message: `Unknown alert: ${alert_name}`,
            };
        }
        const runbook_name = definition.runbook;
        const session_id = `${alert_name}:${performed_by}:${Date.now()}`;
        const session = {
            runbook_name,
            opened_at: Date.now(),
            opened_by: performed_by,
            actions_taken: [],
            status: 'in_progress',
        };
        this.runbookSessions.set(session_id, session);
        return {
            success: true,
            action: 'open_runbook',
            alert_name,
            performed_at: Date.now(),
            message: `Runbook ${runbook_name} opened for alert ${alert_name}`,
            metadata: { runbook_name, session_id },
        };
    }
    /**
     * Get escalation target based on policy
     */
    getEscalationTarget(policy) {
        switch (policy) {
            case 'immediate':
                return 'on-call-lead';
            case '15min':
                return 'tech-lead';
            default:
                return 'default-escalation';
        }
    }
    // ==================== Query Methods ====================
    /**
     * Get active silences
     */
    getActiveSilences() {
        const now = Date.now();
        return Array.from(this.activeSilences.values()).filter(s => s.expires_at > now);
    }
    /**
     * Get incident by ID
     */
    getIncident(incident_id) {
        return this.incidentLinks.get(incident_id);
    }
    /**
     * Get all open incidents
     */
    getOpenIncidents() {
        return Array.from(this.incidentLinks.values()).filter(i => i.status === 'open' || i.status === 'investigating');
    }
    /**
     * Get runbook session
     */
    getRunbookSession(session_id) {
        return this.runbookSessions.get(session_id);
    }
    /**
     * Get action history
     */
    getActionHistory(limit = 100) {
        return this.actionHistory.slice(-limit);
    }
    /**
     * Get escalation records
     */
    getEscalationRecords() {
        return this.escalationRecords;
    }
}
// ==================== Singleton ====================
let _handler = null;
export function getAlertActionHandler() {
    if (!_handler) {
        _handler = new AlertActionHandler();
    }
    return _handler;
}
//# sourceMappingURL=alert_actions.js.map