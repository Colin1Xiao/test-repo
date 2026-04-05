# Diagnostics Panel UI Specification

**阶段**: Wave 2-A: UI Productization  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: OPERATOR_UI_INFORMATION_ARCHITECTURE.md ✅

---

## 一、Diagnostics Panel UI 规格

### 目的

提供系统健康和诊断信息的实时面板，支持：
- 系统健康监控
- 组件状态查看
- 资源使用分析
- 故障诊断
- 性能瓶颈识别

---

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Diagnostics Panel                                  [🔄] [📥]  │
│  Last Updated: 2026-04-05 18:30:00                              │
├─────────────────────────────────────────────────────────────────┤
│  System Health Summary                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🟢 HEALTHY                                              │   │
│  │  Uptime: 168h 23m 15s                                    │   │
│  │  Version: 0.1.0 (commit: abc123)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Component Health                                               │
│  ┌──────────────┬───────────┬──────────┬──────────────┐       │
│  │ Component    │ Status    │ Latency  │ Last Check   │       │
│  ├──────────────┼───────────┼──────────┼──────────────┤       │
│  │ Registry     │ 🟢 OK     │ 5ms      │ 18:30:00     │       │
│  │ Lease Mgr    │ 🟢 OK     │ 10ms     │ 18:30:00     │       │
│  │ Item Coord   │ 🟢 OK     │ 15ms     │ 18:30:00     │       │
│  │ Suppression  │ 🟢 OK     │ 8ms      │ 18:30:00     │       │
│  │ Stale Clean  │ 🟢 OK     │ 50ms     │ 18:29:00     │       │
│  │ Snapshot     │ 🟢 OK     │ 100ms    │ 18:25:00     │       │
│  │ Health Mon   │ 🟢 OK     │ 5ms      │ 18:30:00     │       │
│  │ Metrics      │ 🟢 OK     │ 3ms      │ 18:30:00     │       │
│  └──────────────┴───────────┴──────────┴──────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  Resource Usage                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Memory                                                  │   │
│  │ [████████████████░░░░░░░░░░░░░░░░░░░░] 256/512 MB (50%) │   │
│  │                                                         │   │
│  │ Disk                                                    │   │
│  │ [██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10/50 GB (20%)  │   │
│  │                                                         │   │
│  │ File Handles                                            │   │
│  │ [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 50/1000 (5%)    │   │
│  │                                                         │   │
│  │ Active Leases                                           │   │
│  │ [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 1000/5000 (20%) │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Performance Metrics (24h)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Latency Trend Chart]                                   │   │
│  │ - Acquire P50/P99                                       │   │
│  │ - Claim P50/P99                                         │   │
│  │ - Suppression P50/P99                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Recent Errors (Last 24h)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 18:25:00  LEASE_CONFLICT  lease-123  instance-2  [📋]  │   │
│  │ 18:20:00  SUPPRESS_DUP    corr-456   instance-3  [📋]  │   │
│  │ 18:15:00  STALE_TIMEOUT   lease-789  instance-1  [📋]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [View All Errors →]                                            │
├─────────────────────────────────────────────────────────────────┤
│  Coordination Status                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Active Leases:     1,000                                │   │
│  │ Active Items:      500                                  │   │
│  │ Stale Leases:      10                                   │   │
│  │ Suppression Recs:  5,000                                │   │
│  │                                                         │   │
│  │ Owner Drift (24h):        0 ✅                          │   │
│  │ Duplicate Process (24h):  0 ✅                          │   │
│  │ Ghost States:           0 ✅                            │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Actions                                                        │
│  [Run Health Check] [Export Diagnostics] [View Logs] [Refresh] │
└─────────────────────────────────────────────────────────────────┘
```

---

### 组件健康状态

#### 状态指示器

| 状态 | 颜色 | 说明 |
|------|------|------|
| 🟢 OK | Green | 组件正常运行 |
| 🟡 Degraded | Yellow | 性能下降或部分功能受限 |
| 🔴 Unhealthy | Red | 组件故障或不可用 |
| ⚪ Disabled | Gray | 组件已禁用 |

#### 延迟阈值

| 组件 | 正常 | 警告 | 严重 |
|------|------|------|------|
| Registry | < 10ms | 10-50ms | > 50ms |
| Lease Manager | < 20ms | 20-100ms | > 100ms |
| Item Coordinator | < 30ms | 30-150ms | > 150ms |
| Suppression Manager | < 15ms | 15-75ms | > 75ms |
| Stale Cleanup | < 100ms | 100-500ms | > 500ms |
| Snapshot | < 200ms | 200-1000ms | > 1000ms |

---

### 资源使用监控

#### 内存使用

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| Heap Used | > 70% | > 90% |
| Heap Growth/h | > 50MB/h | > 100MB/h |

#### 磁盘使用

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| Disk Used | > 70% | > 90% |
| Snapshot Size | > 5MB | > 10MB |
| Log Size | > 10MB | > 20MB |

#### 文件句柄

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| Open Handles | > 70% | > 90% |

#### 协调层资源

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| Active Leases | > 80% capacity | > 95% capacity |
| Active Items | > 80% capacity | > 95% capacity |
| Stale Leases | > 100 | > 500 |

---

### 性能指标图表

#### 延迟趋势 (24h)

**显示内容**:
- Acquire P50/P99 延迟
- Claim P50/P99 延迟
- Suppression P50/P99 延迟

**时间范围选项**:
- Last 1h
- Last 6h
- Last 24h
- Last 7d

#### 吞吐量趋势 (24h)

**显示内容**:
- Operations/sec
- Successful operations
- Failed operations

---

### 错误日志

#### 错误分类

| 类别 | 说明 |
|------|------|
| LEASE_CONFLICT | 租约冲突 |
| LEASE_NOT_FOUND | 租约不存在 |
| LEASE_EXPIRED | 租约过期 |
| ITEM_NOT_FOUND | 工作项不存在 |
| ITEM_INVALID_STATE | 工作项状态无效 |
| SUPPRESS_DUP | 重复抑制 |
| SUPPRESS_NOT_FOUND | 抑制记录不存在 |
| STALE_TIMEOUT | Stale 检测超时 |
| SYSTEM_ERROR | 系统错误 |

#### 错误详情

点击错误可查看：
- 完整错误信息
- 堆栈跟踪
- 相关实体 (lease/item/instance)
- 时间戳
- 实例 ID
- Session ID

---

### 协调状态指标

#### 一致性指标

| 指标 | 目标 | 告警 |
|------|------|------|
| Owner Drift (24h) | 0 | > 0 |
| Duplicate Process (24h) | 0 | > 0 |
| Ghost States | 0 | > 0 |
| State Inconsistency | 0 | > 0 |

#### 运行统计

| 指标 | 说明 |
|------|------|
| Active Leases | 当前活跃租约数 |
| Active Items | 当前活跃工作项数 |
| Stale Leases | 待清理的 stale 租约数 |
| Suppression Records | 抑制记录总数 |

---

## 二、Recovery & Replay Console UI 规格

### 目的

提供系统恢复和事件回放的手动操作界面，支持：
- 手动触发恢复操作
- 事件回放调试
- 状态重置
- 故障恢复

---

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Recovery & Replay Console                                      │
├─────────────────────────────────────────────────────────────────┤
│  Recovery Actions                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [🧹 Trigger Stale Cleanup]  [📸 Force Snapshot]         │   │
│  │ [🔄 Replay Events]          [⚠️  Reset State]           │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Event Replay                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Time Range: [From] [To]  Event Type: [All ▼]            │   │
│  │                                                         │   │
│  │ Events to Replay:                                       │   │
│  │ ┌───────────────────────────────────────────────────┐   │   │
│  │ │ ☑ 18:30:05  ACQUIRE  lease-1  instance-1         │   │   │
│  │ │ ☑ 18:30:06  CLAIM    item-1   instance-1         │   │   │
│  │ │ ☐ 18:30:07  RELEASE  lease-2  instance-2         │   │   │
│  │ │ ☐ 18:30:08  COMPLETE item-1   instance-1         │   │   │
│  │ └───────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │ Replay Options:                                         │   │
│  │ ☐ Skip existing events                                  │   │
│  │ ☐ Stop on error                                         │   │
│  │ ☐ Dry run (preview only)                                │   │
│  │                                                         │   │
│  │ [Preview Replay] [Start Replay] [Cancel]                │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Recovery History                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Timestamp  | Action        | Status   | Triggered By    │   │
│  │────────────|───────────────|──────────|─────────────────│   │
│  │ 18:30:00   | Stale Cleanup | ✅ Success | System         │   │
│  │ 18:00:00   | Force Snapshot| ✅ Success | Admin           │   │
│  │ 17:00:00   | Event Replay  | ✅ Success | Admin           │   │
│  │ 16:00:00   | Stale Cleanup | ❌ Failed  | System         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [View Full History →]                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### 恢复操作

#### Trigger Stale Cleanup

**功能**: 手动触发 stale lease 清理

**确认对话框**:
```
┌─────────────────────────────────────────┐
│  Trigger Stale Cleanup                  │
├─────────────────────────────────────────┤
│  This will scan for and clean up stale  │
│  leases that have exceeded the TTL.     │
│                                         │
│  Estimated duration: 1-5 minutes        │
│                                         │
│  [Cancel] [Confirm]                     │
└─────────────────────────────────────────┘
```

**预期结果**:
- 扫描所有 leases
- 识别 stale leases (超过 TTL)
- 清理 stale leases
- 更新统计信息

---

#### Force Snapshot

**功能**: 手动触发系统快照

**确认对话框**:
```
┌─────────────────────────────────────────┐
│  Force Snapshot                         │
├─────────────────────────────────────────┤
│  This will create a new snapshot of     │
│  all current state (leases, items,      │
│  suppression records).                  │
│                                         │
│  Current snapshot size: 1.2 MB          │
│  Estimated duration: 5-10 seconds       │
│                                         │
│  [Cancel] [Confirm]                     │
└─────────────────────────────────────────┘
```

**预期结果**:
- 创建 leases 快照
- 创建 items 快照
- 创建 suppression 快照
- 更新快照历史

---

#### Replay Events

**功能**: 回放指定时间段的事件

**配置选项**:
- 时间范围选择
- 事件类型筛选
- 事件选择 (多选)
- 回放模式 (实际回放 / 预演)

**预演模式**:
- 显示将要执行的操作
- 不修改实际状态
- 用于验证回放安全性

---

#### Reset State

**功能**: 重置系统状态 (危险操作)

**警告对话框**:
```
┌─────────────────────────────────────────┐
│  ⚠️  WARNING: Reset State               │
├─────────────────────────────────────────┤
│  This will RESET all system state:      │
│                                         │
│  - Clear all active leases              │
│  - Clear all active items               │
│  - Clear suppression records            │
│  - Reset statistics                     │
│                                         │
│  This action CANNOT be undone!          │
│                                         │
│  Type "RESET" to confirm: [__________]  │
│                                         │
│  [Cancel] [Reset]                       │
└─────────────────────────────────────────┘
```

---

### 回放进度

```
┌─────────────────────────────────────────┐
│  Replay Progress                        │
├─────────────────────────────────────────┤
│  [████████████░░░░░░░░░░░░░░░░] 60%    │
│                                         │
│  Processing: 18:30:05 ACQUIRE lease-1   │
│                                         │
│  Completed: 60 / 100 events             │
│  Failed: 0                              │
│  Skipped: 0                             │
│                                         │
│  Elapsed: 2m 15s                        │
│  ETA: 1m 30s                            │
│                                         │
│  [Pause] [Resume] [Cancel]              │
└─────────────────────────────────────────┘
```

---

## 三、API 端点

### Diagnostics API

```typescript
// GET /api/v1/diagnostics
interface DiagnosticsResponse {
  timestamp: string;
  version: string;
  git_commit: string;
  build_time: string;
  uptime_ms: number;
  
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, ComponentHealth>;
  };
  
  resources: {
    memory: {
      heap_used_mb: number;
      heap_total_mb: number;
      heap_used_percent: number;
    };
    disk: {
      used_gb: number;
      total_gb: number;
      used_percent: number;
    };
    file_handles: {
      open: number;
      limit: number;
      used_percent: number;
    };
  };
  
  coordination: {
    active_leases: number;
    active_items: number;
    stale_leases: number;
    suppression_records: number;
  };
  
  performance: {
    acquire_latency_p50_ms: number;
    acquire_latency_p99_ms: number;
    claim_latency_p50_ms: number;
    claim_latency_p99_ms: number;
    suppression_latency_p50_ms: number;
    suppression_latency_p99_ms: number;
  };
  
  errors_24h: {
    total: number;
    by_type: Record<string, number>;
    recent: ErrorLog[];
  };
}

// POST /api/v1/diagnostics/health-check
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentHealth>;
  timestamp: string;
}

// POST /api/v1/recovery/stale-cleanup
interface StaleCleanupRequest {
  dry_run?: boolean;
}

interface StaleCleanupResponse {
  status: 'success' | 'failed';
  stale_leases_found: number;
  stale_leases_cleaned: number;
  duration_ms: number;
  error?: string;
}

// POST /api/v1/recovery/snapshot
interface SnapshotRequest {
  dry_run?: boolean;
}

interface SnapshotResponse {
  status: 'success' | 'failed';
  snapshot_path: string;
  snapshot_size_kb: number;
  duration_ms: number;
  error?: string;
}

// POST /api/v1/recovery/replay
interface ReplayRequest {
  startTime: string;
  endTime: string;
  eventTypes?: EventType[];
  eventIds?: string[];
  dry_run?: boolean;
  skip_existing?: boolean;
  stop_on_error?: boolean;
}

interface ReplayResponse {
  status: 'success' | 'failed' | 'in_progress';
  replay_id: string;
  total_events: number;
  completed: number;
  failed: number;
  skipped: number;
  duration_ms?: number;
  error?: string;
}

// GET /api/v1/recovery/history
interface RecoveryHistoryResponse {
  history: RecoveryHistoryEntry[];
  total: number;
}

interface RecoveryHistoryEntry {
  id: string;
  timestamp: string;
  action: 'stale_cleanup' | 'snapshot' | 'replay' | 'reset';
  status: 'success' | 'failed';
  triggered_by: 'system' | 'admin' | 'api';
  details: Record<string, any>;
  duration_ms: number;
}

// POST /api/v1/recovery/reset
interface ResetRequest {
  confirmation: 'RESET';
}

interface ResetResponse {
  status: 'success' | 'failed';
  message: string;
}
```

---

## 四、响应式设计

### 桌面端 (≥1200px)

- 完整面板布局
- 所有图表和指标可见
- 多列显示

### 平板端 (768px - 1199px)

- 单列布局
- 可折叠面板
- 简化图表

### 移动端 (<768px)

- 垂直堆叠布局
- 关键指标优先
- 触摸友好交互
- 可折叠详情

---

## 五、性能要求

### 加载时间

| 指标 | 目标 | 告警 |
|------|------|------|
| 初始加载 | < 2s | > 5s |
| 健康检查 | < 1s | > 3s |
| 资源数据 | < 500ms | > 1s |
| 错误日志 | < 1s | > 3s |

### 刷新频率

| 数据类型 | 自动刷新 | 手动刷新 |
|---------|---------|---------|
| 组件健康 | 30s | ✅ |
| 资源使用 | 10s | ✅ |
| 性能指标 | 60s | ✅ |
| 错误日志 | 30s | ✅ |
| 协调状态 | 30s | ✅ |

---

## 六、待办事项

### 设计 (Track D)

- [x] OPERATOR_UI_INFORMATION_ARCHITECTURE.md
- [x] INCIDENT_TIMELINE_AUDIT_UI_SPEC.md
- [x] DIAGNOSTICS_PANEL_SPEC.md (本文档)
- [ ] RECOVERY_REPLAY_CONSOLE_SPEC.md
- [ ] UI_COMPONENT_LIBRARY.md

### 工程 (Track D)

- [ ] 创建 UI 项目结构
- [ ] 实现 Diagnostics Panel 组件
- [ ] 实现 Recovery Console 组件
- [ ] 实现健康检查 API
- [ ] 实现恢复操作 API
- [ ] 实现实时数据更新 (WebSocket)
- [ ] 实现响应式布局

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-05_  
_下次审查：UI 工程启动后_
