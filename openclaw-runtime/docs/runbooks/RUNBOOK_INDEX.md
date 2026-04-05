# OpenClaw V3 Runbook 索引

_所有应急预案的权威索引。_

---

## Runbook 列表

| 编号 | 名称 | 关联告警 | 风险级 | 状态 |
|------|------|---------|--------|------|
| RB-001 | [Redis Outage](./RUNBOOK_REDIS_OUTAGE.md) | `RedisDisconnected` | P0 | Draft |
| RB-002 | [Lock Leak](./RUNBOOK_LOCK_LEAK.md) | `LockAcquireFailureSpike` | P0 | Draft |
| RB-003 | [Recovery Session Stuck](./RUNBOOK_RECOVERY_STUCK.md) | `RecoverySessionStuck` | P0 | Draft |
| RB-004 | [Replay Misfire](./RUNBOOK_REPLAY_MISFIRE.md) | `ReplayFailureSpike` | P0 | Draft |
| RB-005 | [Webhook Storm](./RUNBOOK_WEBHOOK_STORM.md) | `IdempotencyHitAnomaly`, `WebhookIngestErrorSpike` | P0 | Draft |

---

## 按告警分类

### P0 告警

| 告警 | Runbook | 入口 |
|------|---------|------|
| `RedisDisconnected` | [RUNBOOK_REDIS_OUTAGE.md](./RUNBOOK_REDIS_OUTAGE.md) | 所有协调层入口 |
| `LockAcquireFailureSpike` | [RUNBOOK_LOCK_LEAK.md](./RUNBOOK_LOCK_LEAK.md) | 锁保护入口 |
| `RecoverySessionStuck` | [RUNBOOK_RECOVERY_STUCK.md](./RUNBOOK_RECOVERY_STUCK.md) | Recovery 协调 |
| `ReplayFailureSpike` | [RUNBOOK_REPLAY_MISFIRE.md](./RUNBOOK_REPLAY_MISFIRE.md) | Replay 入口 |
| `IdempotencyHitAnomaly` | [RUNBOOK_WEBHOOK_STORM.md](./RUNBOOK_WEBHOOK_STORM.md) | Webhook 入口 |
| `WebhookIngestErrorSpike` | [RUNBOOK_WEBHOOK_STORM.md](./RUNBOOK_WEBHOOK_STORM.md) | Webhook 入口 |

---

## 按入口分类

### 高风险入口（CRITICAL）

| 入口 | Runbook | 动作 |
|------|---------|------|
| `POST /trading/approvals/:id/resolve` | [RUNBOOK_REDIS_OUTAGE.md](./RUNBOOK_REDIS_OUTAGE.md) | 拒绝（prod） |
| `POST /trading/incidents/:id/resolve` | [RUNBOOK_REDIS_OUTAGE.md](./RUNBOOK_REDIS_OUTAGE.md) | 拒绝（prod） |
| `POST /trading/recovery/items/:id/claim` | [RUNBOOK_LOCK_LEAK.md](./RUNBOOK_LOCK_LEAK.md) | 释放锁 |

### 中风险入口（HIGH）

| 入口 | Runbook | 动作 |
|------|---------|------|
| `POST /trading/incidents/:id/acknowledge` | [RUNBOOK_REDIS_OUTAGE.md](./RUNBOOK_REDIS_OUTAGE.md) | 降级（dev/staging） |
| `POST /trading/recovery/session/start` | [RUNBOOK_RECOVERY_STUCK.md](./RUNBOOK_RECOVERY_STUCK.md) | 回收 Stale Session |
| `POST /trading/replay/run` | [RUNBOOK_REPLAY_MISFIRE.md](./RUNBOOK_REPLAY_MISFIRE.md) | 冻结入口 |

### 只读入口（LOW）

| 入口 | Runbook | 动作 |
|------|---------|------|
| `GET /trading/approvals` | - | 允许（可能 stale） |
| `GET /trading/incidents` | - | 允许（可能 stale） |
| `GET /metrics` | - | 允许 |

---

## 演练记录

| 日期 | Runbook | 类型 | 参与者 | 结果 |
|------|---------|------|--------|------|
| - | - | 桌面演练 | - | 待安排 |

---

## 维护计划

| 项目 | 频率 | 负责人 | 下次日期 |
|------|------|--------|---------|
| Runbook 审查 | 季度 | 运维团队 | 2026-07-04 |
| 桌面演练 | 月度 | 运维团队 | 2026-05-04 |
| 实战演练 | 半年度 | 全员 | 2026-10-04 |
| 链接验证 | 月度 | 自动化 | 2026-05-04 |

---

## 关联文档

- **3A-1**: `docs/ENVIRONMENT_MATRIX.md` — 环境配置
- **3A-1**: `docs/FEATURE_FLAGS.md` — Feature Flags
- **3A-1**: `docs/ENTRY_RISK_MATRIX.md` — 入口风险分级
- **3A-2**: `docs/ALERT_RULES.md` — 告警规则
- **3A-2**: `docs/SLO_BASELINE.md` — SLO 基线
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — 指标定义

---

_最后更新：2026-04-04 21:10_
_版本：1.0_
_状态：Draft_
