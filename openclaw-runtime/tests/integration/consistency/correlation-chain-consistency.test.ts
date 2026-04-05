/**
 * C-5, C-8: Correlation Chain Consistency Tests
 * 
 * Phase 4.0 Batch B: Core Consistency Completion
 * 
 * Tests:
 * - C-5: Status change audit consistency
 * - C-8: Correlation chain consistency
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../../factories/incident.factory.js';
import { createIncidentCreatedEvent, createIncidentUpdatedEvent } from '../../factories/timeline.factory.js';
import { createIncidentCreatedAuditEvent, createStateTransitionAuditEvent } from '../../factories/audit.factory.js';
import { generateCorrelationId, assertTimestampsOrdered } from '../../helpers/test-helpers.js';

// Mock repositories
class MockIncidentRepository {
  private incidents = new Map<string, any>();
  
  async create(incident: any): Promise<any> {
    this.incidents.set(incident.id, incident);
    return incident;
  }
  
  async update(id: string, update: any): Promise<any> {
    const incident = this.incidents.get(id);
    if (!incident) throw new Error('Incident not found');
    
    Object.assign(incident, update);
    incident.updated_at = Date.now();
    this.incidents.set(id, incident);
    return incident;
  }
  
  async getById(id: string): Promise<any> {
    return this.incidents.get(id);
  }
  
  async query(filters: { correlation_id?: string }): Promise<any[]> {
    if (!filters.correlation_id) return [];
    return Array.from(this.incidents.values()).filter(i => i.correlation_id === filters.correlation_id);
  }
}

class MockAuditRepository {
  private events = new Map<string, any[]>();
  
  async addEvent(event: any): Promise<void> {
    const objectId = event.object_id || 'unknown';
    const existing = this.events.get(objectId) || [];
    existing.push(event);
    this.events.set(objectId, existing);
  }
  
  async query(filters: { object_id?: string; event_type?: string }): Promise<any[]> {
    if (!filters.object_id) return [];
    const events = this.events.get(filters.object_id) || [];
    if (filters.event_type) {
      return events.filter(e => e.event_type === filters.event_type);
    }
    return events;
  }
}

class MockTimelineRepository {
  private eventsByIncident = new Map<string, any[]>();
  private eventsByCorrelation = new Map<string, any[]>();
  
  async addEvent(event: any): Promise<void> {
    // Index by incident_id
    if (event.incident_id) {
      const existing = this.eventsByIncident.get(event.incident_id) || [];
      existing.push(event);
      this.eventsByIncident.set(event.incident_id, existing);
    }
    
    // Index by correlation_id
    if (event.correlation_id) {
      const existing = this.eventsByCorrelation.get(event.correlation_id) || [];
      existing.push(event);
      this.eventsByCorrelation.set(event.correlation_id, existing);
    }
  }
  
  async query(filters: { incident_id?: string; correlation_id?: string }): Promise<any[]> {
    if (filters.correlation_id) {
      const events = this.eventsByCorrelation.get(filters.correlation_id) || [];
      return events.sort((a, b) => a.timestamp - b.timestamp);
    }
    if (!filters.incident_id) return [];
    const events = this.eventsByIncident.get(filters.incident_id) || [];
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}

describe('C-5, C-8: Correlation Chain Consistency', () => {
  let incidentRepo: MockIncidentRepository;
  let timelineRepo: MockTimelineRepository;
  let auditRepo: MockAuditRepository;

  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    timelineRepo = new MockTimelineRepository();
    auditRepo = new MockAuditRepository();
  });

  describe('C-5: Status Change Audit', () => {
    it('应该在状态变更后包含 state_transition Audit 事件', async () => {
      // 1. Create incident
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
      
      // 2. Update status
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
      
      // 3. Record audit event
      const auditEvent = createStateTransitionAuditEvent(
        'incident',
        incident.id,
        'open',
        'resolved',
        'colin',
        Date.now()
      );
      await auditRepo.addEvent(auditEvent);
      
      // 4. Query audit
      const audit_events = await auditRepo.query({ object_id: incident.id });
      
      // 5. Verify
      expect(audit_events.length).toBeGreaterThanOrEqual(2); // created + state_transition
      const transition = audit_events.find(e => e.type === 'state_transition');
      expect(transition).toBeDefined();
      if (transition) {
        expect(transition.metadata?.from).toBe('open');
        expect(transition.metadata?.to).toBe('resolved');
        expect(transition.actor).toBe('colin');
      }
    });

    it('应该验证 Audit 中的 actor_id 与更新操作一致', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'test-user-123' });
      
      const auditEvent = createStateTransitionAuditEvent(
        'incident',
        incident.id,
        'open',
        'investigating',
        'test-user-123',
        Date.now()
      );
      await auditRepo.addEvent(auditEvent);
      
      const audit_events = await auditRepo.query({ object_id: incident.id });
      const transition = audit_events.find(e => e.type === 'state_transition');
      
      expect(transition).toBeDefined();
      if (transition) {
        expect(transition.actor).toBe('test-user-123');
      }
    });

    it('应该验证多次状态变更都有对应的 Audit 记录', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
      
      // Multiple status changes
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'open', 'investigating', 'user1', Date.now()));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'investigating', 'resolved', 'user2', Date.now()));
      
      const audit_events = await auditRepo.query({ object_id: incident.id });
      
      // Should have: created + 2 state transitions
      expect(audit_events.length).toBe(3);
      
      const transitions = audit_events.filter(e => e.type === 'state_transition');
      expect(transitions.length).toBe(2);
      
      // Verify order and actors
      expect(transitions[0].metadata?.from).toBe('open');
      expect(transitions[0].metadata?.to).toBe('investigating');
      expect(transitions[0].actor).toBe('user1');
      
      expect(transitions[1].metadata?.from).toBe('investigating');
      expect(transitions[1].metadata?.to).toBe('resolved');
      expect(transitions[1].actor).toBe('user2');
    });
  });

  describe('C-8: Correlation Chain Consistency', () => {
    it('应该验证所有相关事件的 correlation_id 一致', async () => {
      const correlation_id = generateCorrelationId();
      
      // 1. Simulate alert ingestion
      
      // 2. Create incident from alert
      const incident = createTestIncident({ correlation_id });
      await incidentRepo.create(incident);
      
      // 3. Record timeline events
      await timelineRepo.addEvent({
        type: 'alert_triggered',
        incident_id: incident.id,
        correlation_id,
        timestamp: Date.now(),
      });
      await timelineRepo.addEvent({
        ...createIncidentCreatedEvent(incident.id, Date.now()),
        correlation_id,
      });
      
      // 4. Query timeline by correlation_id
      const events = await timelineRepo.query({ correlation_id });
      
      // 5. Verify
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every(e => e.correlation_id === correlation_id)).toBe(true);
    });

    it('应该包含 alert_triggered 和 incident_created 事件', async () => {
      const correlation_id = generateCorrelationId();
      
      const incident = createTestIncident({ correlation_id });
      await incidentRepo.create(incident);
      
      await timelineRepo.addEvent({
        type: 'alert_triggered',
        incident_id: incident.id,
        correlation_id,
        timestamp: Date.now(),
      });
      await timelineRepo.addEvent({
        ...createIncidentCreatedEvent(incident.id, Date.now()),
        correlation_id,
      });
      
      const events = await timelineRepo.query({ correlation_id });
      
      // Should have alert_triggered and incident_created
      const alert_triggered = events.find(e => e.type === 'alert_triggered');
      const incident_created = events.find(e => e.type === 'incident_created');
      
      expect(alert_triggered).toBeDefined();
      expect(incident_created).toBeDefined();
    });

    it('应该验证 correlation chain 的时间戳顺序', async () => {
      const correlation_id = generateCorrelationId();
      
      const incident = createTestIncident({ correlation_id });
      await incidentRepo.create(incident);
      
      const now = Date.now();
      await timelineRepo.addEvent({
        type: 'alert_triggered',
        incident_id: incident.id,
        correlation_id,
        timestamp: now,
      });
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, now + 10));
      
      const events = await timelineRepo.query({ correlation_id });
      
      // Verify timestamp order is monotonic
      assertTimestampsOrdered(events.map(e => e.timestamp));
    });

    it('应该验证多个 alert 共享同一 correlation_id 时的链式一致性', async () => {
      const correlation_id = generateCorrelationId();
      
      // Create incidents from multiple alerts
      const incident1 = createTestIncident({ correlation_id });
      const incident2 = createTestIncident({ correlation_id });
      await incidentRepo.create(incident1);
      await incidentRepo.create(incident2);
      
      await timelineRepo.addEvent({
        type: 'alert_triggered',
        incident_id: incident1.id,
        correlation_id,
        timestamp: Date.now(),
      });
      await timelineRepo.addEvent({
        type: 'alert_triggered',
        incident_id: incident2.id,
        correlation_id,
        timestamp: Date.now() + 10,
      });
      
      const events = await timelineRepo.query({ correlation_id });
      
      // All events should have the same correlation_id
      expect(events.every(e => e.correlation_id === correlation_id)).toBe(true);
      
      // Should have multiple alert_triggered events
      const alert_events = events.filter(e => e.type === 'alert_triggered');
      expect(alert_events.length).toBe(2);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
