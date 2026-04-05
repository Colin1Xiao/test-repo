/**
 * P0 告警闭环：Timeline 集成
 *
 * 告警动作写入 Timeline：
 * - alert_routed
 * - alert_acknowledged
 * - alert_silenced
 * - alert_escalated
 * - incident_linked
 * - runbook_opened
 */
import { RoutedAlert, AlertAction } from './alert_router.js';
import { IncidentLink, RunbookSession } from './alert_actions.js';
export type TimelineEventType = 'alert_triggered' | 'alert_routed' | 'alert_acknowledged' | 'alert_silenced' | 'alert_escalated' | 'incident_linked' | 'incident_created' | 'incident_updated' | 'runbook_opened' | 'runbook_action' | 'runbook_completed' | 'recovery_action';
export interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    timestamp: number;
    alert_name?: string;
    alert_severity?: string;
    incident_id?: string;
    correlation_id?: string;
    resource?: string;
    performed_by?: string;
    metadata?: Record<string, unknown>;
    related_events?: string[];
}
export interface TimelineQuery {
    alert_name?: string;
    incident_id?: string;
    correlation_id?: string;
    resource?: string;
    event_type?: TimelineEventType;
    from?: number;
    to?: number;
    limit?: number;
}
export declare class TimelineStore {
    private events;
    private byAlert;
    private byIncident;
    private byCorrelation;
    private fileRepo;
    initialize(): Promise<void>;
    /**
     * Record an alert triggered event
     */
    recordAlertTriggered(alert_name: string, alert_value?: string, resource?: string, correlation_id?: string): TimelineEvent;
    /**
     * Record an alert routed event
     */
    recordAlertRouted(routedAlert: RoutedAlert): TimelineEvent;
    /**
     * Record an alert action event
     */
    recordAlertAction(action: AlertAction, alert_name: string, performed_by: string, metadata?: Record<string, unknown>): TimelineEvent;
    /**
     * Record an incident created event
     */
    recordIncidentCreated(incident: IncidentLink): TimelineEvent;
    /**
     * Record an incident linked event
     */
    recordIncidentLinked(incident_id: string, alert_name: string, performed_by: string): TimelineEvent;
    /**
     * Record a runbook opened event
     */
    recordRunbookOpened(session: RunbookSession, alert_name: string): TimelineEvent;
    /**
     * Record a runbook action event
     */
    recordRunbookAction(session: RunbookSession, action: string, performed_by: string, result?: string): TimelineEvent;
    /**
     * Record a recovery action event
     */
    recordRecoveryAction(action: string, performed_by: string, metadata?: Record<string, unknown>): TimelineEvent;
    /**
     * Add event to store
     */
    addEvent(event: TimelineEvent): Promise<void>;
    /**
     * Index event for fast lookup
     */
    private indexEvent;
    /**
     * Query timeline events
     */
    query(filters: TimelineQuery): TimelineEvent[];
    /**
     * Get events by alert name
     */
    getByAlert(alert_name: string, limit?: number): TimelineEvent[];
    /**
     * Get events by incident ID
     */
    getByIncident(incident_id: string, limit?: number): TimelineEvent[];
    /**
     * Get events by correlation ID
     */
    getByCorrelation(correlation_id: string, limit?: number): TimelineEvent[];
    /**
     * Get recent events
     */
    getRecent(limit?: number): TimelineEvent[];
    /**
     * Clear all events (for testing)
     */
    clear(): void;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        by_type: Record<string, number>;
    };
}
export declare function getTimelineStore(): TimelineStore;
export declare function resetTimelineStore(): void;
//# sourceMappingURL=timeline_integration.d.ts.map