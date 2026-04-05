# Phase 4.x-B1: 3+ Instance Scale Verification - Design

**阶段**: Phase 4.x-B1: Scale Verification (3+ Instances)  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: Phase 4.x-A2 ✅ Complete

---

## 一、设计目标

**B1 要回答的核心问题**:

> 从 2 实例扩到 3-4 实例后，协调层是否还能保持 owner、lease、item、suppression 四层一致。

**不做什么**:
- ❌ 不修改 A2 协议层实现
- ❌ 不引入新协调机制
- ❌ 不做高并发压力测试 (B2)
- ❌ 不做长期运行验证 (B3)

**做什么**:
- ✅ 验证 3-4 实例扩展场景
- ✅ 验证多实例竞争一致性
- ✅ 验证 stale instance 接管行为
- ✅ 验证跨实例 suppression 一致性

---

## 二、实例扩展场景 (A)

### 场景 1: 2 → 3 实例平滑扩容

**描述**: 从 2 实例运行状态平滑添加第 3 实例

**初始状态**:
- Instance 1: active, 持有 lease-1, lease-2
- Instance 2: active, 持有 lease-3

**操作序列**:
1. Instance 3 启动并注册
2. Instance 3 尝试 acquire lease-4
3. Instance 1/2/3 同时尝试 acquire lease-5

**预期行为**:
- Instance 3 成功注册为 active
- lease-4 被 Instance 3 成功 acquire
- lease-5 只有一个实例成功 (CAS 保证)
- 无 owner 漂移

**验证指标**:
- 注册成功率: 100%
- lease acquire 成功率: 100% (只有一个成功)
- owner mismatch: 0

---

### 场景 2: 3 实例竞争同一 lease / item

**描述**: 3 实例同时竞争同一资源

**初始状态**:
- Instance 1/2/3: 均为 active

**操作序列**:
1. T0: Instance 1/2/3 同时 acquire(lease_key: "shared-1")
2. T1: 成功者 claim(item_key: "shared-1")
3. T2: 失败者重试 acquire

**预期行为**:
- 只有一个实例 acquire 成功 (version CAS)
- 成功者可以 claim item
- 失败者返回 ALREADY_LEASED
- 失败者不能 claim item

**验证指标**:
- lease acquire 成功数: 1/3
- item claim 成功数: 1/3
- duplicate suppression: 0 (首次竞争)

---

### 场景 3: 1 实例故障，2 个存活实例竞争接管

**描述**: 单实例故障后的接管竞争

**初始状态**:
- Instance 1: active, 持有 lease-1, lease-2
- Instance 2: active
- Instance 3: active

**操作序列**:
1. Instance 1 停止心跳 (模拟故障)
2. 等待 heartbeat timeout (30s + 10s grace)
3. Instance 2 detectStaleInstances()
4. Instance 3 detectStaleInstances()
5. Instance 2 reclaimStaleLease(lease-1)
6. Instance 3 reclaimStaleLease(lease-1)

**预期行为**:
- Instance 1 被标记为 failed
- lease-1/lease-2 被标记为 stale
- 只有一个实例 reclaim 成功 (CAS)
- 失败者不能重复 reclaim

**验证指标**:
- stale detection 时间: ≤ 40s
- reclaim 成功数: 1/2
- owner mismatch: 0

---

### 场景 4: 4 实例下 suppression 一致性验证

**描述**: 4 实例共享 suppression 状态

**初始状态**:
- Instance 1/2/3/4: 均为 active
- 共享 suppression 存储

**操作序列**:
1. Instance 1 evaluate(correlation_id: "test-1") → ALLOWED
2. Instance 1 claim(item_key: "test-1")
3. Instance 2 evaluate(correlation_id: "test-1") → ?
4. Instance 3 evaluate(correlation_id: "test-1") → ?
5. Instance 4 evaluate(correlation_id: "test-1") → ?

**预期行为**:
- Instance 1: ALLOWED (first_seen)
- Instance 2/3/4: SUPPRESSED (duplicate)
- 只有 1 个 item 被创建

**验证指标**:
- suppression 命中率: 100% (3/3)
- duplicate item 创建: 0
- cross-instance consistency: 通过

---

## 三、关键指标 (B)

每组场景统一记录以下指标：

### 租赁层指标

| 指标 | 定义 | 目标 |
|------|------|------|
| `lease_acquire_success_rate` | acquire 成功数 / 总请求数 | ≥ 99% |
| `lease_reclaim_latency_ms` | detect stale → reclaim complete | ≤ 1000ms |
| `lease_owner_mismatch_count` | owner_instance_id 与实际不符次数 | 0 |

### 工作项层指标

| 指标 | 定义 | 目标 |
|------|------|------|
| `item_claim_success_rate` | claim 成功数 / 总请求数 | ≥ 99% |
| `item_transition_latency_ms` | claim → complete/fail 时间 | ≤ 5000ms |
| `duplicate_item_count` | 同一 correlation_id 的 item 数 | 0 |

### 去重层指标

| 指标 | 定义 | 目标 |
|------|------|------|
| `suppression_hit_rate` | SUPPRESSED 数 / 重复请求数 | 100% |
| `suppression_decision_latency_ms` | evaluate 决策时间 | ≤ 100ms |
| `cross_instance_inconsistency_count` | 实例间 suppression 状态不一致 | 0 |

### 实例层指标

| 指标 | 定义 | 目标 |
|------|------|------|
| `stale_detection_time_ms` | heartbeat 停止 → 标记 stale | ≤ 40000ms |
| `instance_register_success_rate` | 注册成功数 / 总注册数 | 100% |
| `instance_takeover_success_rate` | 接管成功数 / 总接次数 | 100% |

### 恢复层指标

| 指标 | 定义 | 目标 |
|------|------|------|
| `replay_conflict_count` | replay 模式下的冲突数 | 0 |
| `recovery_double_process_count` | recovery 导致的重复处理 | 0 |
| `ghost_owner_count` | 幽灵 owner (已失效但仍持有) | 0 |

---

## 四、失败分类 (C)

延续 A2-5 的 L1-L6 分类，新增 L7-L8：

| 类型 | 描述 | 定位 | 响应 |
|------|------|------|------|
| **L1** | Instance 层失败 | A2-1 | 修复 A2-1 |
| **L2** | Lease 层失败 | A2-2 | 修复 A2-2 |
| **L3** | Item 层失败 | A2-3 | 修复 A2-3 |
| **L4** | Suppression 层失败 | A2-4 | 修复 A2-4 |
| **L5** | 跨层一致性失败 | A2-1~4 接口 | 修复接口契约 |
| **L6** | 并发竞争失败 | A2-1~4 并发控制 | 修复 CAS 逻辑 |
| **L7** | **多实例接管失败** | **A2-1/A2-2** | **修复 stale detection/reclaim** |
| **L8** | **跨实例去重不一致** | **A2-4** | **修复共享状态同步** |

### L7: 多实例接管失败

**表现**:
- stale instance 未被检测到
- stale lease 未被 reclaim
- 多个实例同时 reclaim 同一 lease
- 接管后 item 状态不一致

**根因**:
- heartbeat timeout 配置不一致
- stale detection 逻辑竞争
- reclaim CAS 失败未重试

### L8: 跨实例去重不一致

**表现**:
- Instance 1 evaluate → ALLOWED
- Instance 2 evaluate (同一 correlation_id) → ALLOWED (应为 SUPPRESSED)
- 创建重复 item

**根因**:
- suppression 存储未共享
- 持久化延迟
- 缓存未同步

---

## 五、预期接管行为 (D)

### Stale Instance 判定

**条件** (满足任一):
- `last_heartbeat < now - timeout_ms - grace_period_ms`
- `status = 'failed'` (显式标记)

**timeout 配置**:
- `timeout_ms`: 30000ms (30s)
- `grace_period_ms`: 10000ms (10s)
- **总判定时间**: ≤ 40s

### Stale Lease 判定

**条件** (满足任一):
- `expires_at < now` (TTL 过期)
- `owner_instance_id` 对应 instance 为 failed

**检测时机**:
- 定期检测 (每 60s)
- acquire/reclaim 前检测

### Reclaim 后 Item 暴露

**行为**:
- lease 被 reclaim → item 失去有效 lease
- item 状态保持 claimed (不自动 fail)
- item 不在 active 列表 (getActiveItems 过滤)
- 其他实例可 claim (需先 reclaim lease)

**不允许的非法终态**:
- ❌ item 状态 = claimed 且 lease status = active 但 owner 不匹配
- ❌ item 状态 = completed 且 lease status = active
- ❌ 多个 item 同一 correlation_id 且状态均为 claimed

---

## 六、退出条件 (E)

**B1 通过标准** (全部满足):

### 场景覆盖

- [x] 场景 1: 2 → 3 实例平滑扩容 ✅
- [x] 场景 2: 3 实例竞争同一 lease/item ✅
- [x] 场景 3: 1 实例故障，2 实例竞争接管 ✅
- [x] 场景 4: 4 实例 suppression 一致性 ✅

### 指标达标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 3 实例场景通过率 | 100% | - | ⏳ |
| 4 实例基础竞争通过率 | 100% | - | ⏳ |
| owner 漂移次数 | 0 | - | ⏳ |
| 重复处理次数 | 0 | - | ⏳ |
| 非法状态迁移 | 0 | - | ⏳ |

### 失败分类

- [ ] 无 L7 级别失败 (多实例接管失败)
- [ ] 无 L8 级别失败 (跨实例去重不一致)
- [ ] L1-L6 失败可明确定位并修复

### 回归验证

- [ ] A2-1~A2-5 测试全绿 (371/371)
- [ ] B1 新增测试全绿 (目标：20-25 条)
- [ ] 无新增回归

---

## 七、测试策略

### 测试文件组织

```
tests/integration/b1-scale/
├── 3-instance-lease-contention.test.ts      # 3 实例 lease 竞争
├── 3-instance-item-claim-contention.test.ts # 3 实例 item 竞争
├── failed-instance-takeover.test.ts         # 故障实例接管
└── cross-instance-suppression.test.ts       # 跨实例 suppression
```

### 测试模式配置

```typescript
const instance1 = await setupInstance({
  dataDir: join(tmpdir(), 'test-b1-instance1'),
  heartbeatTimeoutMs: 30000,
  gracePeriodMs: 10000,
});

const instance2 = await setupInstance({
  dataDir: join(tmpdir(), 'test-b1-instance2'),
  sharedDataDir: join(tmpdir(), 'test-b1-shared'), // 共享存储
});

const instance3 = await setupInstance({
  dataDir: join(tmpdir(), 'test-b1-instance3'),
  sharedDataDir: join(tmpdir(), 'test-b1-shared'),
});
```

### 并发模拟

**方法 1: Promise.all 并发**
```typescript
const results = await Promise.all([
  instance1.leaseManager.acquire(input),
  instance2.leaseManager.acquire(input),
  instance3.leaseManager.acquire(input),
]);
```

**方法 2: 时间窗口并发**
```typescript
await Promise.all([
  delay(0).then(() => instance1.acquire(input)),
  delay(10).then(() => instance2.acquire(input)),
  delay(20).then(() => instance3.acquire(input)),
]);
```

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 共享存储难模拟 | 无法真实验证跨实例一致性 | 使用共享目录 + 文件锁模拟 |
| 并发时序难控制 | 测试结果不稳定 | 增加重试 + 确定性延迟 |
| 长时间等待 (40s stale) | 测试执行慢 | 缩短测试配置 (3s timeout) |
| 多实例资源消耗 | CI 环境资源不足 | 串行执行 + 及时清理 |

---

## 九、下一步

1. ✅ B1 设计完成
2. ⏳ 创建 PHASE_4xB1_SCENARIO_MATRIX.md
3. ⏳ 创建 PHASE_4xB1_METRICS_PLAN.md
4. ⏳ 实现 B1 测试骨架
5. ⏳ 执行 B1 测试
6. ⏳ B1 完成报告

---

_设计版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：场景矩阵 + 指标计划_
