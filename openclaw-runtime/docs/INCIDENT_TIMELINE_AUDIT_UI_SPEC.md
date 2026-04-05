# Incident Timeline & Audit UI Specification

**阶段**: Wave 2-A: UI Productization  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: OPERATOR_UI_INFORMATION_ARCHITECTURE.md ✅

---

## 一、Incident Timeline UI 规格

### 目的

提供协调层事件的可视化时间线，支持：
- 事件探索与分析
- 故障排查
- 审计追溯
- 模式识别

---

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Timeline Explorer                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Time Range: [Last 24h ▼]  Zoom: [1h ▼]  [⏪] [⏩] [🔍]   │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Timeline View                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Interactive Timeline with Event Markers]               │   │
│  │                                                         │   │
│  │  🔴────🟠────🟡────🟢────🔴────🟠────🟡────🟢          │   │
│  │  │     │     │     │     │     │     │     │           │   │
│  │  │     │     │     │     │     │     │     └─ 18:00    │   │
│  │  │     │     │     │     │     │     └─────── 17:00    │   │
│  │  │     │     │     │     │     └───────────── 16:00    │   │
│  │  │     │     │     │     └─────────────────── 15:00    │   │
│  │  │     │     │     └───────────────────────── 14:00    │   │
│  │  │     │     └─────────────────────────────── 13:00    │   │
│  │  │     └───────────────────────────────────── 12:00    │   │
│  │  └─────────────────────────────────────────── 11:00    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Event Layers                                                   │
│  ☑ Lease Events    ☑ Item Events   ☑ Suppression Events       │
│  ☑ Cleanup Events  ☑ System Events ☑ User Actions             │
├─────────────────────────────────────────────────────────────────┤
│  Event Details Panel                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Selected Event                                          │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Timestamp: 2026-04-05 18:30:05                          │   │
│  │ Type: Lease Owner Drift                                 │   │
│  │ Severity: P0 (Critical)                                 │   │
│  │                                                         │   │
│  │ Details:                                                │   │
│  │ Lease Key: lease-12345                                  │   │
│  │ Old Owner: instance-2 (session-abc)                     │   │
│  │ New Owner: instance-3 (session-def)                     │   │
│  │ Reason: Stale lease reclaim                             │   │
│  │                                                         │   │
│  │ Related Entities:                                       │   │
│  │ - Instance: instance-2, instance-3                      │   │
│  │ - Session: session-abc, session-def                     │   │
│  │ - Lease: lease-12345                                    │   │
│  │                                                         │   │
│  │ Actions: [View Logs] [Export] [Create Follow-up]        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 交互设计

#### 时间范围选择

| 选项 | 说明 |
|------|------|
| Last 1h | 最近 1 小时 |
| Last 6h | 最近 6 小时 |
| Last 24h | 最近 24 小时 |
| Last 7d | 最近 7 天 |
| Custom | 自定义范围 |

#### 缩放级别

| 选项 | 每格时间 | 适用场景 |
|------|---------|---------|
| 5m | 5 分钟 | 详细分析 |
| 15m | 15 分钟 | 短期趋势 |
| 1h | 1 小时 | 日常监控 |
| 6h | 6 小时 | 周趋势 |
| 1d | 1 天 | 月趋势 |

#### 事件筛选

**按类型**:
- ☑ Lease Events (acquire/release/renew/reclaim)
- ☑ Item Events (claim/complete/fail/release)
- ☑ Suppression Events (evaluate/record)
- ☑ Cleanup Events (stale detection/cleanup)
- ☑ System Events (startup/shutdown/error)
- ☑ User Actions (manual intervention)

**按严重性**:
- 🔴 P0 (Critical)
- 🟠 P1 (High)
- 🟡 P2 (Medium)
- 🟢 P3 (Low)
- ⚪ Info

**按状态**:
- Open
- Acknowledged
- Resolved
- Closed

---

### 数据需求

#### API 端点

```typescript
// GET /api/v1/timeline/events
interface TimelineEventsRequest {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  types?: EventType[];
  severities?: Severity[];
  statuses?: EventStatus[];
  limit?: number; // Default: 1000
  offset?: number;
}

interface TimelineEventsResponse {
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: Severity;
  status: EventStatus;
  title: string;
  description: string;
  details: Record<string, any>;
  relatedEntities: RelatedEntity[];
  metadata: {
    source: string;
    version: string;
    [key: string]: any;
  };
}
```

#### 事件类型定义

```typescript
type EventType =
  | 'lease_acquired'
  | 'lease_released'
  | 'lease_renewed'
  | 'lease_reclaimed'
  | 'item_claimed'
  | 'item_completed'
  | 'item_failed'
  | 'item_released'
  | 'suppression_evaluated'
  | 'suppression_recorded'
  | 'stale_detected'
  | 'stale_cleaned'
  | 'system_started'
  | 'system_stopped'
  | 'system_error'
  | 'user_intervention';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

type EventStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';
```

---

## 二、Audit Explorer UI 规格

### 目的

提供协调层操作的完整审计日志，支持：
- 合规审计
- 故障追溯
- 操作分析
- 性能优化

---

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Explorer                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Time Range: [Last 7d ▼]  Operation: [All ▼]  [🔍 Search]│   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Audit Log Table                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Timestamp            | Operation | Entity   | Result    │   │
│  │──────────────────────|───────────|──────────|───────────│   │
│  │ 2026-04-05 18:30:05  | ACQUIRE   | lease-1  | ✅ SUCCESS│   │
│  │ 2026-04-05 18:29:58  | CLAIM     | item-1   | ✅ SUCCESS│   │
│  │ 2026-04-05 18:29:45  | RELEASE   | lease-2  | ✅ SUCCESS│   │
│  │ 2026-04-05 18:29:32  | SUPPRESS  | corr-1   | ⚠️ SUPPRD │   │
│  │ 2026-04-05 18:29:20  | RECLAIM   | lease-3  | ✅ SUCCESS│   │
│  │ 2026-04-05 18:29:05  | ACQUIRE   | lease-4  | ❌ FAIL   │   │
│  │ ...                  | ...       | ...      | ...       │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Page: [◀] [1] [2] [3] ... [100] [▶]              10,000 items│
└─────────────────────────────────────────────────────────────────┘
```

---

### 筛选与搜索

#### 时间范围

| 选项 | 说明 |
|------|------|
| Last 1h | 最近 1 小时 |
| Last 6h | 最近 6 小时 |
| Last 24h | 最近 24 小时 |
| Last 7d | 最近 7 天 |
| Last 30d | 最近 30 天 |
| Custom | 自定义范围 |

#### 操作类型

| 类别 | 操作 |
|------|------|
| Lease | ACQUIRE, RELEASE, RENEW, RECLAIM |
| Item | CLAIM, COMPLETE, FAIL, RELEASE |
| Suppression | EVALUATE, RECORD |
| System | START, STOP, ERROR |
| User | INTERVENE, CONFIG_CHANGE |

#### 结果状态

| 状态 | 说明 |
|------|------|
| ✅ SUCCESS | 操作成功 |
| ⚠️ SUPPRESSED | 被抑制 (suppression 场景) |
| ❌ FAIL | 操作失败 |
| ⏸️ TIMEOUT | 操作超时 |
| 🚫 BLOCKED | 被阻止 |

#### 搜索字段

支持搜索:
- Entity ID (lease_key, item_key, correlation_id)
- Instance ID
- Session ID
- Error message
- User ID

---

### 数据需求

#### API 端点

```typescript
// GET /api/v1/audit/logs
interface AuditLogsRequest {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  operations?: OperationType[];
  results?: OperationResult[];
  entityIds?: string[];
  instanceIds?: string[];
  searchQuery?: string;
  limit?: number; // Default: 100
  offset?: number;
  sortBy?: 'timestamp' | 'operation' | 'result';
  sortOrder?: 'asc' | 'desc';
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

interface AuditLog {
  id: string;
  timestamp: string;
  operation: OperationType;
  entity: {
    type: 'lease' | 'item' | 'suppression';
    id: string;
  };
  result: OperationResult;
  details: {
    input: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    duration_ms: number;
  };
  context: {
    instance_id: string;
    session_id: string;
    user_id?: string;
  };
  metadata: {
    version: string;
    [key: string]: any;
  };
}
```

---

## 三、响应式设计

### 桌面端 (≥1200px)

- 三栏布局 (Timeline + Layers + Details)
- 完整图表和交互
- 多窗口并排

### 平板端 (768px - 1199px)

- 两栏布局
- 简化图表
- 可折叠侧边栏

### 移动端 (<768px)

- 单栏布局
- 关键信息优先
- 底部导航栏
- 触摸友好交互

---

## 四、性能要求

### 加载时间

| 指标 | 目标 | 告警 |
|------|------|------|
| 初始加载 | < 2s | > 5s |
| 时间线渲染 | < 500ms | > 1s |
| 事件详情加载 | < 200ms | > 500ms |
| 搜索响应 | < 500ms | > 1s |

### 数据量

| 场景 | 最大事件数 | 建议时间范围 |
|------|-----------|-------------|
| 1h 视图 | 10,000 | Last 1h |
| 24h 视图 | 100,000 | Last 24h |
| 7d 视图 | 500,000 | Last 7d |
| 审计日志 | 10,000/页 | 分页加载 |

### 优化策略

1. **虚拟滚动**: 大量事件时使用虚拟滚动
2. **数据分页**: 审计日志分页加载
3. **时间线聚合**: 高密度时间线聚合显示
4. **懒加载**: 事件详情懒加载
5. **缓存**: 常用时间范围缓存

---

## 五、待办事项

### 设计 (Track D)

- [x] OPERATOR_UI_INFORMATION_ARCHITECTURE.md
- [x] INCIDENT_TIMELINE_AUDIT_UI_SPEC.md (本文档)
- [ ] DIAGNOSTICS_PANEL_SPEC.md
- [ ] RECOVERY_REPLAY_CONSOLE_SPEC.md
- [ ] UI_COMPONENT_LIBRARY.md

### 工程 (Track D)

- [ ] 创建 UI 项目结构
- [ ] 实现 Timeline Explorer 组件
- [ ] 实现 Audit Explorer 组件
- [ ] 实现事件详情面板
- [ ] 实现筛选与搜索
- [ ] 实现响应式布局
- [ ] API 集成

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-05_  
_下次审查：UI 工程启动后_
