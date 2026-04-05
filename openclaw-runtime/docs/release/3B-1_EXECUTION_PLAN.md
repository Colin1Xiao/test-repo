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

## 并发验证方案 (3B-1A)

### 测试脚本

`scripts/concurrency-test.sh` - 6 组并发测试

### 必测场景 (6 组)

| 编号 | 场景 | 预期 | 关联指标 |
|------|------|------|---------|
| CT-01 | 三并发 resolve 同一 approval | 1 成功，2 失败 | `lock_acquire_success=1, failure=2` |
| CT-02 | 三并发 acknowledge 同一 incident | 1 成功，2 失败 | `lock_acquire_success=1, failure=2` |
| CT-03 | 三并发 resolve 同一 incident | 1 成功，2 失败 | `lock_acquire_success=1, failure=2` |
| CT-04 | 三并发 replay 同一 target | 1 成功，2 失败 | `lock_acquire_success=1, failure=2` |
| CT-05 | 三并发 recovery scan 同一 scope | 1 成功，2 失败 | `recovery_session_started=1` |
| CT-06 | 三并发重复 webhook event id | 1 执行，2 幂等 | `idempotency_created=1, hit=2` |

### 执行状态

| 测试 | 状态 | 说明 |
|------|------|------|
| CT-01 ~ CT-06 | ⏸️ 暂停 | 服务未运行，脚本已就绪 |

**备注**: 并发测试脚本已创建，等服务实际运行后执行。

---

## 延长观察方案 (3B-1B)

### 观察时长

| 阶段 | 时长 | 目标 |
|------|------|------|
| Wave 1 | 30 分钟 | 基本功能验证 ✅ |
| **Wave 1 Extended** | **24 小时** | **长时间稳定性** ⏳ |
| Wave 2 | 待定 | 根据数据决定 |

### 观察指标

| 指标 | 基线 | 阈值 | 告警阈值 |
|------|------|------|---------|
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

## Go/No-Go 检查 (12 项)

### 并发验证 (3B-1A)

| 检查项 | 状态 |
|--------|------|
| CT-01: 三并发 resolve approval | ☐ |
| CT-02: 三并发 acknowledge incident | ☐ |
| CT-03: 三并发 resolve incident | ☐ |
| CT-04: 三并发 replay | ☐ |
| CT-05: 三并发 recovery scan | ☐ |
| CT-06: 三并发 webhook 重复 | ☐ |

### 延长观察 (3B-1B)

| 检查项 | 状态 |
|--------|------|
| Redis 连接正常 | ☐ |
| /metrics 可访问 | ☐ |
| 告警通道正常 | ☐ |
| Rollback 开关已确认 | ☐ |
| Feature Flags 已核对 | ☐ |
| 无 P0 告警活跃 | ☐ |

**Go 条件**: 12/12 通过  
**No-Go 条件**: 任一不通过

---

## Rollback 条件

### 并发验证失败

| 条件 | 阈值 | 动作 |
|------|------|------|
| 并发测试失败 | > 1/6 失败 | 修复协调逻辑 |
| lock contention 异常 | 全部失败 | 检查 Redis 连接 |
| idempotency 失效 | > 0 重复执行 | 立即停止 |

### 延长观察异常

| 条件 | 阈值 | 动作 |
|------|------|------|
| endpoint success rate | < 98% | 评估回滚 |
| lock acquire failure | > 15% | 限流 + 评估 |
| idempotency hit 异常 | > 1000/min | 限流 + 评估 |
| Redis 延迟上升 | > 100ms | 评估 + 可能回滚 |
| alert 噪音 | > 50/天 | 降噪 + 评估 |

---

## 成功标准

| 标准 | 验证方法 |
|------|---------|
| 并发验证 6/6 通过 | concurrency-test.sh |
| 24 小时无 P0 告警 | 告警历史记录 |
| SLO 达标 | SLO dashboard |
| 无数据丢失 | Audit 日志检查 |
| 无重复执行 | Idempotency 指标 |

---

## 下一步决策

**24 小时后评估**:

| 数据表现 | 决策 |
|---------|------|
| 所有指标正常 | 直接进入 3B-2 (性能优化) |
| 发现锁竞争热点 | 本地三端口模拟验证 |
| 发现幂等问题 | 修复后重新验证 |
| 发现 Redis 瓶颈 | 评估 Redis 集群方案 |
| 告警噪音大 | 调整告警阈值 |

---

_最后更新：2026-04-05 03:35_
_版本：1.1 (调整版)_
_状态：执行中_

---

## 阻塞项说明

**Blocker**: Business endpoints not deployed behind current gateway

**影响**: 
- 并发测试无法执行有效验证
- 当前只能得到 404（端点不存在），不是协调语义验证

**临时措施**:
- 保持脚本就绪状态
- 继续 24 小时延长观察
- 记录执行条件

**恢复条件**:
- 业务服务（含 trading 端点）部署完成
- 可访问 `/trading/approvals/*`, `/trading/incidents/*`, `/trading/replay/*`, `/trading/recovery/*`, `/trading/webhooks/*` 端点

**当前环境状态**:
- ✅ Gateway 基础服务在线 (端口 18789)
- ✅ 并发测试脚本可用 (`scripts/concurrency-test.sh`)
- ✅ BASE_URL 已配置 (`http://localhost:18789`)
- ❌ 业务端点未部署 (approval/incident/replay/recovery/webhook)

---

_最后更新：2026-04-05 03:55_
