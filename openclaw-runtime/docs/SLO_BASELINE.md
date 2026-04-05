# OpenClaw V3 SLO 基线

_Service Level Objectives 第一版定义。_

---

## SLI 定义

### 1. 关键 API 可用性

**SLI**: `http_requests_success_total / http_requests_total`

**目标**: ≥ 99%

**计算口径**:
```promql
sum(rate(http_requests_success_total[1h])) / sum(rate(http_requests_total[1h])) * 100
```

**观察窗口**: 1 小时滚动窗口

**排除条件**:
- 维护窗口（提前通知）
- 客户端错误（4xx）

---

### 2. Lock Acquire 成功率

**SLI**: `lock_acquire_success_total / (lock_acquire_success_total + lock_acquire_failure_total)`

**目标**: ≥ 95%

**计算口径**:
```promql
sum(rate(lock_acquire_success_total[1h])) / (sum(rate(lock_acquire_success_total[1h])) + sum(rate(lock_acquire_failure_total[1h]))) * 100
```

**观察窗口**: 1 小时滚动窗口

**说明**: 低成功率可能表示锁竞争严重或锁泄漏

---

### 3. Recovery Scan 成功率

**SLI**: `business_recovery_scan_success_total / (business_recovery_scan_success_total + business_recovery_scan_failure_total)`

**目标**: ≥ 95%

**计算口径**:
```promql
sum(rate(business_recovery_scan_success_total[1h])) / (sum(rate(business_recovery_scan_success_total[1h])) + sum(rate(business_recovery_scan_failure_total[1h]))) * 100
```

**观察窗口**: 1 小时滚动窗口

---

### 4. Replay 成功率

**SLI**: `business_replay_success_total / (business_replay_success_total + business_replay_failure_total)`

**目标**: ≥ 95%

**计算口径**:
```promql
sum(rate(business_replay_success_total[1h])) / (sum(rate(business_replay_success_total[1h])) + sum(rate(business_replay_failure_total[1h]))) * 100
```

**观察窗口**: 1 小时滚动窗口

---

### 5. Audit 写入成功率

**SLI**: `audit_write_total{success="true"} / audit_write_total`

**目标**: ≥ 99.9%

**计算口径**:
```promql
sum(rate(audit_write_total{success="true"}[1h])) / sum(rate(audit_write_total[1h])) * 100
```

**观察窗口**: 1 小时滚动窗口

**说明**: 审计日志丢失是合规风险，目标更高

---

### 6. 重复执行事件

**SLI**: `idempotency_failed_total{reason="duplicate_execution"}`

**目标**: = 0

**计算口径**:
```promql
sum(increase(idempotency_failed_total{reason="duplicate_execution"}[24h]))
```

**观察窗口**: 24 小时滚动窗口

**说明**: 重复执行是严重错误，必须为零

---

### 7. 非法状态迁移

**SLI**: `state_transition_rejected_total{reason="INVALID_TRANSITION"}`

**目标**: = 0

**计算口径**:
```promql
sum(increase(state_transition_rejected_total{reason="INVALID_TRANSITION"}[24h]))
```

**观察窗口**: 24 小时滚动窗口

**说明**: 非法状态迁移表示系统逻辑错误或外部攻击

---

## SLO 汇总表

| SLI | 目标 | 观察窗口 | 严重级 |
|-----|------|---------|--------|
| 关键 API 可用性 | ≥ 99% | 1 小时 | P1 |
| Lock Acquire 成功率 | ≥ 95% | 1 小时 | P1 |
| Recovery Scan 成功率 | ≥ 95% | 1 小时 | P1 |
| Replay 成功率 | ≥ 95% | 1 小时 | P1 |
| Audit 写入成功率 | ≥ 99.9% | 1 小时 | P0 |
| 重复执行事件 | = 0 | 24 小时 | P0 |
| 非法状态迁移 | = 0 | 24 小时 | P0 |

---

## 错误预算

**定义**: `错误预算 = 100% - SLO 目标`

### 示例计算

**关键 API 可用性 (99%)**:
- 错误预算：1%
- 1 小时允许错误：36 秒不可用
- 24 小时允许错误：14.4 分钟不可用
- 30 天允许错误：7.2 小时不可用

**Audit 写入成功率 (99.9%)**:
- 错误预算：0.1%
- 1 小时允许错误：3.6 秒不可用
- 24 小时允许错误：1.44 分钟不可用
- 30 天允许错误：43.2 分钟不可用

---

## 错误预算消耗告警

| 预算消耗 | 动作 |
|---------|------|
| 50% | 发送告警通知（P2） |
| 80% | 升级告警（P1），考虑冻结发布 |
| 100% | 紧急告警（P0），必须立即修复 |

**Prometheus 规则示例**:
```yaml
- alert: SLOBudgetWarning50
  expr: (1 - (sum(rate(http_requests_success_total[30d])) / sum(rate(http_requests_total[30d])))) / 0.01 > 0.5
  labels:
    severity: P2
  annotations:
    summary: "SLO 错误预算已消耗 50%"

- alert: SLOBudgetCritical80
  expr: (1 - (sum(rate(http_requests_success_total[30d])) / sum(rate(http_requests_total[30d])))) / 0.01 > 0.8
  labels:
    severity: P1
  annotations:
    summary: "SLO 错误预算已消耗 80%，考虑冻结发布"
```

---

## 报告周期

### 日报

- 前 24 小时 SLI 实际值
- 错误预算消耗百分比
- 触发告警列表

### 周报

- 过去 7 天 SLI 趋势
- SLO 达成情况
- 主要异常事件

### 月报

- 过去 30 天 SLI 汇总
- 错误预算剩余
- 改进建议

---

## 例外情况

以下情况不计入 SLO 计算：

1. **计划内维护** — 提前 48 小时通知
2. **不可抗力** — 云服务商大规模故障
3. **外部依赖故障** — OKX/GitHub 等第三方服务故障
4. **客户端错误** — 4xx 错误

---

_最后更新：2026-04-04 20:25_
