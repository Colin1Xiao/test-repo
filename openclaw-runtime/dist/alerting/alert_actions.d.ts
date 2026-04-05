/**
 * P0: Alert Action API
 *
 * 告警处置动作：acknowledge / silence / escalate / link_incident / open_runbook
 */
import { AlertAction } from './alert_router.js';
export interface AlertActionRequest {
    alert_name: string;
    action: AlertAction;
    performed_by: string;
    performed_at?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
}
export interface AlertActionResponse {
    success: boolean;
    action: AlertAction;
    alert_name: string;
    performed_at: number;
    message?: string;
    metadata?: Record<string, unknown>;
}
export interface IncidentLink {
    incident_id: string;
    incident_type: string;
    created_at: number;
    created_by: string;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    correlation_id?: string;
    related_alerts: string[];
}
export interface RunbookSession {
    runbook_name: string;
    opened_at: number;
    opened_by: string;
    actions_taken: RunbookAction[];
    status: 'in_progress' | 'completed' | 'abandoned';
}
export interface RunbookAction {
    action: string;
    performed_at: number;
    performed_by: string;
    result?: string;
}
export interface SilenceConfig {
    alert_name: string;
    silenced_by: string;
    silenced_at: number;
    expires_at: number;
    reason: string;
}
export interface EscalationRecord {
    alert_name: string;
    escalated_from: string;
    escalated_to: string;
    escalated_at: number;
    reason: string;
}
export declare class AlertActionHandler {
    private activeSilences;
    private incidentLinks;
    private runbookSessions;
    private escalationRecords;
    private actionHistory;
    private router;
    /**
     * Execute an alert action
     */
    execute(request: AlertActionRequest): Promise<AlertActionResponse>;
    /**
     * Acknowledge an alert
     */
    private acknowledge;
    /**
     * Silence an alert
     */
    private silence;
    /**
     * Escalate an alert
     */
    private escalate;
    /**
     * Link alert to an incident
     */
    private linkIncident;
    /**
     * Open runbook for an alert
     */
    private openRunbook;
    /**
     * Get escalation target based on policy
     */
    private getEscalationTarget;
    /**
     * Get active silences
     */
    getActiveSilences(): SilenceConfig[];
    /**
     * Get incident by ID
     */
    getIncident(incident_id: string): IncidentLink | undefined;
    /**
     * Get all open incidents
     */
    getOpenIncidents(): IncidentLink[];
    /**
     * Get runbook session
     */
    getRunbookSession(session_id: string): RunbookSession | undefined;
    /**
     * Get action history
     */
    getActionHistory(limit?: number): AlertActionResponse[];
    /**
     * Get escalation records
     */
    getEscalationRecords(): EscalationRecord[];
}
export declare function getAlertActionHandler(): AlertActionHandler;
//# sourceMappingURL=alert_actions.d.ts.map