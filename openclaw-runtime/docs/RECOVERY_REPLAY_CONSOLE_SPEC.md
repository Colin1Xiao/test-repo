# Recovery Replay Console Specification

**阶段**: Wave 2-A: UI Productization  
**日期**: 2026-04-06  
**状态**: 🟡 **DRAFT**  
**依赖**: INCIDENT_TIMELINE_AUDIT_UI_SPEC.md ✅

---

## 一、概述

### 目的

提供**恢复与重放操作的控制台界面**，支持：
- Recovery Scan 结果查看
- Replay Dry-run 执行与验证
- 异常/失败结果展示
- 与 Timeline/Audit 联动追溯

### 设计原则

| 原则 | 说明 |
|------|------|
| **只读优先** | Gray 10% 期间仅查看，不执行写操作 |
| **二次确认** | 危险操作需双重确认 |
| **可追溯** | 所有操作关联 Timeline/Audit |
| **安全默认** | 默认 Dry-run 模式，真实执行需显式启用 |

---

## 二、Recovery Scan 面板

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Recovery Scan Console                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Scan Configuration                                      │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Scope:   [All Instances ▼]  [instance-1] [instance-2]   │   │
│  │ Time:    [Last 24h ▼]  Custom: [____] to [____]        │   │
│  │ Type:    ☑ Stale Leases  ☑ Orphan Items  ☑ Conflicts   │   │
│  │                                                         │   │
│  │ [🔍 Run Scan]  [📋 Export Results]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Scan Results                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Scan ID: scan-20260406-015500                           │   │
│  │ Status: ✅ Complete | Duration: 1.2s | Items: 23        │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │ Category          Count    Status    Actions            │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Stale Leases      15       ⚠️ Review   [View] [Reclaim] │   │
│  │ Orphan Items      5        ⚠️ Review   [View] [Cleanup] │   │
│  │ Conflicts         3        🔴 Action   [View] [Resolve] │   │
│  │                                                         │   │
│  │ [Expand All] [Collapse All] [Export CSV]                │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Details Panel                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Selected: Stale Lease #12345                            │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Lease Key: lease-12345                                  │   │
│  │ Owner: instance-2 (session-abc)                         │   │
│  │ Last Heartbeat: 2026-04-05 18:30:05 (2h ago)            │   │
│  │ Status: STALE (threshold: 90s)                          │   │
│  │                                                         │   │
│  │ Timeline: ──●────●────●────✗──                          │   │
│  │          Created  Renewed  Renewed  Stale               │   │
│  │                                                         │   │
│  │ Actions: [View Timeline] [View Audit] [Reclaim Lease]   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 交互设计

#### Scan 配置

| 选项 | 说明 | 默认值 |
|------|------|--------|
| Scope | 扫描范围 (实例选择) | All Instances |
| Time | 时间范围 | Last 24h |
| Type | 扫描类型 | Stale + Orphan + Conflicts |

#### Scan 执行

**触发**: 点击 `Run Scan`

**流程**:
```
1. 显示 loading 状态
   ↓
2. 调用 POST /api/v1/recovery/scan
   ↓
3. 轮询扫描状态 (每 1s)
   ↓
4. 显示结果
   ↓
5. 自动展开高优先级项目
```

#### 结果分类

| 类别 | 严重性 | 说明 | 操作 |
|------|--------|------|------|
| Stale Leases | ⚠️ Warning | 租约过期 | View / Reclaim |
| Orphan Items | ⚠️ Warning | 孤立工作项 | View / Cleanup |
| Conflicts | 🔴 Critical | 所有权冲突 | View / Resolve |

---

## 三、Replay Dry-run 面板

### 布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Replay Dry-run Console                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Replay Configuration                                    │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Mode:      ☑ Dry-run (Safe)  ☐ Live Execution ⚠️       │   │
│  │                                                         │   │
│  │ Scope:     [Specific Lease/Item]                       │   │
│  │            [lease-12345 / item-456 / correlation-id]    │   │
│  │                                                         │   │
│  │ Options:   ☑ Validate State     ☑ Check Dependencies   │   │
│  │            ☑ Simulate Effects   ☐ Force Execution      │   │
│  │                                                         │   │
│  │ [▶️ Run Dry-run]  [📋 Load from Scan]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Dry-run Results                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Replay ID: replay-20260406-015500                       │   │
│  │ Status: ✅ Success | Duration: 0.8s | Mode: Dry-run     │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │ Simulation Results:                                      │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │ Step 1: Acquire Lease                                   │   │
│  │   Status: ✅ Would Succeed                              │   │
│  │   Target: lease-12345                                   │   │
│  │   Expected Owner: instance-1                            │   │
│  │                                                         │   │
│  │ Step 2: Claim Item                                      │   │
│  │   Status: ✅ Would Succeed                              │   │
│  │   Target: item-456                                      │   │
│  │   Dependencies: lease-12345 ✅                          │   │
│  │                                                         │   │
│  │ Step 3: Execute Operation                               │   │
│  │   Status: ⚠️ Would Succeed (with warnings)              │   │
│  │   Operation: recovery-scan                              │   │
│  │   Warnings: 2                                           │   │
│  │                                                         │   │
│  │ Warnings:                                                │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ ⚠️ Target lease is in STALE state                        │   │
│  │ ⚠️ No recent heartbeat from current owner                │   │
│  │                                                         │   │
│  │ Actions: [View Timeline] [View Audit] [▶️ Execute Live] │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 交互设计

#### 执行模式

| 模式 | 说明 | 默认 | Gray 10% |
|------|------|------|---------|
| Dry-run | 模拟执行，不修改状态 | ✅ | 🔒 仅允许此模式 |
| Live | 真实执行，修改状态 | ❌ | ❌ 禁用 |

#### Live 执行二次确认

**触发条件**: 选择 `Live Execution` 模式

**确认流程**:
```
1. 用户选择 Live 模式
   ↓
2. 弹出确认对话框
   ┌─────────────────────────────────────────┐
   │ ⚠️  WARNING: Live Execution             │
   │ ─────────────────────────────────────── │
   │ This will modify system state.          │
   │                                         │
   │ Target: lease-12345                     │
   │ Operation: reclaim                      │
   │                                         │
   │ Are you sure?                           │
   │                                         │
   │ [❌ Cancel]  [⚠️ I Understand, Execute] │
   │                                         │
   │ ☑️ Log this action to Audit             │
   └─────────────────────────────────────────┘
   ↓
3. 用户确认
   ↓
4. 执行真实操作
   ↓
5. 记录 Audit 日志
```

#### Dry-run 结果解读

| 状态 | 说明 | 建议 |
|------|------|------|
| ✅ Would Succeed | 模拟成功 | 可考虑 Live 执行 |
| ⚠️ With Warnings | 有警告 | 审查警告后决定 |
| ❌ Would Fail | 模拟失败 | 修复问题后重试 |

---

## 四、结果/异常展示

### 结果视图

```
┌─────────────────────────────────────────────────────────────────┐
│  Operation Results                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Operation: reclaim-lease                                │   │
│  │ Status: ✅ Success                                      │   │
│  │ Duration: 1.5s                                          │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │ Changes Made:                                            │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ • Lease lease-12345 owner changed:                      │   │
│  │   instance-2 → instance-1                               │   │
│  │ • Item item-456 claimed by: instance-1                  │   │
│  │ • Suppression record created: 60s TTL                   │   │
│  │                                                         │   │
│  │ Timeline Events Created:                                 │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ • LEASE_RECLAIMED @ 2026-04-06 01:55:00                 │   │
│  │ • ITEM_RECLAIMED @ 2026-04-06 01:55:01                  │   │
│  │                                                         │   │
│  │ Audit Logs:                                              │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ • RECLAIM_START @ 01:55:00 ✅                           │   │
│  │ • RECLAIM_COMPLETE @ 01:55:01 ✅                        │   │
│  │                                                         │   │
│  │ Actions: [View Full Timeline] [View Full Audit]         │   │
│  │          [Export Report] [Undo]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 异常视图

```
┌─────────────────────────────────────────────────────────────────┐
│  Operation Failed                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Operation: reclaim-lease                                │   │
│  │ Status: ❌ Failed                                       │   │
│  │ Duration: 0.3s                                          │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │ Error: LEASE_CONCURRENT_MODIFICATION                     │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ The lease was modified by another instance during       │   │
│  │ the reclaim operation.                                  │   │
│  │                                                         │   │
│  │ Details:                                                 │   │
│  │ • Lease: lease-12345                                    │   │
│  │ • Expected Owner: instance-2                            │   │
│  │ • Actual Owner: instance-3                              │   │
│  │ • Modified At: 2026-04-06 01:55:00.500                  │   │
│  │                                                         │   │
│  │ Stack Trace:                                             │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ Error: LEASE_CONCURRENT_MODIFICATION                    │   │
│  │   at LeaseManager.reclaim (lease_manager.ts:234)        │   │
│  │   at RecoveryService.execute (recovery.ts:89)           │   │
│  │   ...                                                    │   │
│  │                                                         │   │
│  │ Suggested Actions:                                       │   │
│  │ ─────────────────────────────────────────────────────── │   │
│  │ 1. Refresh and check current lease state                │   │
│  │ 2. Verify owner instance health                         │   │
│  │ 3. Retry if appropriate                                 │   │
│  │                                                         │   │
│  │ Actions: [Refresh State] [Retry] [View Timeline]        │   │
│  │          [View Audit] [Report Issue]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 错误分类

| 错误类型 | 严重性 | 可重试 | 说明 |
|---------|--------|--------|------|
| LEASE_CONCURRENT_MODIFICATION | ⚠️ | ✅ | 并发修改，可重试 |
| LEASE_NOT_FOUND | ⚠️ | ❌ | 租约不存在 |
| OWNER_STILL_ACTIVE | ⚠️ | ❌ | 原 Owner 仍活跃 |
| DEPENDENCY_NOT_MET | ⚠️ | ✅ | 依赖未满足 |
| SYSTEM_ERROR | 🔴 | ⚠️ | 系统错误，需调查 |

---

## 五、与 Timeline/Audit 联动

### 三链联动架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Triple-chain Integration                                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Recovery   │────▶│   Timeline   │◀────│    Audit     │   │
│  │    Console   │     │   Explorer   │     │   Explorer   │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                    │            │
│         │   Click Event      │   Click Event      │            │
│         │   in Recovery      │   in Timeline      │            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Shared Event Detail Panel                   │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Event: LEASE_RECLAIMED                                 │   │
│  │  Timestamp: 2026-04-06 01:55:00                         │   │
│  │  Instance: instance-1                                   │   │
│  │  Lease: lease-12345                                     │   │
│  │                                                         │   │
│  │  Related Timeline Events: 3                             │   │
│  │  Related Audit Logs: 5                                  │   │
│  │  Related Recovery Ops: 1                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 联动场景

#### 场景 1: Recovery Scan → Timeline

**用户操作**: 在 Recovery Scan 结果中点击 `View Timeline`

**联动效果**:
1. 打开 Timeline Explorer
2. 自动筛选相关事件
3. 高亮显示 Recovery 相关事件
4. 时间范围自动设置

**API 调用**:
```typescript
// GET /api/v1/timeline?lease_id=lease-12345&event_type=lease_*
```

#### 场景 2: Recovery Scan → Audit

**用户操作**: 在 Recovery Scan 结果中点击 `View Audit`

**联动效果**:
1. 打开 Audit Explorer
2. 自动筛选相关日志
3. 高亮显示 Recovery 操作日志
4. 显示操作链

**API 调用**:
```typescript
// GET /api/v1/audit?lease_id=lease-12345&operation=recovery_*
```

#### 场景 3: Timeline → Recovery

**用户操作**: 在 Timeline 中点击 Recovery 相关事件

**联动效果**:
1. 在 Recovery Console 中显示详情
2. 自动加载相关 Scan 结果
3. 显示可执行的 Recovery 操作

**API 调用**:
```typescript
// GET /api/v1/recovery/status?event_id=event-123
```

---

## 六、API 端点

### Recovery Scan

```typescript
// POST /api/v1/recovery/scan
interface RecoveryScanRequest {
  scope?: string[];  // instance IDs
  timeRange?: {
    startTime: string;
    endTime: string;
  };
  types?: Array<'stale' | 'orphan' | 'conflict'>;
}

interface RecoveryScanResponse {
  scanId: string;
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: {
    staleLeases: Array<{
      leaseKey: string;
      ownerId: string;
      lastHeartbeat: string;
      staleSince: string;
    }>;
    orphanItems: Array<{
      itemKey: string;
      claimedBy?: string;
      leaseKey?: string;
    }>;
    conflicts: Array<{
      leaseKey: string;
      expectedOwner: string;
      actualOwner: string;
      conflictType: string;
    }>;
  };
}
```

### Replay Dry-run

```typescript
// POST /api/v1/replay/dry-run
interface ReplayDryRunRequest {
  target: string;  // lease-123 / item-456
  targetType: 'lease' | 'item' | 'correlation';
  operation: 'reclaim' | 'cleanup' | 'resolve';
  options?: {
    validateState: boolean;
    checkDependencies: boolean;
    simulateEffects: boolean;
  };
}

interface ReplayDryRunResponse {
  replayId: string;
  status: 'success' | 'failed' | 'warning';
  duration: number;
  mode: 'dry-run';
  steps: Array<{
    step: number;
    name: string;
    status: 'would_succeed' | 'would_fail' | 'warning';
    target?: string;
    details?: object;
    warnings?: string[];
  }>;
  warnings?: string[];
  errors?: string[];
}
```

### Live Execution

```typescript
// POST /api/v1/replay/execute
interface ReplayExecuteRequest {
  replayId: string;  // Reference to dry-run
  confirm: boolean;  // Must be true
  confirmText: string;  // Must be "I understand the risks"
  auditLog: boolean;  // Must be true
}

interface ReplayExecuteResponse {
  executionId: string;
  status: 'success' | 'failed';
  duration: number;
  mode: 'live';
  changes: Array<{
    type: string;
    entity: string;
    before?: any;
    after?: any;
  }>;
  timelineEvents: string[];  // Event IDs created
  auditLogs: string[];  // Log IDs created
}
```

---

## 七、Gray 10% 限制

### 只读模式

**Gray 10% 期间**: 🔒 **只读模式**

| 功能 | 状态 | 说明 |
|------|------|------|
| Recovery Scan | ✅ 启用 | 只读扫描 |
| Replay Dry-run | ✅ 启用 | 模拟执行 |
| Live Execution | ❌ 禁用 | 禁止真实执行 |
| Reclaim 操作 | ❌ 禁用 | 禁止回收 |
| Cleanup 操作 | ❌ 禁用 | 禁止清理 |
| Resolve 操作 | ❌ 禁用 | 禁止解决冲突 |

### 解锁条件

**Gray 10% 完成后**:
- ✅ Day 7 观察完成
- ✅ Gate 2 批准
- ✅ 完整测试验证
- ✅ 回滚流程验证

---

## 八、待办事项

### 设计

- [x] INCIDENT_TIMELINE_AUDIT_UI_SPEC.md
- [x] RECOVERY_REPLAY_CONSOLE_SPEC.md (本文档)
- [ ] DIAGNOSTICS_PANEL_SPEC.md
- [ ] UI_COMPONENT_LIBRARY.md

### 工程

- [ ] 创建 Recovery Console 组件
- [ ] 实现 Scan 配置面板
- [ ] 实现 Scan 结果展示
- [ ] 实现 Replay Dry-run 面板
- [ ] 实现结果/异常视图
- [ ] 实现 Timeline/Audit 联动
- [ ] API 集成
- [ ] Gray 10% 只读模式控制

---

_文档版本：0.1 (Draft)_  
_最后更新：2026-04-06_  
_下次审查：UI 工程启动后_
