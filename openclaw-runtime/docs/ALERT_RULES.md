# OpenClaw V3 告警规则

_P0 优先级告警定义、触发条件、关联 Runbook。_

---

## 告警级别定义

| 级别 | 响应时间 | 通知方式 | 说明 |
|------|---------|---------|------|
| **P0** | 立即（5 分钟内） | 电话 + 短信 + IM | 系统不可用/数据丢失风险 |
| **P1** | 15 分钟内 | 短信 + IM | 功能降级/性能严重下降 |
| **P2** | 1 小时内 | IM | 非关键功能异常 |
| **P3** | 4 小时内 | IM / 工单 | 可观察性问题 |

---

## P0 告警规则

### 1. RedisDisconnected

**触发条件**: `redis_connected == 0` for `1m`

**影响**: 
- 分布式锁失效
- 幂等性保护失效
- Recovery 协调失效

**严重级**: P0

**关联 Runbook**: `RUNBOOK_REDIS_OUTAGE.md`

**Prometheus 规则**:
```yaml
- alert: RedisDisconnected
  expr: redis_connected == 0
  for: 1m
  labels:
    severity: P0
  annotations:
    summary: "Redis 连接断开"
    description: "Redis 实例 {{ $labels.instance }} 已断开连接超过 1 分钟"
    runbook: "RUNBOOK_REDIS_OUTAGE.md"
```

---

### 2. LockAcquireFailureSpike

**触发条件**: `rate(lock_acquire_failure_total[5m]) > 10`

**影响**:
- 高风险入口无法获取锁
- 可能导致并发冲突或拒绝服务

**严重级**: P0

**关联 Runbook**: `RUNBOOK_LOCK_LEAK.md`

**Prometheus 规则**:
```yaml
- alert: LockAcquireFailureSpike
  expr: rate(lock_acquire_failure_total[5m]) > 10
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "锁获取失败激增"
    description: "过去 5 分钟内锁获取失败速率超过 10 次/秒"
    runbook: "RUNBOOK_LOCK_LEAK.md"
```

---

### 3. IdempotencyHitAnomaly

**触发条件**: `rate(idempotency_hit_total[5m]) > 100`

**影响**:
- 大量重复请求
- 可能是 Webhook 风暴或客户端重试异常

**严重级**: P0

**关联 Runbook**: `RUNBOOK_WEBHOOK_STORM.md`

**Prometheus 规则**:
```yaml
- alert: IdempotencyHitAnomaly
  expr: rate(idempotency_hit_total[5m]) > 100
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "幂等命中异常"
    description: "过去 5 分钟内幂等命中速率超过 100 次/秒，可能存在重复请求风暴"
    runbook: "RUNBOOK_WEBHOOK_STORM.md"
```

---

### 4. RecoverySessionStuck

**触发条件**: `recovery_session_in_progress > 10` for `10m`

**影响**:
- Recovery Session 卡住
- Item 无法被 claim/complete
- 可能导致业务停滞

**严重级**: P0

**关联 Runbook**: `RUNBOOK_RECOVERY_STUCK.md`

**Prometheus 规则**:
```yaml
- alert: RecoverySessionStuck
  expr: recovery_session_in_progress > 10
  for: 10m
  labels:
    severity: P0
  annotations:
    summary: "Recovery Session 卡住"
    description: "活跃 Recovery Session 数量超过 10 个并持续 10 分钟"
    runbook: "RUNBOOK_RECOVERY_STUCK.md"
```

---

### 5. StateTransitionRejectSpike

**触发条件**: `rate(state_transition_rejected_total[5m]) > 20`

**影响**:
- 大量非法状态迁移请求
- 可能是系统异常或攻击

**严重级**: P0

**关联 Runbook**: _待创建_

**Prometheus 规则**:
```yaml
- alert: StateTransitionRejectSpike
  expr: rate(state_transition_rejected_total[5m]) > 20
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "状态迁移拒绝激增"
    description: "过去 5 分钟内状态迁移拒绝速率超过 20 次/秒"
    runbook: "TBD"
```

---

### 6. AuditWriteFailure

**触发条件**: `rate(audit_write_failed_total[5m]) > 5`

**影响**:
- 审计日志丢失
- 合规风险
- 无法追溯操作历史

**严重级**: P0

**关联 Runbook**: _待创建_

**Prometheus 规则**:
```yaml
- alert: AuditWriteFailure
  expr: rate(audit_write_failed_total[5m]) > 5
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "审计写入失败"
    description: "过去 5 分钟内审计写入失败速率超过 5 次/秒"
    runbook: "TBD"
```

---

### 7. ReplayFailureSpike

**触发条件**: `rate(business_replay_failure_total[5m]) > 5`

**影响**:
- 重放功能不可用
- 影响事件恢复能力

**严重级**: P0

**关联 Runbook**: _待创建_

**Prometheus 规则**:
```yaml
- alert: ReplayFailureSpike
  expr: rate(business_replay_failure_total[5m]) > 5
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "重放失败激增"
    description: "过去 5 分钟内重放失败速率超过 5 次/秒"
    runbook: "TBD"
```

---

### 8. WebhookIngestErrorSpike

**触发条件**: `rate(http_requests_error_total{route=~"/trading/webhooks/.*"}[5m]) > 10`

**影响**:
- Webhook 接收失败
- 可能丢失外部事件

**严重级**: P0

**关联 Runbook**: `RUNBOOK_WEBHOOK_STORM.md`

**Prometheus 规则**:
```yaml
- alert: WebhookIngestErrorSpike
  expr: rate(http_requests_error_total{route=~"/trading/webhooks/.*"}[5m]) > 10
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "Webhook 接收错误激增"
    description: "过去 5 分钟内 Webhook 端点错误速率超过 10 次/秒"
    runbook: "RUNBOOK_WEBHOOK_STORM.md"
```

---

## P1 告警规则

### 9. HighErrorRate

**触发条件**: `sum(http_requests_error_total) / sum(http_requests_total) > 0.01` for `5m`

**影响**: 整体错误率超过 1%

**严重级**: P1

**Prometheus 规则**:
```yaml
- alert: HighErrorRate
  expr: sum(http_requests_error_total) / sum(http_requests_total) > 0.01
  for: 5m
  labels:
    severity: P1
  annotations:
    summary: "高错误率"
    description: "整体 HTTP 错误率超过 1%"
```

---

### 10. HighLatency

**触发条件**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1` for `5m`

**影响**: P95 延迟超过 1 秒

**严重级**: P1

**Prometheus 规则**:
```yaml
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  labels:
    severity: P1
  annotations:
    summary: "高延迟"
    description: "HTTP 请求 P95 延迟超过 1 秒"
```

---

## 告警路由

```yaml
route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  
  routes:
    - match:
        severity: P0
      receiver: 'pagerduty-critical'
      continue: true
    
    - match:
        severity: P1
      receiver: 'slack-ops'
    
    - match:
        severity: P2
      receiver: 'slack-ops'
      group_wait: 5m
```

---

## 告警抑制

```yaml
inhibit_rules:
  # Redis 断开时抑制所有依赖 Redis 的告警
  - source_match:
      alertname: RedisDisconnected
    target_match:
      alertname: LockAcquireFailureSpike
    equal: ['instance']
  
  # Safe Mode 激活时抑制部分告警
  - source_match:
      alertname: SafeModeActive
    target_match_re:
      alertname: '.*'
    target_match:
      severity: P2
```

---

_最后更新：2026-04-04 20:20_
