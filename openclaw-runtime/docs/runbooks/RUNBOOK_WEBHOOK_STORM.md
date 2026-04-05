# Runbook: Webhook Storm

_Webhook 重复投递 / 流量突增的应急响应。_

---

## 1. 触发条件

**关联告警**: `IdempotencyHitAnomaly` (P0), `WebhookIngestErrorSpike` (P0)

**触发条件**:
- `rate(idempotency_hit_total[5m]) > 100`
- `rate(http_requests_error_total{route=~"/trading/webhooks/.*"}[5m]) > 10`

**其他可能告警**:
- `HighErrorRate`
- `HighLatency`

---

## 2. 症状 / 告警信号

**主要症状**:
- Webhook 接收量突增
- 幂等命中率异常高
- 错误率上升
- 延迟增加

**监控指标**:
```promql
# Webhook 接收速率
rate(business_webhook_accepted_total[5m])

# 幂等命中速率
rate(idempotency_hit_total[5m]) > 100

# Webhook 错误率
rate(http_requests_error_total{route=~"/trading/webhooks/.*"}[5m]) > 10

# 请求延迟
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{route=~"/trading/webhooks/.*"}[5m]))
```

---

## 3. 影响范围

**受影响的 Provider**:
- OKX Webhook
- GitHub Webhook
- 其他外部 Provider

**风险等级**:
| Provider | 风险级 | 说明 |
|---------|--------|------|
| OKX | CRITICAL | 交易事件可能重复处理 |
| GitHub | MEDIUM | 代码事件可能重复 |
| 其他 | LOW | 根据业务影响评估 |

---

## 4. 快速判断

**确认 Webhook 风暴**:
```bash
# 检查各 Provider 的接收量
curl http://localhost:3000/trading/webhooks/stats | jq '
  .[] | {
    provider,
    accepted_total,
    deduped_total,
    error_total,
    last_received_at
  }
'

# 检查幂等命中情况
curl http://localhost:3000/trading/webhooks/idempotency-stats | jq '
  {
    created_total,
    hit_total,
    hit_ratio
  }
'
```

**判断风暴类型**:
| 现象 | 可能原因 |
|------|---------|
| 单一 Provider 流量突增 | Provider 重复投递 |
| 所有 Provider 流量突增 | 系统被攻击 / 配置错误 |
| 幂等命中率高 | 重复投递，已正确去重 |
| 错误率高 | 处理能力不足 / 验证失败 |

---

## 5. 立即止血动作

### 动作 1: Provider 级限流

```bash
# 设置 Provider 限流
export WEBHOOK_OKX_RATE_LIMIT=100
export WEBHOOK_GITHUB_RATE_LIMIT=50

# 或临时禁用特定 Provider
export WEBHOOK_OKX_ENABLED=false
```

### 动作 2: 启用严格幂等

```bash
# 确保幂等性保护启用
export ENABLE_IDEMPOTENCY=true

# 设置严格的幂等窗口
export IDEMPOTENCY_WINDOW_SECONDS=3600
```

### 动作 3: 隔离异常 Provider

```bash
# 将异常 Provider 的 Webhook 路由到隔离队列
export WEBHOOK_OKX_ISOLATE=true

# 或直接拒绝
export WEBHOOK_OKX_REJECT=true
```

### 动作 4: 联系 Provider

**OKX 支持**:
- 邮件：support@okx.com
- API 状态：https://www.okx.com/status

**GitHub 支持**:
- 状态：https://www.githubstatus.com/
- 支持：https://support.github.com/

---

## 6. 详细排查步骤

### Step 1: 分析 Webhook 来源

```bash
# 检查最近的 Webhook 请求
curl http://localhost:3000/trading/webhooks/recent?limit=50 | jq '
  .[] | {
    provider,
    event_type,
    received_at,
    idempotency_key,
    deduped
  }
'

# 检查重复的 idempotency key
curl http://localhost:3000/trading/webhooks/recent?limit=100 | jq '
  group_by(.idempotency_key) |
  .[] | select(length > 1) |
  {
    idempotency_key,
    count: length,
    provider: .[0].provider
  }
'
```

### Step 2: 检查 Provider 配置

```bash
# 检查 Webhook 配置
curl http://localhost:3000/trading/webhooks/config | jq '.'

# 验证签名密钥
redis-cli GET "webhook:okx:secret"
```

### Step 3: 分析流量模式

```bash
# 检查流量时间分布
curl "http://localhost:9090/api/v1/query_range?query=rate(business_webhook_accepted_total[1m])&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60" | jq '.'
```

### Step 4: 检查应用日志

```bash
# 查找 Webhook 相关错误
grep -i "webhook.*error" /var/log/openclaw/openclaw.log | tail -50

# 查找重复投递
grep -i "duplicate.*webhook" /var/log/openclaw/openclaw.log | tail -50

# 查找验证失败
grep -i "webhook.*signature.*fail" /var/log/openclaw/openclaw.log | tail -50
```

---

## 7. 恢复 / 回滚步骤

### 确认风暴结束

**Step 1**: 检查流量是否恢复正常
```promql
# Webhook 接收速率应下降
rate(business_webhook_accepted_total[5m]) < 50

# 幂等命中率应下降
rate(idempotency_hit_total[5m]) < 10
```

**Step 2**: 检查 Provider 状态
```bash
# 检查 OKX 状态
curl https://www.okx.com/api/v5/public/time

# 检查 GitHub 状态
curl https://www.githubstatus.com/api/v2/status.json
```

### 逐步恢复

**Step 1**: 解除限流
```bash
# 逐步提高限流阈值
export WEBHOOK_OKX_RATE_LIMIT=500
export WEBHOOK_GITHUB_RATE_LIMIT=200
```

**Step 2**: 重新启用 Provider
```bash
export WEBHOOK_OKX_ENABLED=true
export WEBHOOK_OKX_ISOLATE=false
export WEBHOOK_OKX_REJECT=false
```

**Step 3**: 处理积压事件（如有）
```bash
# 检查隔离队列中的事件
curl http://localhost:3000/trading/webhooks/isolated-queue | jq '.'

# 逐步处理
curl -X POST http://localhost:3000/trading/webhooks/process-isolated
```

### 验证功能恢复

**Step 1**: 验证 Webhook 接收
```bash
# 发送测试 Webhook
curl -X POST http://localhost:3000/trading/webhooks/okx/test \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
```

**Step 2**: 验证幂等功能
```bash
# 发送重复请求
curl -X POST http://localhost:3000/trading/webhooks/okx \
  -H "X-Idempotency-Key: test-123" \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'

curl -X POST http://localhost:3000/trading/webhooks/okx \
  -H "X-Idempotency-Key: test-123" \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
# 第二次应返回幂等响应
```

---

## 8. 事后复盘与审计项

### 必须记录

| 项目 | 内容 |
|------|------|
| 风暴开始时间 | `2026-04-04 22:00:00` |
| 发现方式 | 告警 / 用户报告 |
| 影响时长 | `XX 分钟` |
| 峰值 QPS | `XXX 请求/秒` |
| 受影响 Provider | OKX / GitHub / 其他 |
| 根本原因 | Provider bug / 配置错误 / 攻击 |
| 恢复时间 | `2026-04-04 23:00:00` |

### 审计问题

- [ ] 是否有重复执行？
- [ ] 幂等性是否正确工作？
- [ ] 是否有数据丢失？
- [ ] 限流策略是否有效？
- [ ] 告警是否及时触发？

### 改进项

- [ ] 增加 Provider 级限流
- [ ] 增加 Webhook 隔离队列
- [ ] 改进幂等窗口管理
- [ ] 增加自动熔断机制
- [ ] 增加 Provider 健康检查

---

## 关联文档

- **3A-1**: `docs/FEATURE_FLAGS.md` — Webhook 配置
- **3A-1**: `docs/ENTRY_RISK_MATRIX.md` — Webhook 风险分级
- **3A-2**: `docs/ALERT_RULES.md` — IdempotencyHitAnomaly / WebhookIngestErrorSpike 告警
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — Webhook 指标

---

_最后更新：2026-04-04 21:05_
_版本：1.0_
_状态：Draft（待演练验证）_
