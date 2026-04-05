# Phase 4.x-A2-5: Integration Tests - Test Plan

**阶段**: Phase 4.x-A2-5: Integration Tests  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: 
- Phase 4.x-A2-1 (Instance Registry) ✅
- Phase 4.x-A2-2 (Distributed Lease) ✅
- Phase 4.x-A2-3 (Work Item Protocol) ✅
- Phase 4.x-A2-4 (Duplicate Suppression) ✅

---

## 一、测试目标

**A2-5 不是单模块测试，而是验证 A2-1 ~ A2-4 组合协议**。

**核心目标**:
1. 验证跨层链路正确性 (instance → lease → item → suppression)
2. 验证多实例并发场景安全性
3. 验证 replay/recovery 下的一致性
4. 验证完整协议链闭环

**不目标**:
- ❌ 不测试单模块功能 (已在 A2-1~4 测过)
- ❌ 不测试业务逻辑 (由上层负责)
- ❌ 不修改 A2-1~4 核心协议

---

## 二、核心场景矩阵

### 2.1 Stale Instance → Stale Lease → Item 暴露链

**涉及层**: A2-1 + A2-2 + A2-3

**场景**:
```
Instance A (heartbeat 超时 30s + 10s grace)
    ↓
A2-1: detectStaleInstances() → mark 'failed'
    ↓
A2-2: detectStaleLeases() → find lease owned by failed instance
    ↓
A2-2: reclaimStaleLease() → mark 'reclaimed', reason: 'owner_failed'
    ↓
A2-3: item 失去 owner (lease released)
    ↓
Item 进入可处理状态 (不自动重分配)
```

**验证点**:
- [ ] Instance heartbeat 超时
- [ ] A2-1 标记 instance 为 'failed'
- [ ] A2-2 检测到 stale lease (owner status = 'failed')
- [ ] A2-2 reclaim stale lease (reason: 'owner_failed')
- [ ] A2-3 item 不再伪装为 active owner 持有
- [ ] A2-3 不自动重分配 (仅暴露)

**判定标准**:
| 指标 | 预期 |
|------|------|
| instance status | 'failed' |
| lease status | 'reclaimed' |
| lease reclaim reason | 'owner_failed' |
| item state | 'released' 或 'failed' |
| item owner | null |

**测试文件**: `tests/integration/a2-5/instance-lease-item-chain.test.ts`

---

### 2.2 Duplicate Suppression → Work Item Claim

**涉及层**: A2-4 + A2-3

**场景**:
```
Request 1 (correlation_id: "alert-123")
    ↓
A2-4: evaluate() → ALLOWED (first_seen)
    ↓
A2-3: claim() → success

Request 2 (correlation_id: "alert-123", duplicate)
    ↓
A2-4: evaluate() → SUPPRESSED (duplicate)
    ↓
A2-3: claim() → 不执行 (被 suppression 挡住)
```

**验证点**:
- [ ] 重复请求被 suppression 挡住
- [ ] 不创建重复 work item
- [ ] 被允许的请求才能 claim item
- [ ] replay-safe 场景不会误抑制合法恢复动作

**判定标准**:
| 指标 | 预期 |
|------|------|
| 第 1 次 evaluate | ALLOWED (first_seen) |
| 第 1 次 claim | success |
| 第 2 次 evaluate | SUPPRESSED (duplicate) |
| 第 2 次 claim | 不执行 |
| work item 数量 | 1 (不是 2) |

**测试文件**: `tests/integration/a2-5/item-suppression-integration.test.ts`

---

### 2.3 Lease 丢失 / Owner 失效 → Work Item 一致性

**涉及层**: A2-2 + A2-3

**场景**:
```
Owner Session 失效
    ↓
A2-2: lease 过期或被 reclaim
    ↓
A2-3: item 失去有效 lease
    ↓
Item 不再伪装为 active owner 持有
    ↓
getActiveItems() 不返回该 item
```

**验证点**:
- [ ] owner session 失效
- [ ] lease 失效或被 reclaim
- [ ] item 不再伪装为 active owner 持有
- [ ] active item 集合保持一致

**判定标准**:
| 指标 | 预期 |
|------|------|
| lease status | 'released' 或 'reclaimed' |
| item state | 'failed' 或 'released' |
| item in active list | false |
| item owner | null |

**测试文件**: `tests/integration/a2-5/lease-item-integration.test.ts`

---

### 2.4 Recovery / Replay 下 Suppression + Ownership 安全性

**涉及层**: A2-4 + A2-3 + A2-2

**场景**:
```
Replay Dry-Run
    ↓
A2-4: evaluate(replay_mode=true) → ALLOWED (replay_safe)
    ↓
A2-3: claim() → 不执行 (dry-run 模式)
    ↓
不触发误 claim

Recovery Scan
    ↓
A2-4: 旧 suppression record 已过期
    ↓
A2-4: evaluate() → ALLOWED (window_expired)
    ↓
A2-3: claim() → success (不被旧 record 误挡)
```

**验证点**:
- [ ] replay dry-run 不触发误 claim
- [ ] recovery scan 不因为旧 suppression record 被误挡
- [ ] ownership 与 suppression 在恢复后仍一致
- [ ] 不出现"旧 lease + 新 suppression"导致的幽灵状态

**判定标准**:
| 指标 | 预期 |
|------|------|
| replay evaluate | ALLOWED (replay_safe) |
| replay claim | 不执行 (dry-run) |
| expired suppression | ALLOWED (window_expired) |
| recovery claim | success |
| ownership/suppression 一致性 | 一致 |

**测试文件**: `tests/integration/a2-5/recovery-cross-layer-safety.test.ts`

---

### 2.5 多实例模拟场景

**涉及层**: A2-1 + A2-2 + A2-3 + A2-4

**Batch 1: 2 实例基础场景**

**场景 1: 两实例抢同一 lease**
```
Instance A + Instance B
    ↓
同时 acquire(lease_key: "incident:123")
    ↓
A2-2: 只有一个成功 (version CAS)
    ↓
另一个返回 'already_acquired'
```

**场景 2: 两实例 claim 同一 item**
```
Instance A + Instance B
    ↓
同时 claim(item_key: "incident:123")
    ↓
A2-3: 只有一个成功 (lease 绑定)
    ↓
另一个返回 'ALREADY_CLAIMED'
```

**场景 3: 一个实例失效，另一个接管**
```
Instance A (active) + Instance B (failed)
    ↓
Instance A detectStaleInstances()
    ↓
Instance A reclaimStaleLeases()
    ↓
Instance A 可 claim 原属于 B 的 item
```

**Batch 2: 3 实例扩展场景**

**场景 4: 3 实例混合竞争**
```
Instance A + B + C
    ↓
同时 acquire/claim 同一资源
    ↓
只有一个成功
```

**场景 5: 心跳抖动 + reclaim + claim 并发**
```
Instance A (heartbeat 抖动)
Instance B (detect + reclaim)
Instance C (claim)
    ↓
验证状态一致性
```

**判定标准**:
| 场景 | 预期 |
|------|------|
| 2 实例抢 lease | 1 成功，1 失败 |
| 2 实例 claim item | 1 成功，1 失败 |
| 1 实例失效接管 | 成功接管 |
| 3 实例竞争 | 1 成功，2 失败 |
| 心跳抖动并发 | 状态一致，无幽灵状态 |

**测试文件**: 
- `tests/integration/a2-5/multi-instance-2-node.test.ts`
- `tests/integration/a2-5/multi-instance-3-node.test.ts`

---

### 2.6 完整链路场景

**涉及层**: A2-1 + A2-2 + A2-3 + A2-4

**场景**:
```
Ingest Request (alert: "alert-123")
    ↓
A2-4: evaluate(suppression_scope: "alert_ingest")
    ↓
    ├─ SUPPRESSED → 返回，记录审计
    └─ ALLOWED → 继续
        ↓
A2-2: acquire(lease_key: "alert:123")
    ↓
    ├─ CONFLICT → 返回，释放 suppression
    └─ SUCCESS → 继续
        ↓
A2-3: claim(item_key: "alert:123")
    ↓
    ├─ CONFLICT → 返回，释放 lease
    └─ SUCCESS → 继续
        ↓
Business Logic (模拟)
    ↓
A2-3: complete() / fail()
    ↓
A2-2: release lease (自动)
    ↓
A2-4: suppression record 保持 (用于去重)
```

**验证点**:
- [ ] ingestion → suppression → lease → work item 全链路
- [ ] 各层失败回滚正确
- [ ] terminal state 正确
- [ ] 审计日志完整

**判定标准**:
| 阶段 | 预期 |
|------|------|
| suppression evaluate | ALLOWED (first_seen) |
| lease acquire | SUCCESS |
| work item claim | SUCCESS |
| business logic | 模拟完成 |
| work item complete | state: 'completed' |
| lease release | status: 'released' |
| suppression record | 保持 (用于去重) |

**测试文件**: `tests/integration/a2-5/full-chain-ingest-to-complete.test.ts`

---

## 三、测试分批策略

### Batch I: 双层集成 (1-2 人日)

**测试文件**:
- `tests/integration/a2-5/instance-lease-integration.test.ts` (A2-1 + A2-2)
- `tests/integration/a2-5/lease-item-integration.test.ts` (A2-2 + A2-3)
- `tests/integration/a2-5/item-suppression-integration.test.ts` (A2-3 + A2-4)

**场景**:
- stale instance → stale lease
- lease reclaim → item 暴露
- lease 丢失 → item 状态更新
- duplicate suppression → item claim 阻止

**预计**: 12-15 条测试

**验收标准**:
- [ ] 所有双层集成测试通过
- [ ] 无跨层一致性失败
- [ ] 回归测试全绿

---

### Batch II: 三层链路 (1-2 人日)

**测试文件**:
- `tests/integration/a2-5/instance-lease-item-chain.test.ts` (A2-1 + A2-2 + A2-3)
- `tests/integration/a2-5/lease-item-suppression-chain.test.ts` (A2-2 + A2-3 + A2-4)

**场景**:
- instance stale → lease reclaim → item 暴露
- lease 过期 → item fail → suppression 允许重试
- replay 模式 → suppression 绕过 → lease/item 恢复

**预计**: 10-12 条测试

**验收标准**:
- [ ] 所有三层链路测试通过
- [ ] 状态转换正确
- [ ] 回滚机制正确

---

### Batch III: 全链路与多实例 (1-2 人日)

**测试文件**:
- `tests/integration/a2-5/full-chain-ingest-to-complete.test.ts` (完整链路)
- `tests/integration/a2-5/multi-instance-2-node.test.ts` (2 实例)
- `tests/integration/a2-5/multi-instance-3-node.test.ts` (3 实例)
- `tests/integration/a2-5/recovery-cross-layer-safety.test.ts` (recovery 安全性)

**场景**:
- 完整链路：ingest → suppression → lease → item → complete
- 2 实例竞争 lease/item
- 2 实例失效接管
- 3 实例混合竞争
- replay/recovery 跨层安全性

**预计**: 15-20 条测试

**验收标准**:
- [ ] 所有全链路测试通过
- [ ] 多实例并发安全
- [ ] replay/recovery 安全性验证通过

---

## 四、Cross-Layer Invariants (跨层不变式)

### Invariant 1: Instance-Lease 一致性
```typescript
∀ lease: lease.owner_instance_id = instance.id
  ⇒ instance.status = 'active'
```

**验证**: instance-lease-integration.test.ts

---

### Invariant 2: Lease-Item 绑定
```typescript
∀ item: item.state = 'claimed' ∨ item.state = 'running'
  ⇒ ∃ lease: lease.lease_key = item.lease_key ∧ lease.status = 'active'
```

**验证**: lease-item-integration.test.ts

---

### Invariant 3: Suppression-Item 互斥
```typescript
∀ suppression: suppression.decision = 'SUPPRESSED'
  ⇒ ¬∃ item: item.correlation_id = suppression.correlation_id ∧ item.state = 'claimed'
```

**验证**: item-suppression-integration.test.ts

---

### Invariant 4: Replay 安全性
```typescript
∀ evaluate: evaluate.replay_mode = true
  ⇒ evaluate.decision = 'ALLOWED' ∧ ¬∃ side_effects
```

**验证**: recovery-cross-layer-safety.test.ts

---

## 五、Expected Failure Classifications (预期失败分类)

| 失败类型 | 描述 | 定位层级 | 响应 |
|---------|------|---------|------|
| **L1: Instance 层失败** | heartbeat 超时、instance 标记错误 | A2-1 | 修复 A2-1 |
| **L2: Lease 层失败** | acquire 失败、reclaim 逻辑错误 | A2-2 | 修复 A2-2 |
| **L3: Item 层失败** | claim 失败、状态转换错误 | A2-3 | 修复 A2-3 |
| **L4: Suppression 层失败** | evaluate 错误、TTL 计算错误 | A2-4 | 修复 A2-4 |
| **L5: 跨层一致性失败** | instance/lease 不一致、lease/item 不一致 | A2-1~4 | 修复接口契约 |
| **L6: 并发竞争失败** | 多实例竞争条件、幽灵状态 | A2-1~4 | 修复并发控制 |

---

## 六、判定标准模板

每个测试场景统一记录：

```typescript
interface TestScenarioExpectation {
  // 参与实例
  instanceIds: string[];
  sessionIds: string[];
  
  // 关键键
  leaseKey?: string;
  itemKey?: string;
  suppressionKey?: string;
  
  // 预期 owner
  expectedOwner?: {
    instanceId: string;
    sessionId: string;
  };
  
  // 预期状态转换
  expectedStateTransitions: Array<{
    component: 'instance' | 'lease' | 'item' | 'suppression';
    from: string;
    to: string;
  }>;
  
  // 预期审计/时间线证据
  expectedAuditEvents: string[];
  
  // 允许的终态
  allowedTerminalStates: string[];
  
  // 禁止的结果
  forbiddenOutcomes: string[];
}
```

---

## 七、测试覆盖矩阵

| 场景组 | 测试文件 | 用例数 | 批次 |
|--------|---------|--------|------|
| A2-1 + A2-2 集成 | instance-lease-integration.test.ts | 5 | Batch I |
| A2-2 + A2-3 集成 | lease-item-integration.test.ts | 5 | Batch I |
| A2-3 + A2-4 集成 | item-suppression-integration.test.ts | 5 | Batch I |
| A2-1 + A2-2 + A2-3 链路 | instance-lease-item-chain.test.ts | 6 | Batch II |
| A2-2 + A2-3 + A2-4 链路 | lease-item-suppression-chain.test.ts | 6 | Batch II |
| 完整链路 | full-chain-ingest-to-complete.test.ts | 6 | Batch III |
| 2 实例场景 | multi-instance-2-node.test.ts | 6 | Batch III |
| 3 实例场景 | multi-instance-3-node.test.ts | 6 | Batch III |
| recovery 安全性 | recovery-cross-layer-safety.test.ts | 5 | Batch III |
| **总计** | **9 文件** | **50** | **3 批次** |

---

## 八、进入标准与完成标准

### 8.1 进入标准 (Entry Criteria)

- [ ] A2-1 实现完成 + 测试通过 (46/46)
- [ ] A2-2 实现完成 + 测试通过 (45/45)
- [ ] A2-3 实现完成 + 测试通过 (64/64)
- [ ] A2-4 实现完成 + 测试通过 (41/41)
- [ ] 完整测试套件全绿 (315/315)
- [ ] A2-5 设计文档审阅通过

### 8.2 完成标准 (Exit Criteria)

- [ ] Batch I 测试全部通过 (12-15 条)
- [ ] Batch II 测试全部通过 (10-12 条)
- [ ] Batch III 测试全部通过 (15-20 条)
- [ ] 总测试数 ≥ 50 条
- [ ] 回归测试全绿 (≥315 条)
- [ ] 无 L5/L6 级别失败
- [ ] A2-5 完成文档提交

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 场景太碎 | 测了很多但没打到真正的跨层风险 | 按场景矩阵组织，确保覆盖 6 组核心场景 |
| 场景太大 | 失败后不知道是哪一层出问题 | 使用 Failure Classifications 快速定位 |
| 并发难复现 | 竞争条件难以稳定触发 | 使用确定性并发测试框架，增加重试 |
| replay 语义复杂 | 容易误测 | 明确 replay 模式边界，dry-run vs real |

---

## 十、下一步

1. ✅ A2-5 测试计划审阅完成
2. ⏳ 开始 Batch I 实现 (双层集成)
3. ⏳ Batch II 实现 (三层链路)
4. ⏳ Batch III 实现 (全链路 + 多实例)
5. ⏳ A2-5 完成文档

---

_测试计划版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：Batch I 实现_
