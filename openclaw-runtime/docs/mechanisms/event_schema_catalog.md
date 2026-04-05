# Event Schema Catalog

**阶段**: Phase X-1: Source Intelligence Extraction  
**日期**: 2026-04-05  
**状态**: ✅ **COMPLETE**

---

## 一、事件分类

### 1.1 事件层级

| 层级 | 类型 | 示例 |
|------|------|------|
| L1 | 业务事件 | alert_triggered, incident_created |
| L2 | 系统事件 | recovery_action, replay_run |
| L3 | 审计事件 | state_transition, actor_action |

### 1.2 事件来源

| 来源 | 存储 | 保留期 |
|------|------|--------|
| Alert/Timeline | timeline.jsonl | 90 天 |
| Incident | incidents.jsonl | 永久 |
| Audit | audit.jsonl | 永久 |

---

## 二、Timeline Event Schema

### 2.1 基础 Schema

```typescript
interface TimelineEvent {
  id: string;                    // 事件 ID: event-${timestamp}-${correlation}
  type: TimelineEventType;       // 事件类型
  timestamp: number;             // 时间戳 (ms)
  alert_name?: string;           // 告警名称
  alert_severity?: string;       // 告警级别 (P0/P1/P2/P3)
  incident_id?: string;          // 关联 Incident ID
  correlation_id?: string;       // 关联 ID (串联用)
  resource?: string;             // 资源标识
  performed_by?: string;         // 执行者
  metadata?: Record<string, unknown>; // 元数据
  related_events?: string[];     // 关联事件 ID
}
```

### 2.2 事件类型

| 类型 | 触发源 | 必填字段 |
|------|--------|---------|
| `alert_triggered` | Alert Ingest | alert_name, correlation_id |
| `alert_routed` | Alert Router | alert_name, alert_severity, runbook_url |
| `alert_acknowledged` | Alert Action | alert_name, performed_by |
| `incident_created` | Incident Create | incident_id, incident_type, correlation_id |
| `incident_linked` | Alert Ingest | incident_id, alert_name |
| `incident_updated` | Incident Update | incident_id, status_change |
| `recovery_action` | Recovery Engine | action, performed_by |

### 2.3 事件示例

**alert_triggered**:
```json
{
  "id": "event-1775337511535-RedisDisconnected-triggered",
  "type": "alert_triggered",
  "timestamp": 1775337511535,
  "alert_name": "RedisDisconnected",
  "correlation_id": "wave2a-t0-1775337511",
  "metadata": {
    "alert_value": "redis_connected=0"
  }
}
```

**incident_created**:
```json
{
  "id": "event-1775337511536-incident-1775337511536-redis_outage-created",
  "type": "incident_created",
  "timestamp": 1775337511536,
  "incident_id": "incident-1775337511536-redis_outage",
  "correlation_id": "wave2a-t0-1775337511",
  "performed_by": "alert_ingest_service",
  "metadata": {
    "incident_type": "redis_outage",
    "related_alerts": ["RedisDisconnected"]
  }
}
```

**incident_updated**:
```json
{
  "id": "event-1775337025223-incident-1775337015470-redis_outage-status-resolved",
  "type": "incident_updated",
  "timestamp": 1775337025223,
  "incident_id": "incident-1775337015470-redis_outage",
  "correlation_id": "persist-test-2",
  "performed_by": "colin",
  "metadata": {
    "status_change": {
      "from": "investigating",
      "to": "resolved"
    }
  }
}
```

---

## 三、Incident Event Schema

### 3.1 基础 Schema

```typescript
interface IncidentEvent {
  type: 'incident_created' | 'incident_updated';
  id: string;                    // Incident ID
  timestamp: number;             // 时间戳 (ms)
  data: Partial<Incident> | IncidentUpdateRequest;
}
```

### 3.2 Incident Schema

```typescript
interface Incident {
  id: string;                    // incident-${timestamp}-${type}
  type: string;                  // incident 类型 (redis_outage, lock_contention, ...)
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  title: string;
  description?: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by?: string;
  resolved_at?: number;
  resolved_by?: string;
  correlation_id?: string;
  resource?: string;
  related_alerts: string[];
  related_incidents?: string[];
  metadata?: Record<string, unknown>;
}
```

### 3.3 事件示例

**incident_created**:
```json
{
  "type": "incident_created",
  "id": "incident-1775337511536-redis_outage",
  "timestamp": 1775337511536,
  "data": {
    "id": "incident-1775337511536-redis_outage",
    "type": "redis_outage",
    "severity": "P0",
    "status": "open",
    "title": "RedisDisconnected - Unknown resource",
    "description": "Alert triggered: RedisDisconnected",
    "created_at": 1775337511536,
    "created_by": "alert_ingest_service",
    "updated_at": 1775337511536,
    "correlation_id": "wave2a-t0-1775337511",
    "related_alerts": ["RedisDisconnected"],
    "related_incidents": [],
    "metadata": {}
  }
}
```

**incident_updated**:
```json
{
  "type": "incident_updated",
  "id": "incident-1775337015470-redis_outage",
  "timestamp": 1775337025223,
  "data": {
    "status": "resolved",
    "updated_by": "colin",
    "updated_at": 1775337025223
  }
}
```

---

## 四、Audit Event Schema

### 4.1 基础 Schema

```typescript
interface AuditEvent {
  id: string;                    // audit-${timestamp}-${object_id}-${type}
  type: string;                  // 事件类型
  timestamp: number;             // 时间戳 (ms)
  actor: string;                 // 执行者
  action: string;                // 动作
  object_type: string;           // 对象类型
  object_id: string;             // 对象 ID
  correlation_id?: string;       // 关联 ID
  explanation?: string;          // 解释/原因
  metadata?: Record<string, unknown>; // 元数据
  related_events?: string[];     // 关联事件 ID
}
```

### 4.2 事件类型

| 类型 | object_type | 触发源 |
|------|-----------|--------|
| `incident_created` | incident | Alert Ingest |
| `incident_updated` | incident | Incident Update |
| `state_transition` | state_object | State Sequence |
| `recovery_session_started` | recovery_session | Recovery Coordinator |
| `recovery_item_claimed` | recovery_item | Recovery Coordinator |
| `lock_acquired` | lock | File Lock |
| `lock_released` | lock | File Lock |

### 4.3 事件示例

**state_transition**:
```json
{
  "id": "audit-1775337025223-incident-1775337015470-state_transition",
  "type": "state_transition",
  "timestamp": 1775337025223,
  "actor": "colin",
  "action": "state_transition",
  "object_type": "incident",
  "object_id": "incident-1775337015470-redis_outage",
  "correlation_id": "persist-test-2",
  "explanation": "Manual resolve",
  "metadata": {
    "machine_id": "incidents",
    "from": "investigating",
    "to": "resolved",
    "transition": {
      "from": "investigating",
      "to": "resolved",
      "allowed": true
    }
  }
}
```

**lock_acquired**:
```json
{
  "id": "audit-1775337511540-incidents-lock_acquired",
  "type": "lock_acquired",
  "timestamp": 1775337511540,
  "actor": "system",
  "action": "lock_acquired",
  "object_type": "file_lock",
  "object_id": "incidents",
  "metadata": {
    "lock_name": "incidents",
    "timeout_ms": 30000,
    "pid": 87208
  }
}
```

---

## 五、Correlation / Actor / Object / Action 模型

### 5.1 Correlation ID

**用途**: 串联同一业务链路的所有事件

**生成规则**:
```typescript
// Alert Ingest
correlation_id = `wave2a-t0-${timestamp}`

// Recovery
correlation_id = `recovery-${session_id}-${item_id}`

// Webhook
correlation_id = webhook.event_id || generateEventId(webhook)
```

**追踪示例**:
```
correlation_id: wave2a-t0-1775337511
  ├── alert_triggered (timestamp: 1775337511535)
  ├── alert_routed (timestamp: 1775337511536)
  ├── incident_created (timestamp: 1775337511536)
  └── incident_linked (timestamp: 1775337511540)
```

### 5.2 Actor

**用途**: 标识执行者

**类型**:
| Actor | 描述 |
|-------|------|
| `alert_ingest_service` | 系统服务 |
| `colin` | 人工用户 |
| `recovery_coordinator` | 恢复引擎 |
| `system` | 自动动作 |

### 5.3 Object

**用途**: 标识操作对象

**类型**:
| object_type | 描述 |
|------------|------|
| `incident` | Incident 对象 |
| `timeline_event` | Timeline 事件 |
| `audit_event` | Audit 事件 |
| `recovery_session` | Recovery 会话 |
| `recovery_item` | Recovery 项目 |
| `file_lock` | 文件锁 |

### 5.4 Action

**用途**: 标识操作类型

**类型**:
| action | 描述 |
|--------|------|
| `create` | 创建 |
| `update` | 更新 |
| `resolve` | 解决/审批 |
| `transition` | 状态迁移 |
| `lock_acquired` | 获取锁 |
| `lock_released` | 释放锁 |

---

## 六、Recovery Checkpoint Schema

### 6.1 基础 Schema

```typescript
interface RecoveryCheckpoint {
  checkpoint_id: string;         // checkpoint-${timestamp}-${session_id}
  session_id: string;            // Recovery Session ID
  item_id: string;               // Recovery Item ID
  item_type: 'approval' | 'incident' | 'event';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}
```

### 6.2 事件示例

```json
{
  "type": "recovery_checkpoint_created",
  "id": "checkpoint-1775337511556-scan-1775337511571",
  "timestamp": 1775337511571,
  "data": {
    "checkpoint_id": "checkpoint-1775337511556-scan-1775337511571",
    "session_id": "scan-1775337511571",
    "item_id": "incident-1775335592423-redis_outage",
    "item_type": "incident",
    "status": "pending",
    "created_at": 1775337511571,
    "metadata": {
      "recovery_type": "scan",
      "dry_run": true
    }
  }
}
```

---

## 七、Webhook Mapping Schema

### 7.1 基础 Schema

```typescript
interface WebhookMapping {
  provider: string;              // 提供商 (okx, binance, ...)
  event_type: string;            // 事件类型 (order, balance, ...)
  mapping: {
    event_id: string;            // JSONPath 到 event_id
    correlation_id: string;      // JSONPath 到 correlation_id
    resource: string;            // JSONPath 到 resource
    severity: string;            // JSONPath 到 severity
    metadata: Record<string, string>; // JSONPath 映射
  };
}
```

### 7.2 映射示例

**OKX Order Event**:
```json
{
  "provider": "okx",
  "event_type": "order",
  "mapping": {
    "event_id": "$.data[0].ordId",
    "correlation_id": "$.data[0].clOrdId",
    "resource": "$.arg.instId",
    "severity": "P1",
    "metadata": {
      "order_id": "$.data[0].ordId",
      "status": "$.data[0].state",
      "side": "$.data[0].side",
      "price": "$.data[0].px",
      "amount": "$.data[0].sz"
    }
  }
}
```

---

## 八、Connector Contract Schema

### 8.1 基础 Schema

```typescript
interface ConnectorContract {
  name: string;                  // Connector 名称
  version: string;               // 版本
  capabilities: string[];        // 能力列表
  resources: ResourceSchema[];   // 资源定义
  events: EventSchema[];         // 事件定义
}
```

### 8.2 Resource Schema

```typescript
interface ResourceSchema {
  name: string;                  // 资源名称
  type: string;                  // 资源类型
  schema: Record<string, unknown>; // JSON Schema
}
```

### 8.3 Event Schema

```typescript
interface EventSchema {
  name: string;                  // 事件名称
  type: string;                  // 事件类型
  schema: Record<string, unknown>; // JSON Schema
  mapping: WebhookMapping;       // Webhook 映射
}
```

---

## 九、已验证事件

| 事件类型 | 验证状态 | 备注 |
|---------|---------|------|
| alert_triggered | ✅ | Wave 2-A T+0h |
| alert_routed | ✅ | Wave 2-A T+0h |
| incident_created | ✅ | Wave 2-A T+0h |
| incident_linked | ✅ | Wave 2-A T+0h |
| incident_updated | ✅ | Wave 2-A T+0h |
| recovery_action | ✅ | Wave 2-A T+0h |
| lock_acquired | ✅ | 3B-3.1 |
| lock_released | ✅ | 3B-3.1 |

---

_文档版本：1.0  
最后更新：2026-04-05 05:39 CST_
