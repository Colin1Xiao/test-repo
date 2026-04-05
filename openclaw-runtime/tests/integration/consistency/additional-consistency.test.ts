/**
 * C-3, C-6, C-7, C-9: Additional Consistency Tests
 * 
 * Phase 4.0 Batch C: Core Consistency Completion
 * 
 * Tests:
 * - C-3: Incident update consistency
 * - C-6: Timeline event ordering consistency
 * - C-7: Audit event completeness
 * - C-9: Cross-entity correlation consistency
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
}

class MockTimelineRepository {
  private eventsByIncident = new Map<string, any[]>();
  
  async addEvent(event: any): Promise<void> {
    if (event.incident_id) {
      const existing = this.eventsByIncident.get(event.incident_id) || [];
      existing.push(event);
      this.eventsByIncident.set(event.incident_id, existing);
    }
  }
  
  async query(filters: { incident_id?: string }): Promise<any[]> {
    if (!filters.incident_id) return [];
    const events = this.eventsByIncident.get(filters.incident_id) || [];
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}

class MockAuditRepository {
  private eventsByObject = new Map<string, any[]>();
  
  async addEvent(event: any): Promise<void> {
    const objectId = event.object_id || 'unknown';
    const existing = this.eventsByObject.get(objectId) || [];
    existing.push(event);
    this.eventsByObject.set(objectId, existing);
  }
  
  async query(filters: { object_id?: string; object_type?: string }): Promise<any[]> {
    if (filters.object_type) {
      return Array.from(this.eventsByObject.values()).flat().filter(e => e.object_type === filters.object_type);
    }
    if (!filters.object_id) return [];
    return this.eventsByObject.get(filters.object_id) || [];
  }
}

describe('C-3, C-6, C-7, C-9: Additional Consistency Tests', () => {
  let incidentRepo: MockIncidentRepository;
  let timelineRepo: MockTimelineRepository;
  let auditRepo: MockAuditRepository;

  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    timelineRepo = new MockTimelineRepository();
    auditRepo = new MockAuditRepository();
  });

  describe('C-3: Incident Update Consistency', () => {
    it('应该在 Incident 更新后包含 incident_updated Timeline 事件', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', Date.now()));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      expect(events.length).toBeGreaterThanOrEqual(2);
      const updateEvent = events.find(e => e.type === 'incident_updated');
      expect(updateEvent).toBeDefined();
      expect(updateEvent!.metadata.status_change.from).toBe('open');
      expect(updateEvent!.metadata.status_change.to).toBe('investigating');
    });

    it('应该验证多次更新产生多个 incident_updated 事件', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', Date.now()));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'user2', Date.now()));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      expect(events.length).toBe(3); // created + 2 updates
      const updateEvents = events.filter(e => e.type === 'incident_updated');
      expect(updateEvents.length).toBe(2);
    });

    it('应该验证更新事件的 metadata 完整', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
      
      await sleep(10);
      const updateTimestamp = Date.now();
      await incidentRepo.update(incident.id, { 
        status: 'investigating', 
        updated_by: 'test-user',
        notes: 'Investigating root cause'
      });
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'test-user', updateTimestamp));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      const updateEvent = events.find(e => e.type === 'incident_updated');
      
      expect(updateEvent).toBeDefined();
      expect(updateEvent!.metadata.status_change.from).toBe('open');
      expect(updateEvent!.metadata.status_change.to).toBe('investigating');
      expect(updateEvent!.performed_by).toBe('test-user');
    });
  });

  describe('C-6: Timeline Event Ordering Consistency', () => {
    it('应该验证 Timeline 事件按时间戳排序', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      
      const t1 = Date.now();
      const t2 = t1 + 100;
      const t3 = t2 + 100;
      
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, t1));
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', t2));
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'user2', t3));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      expect(events.length).toBe(3);
      assertTimestampsOrdered(events.map(e => e.timestamp));
    });

    it('应该验证乱序添加后查询仍返回有序结果', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      
      const t1 = Date.now();
      const t2 = t1 + 100;
      const t3 = t2 + 100;
      
      // Add in reverse order
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'user2', t3));
      await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, t1));
      await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'user1', t2));
      
      const events = await timelineRepo.query({ incident_id: incident.id });
      
      expect(events.length).toBe(3);
      assertTimestampsOrdered(events.map(e => e.timestamp));
      expect(events[0].type).toBe('incident_created');
      expect(events[1].type).toBe('incident_updated');
      expect(events[2].type).toBe('incident_updated');
    });
  });

  describe('C-7: Audit Event Completeness', () => {
    it('应该验证所有 Incident 操作都有对应的 Audit 记录', async () => {
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
      
      expect(audit_events.length).toBe(3); // created + 2 transitions
      
      const created = audit_events.find(e => e.type === 'incident_created');
      const transitions = audit_events.filter(e => e.type === 'state_transition');
      
      expect(created).toBeDefined();
      expect(transitions.length).toBe(2);
    });

    it('应该验证 Audit 事件的 object_type 正确', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
      
      const audit_events = await auditRepo.query({ object_type: 'incident' });
      
      expect(audit_events.length).toBeGreaterThanOrEqual(1);
      expect(audit_events.every(e => e.object_type === 'incident')).toBe(true);
    });

    it('应该验证 Audit 事件的 actor 信息完整', async () => {
      const incident = createTestIncident({ status: 'open' });
      await incidentRepo.create(incident);
      await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'specific-user' });
      await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'open', 'investigating', 'specific-user', Date.now()));
      
      const audit_events = await auditRepo.query({ object_id: incident.id });
      
      expect(audit_events.every(e => e.actor)).toBe(true);
      const transition = audit_events.find(e => e.type === 'state_transition');
      expect(transition!.actor).toBe('specific-user');
    });
  });

  describe('C-9: Cross-Entity Correlation Consistency', () => {
    it('应该验证多个实体共享 correlation_id 时的可追踪性', async () => {
      const correlation_id = generateCorrelationId();
      
      // Create multiple incidents with same correlation_id
      const incidents = [];
      for (let i = 0; i < 3; i++) {
        const incident = createTestIncident({ correlation_id });
        await incidentRepo.create(incident);
        incidents.push(incident);
      }
      
      // All incidents should have the same correlation_id
      incidents.forEach(incident => {
        expect(incident.correlation_id).toBe(correlation_id);
      });
    });

    it('应该验证不同 correlation_id 的事件链独立', async () => {
      const correlation_id_1 = generateCorrelationId();
      const correlation_id_2 = generateCorrelationId();
      
      const incident1 = createTestIncident({ correlation_id: correlation_id_1 });
      const incident2 = createTestIncident({ correlation_id: correlation_id_2 });
      
      await incidentRepo.create(incident1);
      await incidentRepo.create(incident2);
      
      expect(incident1.correlation_id).toBe(correlation_id_1);
      expect(incident2.correlation_id).toBe(correlation_id_2);
      expect(incident1.correlation_id).not.toBe(incident2.correlation_id);
    });

    it('应该验证 correlation_id 在状态变更中保持不变', async () => {
      const correlation_id = generateCorrelationId();
      
      const incident = createTestIncident({ correlation_id, status: 'open' });
      await incidentRepo.create(incident);
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'user1' });
      
      await sleep(10);
      await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'user2' });
      
      const updatedIncident = await incidentRepo.getById(incident.id);
      expect(updatedIncident.correlation_id).toBe(correlation_id);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
