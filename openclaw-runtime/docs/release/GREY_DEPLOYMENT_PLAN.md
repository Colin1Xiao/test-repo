# OpenClaw V3 灰度发布计划

_Phase 3A-5: 灰度部署策略与执行计划。_

---

## 发布概述

| 项目 | 值 |
|------|-----|
| 版本号 | v3.0.0-rc1 |
| 发布类型 | 灰度发布 |
| 发布窗口 | 工作日 10:00-12:00 (Asia/Shanghai) |
| 预计周期 | 5-7 天 |
| 发布负责人 | - |

---

## 灰度范围

### 第一原则：限制影响面

| 维度 | 限制 |
|------|------|
| 用户 | 白名单 operator |
| Webhook Provider | 部分 Provider（OKX testnet 优先） |
| Replay | 仅内部可用 |
| Recovery Scan | 仅 staging/受控 prod 范围 |
| Approval/Incident | 低流量比例（<10%） |

### 环境策略

| 环境 | 流量比例 | Feature Flags |
|------|---------|---------------|
| Staging | 100% | 全开 |
| Prod (Wave 1) | <5% | 高风险功能关闭 |
| Prod (Wave 2) | <30% | 逐步开启 |
| Prod (Wave 3) | 100% | 全开 |

---

## 灰度阶段

### Wave 1: 单环境、低流量、短观察窗

**时间**: Day 1-2

**范围**:
- 单实例部署
- 白名单 operator
- OKX testnet webhook
- Replay 禁用
- Recovery scan 仅 staging

**观察指标**:
| 指标 | 阈值 | 告警 |
|------|------|------|
| endpoint success rate | ≥ 99% | < 99% |
| lock acquire failure rate | < 5% | > 10% |
| idempotency hit anomaly | < 10/min | > 100/min |
| recovery session stuck | 0 | > 10 for 10m |

**退出条件**:
- ✅ 进入 Wave 2: 所有指标正常，无 P0 告警
- ❌ 回滚：任何 Blocker 触发

---

### Wave 2: 扩大范围、持续观察

**时间**: Day 3-5

**范围**:
- 双实例部署
- 扩大到更多 operator
- 增加 GitHub webhook
- Replay 启用（内部）
- Recovery scan 小范围 prod

**观察指标**:
| 指标 | 阈值 | 告警 |
|------|------|------|
| endpoint success rate | ≥ 99% | < 98% |
| lock acquire failure rate | < 5% | > 10% |
| idempotency hit anomaly | < 50/min | > 200/min |
| recovery session stuck | 0 | > 20 for 10m |
| state transition rejected | 正常基线 | 突增 > 20/min |
| audit write failure | 0 | > 5/min |

**退出条件**:
- ✅ 进入 Wave 3: 所有指标正常，无 P0 告警持续 48h
- ❌ 回滚：任何 Blocker 触发

---

### Wave 3: 接近常态流量、验证回滚

**时间**: Day 6-7

**范围**:
- 多实例部署
- 全量 operator
- 全量 webhook provider
- Replay 全开
- Recovery scan 全开

**观察指标**:
| 指标 | 阈值 | 告警 |
|------|------|------|
| endpoint success rate | ≥ 99% | < 98% |
| lock acquire failure rate | < 5% | > 10% |
| idempotency hit anomaly | < 100/min | > 500/min |
| recovery session stuck | 0 | > 50 for 10m |
| SLO 基线 | 符合 SLO_BASELINE.md | 超出错误预算 |

**回滚演练**:
- 执行一次计划内回滚演练
- 验证回滚路径可用
- 记录回滚时间

**退出条件**:
- ✅ 发布完成：所有指标正常，回滚演练成功
- ❌ 回滚：任何 Blocker 触发

---

## 关键指标监控

### Dashboard

| Dashboard | 链接 | 负责人 |
|-----------|------|--------|
| Runtime Health | http://grafana/d/runtime | - |
| Coordination | http://grafana/d/coordination | - |
| Operations | http://grafana/d/operations | - |
| SLO | http://grafana/d/slo | - |

### 告警规则

| 告警 | 级别 | Runbook |
|------|------|---------|
| `RedisDisconnected` | P0 | RUNBOOK_REDIS_OUTAGE.md |
| `LockAcquireFailureSpike` | P0 | RUNBOOK_LOCK_LEAK.md |
| `RecoverySessionStuck` | P0 | RUNBOOK_RECOVERY_STUCK.md |
| `ReplayFailureSpike` | P0 | RUNBOOK_REPLAY_MISFIRE.md |
| `IdempotencyHitAnomaly` | P0 | RUNBOOK_WEBHOOK_STORM.md |
| `WebhookIngestErrorSpike` | P0 | RUNBOOK_WEBHOOK_STORM.md |
| `HighErrorRate` | P1 | - |
| `HighLatency` | P1 | - |

---

## 负责人与联系方式

| 角色 | 人员 | 联系方式 |
|------|------|---------|
| 发布负责人 | - | - |
| 技术负责人 | - | - |
| 运维负责人 | - | - |
| On-call | - | - |

---

## 沟通计划

| 时间点 | 动作 | 受众 |
|--------|------|------|
| Wave 1 开始 | 通知 | 内部团队 |
| Wave 1 完成 | 状态更新 | 内部团队 |
| Wave 2 开始 | 通知 | 内部团队 |
| Wave 2 完成 | 状态更新 | 内部团队 + 利益相关者 |
| Wave 3 开始 | 通知 | 内部团队 + 利益相关者 |
| Wave 3 完成 | 发布完成通知 | 全员 |
| 回滚（如需要） | 紧急通知 | 全员 |

---

## 成功标准

| 标准 | 验证方法 |
|------|---------|
| 无 P0 告警 | 告警历史记录 |
| SLO 达标 | SLO dashboard |
| 无数据丢失 | Audit 日志检查 |
| 无重复执行 | Idempotency 指标 |
| 回滚路径可用 | 回滚演练记录 |

---

_最后更新：2026-04-04 22:40_
_版本：1.0_
_状态：Draft_
