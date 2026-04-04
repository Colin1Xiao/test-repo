/**
 * Audit Event Test Factory
 * 
 * 生成测试用 Audit 事件样本数据
 */

import { AuditEvent } from '../../src/persistence/audit_file_repository.js';

let auditCounter = 0;

export function createTestAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  auditCounter++;
  const now = Date.now();
  
  return {
    id: overrides?.id || `audit-${now}-test-${auditCounter}`,
    type: overrides?.type || 'incident_created',
    timestamp: overrides?.timestamp || now,
    actor: overrides?.actor || 'test',
    action: overrides?.action || 'create',
    object_type: overrides?.object_type || 'incident',
    object_id: overrides?.object_id || `test-object-${auditCounter}`,
    correlation_id: overrides?.correlation_id || `test-correlation-${auditCounter}`,
    explanation: overrides?.explanation,
    metadata: overrides?.metadata || {},
    related_events: overrides?.related_events || [],
  };
}

export function createIncidentCreatedAuditEvent(incidentId: string, createdAt: number): AuditEvent {
  return createTestAuditEvent({
    type: 'incident_created',
    object_type: 'incident',
    object_id: incidentId,
    timestamp: createdAt,
    actor: 'alert_ingest_service',
    action: 'create',
  });
}

export function createStateTransitionAuditEvent(
  objectType: string,
  objectId: string,
  from: string,
  to: string,
  actor: string,
  timestamp?: number
): AuditEvent {
  return createTestAuditEvent({
    type: 'state_transition',
    object_type: objectType,
    object_id: objectId,
    timestamp: timestamp || Date.now(),
    actor,
    action: 'state_transition',
    metadata: {
      from,
      to,
    },
  });
}

export function createRecoveryActionAuditEvent(itemId: string, action: string): AuditEvent {
  return createTestAuditEvent({
    type: 'recovery_action',
    object_type: 'recovery_item',
    object_id: itemId,
    action,
    metadata: {
      recovery_type: 'scan',
    },
  });
}

export function createWebhookReceivedAuditEvent(eventId: string, provider: string): AuditEvent {
  return createTestAuditEvent({
    type: 'webhook_received',
    object_type: 'webhook',
    object_id: eventId,
    action: 'receive',
    metadata: {
      provider,
    },
  });
}

export function createWebhookProcessedAuditEvent(eventId: string, result: any): AuditEvent {
  return createTestAuditEvent({
    type: 'webhook_processed',
    object_type: 'webhook',
    object_id: eventId,
    action: 'process',
    metadata: {
      result,
    },
  });
}

export function resetAuditCounter(): void {
  auditCounter = 0;
}
