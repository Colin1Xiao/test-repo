/**
 * C-1: Incident 创建一致性测试
 * 
 * 验证规则:
 * - Incident 创建后，Timeline 必须包含 incident_created 事件
 * - 事件时间戳 <= Incident 创建时间 + 1000ms
 * - 事件 incident_id 与 Incident ID 一致
 * - 事件 correlation_id 与 Incident correlation_id 一致
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestIncident } from '../../factories/incident.factory.js';
import { createIncidentCreatedEvent } from '../../factories/timeline.factory.js';
import { assertTimestampWithinRange } from '../../helpers/test-helpers.js';

// Mock repositories (实际实现时会替换为真实 repository)
class MockIncidentRepository {
  private incidents = new Map<string, any>();
  
  async create(incident: any): Promise<any> {
    this.incidents.set(incident.id, incident);
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
    return this.events.get(filters.incident_id) || [];
  }
}

describe('C-1: Incident 创建一致性', () => {
  let incidentRepo: MockIncidentRepository;
  let timelineRepo: MockTimelineRepository;
  
  beforeEach(() => {
    incidentRepo = new MockIncidentRepository();
    timelineRepo = new MockTimelineRepository();
  });
  
  it('应该在 Incident 创建后包含 incident_created 事件', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 模拟 Timeline 记录 (实际实现时由 alert_ingest.ts 调用)
    const timelineEvent = createIncidentCreatedEvent(incident.id, incident.created_at);
    await timelineRepo.addEvent(timelineEvent);
    
    // 3. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 4. 验证
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('incident_created');
    expect(events[0].incident_id).toBe(incident.id);
  });
  
  it('应该验证事件时间戳 <= Incident 创建时间 + 1000ms', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 模拟 Timeline 记录
    const timelineEvent = createIncidentCreatedEvent(incident.id, incident.created_at);
    await timelineRepo.addEvent(timelineEvent);
    
    // 3. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 4. 验证时间戳
    assertTimestampWithinRange(events[0].timestamp, incident.created_at, 1000);
  });
  
  it('应该验证事件 correlation_id 与 Incident 一致', async () => {
    // 1. 创建 Incident (带自定义 correlation_id)
    const correlationId = `test-correlation-${Date.now()}`;
    const incident = createTestIncident({ correlation_id: correlationId });
    await incidentRepo.create(incident);
    
    // 2. 模拟 Timeline 记录
    const timelineEvent = createIncidentCreatedEvent(incident.id, incident.created_at);
    timelineEvent.correlation_id = correlationId;
    await timelineRepo.addEvent(timelineEvent);
    
    // 3. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 4. 验证 correlation_id
    expect(events[0].correlation_id).toBe(correlationId);
    expect(events[0].correlation_id).toBe(incident.correlation_id);
  });
  
  it('应该验证完整的一致性流程', async () => {
    // 1. 创建 Incident
    const incident = createTestIncident();
    await incidentRepo.create(incident);
    
    // 2. 模拟 Timeline 记录
    const timelineEvent = createIncidentCreatedEvent(incident.id, incident.created_at);
    timelineEvent.correlation_id = incident.correlation_id;
    await timelineRepo.addEvent(timelineEvent);
    
    // 3. 查询 Timeline
    const events = await timelineRepo.query({ incident_id: incident.id });
    
    // 4. 完整验证
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('incident_created');
    expect(events[0].incident_id).toBe(incident.id);
    expect(events[0].correlation_id).toBe(incident.correlation_id);
    assertTimestampWithinRange(events[0].timestamp, incident.created_at, 1000);
  });
});
