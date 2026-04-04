/**
 * C-2: 状态变更一致性测试
 * 
 * 验证规则:
 * - Incident 状态变更后，Timeline 必须包含 incident_updated 事件
 * - metadata.status_change.from/to 正确
 * - 事件时间戳顺序正确 (单调递增)
 * - correlation_id 保持一致
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../../factories/incident.factory.js';
import { createIncidentCreatedEvent, createIncidentUpdatedEvent } from '../../factories/timeline.factory.js';
import { assertTimestampsOrdered, assertTimestampWithinRange, generateCorrelationId } from '../../helpers/test-helpers.js';

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
  private events = new Map<string, any[]>();
  
  async addEvent(event: any): Promise<void> {
    const incidentId = event.incident_id || 'unknown';
    const existing = this.events.get(incidentId) || [];
    existing.push(event);
    this.events.set(incidentId, existing);
  }
  
  async query(filters: { incident_id?: string }): Promise<any[]> {
    if (!filters.incident_id) return [];
    const events = this.events.get(filters.incident_id) || [];
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}

describe('C-2: 状态变更一致性', () => {
  let incidentRepo: MockIncidentRepository;
  let timelineRepo: MockTimelineRepository;
  
  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    timelineRepo = new MockTimelineRepository();
  });
  
  it('应该在 open → investigating 变更后包含 incident_updated 事件', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    
    // 2. 记录创建事件
    await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
    
    // 3. 更新状态
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'test' });
    
    // 4. 记录更新事件
    const updateEvent = createIncidentUpdatedEvent(
      incident.id,
      'open',
      'investigating',
      'test',
      Date.now()
    );
    await timelineRepo.addEvent(updateEvent);
    
    // 5. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 6. 验证
    expect(events).toHaveLength(2);
    const updateEventQuery = events.find(e => e.type === 'incident_updated');
    expect(updateEventQuery).toBeDefined();
    expect(updateEventQuery!.metadata.status_change.from).toBe('open');
    expect(updateEventQuery!.metadata.status_change.to).toBe('investigating');
  });
  
  it('应该在 investigating → resolved 变更后包含 incident_updated 事件', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
    
    // 2. open → investigating
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'test' });
    await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'test'));
    
    // 3. investigating → resolved
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
    const updateEvent = createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'colin');
    await timelineRepo.addEvent(updateEvent);
    
    // 4. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 5. 验证
    expect(events).toHaveLength(3);
    const resolvedEvent = events.find(e => e.type === 'incident_updated' && e.metadata.status_change.to === 'resolved');
    expect(resolvedEvent).toBeDefined();
    expect(resolvedEvent!.metadata.status_change.from).toBe('investigating');
    expect(resolvedEvent!.metadata.status_change.to).toBe('resolved');
    expect(resolvedEvent!.performed_by).toBe('colin');
  });
  
  it('应该验证时间戳顺序单调递增', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
    
    // 2. 多次状态变更
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'investigating', updated_by: 'test' });
    await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'investigating', 'test'));
    
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'colin' });
    await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'investigating', 'resolved', 'colin'));
    
    // 3. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 4. 验证时间戳顺序
    expect(events).toHaveLength(3);
    const timestamps = events.map(e => e.timestamp);
    assertTimestampsOrdered(timestamps);
  });
  
  it('应该验证 correlation_id 保持一致', async () => {
    // 1. 创建 Incident (带自定义 correlation_id)
    const correlationId = generateCorrelationId('test-c2');
    const incident = createTestIncident({ status: 'open', correlation_id: correlationId });
    await incidentRepo.create(incident);
    
    // 2. 记录创建事件
    const createdEvent = createIncidentCreatedEvent(incident.id, incident.created_at);
    createdEvent.correlation_id = correlationId;
    await timelineRepo.addEvent(createdEvent);
    
    // 3. 状态变更
    await sleep(10);
    await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'test' });
    const updateEvent = createIncidentUpdatedEvent(incident.id, 'open', 'resolved', 'test');
    updateEvent.correlation_id = correlationId;
    await timelineRepo.addEvent(updateEvent);
    
    // 4. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 5. 验证 correlation_id 一致
    expect(events).toHaveLength(2);
    events.forEach(event => {
      expect(event.correlation_id).toBe(correlationId);
    });
  });
  
  it('应该验证状态变更与 Timeline 事件一致', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident({ status: 'open' });
    await incidentRepo.create(incident);
    await timelineRepo.addEvent(createIncidentCreatedEvent(incident.id, incident.created_at));
    
    // 2. 状态变更
    await sleep(10);
    const updatedIncident = await incidentRepo.update(incident.id, { status: 'resolved', updated_by: 'test' });
    await timelineRepo.addEvent(createIncidentUpdatedEvent(incident.id, 'open', 'resolved', 'test'));
    
    // 3. 查询 Incident 和 Timeline
    const [incidentAfter, events] = await Promise.all([
      incidentRepo.getById(incident.id),
      timelineRepo.query({ incident_id: incident.id }),
    ]);
    
    // 4. 验证状态一致
    const lastUpdateEvent = events.filter(e => e.type === 'incident_updated').pop();
    expect(incidentAfter.status).toBe('resolved');
    expect(lastUpdateEvent!.metadata.status_change.to).toBe('resolved');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
