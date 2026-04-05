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

## 四、三链联动查询 (新增)

### 目的

提供 Incident → Timeline → Audit 三链联动查询能力，支持：
- 跨链追溯
- 关联分析
- 根因定位
- 影响范围评估

### 联动架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Query Bar                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Search: [incident-123 / lease-456 / correlation-id] [🔍]│   │
│  │                                                         │   │
│  │ Results: 1 Incident · 12 Timeline Events · 24 Audit Logs│   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Chain 1: Incident View                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Incident #123                                           │   │
│  │ Status: Resolved | Severity: P1 | Type: LeaseConflict   │   │
│  │                                                         │   │
│  │ Timeline: ──●────●────●────●──                          │   │
│  │          Created  Updated  Linked   Resolved            │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Chain 2: Timeline View                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 12 Related Events                                       │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ 18:30:05  LEASE_ACQUIRED   lease-456  instance-1       │   │
│  │ 18:30:10  ITEM_CLAIMED     item-456   instance-1       │   │
│  │ 18:30:15  LEASE_CONFLICT   lease-456  instance-2  ⚠️   │   │
│  │ 18:30:20  INCIDENT_CREATED incident-123  system        │   │
│  │ ...                                                     │   │
│  │                                                         │   │
│  │ [Load More] [Export]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Chain 3: Audit View                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 24 Audit Logs                                           │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ 18:30:05  ACQUIRE   lease-456  ✅ SUCCESS  instance-1   │   │
│  │ 18:30:10  CLAIM     item-456   ✅ SUCCESS  instance-1   │   │
│  │ 18:30:15  ACQUIRE   lease-456  ❌ FAIL     instance-2   │   │
│  │ 18:30:20  INCID_CREATE incident-123 ✅ SUCCESS  system  │   │
│  │ ...                                                     │   │
│  │                                                         │   │
│  │ [Load More] [Export]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 查询类型

#### 1. Incident 查询

**输入**: `incident-123` 或 `#123`

**返回**:
- Incident 详情 (Chain 1)
- 关联 Timeline 事件 (Chain 2)
- 关联 Audit 日志 (Chain 3)

**联动逻辑**:
```
Incident → correlation_id → Timeline Events
Incident → related_alerts → Audit Logs
Incident → resource → All related operations
```

#### 2. Lease/Item 查询

**输入**: `lease-456` 或 `item-789`

**返回**:
- 相关 Incident (如有)
- 完整操作时间线
- 完整审计日志

**联动逻辑**:
```
Lease/Item → All operations → Timeline
Lease/Item → All operations → Audit Logs
Operations with errors → Incidents
```

#### 3. Correlation ID 查询

**输入**: `corr-abc-123`

**返回**:
- 完整调用链
- 所有相关事件
- 所有相关操作

**联动逻辑**:
```
Correlation ID → All events (any chain)
Cross-chain correlation
End-to-end trace
```

### 联动交互

#### 点击联动

| 点击位置 | 联动效果 |
|---------|---------|
| Timeline 事件 | 高亮关联 Audit 日志 |
| Audit 日志 | 高亮关联 Timeline 事件 |
| Incident | 展开关联 Timeline + Audit |
| 时间戳 | 三链同步到该时间点 |

#### 筛选联动

| 筛选条件 | 影响范围 |
|---------|---------|
| 时间范围 | 三链同步筛选 |
| 实例 ID | 三链同步筛选 |
| 事件类型 | Timeline + Audit 同步 |
| 严重性 | Incident + Timeline 同步 |

#### 导航联动

| 操作 | 联动效果 |
|------|---------|
| 时间跳转 | 三链同步跳转 |
| 上一页/下一页 | 三链同步翻页 |
| 导出 | 三链打包导出 |

### API 端点

#### 三链联合查询

```typescript
// GET /api/v1/triple-chain/query
interface TripleChainQueryRequest {
  query: string;  // incident-123 / lease-456 / corr-abc
  queryType?: 'incident' | 'lease' | 'item' | 'correlation' | 'auto';
  timeRange?: {
    startTime: string;
    endTime: string;
  };
  limit?: number;  // Default: 100 per chain
}

interface TripleChainQueryResponse {
  query: string;
  queryType: string;
  
  incidents: {
    total: number;
    items: Incident[];
  };
  
  timeline: {
    total: number;
    items: TimelineEvent[];
  };
  
  audit: {
    total: number;
    items: AuditLog[];
  };
  
  correlations: {
    incident_to_timeline: Array<{incident_id: string, event_ids: string[]}>;
    incident_to_audit: Array<{incident_id: string, log_ids: string[]}>;
    timeline_to_audit: Array<{event_id: string, log_ids: string[]}>;
  };
}
```

#### 联动高亮

```typescript
// GET /api/v1/triple-chain/correlations
interface CorrelationsRequest {
  source_chain: 'incident' | 'timeline' | 'audit';
  source_id: string;
  target_chains: Array<'incident' | 'timeline' | 'audit'>;
}

interface CorrelationsResponse {
  correlations: Array<{
    target_chain: string;
    target_ids: string[];
    relationship: string;
  }>;
}
```

### 只读优先策略

**Gray 10% 期间**: 🔒 **只读模式**

| 功能 | 状态 | 说明 |
|------|------|------|
| 查询 | ✅ 启用 | 完整查询能力 |
| 筛选 | ✅ 启用 | 完整筛选能力 |
| 导出 | ✅ 启用 | CSV/JSON 导出 |
| 写操作 | ❌ 禁用 | 不修改数据 |
| 删除 | ❌ 禁用 | 不删除数据 |
| 配置修改 | ❌ 禁用 | 不修改配置 |

**写操作解锁条件**:
- Gray 10% 观察期完成
- Gate 2 批准
- 完整测试验证

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
