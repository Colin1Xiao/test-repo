# High Priority Test Specs

**阶段**: Phase Y-2: Test Coverage Expansion  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、P0 高优先级测试 (10 条)

### 1.1 C-1: Incident 创建一致性

**规则**: `test_consistency_incident_create()`

**对应代码**: `incident_file_repository.ts:create()` + `timeline_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident (带 correlation_id)
2. 等待 Timeline 记录

**预期结果**:
- Timeline 包含 `incident_created` 事件
- 事件 incident_id 与 Incident ID 一致
- 事件时间戳 <= Incident 创建时间 + 1000ms
- 事件 correlation_id 与 Incident correlation_id 一致

**测试代码框架**:
```typescript
test('C-1: Incident creation consistency', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Query timeline
  const events = await timelineRepo.query({incident_id: incident.id});
  
  // 3. Verify
  expect(events).toHaveLength(1);
  expect(events[0].type).toBe('incident_created');
  expect(events[0].incident_id).toBe(incident.id);
  expect(events[0].timestamp).toBeLessThanOrEqual(incident.created_at + 1000);
});
```

**阻塞发布**: 是

---

### 1.2 C-2: 状态变更一致性

**规则**: `test_consistency_status_change()`

**对应代码**: `incident_file_repository.ts:update()` + `timeline_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident
2. 更新状态 (open → investigating → resolved)
3. 查询 Timeline

**预期结果**:
- Timeline 包含 `incident_updated` 事件
- metadata.status_change.from/to 正确
- 事件时间戳顺序正确

**测试代码框架**:
```typescript
test('C-2: Status change consistency', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Update status
  await incidentRepo.update(incident.id, {status: 'investigating', updated_by: 'test'});
  
  // 3. Query timeline
  const events = await timelineRepo.query({incident_id: incident.id});
  
  // 4. Verify
  expect(events).toHaveLength(2); // created + updated
  const update_event = events.find(e => e.type === 'incident_updated');
  expect(update_event).toBeDefined();
  expect(update_event.metadata.status_change.from).toBe('open');
  expect(update_event.metadata.status_change.to).toBe('investigating');
});
```

**阻塞发布**: 是

---

### 1.3 C-4: Incident-Audit 一致性

**规则**: `test_consistency_incident_audit()`

**对应代码**: `incident_file_repository.ts:create()` + `audit_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident
2. 查询 Audit

**预期结果**:
- Audit 包含 `incident_created` 事件
- object_id 与 Incident ID 一致
- 时间戳 >= Incident 创建时间

**测试代码框架**:
```typescript
test('C-4: Incident-Audit consistency', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Query audit
  const audit_events = await auditRepo.query({object_id: incident.id});
  
  // 3. Verify
  expect(audit_events).toHaveLength(1);
  expect(audit_events[0].type).toBe('incident_created');
  expect(audit_events[0].timestamp).toBeGreaterThanOrEqual(incident.created_at);
});
```

**阻塞发布**: 是

---

### 1.4 C-5: 状态变更 Audit

**规则**: `test_consistency_status_audit()`

**对应代码**: `incident_file_repository.ts:update()` + `audit_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident
2. 更新状态
3. 查询 Audit

**预期结果**:
- Audit 包含 `state_transition` 事件
- metadata.from/to 正确
- actor 正确

**测试代码框架**:
```typescript
test('C-5: Status change audit consistency', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Update status
  await incidentRepo.update(incident.id, {status: 'resolved', updated_by: 'colin'});
  
  // 3. Query audit
  const audit_events = await auditRepo.query({object_id: incident.id});
  
  // 4. Verify
  expect(audit_events).toHaveLength(2); // created + state_transition
  const transition = audit_events.find(e => e.type === 'state_transition');
  expect(transition).toBeDefined();
  expect(transition.metadata.from).toBe('open');
  expect(transition.metadata.to).toBe('resolved');
  expect(transition.actor).toBe('colin');
});
```

**阻塞发布**: 是

---

### 1.5 C-8: Correlation 串联一致性

**规则**: `test_consistency_correlation_chain()`

**对应代码**: `alert_ingest.ts:ingest()` + `incident_file_repository.ts:create()` + `timeline_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 创建 Alert (带 correlation_id)
2. 查询所有相关事件

**预期结果**:
- 包含 `alert_triggered` 事件
- 包含 `incident_created` 或 `incident_linked` 事件
- 所有事件 correlation_id 一致

**测试代码框架**:
```typescript
test('C-8: Correlation chain consistency', async () => {
  const correlation_id = `test-${Date.now()}`;
  
  // 1. Ingest alert
  await alertIngest.ingest({alert_name: 'RedisDisconnected', correlation_id, ...});
  
  // 2. Query timeline
  const events = await timelineRepo.query({correlation_id});
  
  // 3. Verify
  expect(events.length).toBeGreaterThanOrEqual(2);
  const alert_triggered = events.find(e => e.type === 'alert_triggered');
  const incident_event = events.find(e => e.type === 'incident_created' || e.type === 'incident_linked');
  expect(alert_triggered).toBeDefined();
  expect(incident_event).toBeDefined();
  expect(events.every(e => e.correlation_id === correlation_id)).toBe(true);
});
```

**阻塞发布**: 是

---

### 1.6 I-1: Incident/Timeline 一致性

**规则**: `test_invariants_incident_timeline_consistency()`

**对应代码**: `incident_file_repository.ts` + `timeline_file_repository.ts`

**测试类型**: Integration

**输入条件**:
1. 创建多个 Incident
2. 查询所有 Incident 和 Timeline

**预期结果**:
- 每个 Incident 都有对应的 `incident_created` 事件
- 时间戳一致 (容差 1000ms)

**测试代码框架**:
```typescript
test('I-1: Incident/Timeline consistency invariant', async () => {
  // 1. Create multiple incidents
  const incidents = [];
  for (let i = 0; i < 5; i++) {
    const incident = await incidentRepo.create({...});
    incidents.push(incident);
  }
  
  // 2. Verify each incident has timeline event
  for (const incident of incidents) {
    const events = await timelineRepo.query({incident_id: incident.id});
    expect(events.length).toBeGreaterThanOrEqual(1);
    const created_event = events.find(e => e.type === 'incident_created');
    expect(created_event).toBeDefined();
    expect(created_event.timestamp).toBeLessThanOrEqual(incident.created_at + 1000);
  }
});
```

**阻塞发布**: 是

---

### 1.7 I-2: Correlation ID 可追踪性

**规则**: `test_invariants_correlation_chain()`

**对应代码**: `alert_ingest.ts` + `timeline_file_repository.ts`

**测试类型**: Integration

**输入条件**:
1. 创建多个 Alert (不同 correlation_id)
2. 查询每个 correlation_id 的事件链

**预期结果**:
- 每个 correlation_id 都有完整事件链
- 事件链包含 alert_triggered 和 incident_created/linked

**测试代码框架**:
```typescript
test('I-2: Correlation ID traceability invariant', async () => {
  const correlation_ids = [`test-1-${Date.now()}`, `test-2-${Date.now()}`];
  
  for (const cid of correlation_ids) {
    // 1. Ingest alert
    await alertIngest.ingest({alert_name: 'RedisDisconnected', correlation_id: cid, ...});
    
    // 2. Query timeline
    const events = await timelineRepo.query({correlation_id: cid});
    
    // 3. Verify chain completeness
    const has_alert = events.some(e => e.type === 'alert_triggered');
    const has_incident = events.some(e => e.type === 'incident_created' || e.type === 'incident_linked');
    expect(has_alert).toBe(true);
    expect(has_incident).toBe(true);
  }
});
```

**阻塞发布**: 是

---

### 1.8 I-3: 时间戳单调性

**规则**: `test_invariants_timestamp_monotonicity()`

**对应代码**: `timeline_file_repository.ts`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident
2. 多次更新状态
3. 查询 Timeline 事件

**预期结果**:
- 所有事件时间戳递增

**测试代码框架**:
```typescript
test('I-3: Timestamp monotonicity invariant', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Update multiple times
  await incidentRepo.update(incident.id, {status: 'investigating', updated_by: 'test'});
  await incidentRepo.update(incident.id, {status: 'resolved', updated_by: 'test'});
  
  // 3. Query timeline
  const events = await timelineRepo.query({incident_id: incident.id});
  
  // 4. Verify monotonicity
  for (let i = 1; i < events.length; i++) {
    expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i-1].timestamp);
  }
});
```

**阻塞发布**: 是

---

### 1.9 W-5: Timeline vs Incident 顺序

**规则**: `test_write_order_timeline_incident()`

**对应代码**: `alert_ingest.ts:ingest()`

**测试类型**: Integration

**输入条件**:
1. 创建 Incident
2. 检查 Incident 创建时间和 Timeline 事件时间

**预期结果**:
- Incident 创建时间 <= Timeline 事件时间

**测试代码框架**:
```typescript
test('W-5: Timeline vs Incident write order', async () => {
  // 1. Create incident
  const before = Date.now();
  const incident = await incidentRepo.create({...});
  const after = Date.now();
  
  // 2. Query timeline
  const events = await timelineRepo.query({incident_id: incident.id});
  
  // 3. Verify order
  expect(incident.created_at).toBeGreaterThanOrEqual(before);
  expect(incident.created_at).toBeLessThanOrEqual(after);
  expect(events[0].timestamp).toBeGreaterThanOrEqual(incident.created_at);
});
```

**阻塞发布**: 是

---

### 1.10 W-7: Audit vs 业务动作顺序

**规则**: `test_write_order_audit_business()`

**对应代码**: `incident_file_repository.ts:update()` + `audit_file_repository.ts:addEvent()`

**测试类型**: Integration

**输入条件**:
1. 更新 Incident 状态
2. 检查业务动作时间和 Audit 记录时间

**预期结果**:
- 业务动作时间 <= Audit 记录时间

**测试代码框架**:
```typescript
test('W-7: Audit vs business action write order', async () => {
  // 1. Create incident
  const incident = await incidentRepo.create({...});
  
  // 2. Update status
  const before_update = Date.now();
  await incidentRepo.update(incident.id, {status: 'resolved', updated_by: 'test'});
  const after_update = Date.now();
  
  // 3. Query audit
  const audit_events = await auditRepo.query({object_id: incident.id});
  
  // 4. Verify order
  const transition = audit_events.find(e => e.type === 'state_transition');
  expect(transition).toBeDefined();
  expect(transition.timestamp).toBeGreaterThanOrEqual(before_update);
  expect(transition.timestamp).toBeLessThanOrEqual(after_update + 5000); // 5s tolerance
});
```

**阻塞发布**: 是

---

## 二、P1 测试规格 (摘要)

### 2.1 P1 测试列表

| 规则 | 测试用例 | 类型 | 预计工作量 |
|------|---------|------|----------|
| I-4 | test_invariants_write_order() | Integration | 0.5 人日 |
| I-5 | test_invariants_lock_hold_time() | Integration | 0.5 人日 |
| I-11 | test_invariants_terminal_state() | Unit | 0.5 人日 |
| C-3 | test_consistency_timeline_order() | Integration | 0.5 人日 |
| C-6 | test_consistency_event_mapping() | Integration | 0.5 人日 |
| C-7 | test_consistency_timestamp() | Integration | 0.5 人日 |
| C-9 | test_consistency_correlation_unique() | Integration | 0.5 人日 |
| W-3 | test_write_order_snapshot() | Integration | 0.5 人日 |
| W-6 | test_write_order_audit() | Unit | 0.5 人日 |
| L-6 | test_lock_ownership_timeout() | Integration | 0.5 人日 |
| R-6 | test_recovery_side_effects() | Integration | 0.5 人日 |

**总计**: 11 条，5.5 人日

---

## 三、测试实现顺序

### 3.1 第一批 (Wave 2-A 后，立即)

1. C-1: Incident 创建一致性
2. C-2: 状态变更一致性
3. C-4: Incident-Audit 一致性
4. C-5: 状态变更 Audit
5. C-8: Correlation 串联一致性

**工作量**: 2.5 人日

### 3.2 第二批 (Wave 2-A 后，继续)

1. I-1: Incident/Timeline 一致性
2. I-2: Correlation ID 可追踪性
3. I-3: 时间戳单调性
4. W-5: Timeline vs Incident 顺序
5. W-7: Audit vs 业务动作顺序

**工作量**: 2.5 人日

### 3.3 第三批 (Phase 4.x 前)

P1 测试 (11 条)

**工作量**: 5.5 人日

---

## 四、测试框架配置

### 4.1 Jest 配置

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/*.test.ts"],
  "collectCoverageFrom": ["src/**/*.ts"],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### 4.2 测试数据结构

```typescript
// test/fixtures/incident.ts
export function createTestIncident(overrides?: Partial<Incident>): Incident {
  return {
    id: `incident-${Date.now()}-test`,
    type: 'test_incident',
    severity: 'P0',
    status: 'open',
    title: 'Test Incident',
    description: 'Test incident for testing',
    created_at: Date.now(),
    created_by: 'test',
    updated_at: Date.now(),
    related_alerts: [],
    related_incidents: [],
    ...overrides,
  };
}
```

---

_文档版本：1.0  
最后更新：2026-04-05 06:00 CST_
