/**
 * Incident Test Factory
 * 
 * 生成测试用 Incident 样本数据
 */

import { Incident, IncidentStatus } from '../../src/alerting/incident_repository.js';

let incidentCounter = 0;

export function createTestIncident(overrides?: Partial<Incident> & { status?: IncidentStatus | string }): Incident {
  incidentCounter++;
  const now = Date.now();
  
  return {
    id: `incident-${now}-test-${incidentCounter}`,
    type: overrides?.type || 'test_incident',
    severity: overrides?.severity || 'P0',
    status: overrides?.status || 'open',
    title: overrides?.title || 'Test Incident',
    description: overrides?.description || 'Test incident for testing',
    created_at: overrides?.created_at || now,
    created_by: overrides?.created_by || 'test',
    updated_at: overrides?.updated_at || now,
    updated_by: overrides?.updated_by,
    resolved_at: overrides?.resolved_at,
    resolved_by: overrides?.resolved_by,
    correlation_id: overrides?.correlation_id || `test-correlation-${incidentCounter}`,
    resource: overrides?.resource || 'test-resource',
    related_alerts: overrides?.related_alerts || [],
    related_incidents: overrides?.related_incidents || [],
    metadata: overrides?.metadata || {},
    version: overrides?.version || 1,  // Phase 4.x-A1: Default version
  };
}

export function createIncidentWithStatus(status: IncidentStatus): Incident {
  return createTestIncident({ status });
}

export function createResolvedIncident(): Incident {
  const now = Date.now();
  return createTestIncident({
    status: 'resolved',
    resolved_at: now,
    resolved_by: 'test',
    updated_at: now,
  });
}

export function resetIncidentCounter(): void {
  incidentCounter = 0;
}
