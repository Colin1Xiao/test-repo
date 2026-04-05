# Phase 4.x-B3: Long-Running Stability Verification - Design

**阶段**: Phase 4.x-B3: Stability Verification (Long-Running)  
**日期**: 2026-04-05  
**状态**: 🟡 **DESIGN**  
**依赖**: Phase 4.x-B1 ✅ Complete, Phase 4.x-B2 ✅ Complete

---

## 一、设计目标

**B3 要回答的核心问题**:

> 在长时间运行下，协调层是否还能保持一致性和资源健康？

**与 B1/B2 的区别**:
- B1: 验证 **正确性** (3-4 实例扩展是否成立)
- B2: 验证 **稳定性** (高并发下是否仍一致 + 性能达标)
- B3: 验证 **持久性** (12h+/24h+/48h+ 运行是否健康)

**不做什么**:
- ❌ 不修改 A2 协议层实现
- ❌ 不引入新协调机制
- ❌ 不做生产部署验证 (Wave 2-B)

**做什么**:
- ✅ 12h / 24h / 48h 运行窗口
- ✅ Snapshot 周期与增长趋势
- ✅ Log replay 恢复时间
- ✅ Stale cleanup 长时间行为
- ✅ 内存/文件增长趋势
- ✅ 长时间无 owner 漂移/无重复处理/无幽灵状态

---

## 二、运行场景 (A)

### 场景 1: 12h 基础稳定性

**描述**: 12 小时连续运行，验证基础稳定性

**初始状态**:
- 3 实例共享存储
- 持续 acquire/release/claim/complete 操作

**操作序列**:
1. T0-T12h: 持续操作 (1 次/秒/实例)
2. 每 30 分钟采集指标
3. 验证最终状态一致性

**预期行为**:
- 无 owner 漂移
- 无重复处理
- 无幽灵状态
- 内存增长 ≤ 50MB

**验证指标**:
- owner_drift_count: 0
- duplicate_process_count: 0
- ghost_state_count: 0
- memory_growth_mb: ≤ 50

---

### 场景 2: 24h 资源泄漏检测

**描述**: 24 小时连续运行，检测资源泄漏

**初始状态**:
- 3 实例共享存储
- 持续 acquire/release/claim/complete 操作

**操作序列**:
1. T0-T24h: 持续操作 (1 次/秒/实例)
2. 每 1 小时采集资源指标
3. 验证最终资源状态

**预期行为**:
- 内存无持续增长
- 文件句柄无泄漏
- 临时文件无积累
- snapshot/log 大小在阈值内

**验证指标**:
- memory_leak_mb: ≤ 100MB (24h)
- file_handle_leak: 0
- temp_file_accumulation: 0
- snapshot_size_kb: ≤ 5120 KB
- log_size_kb: ≤ 10240 KB

---

### 场景 3: 48h Stale Cleanup 行为

**描述**: 48 小时连续运行，验证 stale cleanup 行为

**初始状态**:
- 3 实例共享存储
- 模拟实例故障 (每 12h 停止 1 实例)

**操作序列**:
1. T0-T48h: 持续操作 + 实例故障模拟
2. 每 1 小时验证 stale lease 清理
3. 验证 reclaim 行为

**预期行为**:
- stale lease 在 TTL 后被清理
- reclaim 成功
- 无 owner 漂移
- cleanup 频率正常

**验证指标**:
- stale_cleanup_latency_ms: ≤ 1000ms
- reclaim_success_rate: ≥ 99%
- owner_drift_count: 0
- cleanup_interval_ms: 符合配置

---

### 场景 4: 72h 极端压力

**描述**: 72 小时连续运行，混合压力场景

**初始状态**:
- 5 实例共享存储
- 混合压力 (常规 + storm 交替)

**操作序列**:
1. T0-T72h: 混合压力
   - 常规操作 (1 次/秒/实例)
   - Storm 场景 (每 6h 一次，1000 并发)
2. 每 1 小时采集指标
3. 验证最终状态

**预期行为**:
- 性能无显著退化
- 状态一致性保持
- 资源使用稳定

**验证指标**:
- performance_degradation: ≤ 20%
- state_consistency: 100%
- resource_stability: ✅

---

## 三、关键指标 (B)

### 一致性指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `owner_drift_count` | owner_instance_id 意外变更次数 | 0 | > 0 |
| `duplicate_process_count` | 同一 item 重复处理次数 | 0 | > 0 |
| `ghost_state_count` | 幽灵状态 (无主 lease/item) 数 | 0 | > 0 |
| `state_inconsistency_count` | 跨实例状态不一致次数 | 0 | > 0 |

### 资源指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `memory_growth_mb_12h` | 12h 内存增长 | ≤ 50MB | > 100MB |
| `memory_growth_mb_24h` | 24h 内存增长 | ≤ 100MB | > 200MB |
| `memory_growth_mb_48h` | 48h 内存增长 | ≤ 200MB | > 500MB |
| `file_handle_leak` | 文件句柄泄漏数 | 0 | > 0 |
| `temp_file_accumulation` | 临时文件积累数 | 0 | > 0 |
| `snapshot_size_kb` | snapshot 文件大小 | ≤ 5120 KB | > 10240 KB |
| `log_size_kb` | log 文件大小 | ≤ 10240 KB | > 20480 KB |

### 性能指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `performance_degradation_12h` | 12h 性能退化 | ≤ 10% | > 20% |
| `performance_degradation_24h` | 24h 性能退化 | ≤ 15% | > 30% |
| `performance_degradation_48h` | 48h 性能退化 | ≤ 20% | > 50% |
| `stale_cleanup_latency_ms` | stale cleanup 延迟 | ≤ 1000ms | > 5000ms |
| `reclaim_success_rate` | reclaim 成功率 | ≥ 99% | < 95% |

### 恢复指标

| 指标 | 定义 | 目标 | 告警 |
|------|------|------|------|
| `replay_time_ms` | log replay 恢复时间 | ≤ 10000ms | > 30000ms |
| `snapshot_recovery_time_ms` | snapshot 恢复时间 | ≤ 5000ms | > 10000ms |
| `cold_start_time_ms` | 冷启动时间 | ≤ 30000ms | > 60000ms |

---

## 四、失败分类 (C)

延续 B1/B2 的 L1-L10 分类，新增 L11-L12：

| 类型 | 描述 | 定位 | 响应 |
|------|------|------|------|
| **L1-L8** | 见 B1/B2 设计 | 见 B1/B2 | 见 B1/B2 |
| **L9** | 性能退化 | A2-1~4 性能 | 优化热点路径 |
| **L10** | 资源泄漏 | 内存/文件句柄 | 修复泄漏点 |
| **L11** | **长时间状态漂移** | **状态机/持久化** | **修复状态同步** |
| **L12** | **Cleanup 失效** | **stale detection/cleanup** | **修复 cleanup 逻辑** |

### L11: 长时间状态漂移

**表现**:
- owner_instance_id 意外变更
- 幽灵状态出现
- 跨实例状态不一致

**根因**:
- 状态同步 bug
- 持久化时序问题
- 时钟漂移

### L12: Cleanup 失效

**表现**:
- stale lease 未被清理
- cleanup 频率异常
- reclaim 失败

**根因**:
- stale detection 逻辑 bug
- cleanup 定时器失效
- 实例故障未正确检测

---

## 五、退出条件 (D)

**B3 通过标准** (全部满足):

### 场景覆盖

- [ ] 场景 1: 12h 基础稳定性 ✅
- [ ] 场景 2: 24h 资源泄漏检测 ✅
- [ ] 场景 3: 48h Stale Cleanup 行为 ✅
- [ ] 场景 4: 72h 极端压力 ✅

### 一致性指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| owner_drift_count | 0 | - | ⏳ |
| duplicate_process_count | 0 | - | ⏳ |
| ghost_state_count | 0 | - | ⏳ |
| state_inconsistency_count | 0 | - | ⏳ |

### 资源指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| memory_growth_mb_24h | ≤ 100MB | - | ⏳ |
| file_handle_leak | 0 | - | ⏳ |
| snapshot_size_kb | ≤ 5120 KB | - | ⏳ |
| log_size_kb | ≤ 10240 KB | - | ⏳ |

### 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| performance_degradation_24h | ≤ 15% | - | ⏳ |
| stale_cleanup_latency_ms | ≤ 1000ms | - | ⏳ |
| reclaim_success_rate | ≥ 99% | - | ⏳ |

### 失败分类

- [ ] 无 L11 级别失败 (长时间状态漂移)
- [ ] 无 L12 级别失败 (Cleanup 失效)
- [ ] L1-L10 失败可明确定位并修复

### 回归验证

- [ ] B1 测试全绿 (30/30)
- [ ] B2 测试全绿 (21/21)
- [ ] B3 新增测试全绿 (目标：15-20 条)

---

## 六、测试策略

### 测试文件组织

```
tests/integration/b3-stability/
├── 12h-basic-stability.test.ts           # 12h 基础稳定性
├── 24h-resource-leak.test.ts             # 24h 资源泄漏检测
├── 48h-stale-cleanup.test.ts             # 48h Stale Cleanup 行为
├── 72h-extreme-stress.test.ts            # 72h 极端压力
└── fixtures/
    └── long-running-fixture.ts           # 长运行测试支架
```

### 长运行测试支架

**功能**:
- 支持 12h/24h/48h/72h 运行窗口
- 定时指标采集 (每 30min/1h)
- 异常中断恢复
- 最终状态验证

**接口**:
```typescript
export async function createLongRunningFixture(
  config: LongRunningConfig
): Promise<LongRunningFixture>;

export async function runWithDuration(
  fixture: LongRunningFixture,
  durationHours: number,
  operation: () => Promise<void>
): Promise<void>;

export async function collectMetrics(
  fixture: LongRunningFixture
): Promise<StabilityMetrics>;
```

### 指标采集

**方式**: 定时采集 + 事件触发

```typescript
class StabilityMetricsCollector {
  private metrics: Map<string, TimeSeriesData> = new Map();

  record(metric: string, value: number, timestamp: number) {
    // Record time-series data
  }

  getTrend(metric: string, durationHours: number): TrendAnalysis {
    // Analyze trend over duration
  }

  detectAnomalies(metric: string): Anomaly[] {
    // Detect anomalies using statistical methods
  }
}
```

### 超时控制

**策略**:
- 12h 测试: 14h 超时 (缓冲 2h)
- 24h 测试: 28h 超时 (缓冲 4h)
- 48h 测试: 56h 超时 (缓冲 8h)
- 72h 测试: 84h 超时 (缓冲 12h)

**实现**:
```typescript
it('应该 24h 资源泄漏检测', async () => {
  await runWithDuration(fixture, 24, async () => {
    // Continuous operations
  }, { timeout: 28 * 60 * 60 * 1000 }); // 28h timeout
}, 28 * 60 * 60 * 1000);
```

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CI 环境超时 | 测试无法完成 | 本地运行 + CI 仅运行 12h 场景 |
| 测试执行时间长 | 反馈周期长 | 分批次执行 + 夜间运行 |
| 指标采集开销大 | 影响测试结果 | 采样采集 (1%) |
| 临时文件积累 | 磁盘空间不足 | 定期清理 + 限制大小 |
| 实例故障模拟 | 测试复杂性增加 | 简化故障场景 (仅停止实例) |

---

## 八、下一步

1. ✅ B3 设计完成
2. ⏳ 实现 B3 测试支架 (long-running-fixture.ts)
3. ⏳ 实现 B3 测试骨架 (4 文件，15-20 条)
4. ⏳ 执行 B3 测试 (12h → 24h → 48h → 72h)
5. ⏳ B3 完成报告
6. ⏳ 进入 Wave 2 准备 (生产部署验证)

---

_设计版本：1.0_  
_审阅日期：2026-04-05_  
_下一步：B3 测试支架实现_
