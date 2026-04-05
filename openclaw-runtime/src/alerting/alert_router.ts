/**
 * P0: Alert Router
 * 
 * 告警路由与映射：告警 → runbook/incident/风险等级
 */

// ==================== Types ====================

export type AlertSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export type AlertAction = 'acknowledge' | 'silence' | 'escalate' | 'link_incident' | 'open_runbook';

export interface AlertDefinition {
  name: string;
  severity: AlertSeverity;
  condition: string; // PromQL or expression
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

// ==================== Alert Definitions ====================

export const ALERT_DEFINITIONS: Record<string, AlertDefinition> = {
  // P0 Alerts
  'RedisDisconnected': {
    name: 'RedisDisconnected',
    severity: 'P0',
    condition: 'redis_connected == 0 for 1m',
    runbook: 'RUNBOOK_REDIS_OUTAGE.md',
    incident_type: 'redis_outage',
    escalation_policy: 'immediate',
    tags: { category: 'infrastructure', component: 'redis' },
  },
  'LockAcquireFailureSpike': {
    name: 'LockAcquireFailureSpike',
    severity: 'P0',
    condition: 'rate(lock_acquire_failure_total[5m]) > 10',
    runbook: 'RUNBOOK_LOCK_LEAK.md',
    incident_type: 'lock_contention',
    escalation_policy: 'immediate',
    tags: { category: 'coordination', component: 'lock' },
  },
  'RecoverySessionStuck': {
    name: 'RecoverySessionStuck',
    severity: 'P0',
    condition: 'recovery_session_in_progress > 10 for 10m',
    runbook: 'RUNBOOK_RECOVERY_STUCK.md',
    incident_type: 'recovery_stuck',
    escalation_policy: 'immediate',
    tags: { category: 'coordination', component: 'recovery' },
  },
  'ReplayFailureSpike': {
    name: 'ReplayFailureSpike',
    severity: 'P0',
    condition: 'rate(business_replay_failure_total[5m]) > 5',
    runbook: 'RUNBOOK_REPLAY_MISFIRE.md',
    incident_type: 'replay_failure',
    escalation_policy: 'immediate',
    tags: { category: 'business', component: 'replay' },
  },
  'IdempotencyHitAnomaly': {
    name: 'IdempotencyHitAnomaly',
    severity: 'P0',
    condition: 'rate(idempotency_hit_total[5m]) > 100',
    runbook: 'RUNBOOK_WEBHOOK_STORM.md',
    incident_type: 'webhook_storm',
    escalation_policy: 'immediate',
    tags: { category: 'coordination', component: 'idempotency' },
  },
  'WebhookIngestErrorSpike': {
    name: 'WebhookIngestErrorSpike',
    severity: 'P0',
    condition: 'rate(http_requests_error_total{route=~"/trading/webhooks/.*"}[5m]) > 10',
    runbook: 'RUNBOOK_WEBHOOK_STORM.md',
    incident_type: 'webhook_failure',
    escalation_policy: 'immediate',
    tags: { category: 'business', component: 'webhook' },
  },
  'AuditWriteFailure': {
    name: 'AuditWriteFailure',
    severity: 'P0',
    condition: 'rate(audit_write_failed_total[5m]) > 5',
    runbook: 'TBD',
    incident_type: 'audit_failure',
    escalation_policy: 'immediate',
    tags: { category: 'compliance', component: 'audit' },
  },
  'StateTransitionRejectSpike': {
    name: 'StateTransitionRejectSpike',
    severity: 'P0',
    condition: 'rate(state_transition_rejected_total[5m]) > 20',
    runbook: 'TBD',
    incident_type: 'state_machine_anomaly',
    escalation_policy: 'immediate',
    tags: { category: 'coordination', component: 'state_machine' },
  },
  
  // P1 Alerts
  'HighErrorRate': {
    name: 'HighErrorRate',
    severity: 'P1',
    condition: 'sum(http_requests_error_total) / sum(http_requests_total) > 0.01 for 5m',
    runbook: 'TBD',
    incident_type: 'service_degradation',
    escalation_policy: '15min',
    tags: { category: 'service', component: 'api' },
  },
  'HighLatency': {
    name: 'HighLatency',
    severity: 'P1',
    condition: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1 for 5m',
    runbook: 'TBD',
    incident_type: 'performance_degradation',
    escalation_policy: '15min',
    tags: { category: 'performance', component: 'api' },
  },
};

// ==================== Related Metrics ====================

export const ALERT_RELATED_METRICS: Record<string, string[]> = {
  'RedisDisconnected': [
    'redis_connected',
    'redis_command_total',
    'redis_command_error_total',
    'lock_acquire_failure_total',
  ],
  'LockAcquireFailureSpike': [
    'lock_acquire_success_total',
    'lock_acquire_failure_total',
    'lock_contention_total',
    'lock_held_duration_seconds',
  ],
  'RecoverySessionStuck': [
    'recovery_session_in_progress',
    'recovery_session_started_total',
    'recovery_session_completed_total',
    'recovery_item_claim_success_total',
  ],
  'ReplayFailureSpike': [
    'business_replay_success_total',
    'business_replay_failure_total',
    'state_transition_rejected_total',
  ],
  'IdempotencyHitAnomaly': [
    'idempotency_created_total',
    'idempotency_hit_total',
    'business_webhook_accepted_total',
    'business_webhook_deduped_total',
  ],
  'WebhookIngestErrorSpike': [
    'http_requests_total{route=~"/trading/webhooks/.*"}',
    'http_requests_error_total{route=~"/trading/webhooks/.*"}',
    'idempotency_hit_total',
  ],
  'AuditWriteFailure': [
    'audit_write_total',
    'audit_write_failed_total',
  ],
  'StateTransitionRejectSpike': [
    'state_transition_allowed_total',
    'state_transition_rejected_total',
  ],
};

// ==================== Related Alerts ====================

export const ALERT_RELATED_ALERTS: Record<string, string[]> = {
  'RedisDisconnected': ['LockAcquireFailureSpike', 'RecoverySessionStuck'],
  'LockAcquireFailureSpike': ['RedisDisconnected', 'RecoverySessionStuck'],
  'RecoverySessionStuck': ['RedisDisconnected', 'LockAcquireFailureSpike'],
  'ReplayFailureSpike': ['StateTransitionRejectSpike'],
  'IdempotencyHitAnomaly': ['WebhookIngestErrorSpike'],
  'WebhookIngestErrorSpike': ['IdempotencyHitAnomaly'],
  'AuditWriteFailure': [],
  'StateTransitionRejectSpike': ['ReplayFailureSpike'],
  'HighErrorRate': ['HighLatency'],
  'HighLatency': ['HighErrorRate'],
};

// ==================== Suggested Actions ====================

export const ALERT_SUGGESTED_ACTIONS: Record<AlertSeverity, AlertAction[]> = {
  'P0': ['acknowledge', 'escalate', 'open_runbook', 'link_incident'],
  'P1': ['acknowledge', 'open_runbook', 'link_incident'],
  'P2': ['acknowledge', 'open_runbook'],
  'P3': ['acknowledge'],
};

// ==================== Alert Router ====================

export class AlertRouter {
  /**
   * Route an alert to its destination
   */
  route(alertName: string, alertValue?: string, resource?: string, correlation_id?: string): RoutedAlert {
    const definition = ALERT_DEFINITIONS[alertName];
    if (!definition) {
      throw new Error(`Unknown alert: ${alertName}`);
    }

    const relatedMetrics = ALERT_RELATED_METRICS[alertName] || [];
    const relatedAlerts = ALERT_RELATED_ALERTS[alertName] || [];
    const suggestedActions = ALERT_SUGGESTED_ACTIONS[definition.severity];

    const context: AlertContext = {
      alert_name: alertName,
      alert_severity: definition.severity,
      alert_triggered_at: Date.now(),
      alert_value: alertValue,
      resource,
      correlation_id,
      runbook_url: this.getRunbookUrl(definition.runbook),
      incident_id: undefined, // Will be set when incident is created
      suggested_actions: suggestedActions,
      related_metrics: relatedMetrics,
      related_alerts: relatedAlerts,
    };

    const routed: RoutedAlert = {
      ...context,
      routed_at: Date.now(),
      routed_by: 'alert_router',
      incident_created: false,
      runbook_opened: false,
    };

    return routed;
  }

  /**
   * Get runbook URL from runbook filename
   */
  private getRunbookUrl(runbook: string): string {
    return `docs/release/runbooks/${runbook}`;
  }

  /**
   * Get alert definition by name
   */
  getDefinition(alertName: string): AlertDefinition | undefined {
    return ALERT_DEFINITIONS[alertName];
  }

  /**
   * Get all P0 alerts
   */
  getP0Alerts(): AlertDefinition[] {
    return Object.values(ALERT_DEFINITIONS).filter(a => a.severity === 'P0');
  }

  /**
   * Get alerts by incident type
   */
  getByIncidentType(incidentType: string): AlertDefinition[] {
    return Object.values(ALERT_DEFINITIONS).filter(a => a.incident_type === incidentType);
  }
}

// ==================== Singleton ====================

let _router: AlertRouter | null = null;

export function getAlertRouter(): AlertRouter {
  if (!_router) {
    _router = new AlertRouter();
  }
  return _router;
}
