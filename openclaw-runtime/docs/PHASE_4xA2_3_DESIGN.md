# Phase 4.x-A2-3: Work Item Protocol Design

**阶段**: Phase 4.x-A2-3: Work Item Protocol  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: 
- Phase 4.x-A2-1 (Instance Registry) ✅
- Phase 4.x-A2-2 (Distributed Lease) ✅

---

## 一、设计决策总结

### 1.1 Work Item 唯一键

**决策**: 与 A2-2 一致的抽象风格

```typescript
interface WorkItemRecord {
  item_key: string;     // 全局唯一 (e.g., "incident:123")
  item_type: string;    // 类型 (e.g., "incident", "recovery_scan")
  // ...
}
```

**理由**:
- ✅ 与 lease_key/lease_type 保持一致
- ✅ 便于 lease 和 item 自然映射
- ✅ 不耦死特定业务类型

---

### 1.2 Work Item 与 Lease 关系

**决策**: 1:1 绑定，A2-3 依赖 A2-2

```typescript
interface WorkItemRecord {
  lease_key?: string;  // 与 item_key 1:1 绑定
  owner_instance_id?: string;
  owner_session_id?: string;
}
```

**claim 语义**:
```
claim success = item 状态变化 + lease acquire 成功
```

**理由**:
- ✅ active item 必须有对应 lease
- ✅ A2-3 不自己管理 ownership
- ✅ 依赖 LeaseManager

---

### 1.3 生命周期状态集合

**决策**: 最小状态集 (6 个状态)

```typescript
type WorkItemState = 
  | 'pending'     // 初始状态，可被 claim
  | 'claimed'     // 已认领，有 active lease
  | 'running'     // 执行中 (可选，用于长任务)
  | 'completed'   // 终态：成功完成
  | 'failed'      // 终态：执行失败 (可重试)
  | 'released';   // 终态：主动释放 (不执行)
```

**状态转换**:
```
pending → claimed → running → completed
                    ↓           ↓
                failed      failed
                    ↓
                released
```

**终态**:
- ✅ `completed` - 成功完成，不可变
- ✅ `failed` - 执行失败，可重试
- ✅ `released` - 主动释放，不可变

---

### 1.4 操作结果语义

**决策**: 结果驱动，定义清晰返回类型

| 操作 | 成功 | 失败/冲突 |
|------|------|----------|
| claim | ✅ success | ❌ ALREADY_CLAIMED / LEASE_CONFLICT |
| renew | ✅ success | ❌ OWNER_MISMATCH / LEASE_MISSING |
| complete | ✅ success | ❌ INVALID_STATE / OWNER_MISMATCH |
| fail | ✅ success | ❌ INVALID_STATE / OWNER_MISMATCH |
| release | ✅ success (幂等) | ❌ INVALID_STATE / OWNER_MISMATCH |

---

### 1.5 状态与 Lease 一致性

**决策**: 严格一致性约束

| 规则 | 约束 |
|------|------|
| claimed/running | 必须存在 active lease |
| completed/failed/released | lease 必须被释放 |
| lease lost | item 状态降级为 failed |
| stale lease reclaim | item 暴露给后续处理 |

**理由**:
- ✅ claimed/running → active lease
- ✅ 终态 → lease released
- ✅ lease lost → item failed
- ✅ A2-3 不发明新 lease 规则

---

### 1.6 持久化与恢复

**决策**: 与 A2-1/A2-2 一致

**存储结构**:
```
~/.openclaw/runtime/work_items/
├── work_items_log.jsonl     // append-only
├── work_items_snapshot.json // 定期快照
└── work_items.json          // 内存缓存
```

**恢复语义**:
- ✅ snapshot + log replay
- ✅ lease 状态同步恢复
- ✅ corrupted log 容错

---

### 1.7 A2-3 边界

**决策**: 协调协议层，不处理业务逻辑

**A2-3 职责**:
- ✅ item protocol (claim/renew/complete/fail/release)
- ✅ ownership consistency
- ✅ lifecycle transitions
- ✅ recovery-safe coordination

**A2-3 不负责**:
- ❌ incident 业务语义
- ❌ recovery_scan 业务动作
- ❌ replay_run 内容本身
- ❌ connector_job 业务逻辑

---

## 二、核心接口

### 2.1 WorkItemRecord Schema

```typescript
interface WorkItemRecord {
  item_key: string;
  item_type: string;
  state: WorkItemState;
  
  // Ownership (从 lease 同步)
  owner_instance_id?: string;
  owner_session_id?: string;
  lease_key?: string;
  
  // Timestamps
  claimed_at?: number;
  updated_at: number;
  completed_at?: number;
  failed_at?: number;
  released_at?: number;
  
  // Concurrency
  version: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
}
```

---

### 2.2 WorkItemCoordinator Interface

```typescript
interface WorkItemCoordinator {
  // 生命周期操作
  claim(input: ClaimWorkItemInput): Promise<ClaimResult>;
  renew(input: RenewWorkItemInput): Promise<RenewResult>;
  complete(input: CompleteWorkItemInput): Promise<CompleteResult>;
  fail(input: FailWorkItemInput): Promise<FailResult>;
  release(input: ReleaseWorkItemInput): Promise<ReleaseResult>;
  
  // 查询
  getItem(item_key: string): Promise<WorkItemRecord | null>;
  getActiveItems(): Promise<WorkItemRecord[]>;
  getItemsByType(item_type: string): Promise<WorkItemRecord[]>;
  getItemsByOwner(instance_id: string): Promise<WorkItemRecord[]>;
}
```

---

### 2.3 Input Types

```typescript
interface ClaimWorkItemInput {
  item_key: string;
  item_type: string;
  owner_instance_id: string;
  owner_session_id: string;
  lease_ttl_ms?: number;
  metadata?: Record<string, unknown>;
}

interface RenewWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  lease_ttl_ms?: number;
}

interface CompleteWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  result?: unknown;
}

interface FailWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  error: string;
  retryable?: boolean;
}

interface ReleaseWorkItemInput {
  item_key: string;
  owner_instance_id: string;
  owner_session_id: string;
  reason?: string;
}
```

---

### 2.4 Result Types

```typescript
type ClaimResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'ALREADY_CLAIMED' | 'LEASE_CONFLICT' | 'INVALID_STATE'; message: string };

type RenewResult =
  | { success: true; item: WorkItemRecord; lease: LeaseRecord }
  | { success: false; error: 'OWNER_MISMATCH' | 'LEASE_MISSING' | 'INVALID_STATE'; message: string };

type CompleteResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };

type FailResult =
  | { success: true; item: WorkItemRecord }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };

type ReleaseResult =
  | { success: true; item: WorkItemRecord; already_released?: boolean }
  | { success: false; error: 'INVALID_STATE' | 'OWNER_MISMATCH'; message: string };
```

---

### 2.5 WorkItemEvent Schema

```typescript
type WorkItemEvent = {
  type: 'item_created' | 'item_claimed' | 'item_renewed' | 'item_completed' | 'item_failed' | 'item_released';
  item_key: string;
  timestamp: number;
  data: Partial<WorkItemRecord> & {
    previous_state?: WorkItemState;
    new_state?: WorkItemState;
    reason?: string;
    error?: string;
    result?: unknown;
  };
};
```

---

## 三、状态机

### 3.1 状态转换表

| 当前状态 | claim | renew | complete | fail | release |
|----------|-------|-------|----------|------|---------|
| pending | ✅ claimed | ❌ | ❌ | ❌ | ✅ released |
| claimed | ❌ | ✅ renewed | ✅ completed | ✅ failed | ✅ released |
| running | ❌ | ✅ renewed | ✅ completed | ✅ failed | ✅ released |
| completed | ❌ | ❌ | ❌ | ❌ | ❌ |
| failed | ❌ | ❌ | ❌ | ❌ | ✅ released |
| released | ❌ | ❌ | ❌ | ❌ | ❌ (no-op) |

### 3.2 终态

| 终态 | 描述 | 可恢复 |
|------|------|--------|
| completed | 成功完成 | ❌ 不可变 |
| failed | 执行失败 | ✅ 可重试 (回到 pending) |
| released | 主动释放 | ❌ 不可变 |

---

## 四、Lease 一致性规则

### 4.1 约束验证

```typescript
async validateLeaseConsistency(item: WorkItemRecord): Promise<boolean> {
  // 约束 1: claimed/running 必须存在 active lease
  if (item.state === 'claimed' || item.state === 'running') {
    if (!item.lease_key) return false;
    
    const lease = await this.leaseManager.getLease(item.lease_key);
    return lease !== null && lease.status === 'active';
  }
  return true;
}
```

### 4.2 终态清理

```typescript
async releaseLeaseOnTerminalState(item: WorkItemRecord): Promise<void> {
  if (item.state === 'completed' || item.state === 'failed' || item.state === 'released') {
    if (item.lease_key && item.owner_instance_id && item.owner_session_id) {
      await this.leaseManager.release({
        lease_key: item.lease_key,
        owner_instance_id: item.owner_instance_id,
        owner_session_id: item.owner_session_id,
      });
    }
  }
}
```

### 4.3 Lease Lost 处理

```typescript
async handleLeaseLoss(item: WorkItemRecord): Promise<void> {
  if (!item.lease_key) return;
  
  const lease = await this.leaseManager.getLease(item.lease_key);
  
  if (!lease || lease.status !== 'active') {
    // Lease lost, mark item as failed
    item.state = 'failed';
    item.failed_at = Date.now();
    item.metadata = {
      ...item.metadata,
      failure_reason: 'lease_lost',
    };
  }
}
```

---

## 五、配置

### 5.1 WorkItemConfig

```typescript
interface WorkItemConfig {
  default_lease_ttl_ms: number;    // 默认 lease TTL (30s)
  max_lease_ttl_ms: number;        // 最大 lease TTL (300s)
  auto_release_on_complete: boolean; // 完成后自动释放 lease (true)
  auto_fail_on_lease_loss: boolean;  // lease 丢失自动失败 (true)
}

const DEFAULT_WORK_ITEM_CONFIG: WorkItemConfig = {
  default_lease_ttl_ms: 30000,        // 30s
  max_lease_ttl_ms: 300000,           // 5min
  auto_release_on_complete: true,
  auto_fail_on_lease_loss: true,
};
```

---

## 六、实现计划

### 6.1 Phase 4.x-A2-3-1: WorkItemCoordinator 核心 (1-2 人日)

**任务**:
- [ ] WorkItemRecord 类型定义
- [ ] WorkItemCoordinator 接口定义
- [ ] claim / renew / complete / fail / release 实现
- [ ] lease 一致性验证

**验收**:
- [ ] claim 成功/冲突路径
- [ ] renew owner 验证
- [ ] complete/fail 状态转换
- [ ] release 幂等性

### 6.2 Phase 4.x-A2-3-2: Lease 集成 (1 人日)

**任务**:
- [ ] claim 时 acquire lease
- [ ] renew 时 renew lease
- [ ] complete/fail/release 时 release lease
- [ ] lease lost 检测与处理

**验收**:
- [ ] lease 1:1 绑定
- [ ] lease 一致性验证
- [ ] lease lost 自动失败

### 6.3 Phase 4.x-A2-3-3: 持久化 (1 人日)

**任务**:
- [ ] work_items_log.jsonl append-only
- [ ] work_items_snapshot.json 定期快照
- [ ] 崩溃恢复 (replay log + snapshot)

**验收**:
- [ ] 事件写入 log
- [ ] snapshot 恢复
- [ ] lease 状态同步恢复

### 6.4 Phase 4.x-A2-3-4: 测试 (2-3 人日)

**任务**:
- [ ] claim 测试 (6 条)
- [ ] renew 测试 (4 条)
- [ ] complete/fail 测试 (6 条)
- [ ] release 测试 (4 条)
- [ ] lease 一致性测试 (5 条)
- [ ] recovery 测试 (5 条)

**验收**:
- [ ] 30+ 测试通过
- [ ] 无回归失败

---

## 七、测试策略

### 7.1 测试模式配置

```typescript
const coordinator = new WorkItemCoordinator({
  dataDir,
  leaseManager,
  registry,
  autoCleanup: false,
  config: {
    default_lease_ttl_ms: 100,  // 快速测试
  },
});
```

### 7.2 测试覆盖矩阵

| 契约 | 测试 | 用例数 |
|------|------|--------|
| claim 成功/冲突 | claim.test.ts | 6 |
| renew owner 验证 | renew.test.ts | 4 |
| complete/fail 状态转换 | complete-fail.test.ts | 6 |
| release 幂等性 | release.test.ts | 4 |
| lease 一致性 | lease-consistency.test.ts | 5 |
| 持久化恢复 | recovery.test.ts | 5 |
| **总计** | **6 文件** | **30+** |

---

## 八、依赖关系

### 8.1 依赖 A2-2

```typescript
// WorkItemCoordinator 依赖 LeaseManager
async claim(input): Promise<ClaimResult> {
  // Acquire lease first
  const leaseResult = await this.leaseManager.acquire({
    lease_key: input.item_key,
    lease_type: input.item_type,
    owner_instance_id: input.owner_instance_id,
    owner_session_id: input.owner_session_id,
    ttl_ms: input.lease_ttl_ms,
  });
  
  if (!leaseResult.success) {
    return { success: false, error: 'LEASE_CONFLICT' };
  }
  
  // Then update item state
  // ...
}
```

### 8.2 被业务层依赖

```typescript
// Business Logic 依赖 WorkItemCoordinator
async processIncident(incidentId: string): Promise<void> {
  const itemKey = `incident:${incidentId}`;
  
  // Claim work item
  const claimResult = await coordinator.claim({
    item_key: itemKey,
    item_type: 'incident',
    owner_instance_id: this.instanceId,
    owner_session_id: this.sessionId,
  });
  
  if (!claimResult.success) {
    return; // Already claimed by another instance
  }
  
  // Process incident (business logic)
  // ...
  
  // Complete work item
  await coordinator.complete({
    item_key: itemKey,
    owner_instance_id: this.instanceId,
    owner_session_id: this.sessionId,
    result: { processed: true },
  });
}
```

---

## 九、风险与缓解

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| lease 与 item 状态不一致 | 中 | 高 | 严格一致性验证 + 事务性更新 |
| lease lost 未检测 | 低 | 高 | 定期验证 + auto_fail_on_lease_loss |
| 终态 lease 未释放 | 低 | 中 | 自动释放 + 审计日志 |

### 9.2 迁移风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 旧 item 格式不兼容 | 低 | 中 | 向后兼容模式 |
| lease TTL 配置不当 | 中 | 中 | 默认值 + 文档 |

---

## 十、验收标准

### 10.1 Phase 4.x-A2-3 完成标准

- [ ] WorkItemCoordinator 实现完成
- [ ] claim/renew/complete/fail/release 测试通过
- [ ] lease 一致性测试通过
- [ ] 持久化测试通过
- [ ] 30+ 测试全部通过
- [ ] 无回归失败

### 10.2 质量指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 测试通过率 | 100% | - |
| 测试用例数 | ≥30 | - |
| 回归失败 | 0 | - |
| 文档完整性 | 完整 | ✅ |

---

_文档版本：1.0  
创建时间：2026-04-05 15:50 CST_
