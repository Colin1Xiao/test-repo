# Phase 3B-1: 并发验证 + 延长观察

_Concurrency Verification + Extended Observation (24 小时)_

---

## 执行摘要

**Wave 1 结果**: ✅ 成功 (6/6 Go/No-Go 通过，无 P0 告警)

**3B-1 目标** (调整版):
- ✅ 并发脚本验证协调语义 (单实例 + Redis)
- ✅ 延长 Wave 1 观察到 24 小时
- ⏸️ 三实例验证 (暂停，等待真实数据后再决定)

---

## Wave 2 放量方案

### 流量范围

| 指标 | Wave 1 | Wave 2 | Wave 3 |
|------|--------|--------|--------|
| 流量比例 | <5% | <30% | 100% |
| 并发上限 | <10 req/s | <50 req/s | 无限制 |
| 日请求量 | <1000 | <10000 | 无限制 |
| Webhook 接收 | <100/hour | <500/hour | 无限制 |

### 白名单扩展

| 类别 | Wave 1 | Wave 2 |
|------|--------|--------|
| Operator 数量 | 4 名 | 10-15 名 |
| 覆盖角色 | Approval/Incident/Webhook | 全角色 |
| 通知方式 | IM | IM + 邮件 |

### 开放入口

| 入口 | Wave 1 | Wave 2 |
|------|--------|--------|
| `POST /trading/approvals/:id/resolve` | ✅ | ✅ |
| `POST /trading/incidents/:id/acknowledge` | ✅ | ✅ |
| `POST /trading/webhooks/okx/ingest` | ✅ (testnet) | ✅ (testnet + 部分 prod) |
| `POST /trading/replay/run` | ❌ | ✅ (内部) |
| `POST /trading/recovery/scan` | ❌ | ✅ (staging + 受控 prod) |

---

## 三实例验证计划

### 部署架构

```
                    ┌─────────────┐
                    │   Redis     │
                    │ (staging)   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
   │ Instance 1│   │ Instance 2│   │ Instance 3│
   │  (prod-1) │   │  (prod-2) │   │  (prod-3) │
   └───────────┘   └───────────┘   └───────────┘
```

### 必测场景

| 编号 | 场景 | 预期 | 关联指标 |
|------|------|------|---------|
| 3I-01 | 三实例 resolve 同一 approval | 只有一个成功 | `lock_acquire_success=1, failure=2` |
| 3I-02 | 三实例 resolve 同一 incident | 只有一个成功 | `lock_acquire_success=1, failure=2` |
| 3I-03 | 三实例 claim 同一 recovery item | 只有一个成功 | `recovery_item_claim_success=1` |
| 3I-04 | 三实例 webhook 重复投递 | 只执行一次 | `idempotency_hit=2` |
| 3I-05 | 三实例 webhook 并发投递 | 不重复执行 | `idempotency_created=1` |
| 3I-06 | session renew + stale reclaim | 正常续期/接管 | `recovery_session_renewed`, `recovery_session_expired` |
| 3I-07 | lock contention under higher traffic | 竞争上升但可控 | `lock_contention_total` |

### 执行步骤

**Step 1**: 部署第 3 实例
```bash
# 部署 instance-3
systemctl start openclaw-prod-3

# 验证健康
curl http://prod-3:3002/health
```

**Step 2**: 验证 Redis 连接
```bash
# 所有实例应连接同一 Redis
redis-cli CLIENT LIST | grep openclaw
```

**Step 3**: 执行并发测试
```bash
# 三实例并发 resolve 同一 approval
curl -X POST http://prod-1:3000/trading/approvals/:id/resolve &
curl -X POST http://prod-2:3001/trading/approvals/:id/resolve &
curl -X POST http://prod-3:3002/trading/approvals/:id/resolve &
wait
```

**Step 4**: 验证指标
```promql
# 应只有 1 个成功
lock_acquire_success_total{resource="approval:xxx"} == 1

# 应有 2 个失败
lock_acquire_failure_total{resource="approval:xxx"} == 2
```

---

## 长时观察窗口定义

### 观察时长

| 阶段 | 时长 | 目标 |
|------|------|------|
| Wave 1 | 30 分钟 | 基本功能验证 |
| Wave 2 | 24 小时 | 长时间稳定性 |
| Wave 3 | 7 天 | 生产级稳定性 |

### 观察指标

| 指标 | Wave 1 基线 | Wave 2 阈值 | 告警阈值 |
|------|-----------|-----------|---------|
| endpoint success rate | ≥ 99% | ≥ 99% | < 98% |
| lock acquire failure | < 5% | < 10% | > 15% |
| idempotency hit | < 100/min | < 500/min | > 1000/min |
| recovery session stuck | 0 | < 20 | > 50 for 10m |
| audit write failure | 0 | 0 | > 10/min |
| Redis command latency | < 10ms | < 50ms | > 100ms |
| alert 噪音 | 0 | < 10/天 | > 50/天 |

### 检查频率

| 时间 | 检查项 | 负责人 |
|------|--------|--------|
| T+5min | 健康检查 | On-call |
| T+30min | 指标检查 | On-call |
| T+1h | 状态更新 | On-call |
| T+4h | 日中总结 | 发布负责人 |
| T+12h | 夜间检查 | On-call |
| T+24h | 最终总结 | 发布负责人 |

---

## Wave 2 Release Gate

### 前置条件

| 条件 | 状态 |
|------|------|
| Wave 1 成功完成 | ✅ |
| 三实例部署就绪 | ☐ |
| 白名单扩展完成 (10-15 名) | ☐ |
| 监控 Dashboard 就绪 | ☐ |
| On-call 排班完成 | ☐ |

### Go/No-Go 检查 (8 项)

| 检查项 | 状态 |
|--------|------|
| 三实例健康检查通过 | ☐ |
| Redis 连接正常 | ☐ |
| /metrics 可访问 (3 实例) | ☐ |
| 告警通道正常 | ☐ |
| Rollback 开关已确认 | ☐ |
| 白名单已生效 | ☐ |
| Feature Flags 已核对 | ☐ |
| 无 P0 告警活跃 | ☐ |

**Go 条件**: 8/8 通过  
**No-Go 条件**: 任一不通过

---

## Wave 2 Rollback 补充条件

### 新增回滚触发

| 条件 | 阈值 | 动作 |
|------|------|------|
| 三实例竞争失败 | > 10% 失败率 | 降级到 2 实例 |
| lock contention 激增 | > 100/min | 限流 + 评估 |
| idempotency hit 异常 | > 1000/min | 限流 + 评估 |
| Redis 延迟上升 | > 100ms | 评估 + 可能回滚 |
| alert 噪音 | > 50/天 | 降噪 + 评估 |

### 回滚步骤补充

```bash
# 降级到 2 实例
systemctl stop openclaw-prod-3

# 验证 2 实例运行正常
curl http://prod-1:3000/health
curl http://prod-2:3001/health
```

---

## 成功标准

| 标准 | 验证方法 |
|------|---------|
| 三实例排他性验证通过 | 3I-01~03 测试通过 |
| Webhook 并发处理正确 | 3I-04~05 测试通过 |
| Session renew/reclaim 正常 | 3I-06 测试通过 |
| 24 小时无 P0 告警 | 告警历史记录 |
| SLO 达标 | SLO dashboard |
| 无数据丢失 | Audit 日志检查 |

---

## 负责人与排班

| 角色 | 人员 | 时间段 |
|------|------|--------|
| 发布负责人 | Colin | 全程 |
| 技术负责人 | Colin | 全程 |
| 运维负责人 | Colin | 全程 |
| On-call 1 | 小龙 | 00:00-08:00 |
| On-call 2 | 小龙 | 08:00-16:00 |
| On-call 3 | 小龙 | 16:00-24:00 |

---

_最后更新：2026-04-04 20:50_
_版本：1.0_
_状态：Draft_
