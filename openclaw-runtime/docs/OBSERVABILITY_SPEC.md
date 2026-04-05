# OpenClaw V3 Observability 规范

_指标定义、采集、暴露的权威规范。_

---

## 指标命名规范

**格式**: `<layer>_<component>_<metric>_<unit>`

**层级前缀**:
- `http_requests_` — HTTP 请求层
- `idempotency_` — 幂等性
- `lock_` — 分布式锁
- `recovery_` — Recovery 协调
- `state_transition_` — 状态迁移
- `redis_` — Redis 依赖
- `persistence_` — 持久化
- `audit_` — 审计日志
- `business_` — 业务指标

**指标类型**:
- `Counter` — 单调递增（总数、错误数）
- `Gauge` — 瞬时值（连接数、进行中任务）
- `Histogram` — 分布（延迟、时长）

---

## 标签规范

### 通用标签

| 标签名 | 说明 | 基数控制 |
|--------|------|---------|
| `method` | HTTP 方法 (GET/POST) | 低 (≤5) |
| `route` | **模板化路由** | 中 (≤50) |
| `status_code` | HTTP 状态码 | 低 (≤20) |
| `error_type` | 错误类型 | 中 (≤20) |
| `resource` | 资源名称 | 中 (≤50) |
| `reason` | 原因/失败类型 | 中 (≤20) |

### Route 模板化规则

**必须使用模板，禁止原始 URL**：

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| `/trading/approvals/123/resolve` | `/trading/approvals/:id/resolve` |
| `/trading/incidents/456/acknowledge` | `/trading/incidents/:id/acknowledge` |
| `/trading/webhooks/okx` | `/trading/webhooks/:provider` |

---

## 指标定义

### 1. HTTP 请求层

**前缀**: `http_requests_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `http_requests_total` | Counter | `method`, `route` | 请求总数 |
| `http_requests_success_total` | Counter | `method`, `route` | 成功请求数 |
| `http_requests_error_total` | Counter | `method`, `route`, `error_type` | 错误请求数 |
| `http_request_duration_seconds` | Histogram | `method`, `route` | 请求延迟分布 (buckets: 0.01, 0.05, 0.1, 0.5, 1, 5) |

**采集位置**: HTTP 中间件 (`src/metrics/http_metrics.ts`)

---

### 2. Idempotency 指标

**前缀**: `idempotency_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `idempotency_created_total` | Counter | `route` | 幂等记录创建数 |
| `idempotency_hit_total` | Counter | `route` | 幂等命中数（重复请求） |
| `idempotency_in_progress_total` | Gauge | `route` | 处理中请求数 |
| `idempotency_failed_total` | Counter | `route`, `reason` | 幂等失败数 |

**采集位置**: `src/coordination/idempotency_manager.ts`

---

### 3. Distributed Lock 指标

**前缀**: `lock_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `lock_acquire_success_total` | Counter | `resource` | 锁获取成功数 |
| `lock_acquire_failure_total` | Counter | `resource`, `reason` | 锁获取失败数 |
| `lock_release_success_total` | Counter | `resource` | 锁释放成功数 |
| `lock_release_failure_total` | Counter | `resource` | 锁释放失败数 |
| `lock_renew_success_total` | Counter | `resource` | 锁续期成功数 |
| `lock_renew_failure_total` | Counter | `resource` | 锁续期失败数 |
| `lock_contention_total` | Counter | `resource` | 锁竞争次数（多次尝试） |
| `lock_held_duration_seconds` | Histogram | `resource` | 锁持有时长分布 |
| `lock_in_progress_total` | Gauge | `resource` | 当前持有的锁数 |

**注意**: **不包含 `owner` 标签**（高基数风险）

**采集位置**: `src/coordination/distributed_lock.ts`

---

### 4. Recovery Coordination 指标

**前缀**: `recovery_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `recovery_session_started_total` | Counter | - | Session 启动数 |
| `recovery_session_renewed_total` | Counter | - | Session 续期数 |
| `recovery_session_completed_total` | Counter | `status` | Session 完成数 |
| `recovery_session_expired_total` | Counter | - | Session 过期数 |
| `recovery_session_in_progress` | **Gauge** | - | **当前活跃 Session 数** |
| `recovery_item_claim_success_total` | Counter | `item_type` | Item Claim 成功数 |
| `recovery_item_claim_failure_total` | Counter | `item_type`, `reason` | Item Claim 失败数 |
| `recovery_item_complete_total` | Counter | `item_type`, `status` | Item 完成数 |

**采集位置**: `src/ownership/recovery_coordinator.ts`

---

### 5. State Sequence 指标

**前缀**: `state_transition_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `state_transition_allowed_total` | Counter | `machine`, `from`, `to` | 允许的状态迁移数 |
| `state_transition_rejected_total` | Counter | `machine`, `from`, `to`, `reason` | 拒绝的状态迁移数 |

**采集位置**: `src/ownership/state_sequence.ts`

---

### 6. Redis 依赖指标

**前缀**: `redis_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `redis_connected` | Gauge | `instance` | 连接状态 (1=connected, 0=disconnected) |
| `redis_command_total` | Counter | `command` | 命令执行总数 |
| `redis_command_error_total` | Counter | `command`, `error_type` | 命令错误数 |
| `redis_command_duration_seconds` | Histogram | `command` | 命令延迟分布 |

**采集位置**: `src/coordination/redis_client.ts`

---

### 7. Persistence 指标

**前缀**: `persistence_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `persistence_read_total` | Counter | `entity`, `success` | 读取次数 |
| `persistence_write_total` | Counter | `entity`, `success` | 写入次数 |
| `persistence_read_duration_seconds` | Histogram | `entity` | 读取延迟 |
| `persistence_write_duration_seconds` | Histogram | `entity` | 写入延迟 |

**采集位置**: `src/persistence/persistence_store.ts`

---

### 8. Audit 指标

**前缀**: `audit_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `audit_write_total` | Counter | `event_type`, `success` | 审计写入次数 |
| `audit_write_failed_total` | Counter | `event_type`, `reason` | 审计写入失败数 |

**采集位置**: `src/persistence/audit_log_service.ts`

---

### 9. 业务层指标

**前缀**: `business_`

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `business_approval_resolved_total` | Counter | `status` | 审批解决数 |
| `business_incident_acknowledged_total` | Counter | - | 事件确认数 |
| `business_incident_resolved_total` | Counter | `status` | 事件解决数 |
| `business_replay_success_total` | Counter | - | 重放成功数 |
| `business_replay_failure_total` | Counter | `reason` | 重放失败数 |
| `business_recovery_scan_success_total` | Counter | - | 恢复扫描成功数 |
| `business_recovery_scan_failure_total` | Counter | `reason` | 恢复扫描失败数 |
| `business_webhook_accepted_total` | Counter | `provider` | Webhook 接收数 |
| `business_webhook_deduped_total` | Counter | `provider` | Webhook 去重数 |

**采集位置**: 各业务 Handler

---

## 指标暴露

### 端点

- **路径**: `/metrics`
- **方法**: GET
- **格式**: Prometheus 文本格式 (`text/plain; version=0.0.4`)
- **认证**: 无（内网访问）

### 输出格式示例

```prometheus
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",route="/trading/approvals/:id/resolve"} 1234

# HELP lock_acquire_success_total Lock acquire successes
# TYPE lock_acquire_success_total counter
lock_acquire_success_total{resource="approval:123"} 50

# HELP recovery_session_in_progress Current active recovery sessions
# TYPE recovery_session_in_progress gauge
recovery_session_in_progress 3

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="POST",route="/trading/approvals/:id/resolve",le="0.01"} 100
http_request_duration_seconds_bucket{method="POST",route="/trading/approvals/:id/resolve",le="0.05"} 500
http_request_duration_seconds_bucket{method="POST",route="/trading/approvals/:id/resolve",le="0.1"} 1000
http_request_duration_seconds_bucket{method="POST",route="/trading/approvals/:id/resolve",le="+Inf"} 1234
http_request_duration_seconds_sum{method="POST",route="/trading/approvals/:id/resolve"} 45.6
http_request_duration_seconds_count{method="POST",route="/trading/approvals/:id/resolve"} 1234
```

---

## 采集原则

### 必须采集

- 所有 HTTP 请求（中间件自动采集）
- 所有协调层操作（锁、幂等、Recovery、状态迁移）
- 所有依赖健康状态（Redis、Persistence、Audit）
- 所有高风险入口（approval/incident/replay/recovery）

### 可选采集

- 只读查询接口（timeline、metrics 自身）
- 低频后台任务

### 禁止采集

- 高基数标签（user_id、request_id、owner 等）
- 敏感数据（secrets、PII）
- 原始请求体/响应体

---

## 实现指南

### Counter 使用

```typescript
// 正确
metrics.counter('http_requests_total', { method: 'POST', route: '/approvals/:id/resolve' }).inc();

// 错误 - 高基数标签
metrics.counter('http_requests_total', { method: 'POST', route: '/approvals/123/resolve' }).inc();
```

### Gauge 使用

```typescript
// 正确 - 设置瞬时值
metrics.gauge('recovery_session_in_progress').set(activeSessionCount);

// 正确 - 增减
metrics.gauge('idempotency_in_progress_total', { route }).inc();
metrics.gauge('idempotency_in_progress_total', { route }).dec();
```

### Histogram 使用

```typescript
// 正确 - 记录延迟
const start = Date.now();
try {
  await doWork();
} finally {
  const duration = (Date.now() - start) / 1000;
  metrics.histogram('http_request_duration_seconds', { method, route }).observe(duration);
}
```

---

_最后更新：2026-04-04 20:15_
