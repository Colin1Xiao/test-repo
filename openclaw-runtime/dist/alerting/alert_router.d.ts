/**
 * P0: Alert Router
 *
 * 告警路由与映射：告警 → runbook/incident/风险等级
 */
export type AlertSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type AlertAction = 'acknowledge' | 'silence' | 'escalate' | 'link_incident' | 'open_runbook';
export interface AlertDefinition {
    name: string;
    severity: AlertSeverity;
    condition: string;
    runbook: string;
    incident_type?: string;
    escalation_policy?: string;
    tags?: Record<string, string>;
}
export interface AlertContext {
    alert_name: string;
    alert_severity: AlertSeverity;
    alert_triggered_at: number;
    alert_value?: string;
    resource?: string;
    correlation_id?: string;
    runbook_url?: string;
    incident_id?: string;
    suggested_actions: AlertAction[];
    related_metrics: string[];
    related_alerts: string[];
}
export interface RoutedAlert extends AlertContext {
    routed_at: number;
    routed_by: string;
    incident_created?: boolean;
    runbook_opened?: boolean;
}
export declare const ALERT_DEFINITIONS: Record<string, AlertDefinition>;
export declare const ALERT_RELATED_METRICS: Record<string, string[]>;
export declare const ALERT_RELATED_ALERTS: Record<string, string[]>;
export declare const ALERT_SUGGESTED_ACTIONS: Record<AlertSeverity, AlertAction[]>;
export declare class AlertRouter {
    /**
     * Route an alert to its destination
     */
    route(alertName: string, alertValue?: string, resource?: string, correlation_id?: string): RoutedAlert;
    /**
     * Get runbook URL from runbook filename
     */
    private getRunbookUrl;
    /**
     * Get alert definition by name
     */
    getDefinition(alertName: string): AlertDefinition | undefined;
    /**
     * Get all P0 alerts
     */
    getP0Alerts(): AlertDefinition[];
    /**
     * Get alerts by incident type
     */
    getByIncidentType(incidentType: string): AlertDefinition[];
}
export declare function getAlertRouter(): AlertRouter;
//# sourceMappingURL=alert_router.d.ts.map