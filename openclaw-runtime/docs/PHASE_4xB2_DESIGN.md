# Phase 4.x-B2: High-Concurrency Stress Test - Design

**阶段**: Phase 4.x-B2: Stress Verification (High Concurrency)  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: Phase 4.x-B1 ✅ Complete

---

## 一、设计目标

**B2 要回答的核心问题**:

> 在高并发压力下，协调层是否还能保持一致性和性能？

**与 B1 的区别**:
- B1: 验证 **正确性** (3-4 实例扩展是否成立)
- B2: 验证 **稳定性** (高并发下是否仍一致 + 性能达标)

**不做什么**:
- ❌ 不修改 A2 协议层实现
- ❌ 不引入新协调机制
- ❌ 不做长期运行验证 (B3)
- ❌ 不做生产部署 (Wave 2-B)

**做什么**:
- ✅ 高频 acquire/renew/release 压力
- ✅ 高频 claim/complete/fail 压力
- ✅ Suppression storm 场景
- ✅ Snapshot / log 增长下性能
- ✅ 性能基准采集

---

## 二、压力场景 (A)

### 场景 1: 高频 Lease Acquire/Release

**描述**: 10 实例并发 acquire/release 循环

**初始状态**:
- 10 实例共享存储
- 100 个 lease key 池

**操作序列**:
1. T0-T1000ms: 10 实例并发 acquire (100 次/实例)
2. T1000-T2000ms: 10 实例并发 release (100 次/实例)
3. T2000-T3000ms: 混合 acquire/release

**预期行为**:
- CAS 保证唯一成功者
- 无 owner 漂移
- latency P99 ≤ 100ms

**验证指标**:
- acquire_success_rate: ≥ 99%
- release_success_rate: ≥ 99%
- acquire_latency_p99: ≤ 100ms
- release_latency_p99: ≤ 50ms

---

### 场景 2: 高频 Item Claim/Complete

**描述**: 10 实例并发 claim/complete 循环

**初始状态**:
- 10 实例共享存储
- 50 个 item key 池

**操作序列**:
1. T0-T1000ms: 10 实例并发 claim (50 次/实例)
2. T1000-T2000ms: 10 实例并发 complete (50 次/实例)
3. T2000-T3000ms: 混合 claim/complete/fail

**预期行为**:
- CAS 保证唯一 claim 成功者
- 无重复 item 创建
- claim→complete 链路完整

**验证指标**:
- claim_success_rate: ≥ 99%
- complete_success_rate: ≥ 99%
- claim_latency_p99: ≤ 200ms
- duplicate_item_count: 0

---

### 场景 3: Suppression Storm

**描述**: 10 实例并发 evaluate 同一 correlation_id

**初始状态**:
- 10 实例共享 suppression manager
- 10 个 correlation_id 池

**操作序列**:
1. T0-T500ms: 10 实例并发 evaluate (100 次/实例/ID)
2. T500-T1000ms: 验证 suppression 一致性

**预期行为**:
- 每个 correlation_id 只有一个 ALLOWED
- 其余 999 次为 SUPPRESSED
- 无跨实例分裂

**验证指标**:
- suppression_hit_rate: 100%
- cross_instance_inconsistency_count: 0
- suppression_decision_latency_p99: ≤ 50ms

---

### 场景 4: Snapshot / Log 增长下性能

**描述**: 长时间运行下 snapshot/log 增长对性能的影响

**初始状态**:
- 10 实例共享存储
- 持续 acquire/release 操作

**操作序列**:
1. T0-T60s: 持续 acquire/release (10 次/秒)
2. 每 10s 采集 latency 指标
3. 验证 snapshot/log 大小

**预期行为**:
- latency 不随 log 增长而显著上升
- snapshot 大小在阈值内
- replay time 在阈值内

**验证指标**:
- latency_degradation: ≤ 20% (T60 vs T0)
- snapshot_size_kb: ≤ 5120 KB
- replay_time_ms: ≤ 10000ms

---

## 三、关键指标 (B)

### 性能指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `acquire_latency_p50_ms` | acquire latency P50 | ≤ 20ms | > 50ms |
| `acquire_latency_p99_ms` | acquire latency P99 | ≤ 100ms | > 200ms |
| `release_latency_p50_ms` | release latency P50 | ≤ 10ms | > 30ms |
| `release_latency_p99_ms` | release latency P99 | ≤ 50ms | > 100ms |
| `claim_latency_p50_ms` | claim latency P50 | ≤ 50ms | > 100ms |
| `claim_latency_p99_ms` | claim latency P99 | ≤ 200ms | > 500ms |
| `complete_latency_p50_ms` | complete latency P50 | ≤ 30ms | > 80ms |
| `complete_latency_p99_ms` | complete latency P99 | ≤ 100ms | > 200ms |
| `suppression_latency_p50_ms` | suppression latency P50 | ≤ 10ms | > 30ms |
| `suppression_latency_p99_ms` | suppression latency P99 | ≤ 50ms | > 100ms |

### 一致性指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `acquire_success_rate` | acquire 成功数 / 总请求数 | ≥ 99% | < 95% |
| `release_success_rate` | release 成功数 / 总请求数 | ≥ 99% | < 95% |
| `claim_success_rate` | claim 成功数 / 总请求数 | ≥ 99% | < 95% |
| `suppression_hit_rate` | SUPPRESSED 数 / 重复请求数 | 100% | < 100% |
| `lease_owner_mismatch_count` | owner_instance_id 与实际不符次数 | 0 | > 0 |
| `duplicate_item_count` | 同一 correlation_id 的 item 数 | 0 | > 0 |
| `cross_instance_inconsistency_count` | 实例间状态不一致次数 | 0 | > 0 |

### 系统指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `snapshot_size_kb` | snapshot 文件大小 | ≤ 5120 KB | > 10240 KB |
| `log_size_kb` | log 文件大小 | ≤ 10240 KB | > 20480 KB |
| `replay_time_ms` | log replay 恢复时间 | ≤ 10000ms | > 20000ms |
| `active_instance_count` | 当前 active 实例数 | = 预期 | ≠ 预期 |
| `memory_usage_mb` | 内存使用量 | ≤ 512 MB | > 1024 MB |

---

## 四、失败分类 (C)

延续 B1 的 L1-L8 分类，新增 L9-L10：

| 类型 | 描述 | 定位 | 响应 |
|------|------|------|------|
| **L1** | Instance 层失败 | A2-1 | 修复 A2-1 |
| **L2** | Lease 层失败 | A2-2 | 修复 A2-2 |
| **L3** | Item 层失败 | A2-3 | 修复 A2-3 |
| **L4** | Suppression 层失败 | A2-4 | 修复 A2-4 |
| **L5** | 跨层一致性失败 | A2-1~4 接口 | 修复接口契约 |
| **L6** | 并发竞争失败 | A2-1~4 并发控制 | 修复 CAS 逻辑 |
| **L7** | 多实例接管失败 | A2-1/A2-2 | 修复 stale detection/reclaim |
| **L8** | 跨实例去重不一致 | A2-4 | 修复共享状态同步 |
| **L9** | **性能退化** | **A2-1~4 性能** | **优化热点路径** |
| **L10** | **资源泄漏** | **内存/文件句柄** | **修复泄漏点** |

### L9: 性能退化

**表现**:
- latency P99 超过阈值
- throughput 显著下降
- snapshot/log 增长导致性能下降

**根因**:
- 锁竞争
- 内存缓存未命中
- 文件 I/O 瓶颈

### L10: 资源泄漏

**表现**:
- 内存使用持续增长
- 文件句柄未释放
- 临时文件未清理

**根因**:
- 未正确 shutdown
- 事件监听器未移除
- 临时文件未清理

---

## 五、退出条件 (D)

**B2 通过标准** (全部满足):

### 场景覆盖

- [x] 场景 1: 高频 Lease Acquire/Release ✅
- [x] 场景 2: 高频 Item Claim/Complete ✅
- [x] 场景 3: Suppression Storm ✅
- [x] 场景 4: Snapshot/Log 增长下性能 ✅

### 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| acquire_latency_p99 | ≤ 100ms | - | ⏳ |
| claim_latency_p99 | ≤ 200ms | - | ⏳ |
| suppression_latency_p99 | ≤ 50ms | - | ⏳ |
| latency_degradation | ≤ 20% | - | ⏳ |

### 一致性指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| acquire_success_rate | ≥ 99% | - | ⏳ |
| claim_success_rate | ≥ 99% | - | ⏳ |
| suppression_hit_rate | 100% | - | ⏳ |
| cross_instance_inconsistency_count | 0 | - | ⏳ |

### 系统指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| snapshot_size_kb | ≤ 5120 KB | - | ⏳ |
| replay_time_ms | ≤ 10000ms | - | ⏳ |
| memory_usage_mb | ≤ 512 MB | - | ⏳ |

### 失败分类

- [ ] 无 L9 级别失败 (性能退化)
- [ ] 无 L10 级别失败 (资源泄漏)
- [ ] L1-L8 失败可明确定位并修复

### 回归验证

- [ ] B1 测试全绿 (30/30)
- [ ] B2 新增测试全绿 (目标：25-30 条)
- [ ] 完整测试套件全绿 (≥401 条)

---

## 六、测试策略

### 测试文件组织

```
tests/integration/b2-stress/
├── lease-acquire-release-stress.test.ts      # 高频 lease 压力
├── item-claim-complete-stress.test.ts        # 高频 item 压力
├── suppression-storm.test.ts                 # Suppression storm
└── snapshot-log-growth.test.ts               # Snapshot/log 增长
```

### 并发模拟

**方法 1: Promise.all 并发**
```typescript
const results = await Promise.all(
  Array.from({ length: 100 }, (_, i) =>
    instances[i % instances.length].leaseManager.acquire(input)
  )
);
```

**方法 2: 时间窗口并发**
```typescript
const results = await Promise.all(
  Array.from({ length: 100 }, (_, i) => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await instances[i % instances.length]
          .leaseManager
          .acquire(input);
        resolve(result);
      }, i * 10); // 10ms 间隔
    });
  })
);
```

### 指标采集

**方式**: 内嵌指标采集器
```typescript
class StressMetricsCollector {
  private latencies: Map<string, number[]> = new Map();

  recordLatency(operation: string, latencyMs: number) {
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, []);
    }
    this.latencies.get(operation)!.push(latencyMs);
  }

  getP99(operation: string): number {
    const values = this.latencies.get(operation) || [];
    values.sort((a, b) => a - b);
    const index = Math.floor(values.length * 0.99);
    return values[index] || 0;
  }
}
```

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CI 环境资源不足 | 测试失败或超时 | 串行执行 + 降低并发度 |
| 测试执行时间长 | 反馈周期长 | 分批次执行 + 超时控制 |
| 指标采集开销大 | 影响性能测试结果 | 采样采集 (10%) |
| 临时文件积累 | 磁盘空间不足 | 及时清理 + 限制大小 |

---

## 八、下一步

1. ✅ B2 设计完成
2. ⏳ 实现 B2 测试骨架 (4 文件，25-30 条)
3. ⏳ 执行 B2 测试并采集指标
4. ⏳ B2 完成报告
5. ⏳ 进入 B3 设计 (长期运行稳定性)

---

_设计版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：B2 测试骨架实现_
