/**
 * I-1, I-2, I-3: Invariants Consistency Tests
 * 
 * Phase 4.0 Batch B: Core Consistency Completion
 * 
 * Tests:
 * - I-1: Incident/Timeline consistency invariant
 * - I-2: Correlation ID traceability invariant
 * - I-3: Timestamp monotonicity invariant
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../../factories/incident.factory.js';
import { createIncidentCreatedEvent, createIncidentUpdatedEvent } from '../../factories/timeline.factory.js';
import { createIncidentCreatedAuditEvent, createStateTransitionAuditEvent } from '../../factories/audit.factory.js';
import { generateCorrelationId, assertTimestampsOrdered, assertTimestampWithinRange } from '../../helpers/test-helpers.js';

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
  
  async query(filters: { object_id?: string }): Promise<any[]> {
    if (!filters.object_id) return [];
    return this.events.get(filters.object_id) || [];
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

describe('I-1, I-2, I-3: Invariants Consistency', () => {
  let incidentRepo: MockIncidentRepository;
  let timelineRepo: MockTimelineRepository;
  let auditRepo: MockAuditRepository;

  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    timelineRepo = new MockTimelineRepository();
    auditRepo = new MockAuditRepository();
  });

  describe('I-1: Incident/Timeline Consistency Invariant', () => {
    it('每个 Incident 都应该有对应的 incident_created 事件', async () => {
      // 1. Create multiple incidents
      const incidents = [];
      for (let i = 0; i < 5; i++) {
        const incident = createTestIncident();
        await incidentRepo.create(incident);
        await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
        incidents.push(incident);
      }
      
      // 2. Verify each incident has timeline event
      for (const incident of incidents) {
        const events = await timelineRepo.query({ incident_id: incident.id });
        expect(events.length).toBeGreaterThanOrEqual(1);
        const created_event = events.find(e => e.type === 'incident_created');
        expect(created_event).toBeDefined();
      }
    });

    it('应该验证 Incident 和 Timeline 事件的时间戳一致（容差 1000ms）', async () => {
      const incidents = [];
      for (let i = 0; i < 3; i++) {
        const incident = createTestIncident();
        await incidentRepo.create(incident);
        await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
        incidents.push(incident);
      }
      
      for (const incident of incidents) {
        const events = await timelineRepo.query({ incident_id: incident.id });
        const created_event = events.find(e => e.type === 'incident_created');
        
        expect(created_event).toBeDefined();
        if (created_event) {
          // Timeline event timestamp should be within 1000ms of incident created_at
          assertTimestampWithinRange(created_event.timestamp, incident.created_at, 1000);
        }
      }
    });

    it('应该验证状态变更后 Timeline 事件数量正确', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      // Initial: 1 event (created)
      let events = await timelineRepo.query({ incident_id: incident.id });
      expect(events.length).toBe(1);
      
      // After 1st update: 2 events
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', Date.now()));
      events = await timelineRepo.query({ incident_id: incident.id });
      expect(events.length).toBe(2);
      
      // After 2nd update: 3 events
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'user2', Date.now()));
      events = await timelineRepo.query({ incident_id: incident.id });
      expect(events.length).toBe(3);
    });
  });

  describe('I-2: Correlation ID Traceability Invariant', () => {
    it('应该能够通过 correlation_id 追踪所有相关事件', async () => {
      const correlation_id = generateCorrelationId();
      
      const incident = createTestIncident({ correlation_id });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent({
        ...createIncidentCreatedEvent(incident.id, Date.now()),
        correlation_id,
      });
      
      // Query by correlation_id
      const events = await timelineRepo.query({ correlation_id });
      
      // All events should have the same correlation_id
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(e => e.correlation_id === correlation_id)).toBe(true);
    });

    it('应该验证 correlation_id 在 Incident 和 Timeline 中一致', async () => {
      const correlation_id = generateCorrelationId();
      
      const incident = createTestIncident({ correlation_id });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent({
        ...createIncidentCreatedEvent(incident.id, Date.now()),
        correlation_id,
      });
      
      // Get incidents by correlation_id
      const incidents = await incidentRepo.query({ correlation_id });
      expect(incidents.length).toBeGreaterThanOrEqual(1);
      
      // Get timeline events by correlation_id
      const events = await timelineRepo.query({ correlation_id });
      expect(events.length).toBeGreaterThanOrEqual(1);
      
      // Verify correlation_id consistency
      incidents.forEach(i => {
        expect(i.correlation_id).toBe(correlation_id);
      });
      
      events.forEach(e => {
        expect(e.correlation_id).toBe(correlation_id);
      });
    });

    it('应该验证多个 incident 共享 correlation_id 时的可追踪性', async () => {
      const correlation_id = generateCorrelationId();
      
      // Create multiple incidents with same correlation_id
      for (let i = 0; i < 3; i++) {
        const incident = createTestIncident({ correlation_id });
        await incidentRepo.create(incident);
        await timelineRepo.addEvent({
          ...createIncidentCreatedEvent(incident.id, Date.now()),
          correlation_id,
        });
      }
      
      // Query by correlation_id
      const events = await timelineRepo.query({ correlation_id });
      
      // Should find all events
      expect(events.length).toBe(3);
      expect(events.every(e => e.correlation_id === correlation_id)).toBe(true);
    });

    it('应该验证不存在的 correlation_id 返回空结果', async () => {
      const non_existent_id = 'non-existent-correlation-id';
      
      const events = await timelineRepo.query({ correlation_id: non_existent_id });
      expect(events.length).toBe(0);
    });
  });

  describe('I-3: Timestamp Monotonicity Invariant', () => {
    it('应该验证单个 Incident 的 Timeline 事件时间戳单调递增', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      // Multiple status changes
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', Date.now()));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'user2', Date.now()));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      // Verify timestamp order is monotonic
      assertTimestampsOrdered(events.map(e => e.timestamp));
    });

    it('应该验证 correlation chain 的时间戳单调递增', async () => {
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

    it('应该验证 Audit 事件时间戳单调递增', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'open', 'investigating', 'user1', Date.now()));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'investigating', 'resolved', 'user2', Date.now()));
      
      const audit_events = await auditRepo.query({ object_id: incident.id });
      
      // Verify timestamp order is monotonic
      assertTimestampsOrdered(audit_events.map(e => e.timestamp));
    });

    it('应该验证多次快速写入的时间戳顺序', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      // Rapid updates
      const updates = [
        { status: 'investigating', updated_by: 'user1' },
        { status: 'resolved', updated_by: 'user2' },
      ];
      
      for (const update of updates) {
        await sleep(5);
        await incidentRepo.update(incident.id, update);
        await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, update.status === 'investigating' ? 'open' : 'investigating', update.status as string, update.updated_by, Date.now()));
      }
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      // Verify monotonicity even with rapid writes
      assertTimestampsOrdered(events.map(e => e.timestamp));
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
