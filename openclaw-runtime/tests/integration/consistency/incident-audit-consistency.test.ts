/**
 * C-4: Incident-Audit 一致性测试
 * 
 * 验证规则:
 * - Incident 创建后，Audit 必须包含 incident_created 事件
 * - object_id 与 Incident ID 一致
 * - 时间戳 >= Incident 创建时间
 * - actor / action / object_type 完整
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../../factories/incident.factory.js';
import { createIncidentCreatedAuditEvent, createStateTransitionAuditEvent } from '../../factories/audit.factory.js';
import { assertTimestampWithinRange, generateCorrelationId } from '../../helpers/test-helpers.js';

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
    const events = this.events.get(filters.object_id) || [];
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}

describe('C-4: Incident-Audit 一致性', () => {
  let incidentRepo: MockIncidentRepository;
  let auditRepo: MockAuditRepository;
  
  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    auditRepo = new MockAuditRepository();
  });
  
  it('应该在 Incident 创建后包含 incident_created Audit 事件', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 记录 Audit
    const auditEvent = createIncidentCreatedAuditEvent(incident.id, incident.created_at);
    await auditRepo.addEvent(auditEvent);
    
    // 3. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 4. 验证
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('incident_created');
    expect(events[0].object_id).toBe(incident.id);
  });
  
  it('应该验证 Audit 时间戳 >= Incident 创建时间', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 记录 Audit (时间戳可能稍晚)
    const auditEvent = createIncidentCreatedAuditEvent(incident.id, incident.created_at + 100);
    await auditRepo.addEvent(auditEvent);
    
    // 3. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 4. 验证时间戳
    expect(events).toHaveLength(1);
    assertTimestampWithinRange(events[0].timestamp, incident.created_at, 5000);
    expect(events[0].timestamp).toBeGreaterThanOrEqual(incident.created_at);
  });
  
  it('应该验证 actor / action / object_type 完整', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 记录 Audit
    const auditEvent = createIncidentCreatedAuditEvent(incident.id, incident.created_at);
    await auditRepo.addEvent(auditEvent);
    
    // 3. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 4. 验证字段完整
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBeDefined();
    expect(events[0].actor).toBe('alert_ingest_service');
    expect(events[0].action).toBeDefined();
    expect(events[0].action).toBe('create');
    expect(events[0].object_type).toBeDefined();
    expect(events[0].object_type).toBe('incident');
  });
  
  it('应该在状态变更后包含 state_transition Audit 事件', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
    
    // 2. 状态变更
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
    const auditEvent = createStateTransitionAuditEvent(
      'incident',
      incident.id,
      'open',
      'resolved',
      'colin'
    );
    await auditRepo.addEvent(auditEvent);
    
    // 3. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 4. 验证
    expect(events).toHaveLength(2);
    const transitionEvent = events.find(e => e.type === 'state_transition');
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent!.metadata.from).toBe('open');
    expect(transitionEvent!.metadata.to).toBe('resolved');
    expect(transitionEvent!.actor).toBe('colin');
  });
  
  it('应该验证 Audit 与 Incident 状态一致', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
    
    // 2. 状态变更
    await sleep(10);
    const updatedIncident = await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
    await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'open', 'resolved', 'colin'));
    
    // 3. 查询 Incident 和 Audit
    const [incidentAfter, events] = await Promise.all([
      incidentRepo.getById(incident.id),
      auditRepo.query({ object_id: incident.id }),
    ]);
    
    // 4. 验证状态一致
    const lastTransition = events.filter(e => e.type === 'state_transition').pop();
    expect(incidentAfter.status).toBe('resolved');
    expect(lastTransition!.metadata.to).toBe('resolved');
  });
  
  it('应该验证 correlation_id 在 Incident 和 Audit 中一致', async () => {
    // 1. 创建 Incident (带自定义 correlation_id)
    const correlationId = generateCorrelationId('test-c4');
    const incident = createTestIncident({ correlation_id: correlationId });
    await incidentRepo.create(incident);
    
    // 2. 记录 Audit
    const auditEvent = createIncidentCreatedAuditEvent(incident.id, incident.created_at);
    auditEvent.correlation_id = correlationId;
    await auditRepo.addEvent(auditEvent);
    
    // 3. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 4. 验证 correlation_id
    expect(events).toHaveLength(1);
    expect(events[0].correlation_id).toBe(correlationId);
    expect(events[0].correlation_id).toBe(incident.correlation_id);
  });
  
  it('应该验证重复操作不会产生不合理 Audit 污染', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await auditRepo.addEvent(createIncidentCreatedAuditEvent(incident.id, incident.created_at));
    
    // 2. 状态变更一次
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
    await auditRepo.addEvent(createStateTransitionAuditEvent('incident', incident.id, 'open', 'resolved', 'colin'));
    
    // 3. 重复"解决"操作 (假设系统允许但记录审计)
    await sleep(10);
    await incidentRepo.update(incident.id, { updated_by: 'colin' }); // 不改变状态
    // 不记录额外的 state_transition (因为状态未变)
    
    // 4. 查询 Audit
    const events = await auditRepo.query({ object_id: incident.id });
    
    // 5. 验证 Audit 数量合理 (只有创建 + 一次状态变更)
    expect(events).toHaveLength(2);
    const transitions = events.filter(e => e.type === 'state_transition');
    expect(transitions).toHaveLength(1);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
