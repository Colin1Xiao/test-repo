# Phase 4.x-B1: Scenario Matrix

**阶段**: Phase 4.x-B1: Scale Verification  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**

---

## 场景矩阵总览

| 场景 ID | 场景名 | 实例数 | 初始状态 | 测试文件 | 用例数 |
|--------|--------|--------|---------|---------|--------|
| B1-S1 | 2→3 实例平滑扩容 | 3 | 2 active | 3-instance-lease-contention.test.ts | 3 |
| B1-S2 | 3 实例竞争同一 lease | 3 | 3 active | 3-instance-lease-contention.test.ts | 4 |
| B1-S3 | 3 实例竞争同一 item | 3 | 3 active | 3-instance-item-claim-contention.test.ts | 4 |
| B1-S4 | 1 实例故障接管 | 3 | 1 failed, 2 active | failed-instance-takeover.test.ts | 5 |
| B1-S5 | 4 实例 suppression 一致性 | 4 | 4 active | cross-instance-suppression.test.ts | 4 |
| **总计** | **5 场景** | **3-4** | **-** | **4 文件** | **20** |

---

## B1-S1: 2→3 实例平滑扩容

| 字段 | 值 |
|------|------|
| **场景名** | 2→3 实例平滑扩容 |
| **实例数** | 3 (Instance 1/2 已存在，Instance 3 新加入) |
| **初始状态** | Instance 1: active, 持有 lease-1, lease-2<br>Instance 2: active, 持有 lease-3<br>Instance 3: 未注册 |
| **操作序列** | 1. Instance 3 启动并注册<br>2. Instance 3 acquire(lease-4)<br>3. Instance 1/2/3 同时 acquire(lease-5) |
| **预期 owner** | lease-4: Instance 3<br>lease-5: Instance 1/2/3 之一 |
| **预期 lease 状态** | lease-1/2/3: active (原 owner)<br>lease-4: active (Instance 3)<br>lease-5: active (成功者) |
| **预期 item 状态** | 无 item 操作 |
| **预期 suppression 行为** | 不涉及 |
| **失败归类** | L1 (注册失败) / L2 (lease 竞争失败) |

### 验证断言

```typescript
// Instance 3 注册成功
const identity3 = await instance3.registry.getIdentity();
expect(identity3.status).toBe('active');

// lease-4 被 Instance 3 acquire
const lease4Result = await instance3.leaseManager.acquire({ lease_key: 'lease-4', ... });
expect(lease4Result.success).toBe(true);

// lease-5 只有一个成功者
const lease5Results = await Promise.all([
  instance1.leaseManager.acquire({ lease_key: 'lease-5', ... }),
  instance2.leaseManager.acquire({ lease_key: 'lease-5', ... }),
  instance3.leaseManager.acquire({ lease_key: 'lease-5', ... }),
]);
const successCount = lease5Results.filter(r => r.success).length;
expect(successCount).toBe(1);
```

---

## B1-S2: 3 实例竞争同一 lease

| 字段 | 值 |
|------|------|
| **场景名** | 3 实例竞争同一 lease |
| **实例数** | 3 |
| **初始状态** | Instance 1/2/3: 均为 active |
| **操作序列** | 1. T0: Instance 1/2/3 同时 acquire(lease_key: "shared-1")<br>2. T1: 成功者 claim(item_key: "shared-1")<br>3. T2: 失败者重试 acquire |
| **预期 owner** | shared-1: Instance 1/2/3 之一 |
| **预期 lease 状态** | shared-1: active (成功者持有) |
| **预期 item 状态** | shared-1: claimed (成功者 claim) |
| **预期 suppression 行为** | 不涉及 (首次竞争) |
| **失败归类** | L2 (lease CAS 失败) / L6 (并发竞争) |

### 验证断言

```typescript
// 只有一个 acquire 成功
const acquireResults = await Promise.all([
  instance1.leaseManager.acquire({ lease_key: 'shared-1', ... }),
  instance2.leaseManager.acquire({ lease_key: 'shared-1', ... }),
  instance3.leaseManager.acquire({ lease_key: 'shared-1', ... }),
]);
expect(acquireResults.filter(r => r.success).length).toBe(1);

// 成功者可以 claim
const winner = acquireResults.findIndex(r => r.success);
const claimResult = await [instance1, instance2, instance3][winner].itemCoordinator.claim({
  item_key: 'shared-1',
  ...
});
expect(claimResult.success).toBe(true);

// 失败者不能 claim
const loserClaim = await [instance1, instance2, instance3][(winner + 1) % 3].itemCoordinator.claim({
  item_key: 'shared-1',
  ...
});
expect(loserClaim.success).toBe(false);
```

---

## B1-S3: 3 实例竞争同一 item

| 字段 | 值 |
|------|------|
| **场景名** | 3 实例竞争同一 item |
| **实例数** | 3 |
| **初始状态** | Instance 1/2/3: 均为 active |
| **操作序列** | 1. Instance 1/2/3 同时 claim(item_key: "item-shared-1")<br>2. 验证只有一个成功<br>3. 失败者重试 claim |
| **预期 owner** | item-shared-1: Instance 1/2/3 之一 |
| **预期 lease 状态** | item-shared-1: active (绑定到成功者) |
| **预期 item 状态** | item-shared-1: claimed (只有一个) |
| **预期 suppression 行为** | 不涉及 (无 suppression) |
| **失败归类** | L3 (item 竞争失败) / L6 (并发竞争) |

### 验证断言

```typescript
// 只有一个 claim 成功
const claimResults = await Promise.all([
  instance1.itemCoordinator.claim({ item_key: 'item-shared-1', ... }),
  instance2.itemCoordinator.claim({ item_key: 'item-shared-1', ... }),
  instance3.itemCoordinator.claim({ item_key: 'item-shared-1', ... }),
]);
expect(claimResults.filter(r => r.success).length).toBe(1);

// 只有一个 active item
const activeItems = await instance1.itemCoordinator.getActiveItems();
const matchingItems = activeItems.filter(i => i.item_key === 'item-shared-1');
expect(matchingItems.length).toBe(1);
```

---

## B1-S4: 1 实例故障接管

| 字段 | 值 |
|------|------|
| **场景名** | 1 实例故障，2 实例竞争接管 |
| **实例数** | 3 |
| **初始状态** | Instance 1: active, 持有 lease-1, lease-2<br>Instance 2: active<br>Instance 3: active |
| **操作序列** | 1. Instance 1 停止心跳 (模拟故障)<br>2. 等待 heartbeat timeout (30s + 10s grace)<br>3. Instance 2 detectStaleInstances()<br>4. Instance 3 detectStaleInstances()<br>5. Instance 2 reclaimStaleLease(lease-1)<br>6. Instance 3 reclaimStaleLease(lease-1) |
| **预期 owner** | lease-1: Instance 2 或 Instance 3 (先 reclaim 者) |
| **预期 lease 状态** | lease-1: reclaimed<br>lease-2: reclaimed (或待 reclaim) |
| **预期 item 状态** | 关联 item: 失去有效 lease (不自动 fail) |
| **预期 suppression 行为** | 不涉及 |
| **失败归类** | L7 (接管失败) / L2 (reclaim CAS 失败) |

### 验证断言

```typescript
// Instance 1 被标记为 failed
const instances = await instance2.registry.getFailedInstances();
expect(instances.some(i => i.instance_id === identity1.instance_id)).toBe(true);

// lease-1 被标记为 stale
const staleLeases = await instance2.leaseManager.detectStaleLeases();
expect(staleLeases.some(l => l.lease_key === 'lease-1')).toBe(true);

// 只有一个 reclaim 成功
const reclaimResults = await Promise.all([
  instance2.leaseManager.reclaimStaleLease({ lease_key: 'lease-1', ... }),
  instance3.leaseManager.reclaimStaleLease({ lease_key: 'lease-1', ... }),
]);
expect(reclaimResults.filter(r => r.success).length).toBe(1);

// 成功者成为新 owner
const winner = reclaimResults.findIndex(r => r.success);
const lease1 = await [instance2, instance3][winner].leaseManager.getLease('lease-1');
expect(lease1.status).toBe('reclaimed');
```

---

## B1-S5: 4 实例 suppression 一致性

| 字段 | 值 |
|------|------|
| **场景名** | 4 实例 suppression 一致性验证 |
| **实例数** | 4 |
| **初始状态** | Instance 1/2/3/4: 均为 active<br>共享 suppression 存储 |
| **操作序列** | 1. Instance 1 evaluate(correlation_id: "test-1")<br>2. Instance 1 claim(item_key: "test-1")<br>3. Instance 2 evaluate(correlation_id: "test-1")<br>4. Instance 3 evaluate(correlation_id: "test-1")<br>5. Instance 4 evaluate(correlation_id: "test-1") |
| **预期 owner** | test-1: Instance 1 |
| **预期 lease 状态** | test-1: active (Instance 1 持有) |
| **预期 item 状态** | test-1: claimed (Instance 1) |
| **预期 suppression 行为** | Instance 1: ALLOWED (first_seen)<br>Instance 2/3/4: SUPPRESSED (duplicate) |
| **失败归类** | L8 (跨实例去重不一致) / L4 (suppression 失败) |

### 验证断言

```typescript
// Instance 1: ALLOWED
const suppression1 = await instance1.suppressionManager.evaluate({
  correlation_id: 'test-1',
  ...
});
expect(suppression1.decision).toBe('ALLOWED');

// Instance 1 claim
await instance1.itemCoordinator.claim({ item_key: 'test-1', ... });

// Instance 2/3/4: SUPPRESSED
const suppression2 = await instance2.suppressionManager.evaluate({
  correlation_id: 'test-1',
  ...
});
expect(suppression2.decision).toBe('SUPPRESSED');

const suppression3 = await instance3.suppressionManager.evaluate({
  correlation_id: 'test-1',
  ...
});
expect(suppression3.decision).toBe('SUPPRESSED');

const suppression4 = await instance4.suppressionManager.evaluate({
  correlation_id: 'test-1',
  ...
});
expect(suppression4.decision).toBe('SUPPRESSED');

// 只有一个 item 被创建
const allActiveItems = await instance1.itemCoordinator.getActiveItems();
const matchingItems = allActiveItems.filter(i => i.item_key === 'test-1');
expect(matchingItems.length).toBe(1);
```

---

## 场景执行顺序

**推荐顺序**:

1. **B1-S1** (2→3 实例平滑扩容) - 基础扩展验证
2. **B1-S2** (3 实例 lease 竞争) - 并发竞争验证
3. **B1-S3** (3 实例 item 竞争) - item 层并发验证
4. **B1-S4** (1 实例故障接管) - stale 检测与接管验证
5. **B1-S5** (4 实例 suppression 一致性) - 跨实例去重验证

**执行时间预估**:
- B1-S1: 5 min
- B1-S2: 5 min
- B1-S3: 5 min
- B1-S4: 10 min (含 40s stale timeout)
- B1-S5: 5 min
- **总计**: ~30 min

---

## 失败场景处理

| 失败类型 | 响应 |
|---------|------|
| L1-L6 | 记录并修复对应层 |
| L7 (接管失败) | 检查 stale detection 逻辑 + reclaim CAS |
| L8 (去重不一致) | 检查共享存储同步机制 |

---

_场景矩阵版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：指标计划 (PHASE_4xB1_METRICS_PLAN.md)_
