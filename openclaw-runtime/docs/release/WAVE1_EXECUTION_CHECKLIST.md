# Wave 1 灰度执行清单

_Phase 3A-5: 首轮灰度发布执行。_

---

## 执行信息

| 项目 | 值 |
|------|-----|
| 执行日期 | 2026-04-05 |
| 执行时间 | 10:00-12:00 (Asia/Shanghai) |
| 发布窗口 | 工作日 上午 |
| 版本 | v3.0.0-rc1 |
| 发布负责人 | |
| 技术负责人 | |
| 运维负责人 | |

---

## 前置条件确认

### Release Gate 检查

| 条件 | 状态 |
|------|------|
| RELEASE_GATE_CHECKLIST.md 通过 | ☐ 是 / ☐ 否 |
| Staging 12/12 测试项通过 | ☐ 是 / ☐ 否 |
| 无 Blocker 触发 | ☐ 是 / ☐ 否 |
| GO/NO-GO 决策为 GO | ☐ 是 / ☐ 否 |

### 环境准备

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 实例 1 运行中 | `systemctl status openclaw-prod-1` | Active | ☐ |
| 实例 2 运行中 | `systemctl status openclaw-prod-2` | Active | ☐ |
| Redis 连接正常 | `redis-cli ping` | PONG | ☐ |
| /metrics 可访问 | `curl http://prod-1:3000/metrics` | 200 | ☐ |
| 告警规则加载 | `curl http://prometheus:9090/api/v1/rules` | 有规则 | ☐ |

### Feature Flags 配置

| Flag | Wave 1 值 | 确认 |
|------|---------|------|
| `ENABLE_DISTRIBUTED_LOCK` | true | ☐ |
| `ENABLE_IDEMPOTENCY` | true | ☐ |
| `ENABLE_REPLAY` | false (仅内部) | ☐ |
| `ENABLE_RECOVERY_SCAN` | false (仅 staging) | ☐ |
| `STRICT_COORDINATION_REQUIRED` | true (prod) | ☐ |
| `FALLBACK_ON_REDIS_DOWN` | reject (prod) | ☐ |

---

## Wave 1 范围

### 白名单 Operator

| Operator | 联系方式 | 已通知 |
|----------|---------|--------|
| - | - | ☐ |
| - | - | ☐ |

### 开放入口

| 入口 | 状态 | 备注 |
|------|------|------|
| `POST /trading/approvals/:id/resolve` | ✅ 开放 | 白名单 only |
| `POST /trading/incidents/:id/acknowledge` | ✅ 开放 | 白名单 only |
| `POST /trading/replay/run` | ❌ 关闭 | 仅内部测试 |
| `POST /trading/recovery/scan` | ❌ 关闭 | 仅 staging |
| `POST /trading/webhooks/okx/ingest` | ✅ 开放 | testnet only |

### 流量限制

| 指标 | 阈值 |
|------|------|
| 最大并发请求 | < 10 req/s |
| 最大日请求量 | < 1000 req/day |
| Webhook 接收上限 | < 100 req/hour |

---

## 观察指标

### 核心指标 (每分钟检查)

| 指标 | 正常阈值 | 告警阈值 | 当前值 |
|------|---------|---------|--------|
| `endpoint success rate` | ≥ 99% | < 98% | - |
| `lock acquire failure rate` | < 5% | > 10% | - |
| `idempotency hit anomaly` | < 10/min | > 100/min | - |
| `recovery session in progress` | < 5 | > 10 for 10m | - |
| `audit write failure` | 0 | > 5/min | - |

### Dashboard

| Dashboard | 链接 | 状态 |
|-----------|------|------|
| Runtime Health | http://grafana/d/runtime | ☐ 正常 |
| Coordination | http://grafana/d/coordination | ☐ 正常 |
| Operations | http://grafana/d/operations | ☐ 正常 |
| SLO | http://grafana/d/slo | ☐ 正常 |

---

## 执行步骤

### T-30min: 最终确认

| 检查项 | 执行人 | 状态 |
|--------|--------|------|
| Release Gate 通过 | | ☐ |
| 团队已就位 | | ☐ |
| On-call 已安排 | | ☐ |
| 沟通渠道已建立 | | ☐ |

### T-10min: 通知相关方

| 受众 | 方式 | 模板 | 执行人 | 状态 |
|------|------|------|--------|------|
| 内部团队 | IM | "Wave 1 灰度即将开始" | | ☐ |
| 白名单 Operator | 邮件/IM | "灰度测试邀请" | | ☐ |

### T-0: 开启灰度

| 动作 | 命令 | 执行人 | 状态 |
|------|------|--------|------|
| 更新 Feature Flags | `export ENABLE_*` | | ☐ |
| 更新负载均衡配置 | 更新白名单 | | ☐ |
| 验证配置生效 | `curl /config` | | ☐ |

### T+5min: 首次健康检查

| 检查项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 实例 1 健康 | 200 OK | | ☐ |
| 实例 2 健康 | 200 OK | | ☐ |
| Redis 连接 | connected | | ☐ |
| 首波流量进入 | > 0 req | | ☐ |

### T+30min: 首次指标检查

| 指标 | 阈值 | 实际 | 状态 |
|------|------|------|------|
| endpoint success rate | ≥ 99% | | ☐ |
| lock acquire failure | < 5% | | ☐ |
| idempotency hit | < 100/min | | ☐ |
| recovery session | < 10 | | ☐ |
| audit write failure | 0 | | ☐ |

### T+1h: 首次状态更新

| 项目 | 内容 |
|------|------|
| 当前流量 | |
| 告警触发 | ☐ 无 / ☐ 有 |
| 异常情况 | |
| 是否继续 | ☐ 是 / ☐ 否 |

### T+2h: 第二次指标检查

（同上）

### T+4h: 日终总结

| 项目 | 内容 |
|------|------|
| 总请求量 | |
| 错误数 | |
| 告警触发 | |
| Blocker | ☐ 无 / ☐ 有 |
| 是否进入明天 | ☐ 是 / ☐ 否 |

---

## 告警响应

### P0 告警触发

| 告警 | Runbook | 响应时间 | 升级时间 |
|------|---------|---------|---------|
| `RedisDisconnected` | RUNBOOK_REDIS_OUTAGE.md | 5 min | 15 min |
| `LockAcquireFailureSpike` | RUNBOOK_LOCK_LEAK.md | 5 min | 15 min |
| `RecoverySessionStuck` | RUNBOOK_RECOVERY_STUCK.md | 5 min | 15 min |
| `ReplayFailureSpike` | RUNBOOK_REPLAY_MISFIRE.md | 5 min | 15 min |
| `IdempotencyHitAnomaly` | RUNBOOK_WEBHOOK_STORM.md | 5 min | 15 min |
| `WebhookIngestErrorSpike` | RUNBOOK_WEBHOOK_STORM.md | 5 min | 15 min |

### 回滚触发

| 条件 | 动作 | 执行人 |
|------|------|--------|
| 任何 Blocker 触发 | 立即回滚 | 发布负责人 |
| P0 告警持续 > 15min | 评估回滚 | 技术负责人 |
| 错误率 > 5% | 评估回滚 | 运维负责人 |

---

## 沟通模板

### Wave 1 开始通知

```
【Wave 1 灰度开始】

时间：2026-04-05 10:00
版本：v3.0.0-rc1
范围：白名单 operator, <5% 流量
观察窗口：4 小时

Dashboard: http://grafana/d/runtime
On-call: [姓名] [联系方式]

如有异常请立即联系。
```

### Wave 1 完成通知

```
【Wave 1 灰度完成】

时间：2026-04-05 14:00
总请求量：XXX
错误数：XXX
告警触发：无/有 [详情]
Blocker: 无/有 [详情]

决策：☐ 进入 Wave 2 / ☐ 需要修复 / ☐ 回滚

详细报告：[链接]
```

---

## 验收标准

### Wave 1 通过条件

| 条件 | 状态 |
|------|------|
| 无 P0 告警 | ☐ |
| endpoint success rate ≥ 99% | ☐ |
| lock acquire failure < 10% | ☐ |
| idempotency hit anomaly < 100/min | ☐ |
| recovery session stuck = 0 | ☐ |
| audit write failure = 0 | ☐ |
| 无 Blocker 触发 | ☐ |

### 是否进入 Wave 2

| 项目 | 结果 |
|------|------|
| Wave 1 通过 | ☐ 是 / ☐ 否 |
| 团队评估 | ☐ 建议进入 / ☐ 需要修复 |
| 决策 | ☐ 进入 Wave 2 / ☐ 暂停 |

---

## 签字

| 角色 | 人员 | 签字 | 时间 |
|------|------|------|------|
| 发布负责人 | | | |
| 技术负责人 | | | |
| 运维负责人 | | | |

---

_最后更新：2026-04-04 23:00_
_版本：1.0_
_状态：Ready for Execution_
