# Phase 4.x-B1: Metrics Plan

**阶段**: Phase 4.x-B1: Scale Verification  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**

---

## 一、观测目标

**B1 指标计划要回答的问题**:

> 如何量化验证"3-4 实例下协调层仍保持一致性"？

**原则**:
- ✅ 指标可自动化采集
- ✅ 指标可跨场景对比
- ✅ 指标有明确阈值
- ✅ 指标可定位问题层级

---

## 二、核心指标定义

### 2.1 Lease 层指标

#### lease_acquire_success_rate

**定义**: acquire 成功数 / 总请求数

**采集点**: `LeaseManager.acquire()` 返回

**计算公式**:
```typescript
const successRate = acquireResults.filter(r => r.success).length / acquireResults.length * 100;
```

**目标**: ≥ 99% (多实例竞争场景允许 <100%，因为只有一个成功者)

**告警阈值**: < 90%

---

#### lease_reclaim_latency_ms

**定义**: detect stale → reclaim complete 时间

**采集点**: 
- T0: `detectStaleLeases()` 返回
- T1: `reclaimStaleLease()` 完成

**计算公式**:
```typescript
const latency = reclaimCompleteTime - detectStaleTime;
```

**目标**: ≤ 1000ms

**告警阈值**: > 5000ms

---

#### lease_owner_mismatch_count

**定义**: lease.owner_instance_id 与实际持有者不符次数

**采集点**: `LeaseManager.getLease()` + `InstanceRegistry.getInstance()`

**计算公式**:
```typescript
const lease = await leaseManager.getLease(leaseKey);
const instance = await registry.getInstance(lease.owner_instance_id);
if (instance?.status !== 'active') {
  mismatchCount++;
}
```

**目标**: 0

**告警阈值**: > 0

---

### 2.2 Item 层指标

#### item_claim_success_rate

**定义**: claim 成功数 / 总请求数

**采集点**: `WorkItemCoordinator.claim()` 返回

**计算公式**:
```typescript
const successRate = claimResults.filter(r => r.success).length / claimResults.length * 100;
```

**目标**: ≥ 99% (并发场景允许 <100%)

**告警阈值**: < 90%

---

#### item_transition_latency_ms

**定义**: claim → complete/fail 时间

**采集点**:
- T0: `claim()` 完成
- T1: `complete()` 或 `fail()` 完成

**计算公式**:
```typescript
const latency = completeTime - claimTime;
```

**目标**: ≤ 5000ms

**告警阈值**: > 10000ms

---

#### duplicate_item_count

**定义**: 同一 correlation_id 的 item 数量

**采集点**: `WorkItemCoordinator.getActiveItems()` + 过滤

**计算公式**:
```typescript
const items = await itemCoordinator.getActiveItems();
const matchingItems = items.filter(i => i.item_key === correlationId);
const duplicateCount = matchingItems.length > 1 ? matchingItems.length - 1 : 0;
```

**目标**: 0

**告警阈值**: > 0

---

### 2.3 Suppression 层指标

#### suppression_hit_rate

**定义**: SUPPRESSED 数 / 重复请求数

**采集点**: `DuplicateSuppressionManager.evaluate()` 返回

**计算公式**:
```typescript
const hitRate = suppressedCount / duplicateRequestCount * 100;
```

**目标**: 100%

**告警阈值**: < 100%

---

#### suppression_decision_latency_ms

**定义**: evaluate 决策时间

**采集点**: `evaluate()` 开始 → 返回

**计算公式**:
```typescript
const latency = evaluateCompleteTime - evaluateStartTime;
```

**目标**: ≤ 100ms

**告警阈值**: > 500ms

---

#### cross_instance_inconsistency_count

**定义**: 实例间 suppression 状态不一致次数

**采集点**: 多实例 evaluate 结果对比

**计算公式**:
```typescript
const results = await Promise.all([
  instance1.suppressionManager.evaluate(input),
  instance2.suppressionManager.evaluate(input),
  instance3.suppressionManager.evaluate(input),
]);

// 期望：第一个 ALLOWED，其余 SUPPRESSED
const allowedCount = results.filter(r => r.decision === 'ALLOWED').length;
const inconsistencyCount = allowedCount > 1 ? allowedCount - 1 : 0;
```

**目标**: 0

**告警阈值**: > 0

---

### 2.4 Instance 层指标

#### stale_detection_time_ms

**定义**: heartbeat 停止 → 标记 stale 时间

**采集点**:
- T0: 最后 heartbeat 时间
- T1: `detectStaleInstances()` 返回 failed

**计算公式**:
```typescript
const detectionTime = failedMarkTime - lastHeartbeatTime;
```

**目标**: ≤ 40000ms (30s timeout + 10s grace)

**告警阈值**: > 50000ms

---

#### instance_register_success_rate

**定义**: 注册成功数 / 总注册数

**采集点**: `InstanceRegistry.initialize()` 完成

**计算公式**:
```typescript
const successRate = successfulRegisters / totalRegisters * 100;
```

**目标**: 100%

**告警阈值**: < 100%

---

#### instance_takeover_success_rate

**定义**: 接管成功数 / 总接管次数

**采集点**: `reclaimStaleLease()` 返回

**计算公式**:
```typescript
const successRate = successfulTakeovers / totalTakeoverAttempts * 100;
```

**目标**: 100%

**告警阈值**: < 90%

---

### 2.5 Recovery 层指标

#### replay_conflict_count

**定义**: replay 模式下的冲突数

**采集点**: `evaluate(replay_mode=true)` 返回 + item 状态检查

**计算公式**:
```typescript
if (replayResult.decision === 'ALLOWED' && itemWasModified) {
  conflictCount++;
}
```

**目标**: 0

**告警阈值**: > 0

---

#### recovery_double_process_count

**定义**: recovery 导致的重复处理次数

**采集点**: item 状态 + suppression 记录对比

**计算公式**:
```typescript
if (item.state === 'completed' && suppressionRecord.hit_count > 1) {
  // 可能发生了重复处理
  doubleProcessCount++;
}
```

**目标**: 0

**告警阈值**: > 0

---

#### ghost_owner_count

**定义**: 幽灵 owner (已失效但仍持有 lease) 数量

**采集点**: lease.owner_instance_id + instance.status 对比

**计算公式**:
```typescript
const leases = await leaseManager.getActiveLeases();
for (const lease of leases) {
  const instance = await registry.getInstance(lease.owner_instance_id);
  if (instance?.status !== 'active') {
    ghostOwnerCount++;
  }
}
```

**目标**: 0

**告警阈值**: > 0

---

### 2.6 系统层指标

#### snapshot_size_kb

**定义**: snapshot 文件大小

**采集点**: 文件系统 stat

**计算公式**:
```typescript
const stat = await fs.stat(snapshotPath);
const sizeKb = stat.size / 1024;
```

**目标**: ≤ 1024 KB (1MB)

**告警阈值**: > 5120 KB (5MB)

---

#### replay_time_ms

**定义**: log replay 恢复时间

**采集点**:
- T0: 开始 replay
- T1: replay 完成

**计算公式**:
```typescript
const replayTime = replayCompleteTime - replayStartTime;
```

**目标**: ≤ 5000ms

**告警阈值**: > 10000ms

---

#### active_instance_count

**定义**: 当前 active 实例数

**采集点**: `InstanceRegistry.getActiveInstances()`

**计算公式**:
```typescript
const instances = await registry.getActiveInstances();
const count = instances.length;
```

**目标**: 与预期实例数一致

**告警阈值**: 与预期不符

---

#### failed_instance_count

**定义**: 当前 failed 实例数

**采集点**: `InstanceRegistry.getFailedInstances()`

**计算公式**:
```typescript
const instances = await registry.getFailedInstances();
const count = instances.length;
```

**目标**: 0 (无故障时)

**告警阈值**: > 0 (非预期故障)

---

#### stale_cleanup_count

**定义**: stale cleanup 执行次数

**采集点**: `cleanupExpiredRecords()` 调用

**计算公式**:
```typescript
let cleanupCount = 0;
const originalCleanup = manager.cleanupExpiredRecords.bind(manager);
manager.cleanupExpiredRecords = async () => {
  cleanupCount++;
  return originalCleanup();
};
```

**目标**: 与预期清理周期一致

**告警阈值**: 异常频繁 (> 10 次/小时)

---

## 三、指标采集策略

### 自动采集

**方式**: 测试框架内嵌指标采集

```typescript
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  record(metric: string, value: number) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);
  }

  getAverage(metric: string): number {
    const values = this.metrics.get(metric) || [];
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  getMax(metric: string): number {
    return Math.max(...(this.metrics.get(metric) || [0]));
  }

  getMin(metric: string): number {
    return Math.min(...(this.metrics.get(metric) || [Infinity]));
  }
}
```

### 手动记录

**方式**: 测试用例中显式记录

```typescript
it('应该 3 实例竞争同一 lease', async () => {
  const startTime = Date.now();
  
  const results = await Promise.all([...]);
  
  metrics.record('lease_acquire_latency_ms', Date.now() - startTime);
  metrics.record('lease_acquire_success_count', results.filter(r => r.success).length);
  
  // ... 断言
});
```

---

## 四、指标报告格式

### 单次测试报告

```markdown
## B1-S2: 3 实例竞争同一 lease - 指标报告

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| lease_acquire_success_rate | ≥ 33% (1/3) | 33% (1/3) | ✅ |
| lease_reclaim_latency_ms | ≤ 1000ms | N/A | - |
| lease_owner_mismatch_count | 0 | 0 | ✅ |
| item_claim_success_rate | ≥ 33% (1/3) | 33% (1/3) | ✅ |
| duplicate_item_count | 0 | 0 | ✅ |

**TL;DR**: 所有指标达标 ✅
```

### 汇总报告

```markdown
# Phase 4.x-B1 指标汇总报告

## 场景覆盖

| 场景 | 通过率 | 关键指标 |
|------|--------|---------|
| B1-S1 | 100% | register_success: 100%, lease_acquire: 100% |
| B1-S2 | 100% | lease_acquire: 33%, item_claim: 33% |
| B1-S3 | 100% | item_claim: 33%, duplicate_item: 0 |
| B1-S4 | 100% | stale_detection: 38s, takeover: 100% |
| B1-S5 | 100% | suppression_hit: 100%, cross_instance: 0 |

## 核心指标汇总

| 指标类别 | 平均值 | 最大值 | 最小值 | 目标 | 状态 |
|---------|--------|--------|--------|------|------|
| lease_acquire_success_rate | 67% | 100% | 33% | ≥ 33% | ✅ |
| lease_reclaim_latency_ms | 850ms | 1200ms | 500ms | ≤ 1000ms | ⚠️ |
| suppression_hit_rate | 100% | 100% | 100% | 100% | ✅ |
| stale_detection_time_ms | 38000ms | 42000ms | 35000ms | ≤ 40000ms | ⚠️ |

## 失败分类

| 类型 | 次数 | 占比 |
|------|------|------|
| L1-L6 | 0 | 0% |
| L7 (接管失败) | 0 | 0% |
| L8 (去重不一致) | 0 | 0% |

## 结论

**B1 指标状态**: 🟡 部分达标 (2 个指标接近阈值)

**建议**: 
- lease_reclaim_latency 接近阈值，优化 reclaim 逻辑
- stale_detection_time 接近阈值，考虑调整 timeout 配置
```

---

## 五、指标阈值总览

| 指标 | 目标 | 告警 | 严重 |
|------|------|------|------|
| lease_acquire_success_rate | ≥ 99% | < 90% | < 50% |
| lease_reclaim_latency_ms | ≤ 1000ms | > 5000ms | > 10000ms |
| lease_owner_mismatch_count | 0 | > 0 | > 5 |
| item_claim_success_rate | ≥ 99% | < 90% | < 50% |
| item_transition_latency_ms | ≤ 5000ms | > 10000ms | > 30000ms |
| duplicate_item_count | 0 | > 0 | > 5 |
| suppression_hit_rate | 100% | < 100% | < 90% |
| suppression_decision_latency_ms | ≤ 100ms | > 500ms | > 1000ms |
| cross_instance_inconsistency_count | 0 | > 0 | > 5 |
| stale_detection_time_ms | ≤ 40000ms | > 50000ms | > 60000ms |
| instance_register_success_rate | 100% | < 100% | < 90% |
| instance_takeover_success_rate | 100% | < 90% | < 50% |
| replay_conflict_count | 0 | > 0 | > 5 |
| recovery_double_process_count | 0 | > 0 | > 5 |
| ghost_owner_count | 0 | > 0 | > 5 |
| snapshot_size_kb | ≤ 1024 KB | > 5120 KB | > 10240 KB |
| replay_time_ms | ≤ 5000ms | > 10000ms | > 30000ms |

---

## 六、下一步

1. ✅ 指标定义完成
2. ⏳ 实现 MetricsCollector 工具类
3. ⏳ 集成到 B1 测试骨架
4. ⏳ 执行 B1 测试并采集指标
5. ⏳ 生成指标报告

---

_指标计划版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：B1 测试骨架实现_
