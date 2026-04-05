# Staging Multi-Instance 验证计划

_Phase 3A-4: 多实例协调语义验证。_

---

## 验证目标

在 Staging 环境中验证 OpenClaw V3 在多实例部署下的协调行为是否符合预期：

1. **多实例排他** — 同一资源只能被一个实例处理
2. **Session/Item Ownership** — 所有权语义正确
3. **状态迁移合法性** — 非法跃迁被拒绝
4. **Webhook 重复处理** — 幂等性正确工作
5. **故障与恢复** — Redis outage / Recovery stuck 可恢复

---

## 环境要求

### 基础设施

| 组件 | 要求 | 状态 |
|------|------|------|
| 实例数量 | ≥ 2（双实例）/ ≥ 3（三实例） | 🔜 |
| Redis | 共享实例（staging-redis） | 🔜 |
| Persistence | 共享存储路径 | 🔜 |
| Audit Log | 共享索引 | 🔜 |
| /metrics 端点 | 可访问 | 🔜 |
| 告警规则 | 已配置 | 🔜 |

### 环境变量

```bash
# 所有实例共享
NODE_ENV=staging
REDIS_HOST=staging-redis.internal
REDIS_PORT=6379
PERSISTENCE_PATH=/var/openclaw/staging/data
AUDIT_LOG_PATH=/var/openclaw/staging/audit

# 各实例独立
INSTANCE_ID=instance-1  # 或 instance-2 / instance-3
PORT=3000  # 或 3001 / 3002
```

### Feature Flags

```bash
# Staging 配置
ENABLE_DISTRIBUTED_LOCK=true
ENABLE_IDEMPOTENCY=true
ENABLE_REPLAY=true
ENABLE_RECOVERY_SCAN=true
STRICT_COORDINATION_REQUIRED=false  # staging 允许降级
FALLBACK_ON_REDIS_DOWN=allow
```

---

## 测试场景

### 场景 1: 多实例排他性

**目标**: 验证同一资源只能被一个实例处理。

| 测试项 | 预期 | 关联指标 |
|--------|------|---------|
| 两实例同时 resolve 同一 approval | 只有一个成功 | `lock_acquire_success_total`, `lock_acquire_failure_total` |
| 两实例同时 resolve 同一 incident | 只有一个成功 | `lock_acquire_success_total`, `lock_acquire_failure_total` |
| 两实例同时 replay 同一 target | 只有一个成功 | `lock_acquire_success_total`, `business_replay_success_total` |
| 两实例同时 recovery scan 同一 scope | 只有一个成功 | `recovery_session_started_total`, `recovery_session_in_progress` |

**通过标准**:
- 只有一个实例成功获取锁并执行
- 另一个实例被拒绝（409 或 503）
- 审计日志完整记录

---

### 场景 2: Session / Item Ownership

**目标**: 验证 Recovery Session 和 Item 的所有权语义。

| 测试项 | 预期 | 关联指标 |
|--------|------|---------|
| 两实例同时 start recovery session | 只有一个成功 | `recovery_session_started_total`, `recovery_session_in_progress` |
| 两实例同时 claim 同一 recovery item | 只有一个成功 | `recovery_item_claim_success_total`, `recovery_item_claim_failure_total` |
| Stale session 过期后，其他实例接管 | 接管成功 | `recovery_session_expired_total`, `recovery_session_started_total` |

**通过标准**:
- 单 owner 成立
- Claim 原子性成立
- Stale owner 无法继续提交结果

---

### 场景 3: 状态迁移合法性

**目标**: 验证 4 条状态流的迁移规则。

| 状态机 | 合法迁移 | 非法迁移 | 预期 |
|--------|---------|---------|------|
| Approvals | pending → approved | approved → pending | 非法被拒绝 |
| Incidents | open → acknowledged | resolved → open | 非法被拒绝 |
| Risk State | normal → warning | critical → warning | 非法被拒绝 |
| Deployments | planned → in_progress | completed → in_progress | 非法被拒绝 |

**通过标准**:
- 合法迁移通过
- 非法迁移被拒绝（400 或 409）
- `state_transition_rejected_total` 有记录
- 审计日志带 reason

---

### 场景 4: Webhook 重复处理

**目标**: 验证幂等性正确工作。

| 测试项 | 预期 | 关联指标 |
|--------|------|---------|
| 重复 event id 投递 | 只执行一次 | `idempotency_hit_total`, `business_webhook_deduped_total` |
| 并发 webhook 投递 | 不重复执行 | `idempotency_created_total`, `idempotency_hit_total` |
| Provider 突发流量 | 限流生效 | `http_requests_error_total`, `rate_limit_hit_total` |

**通过标准**:
- Idempotency 命中
- 不重复执行业务动作
- 告警与 runbook 可对应触发

---

### 场景 5: 故障与恢复演练

**目标**: 验证故障场景下的系统行为。

#### 5A: Redis 短时不可用

| 预期 | 关联告警 | Runbook |
|------|---------|---------|
| Staging 按策略降级 | `RedisDisconnected` | `RUNBOOK_REDIS_OUTAGE.md` |
| 高风险入口行为符合矩阵 | `LockAcquireFailureSpike` | |
| 恢复后服务回归正常 | | |

#### 5B: Recovery Session 卡住

| 预期 | 关联告警 | Runbook |
|------|---------|---------|
| 触发 stuck 指标/告警 | `RecoverySessionStuck` | `RUNBOOK_RECOVERY_STUCK.md` |
| Runbook 可执行 | | |
| Reclaim 后恢复正常 | | |

---

## 执行顺序

### 第一阶段：环境检查（30 分钟）

1. 部署 2 实例
2. 验证 Redis 连接
3. 验证 /metrics 端点
4. 验证告警规则

### 第二阶段：双实例验证（2 小时）

1. Approval 排他性测试
2. Incident 排他性测试
3. Replay 排他性测试
4. Recovery 排他性测试
5. Webhook 幂等性测试

### 第三阶段：三实例验证（1 小时）

1. 部署第 3 实例
2. 重复双实例测试
3. 验证 ownership 竞争

### 第四阶段：故障演练（1 小时）

1. Redis outage 演练
2. Recovery stuck 演练

### 第五阶段：结果归档（30 分钟）

1. 整理测试结果
2. 输出 STAGING_FINDINGS.md
3. 决定是否进入 3A-5

---

## 验收标准

| 项目 | 状态 |
|------|------|
| Staging 双实例部署成功 | 🔜 |
| Staging 三实例部署成功 | 🔜 |
| Approval/Incident/Replay/Recovery/Webhook 多实例竞争验证通过 | 🔜 |
| Session Ownership / Item Claim / Stale Reclaim 验证通过 | 🔜 |
| 4 条状态流合法性验证通过 | 🔜 |
| 至少 2 类故障演练完成 | 🔜 |
| /metrics、告警、Runbook 在 Staging 中可用 | 🔜 |
| 输出 STAGING_FINDINGS.md | 🔜 |

---

## 回滚计划

如验证失败，执行以下回滚：

1. **停止实例**: `systemctl stop openclaw-staging-*`
2. **清理数据**: `rm -rf /var/openclaw/staging/data/*`
3. **恢复配置**: 回滚到验证前版本
4. **记录问题**: 更新 STAGING_FINDINGS.md

---

## 参与人员

| 角色 | 人员 | 职责 |
|------|------|------|
| 测试执行 | - | 执行测试用例 |
| 观察记录 | - | 记录指标和日志 |
| 决策 | - | 判断是否通过 |

---

_最后更新：2026-04-04 21:15_
_版本：1.0_
_状态：Draft_
