/**
 * Timeline Event Test Factory
 * 
 * 生成测试用 Timeline 事件样本数据
 */

import { TimelineEvent } from '../../src/alerting/timeline_integration.js';

let eventCounter = 0;

export function createTestTimelineEvent(overrides?: Partial<TimelineEvent>): TimelineEvent {
  eventCounter++;
  const now = Date.now();
  
  return {
    id: overrides?.id || `event-${now}-test-${eventCounter}`,
    type: overrides?.type || 'alert_triggered',
    timestamp: overrides?.timestamp || now,
    alert_name: overrides?.alert_name,
    alert_severity: overrides?.alert_severity,
    incident_id: overrides?.incident_id,
    correlation_id: overrides?.correlation_id || `test-correlation-${eventCounter}`,
    resource: overrides?.resource,
    performed_by: overrides?.performed_by || 'test',
    metadata: overrides?.metadata || {},
    related_events: overrides?.related_events || [],
  };
}

export function createIncidentCreatedEvent(incidentId: string, createdAt: number): TimelineEvent {
  return createTestTimelineEvent({
    type: 'incident_created',
    incident_id: incidentId,
    timestamp: createdAt,
    performed_by: 'alert_ingest_service',
    metadata: {
      incident_type: 'test_incident',
      related_alerts: ['TestAlert'],
    },
  });
}

export function createIncidentUpdatedEvent(
  incidentId: string,
  fromStatus: string,
  toStatus: string,
  updatedBy: string,
  timestamp?: number
): TimelineEvent {
  return createTestTimelineEvent({
    type: 'incident_updated',
    incident_id: incidentId,
    timestamp: timestamp || Date.now(),
    performed_by: updatedBy,
    metadata: {
      status_change: {
        from: fromStatus,
        to: toStatus,
      },
    },
  });
}

export function createAlertTriggeredEvent(alertName: string, correlationId: string): TimelineEvent {
  return createTestTimelineEvent({
    type: 'alert_triggered',
    alert_name: alertName,
    correlation_id: correlationId,
  });
}

export function createAlertRoutedEvent(alertName: string, correlationId: string): TimelineEvent {
  return createTestTimelineEvent({
    type: 'alert_routed',
    alert_name: alertName,
    correlation_id: correlationId,
    alert_severity: 'P0',
    metadata: {
      runbook_url: 'docs/release/runbooks/RUNBOOK_TEST.md',
      suggested_actions: ['acknowledge', 'escalate', 'open_runbook', 'link_incident'],
    },
  });
}

export function createIncidentLinkedEvent(incidentId: string, alertName: string): TimelineEvent {
  return createTestTimelineEvent({
    type: 'incident_linked',
    incident_id: incidentId,
    alert_name: alertName,
    performed_by: 'alert_ingest_service',
  });
}

export function resetEventCounter(): void {
  eventCounter = 0;
}
