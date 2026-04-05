# OpenClaw V3 回滚计划

_Phase 3A-5: 回滚策略与执行流程。_

---

## 回滚触发条件

### 立即回滚（P0）

**出现以下任何情况，立即执行回滚：**

| 条件 | 检测方法 | 阈值 |
|------|---------|------|
| Lock contention 异常上升 | `rate(lock_acquire_failure_total[5m])` | > 50/min |
| 重复执行风险 | `idempotency_failed_total{reason="duplicate_execution"}` | > 0 |
| 非法状态迁移被放过 | `state_transition_rejected_total` 异常低 + 业务异常 | - |
| Redis 协调不稳定 | `redis_connected` 波动 | 频繁 disconnect |
| Recovery session stuck 无法回收 | `recovery_session_in_progress` | > 50 for 10m |
| Webhook storm 无法吸收 | `rate(idempotency_hit_total[5m])` | > 1000/min |
| Audit 写入失败 | `rate(audit_write_failed_total[5m])` | > 20/min |
| SLO 严重超出 | 错误预算消耗 | > 80% |

### 延迟回滚（P1）

**以下情况可观察 15-30 分钟后决定是否回滚：**

| 条件 | 检测方法 |
|------|---------|
| 高延迟 | P95 > 5s |
| 错误率上升 | > 2% 但 < 5% |
| 部分功能异常 | 非核心功能 |
| 单实例问题 | 可隔离 |

---

## 回滚决策流程

```
告警触发
    ↓
On-call 确认 (5 分钟内)
    ↓
┌─────────────────────────────────┐
│ P0 触发？                        │
│ → 是：立即回滚                  │
│ → 否：观察 15-30 分钟             │
└─────────────────────────────────┘
    ↓
回滚执行
    ↓
回滚后验证
    ↓
事后复盘
```

---

## 回滚动作

### 动作 1: 关闭高风险 Feature Flags

```bash
# 禁用 Replay
export ENABLE_REPLAY=false

# 禁用 Recovery Scan
export ENABLE_RECOVERY_SCAN=false

# 禁用分布式锁（降级）
export ENABLE_DISTRIBUTED_LOCK=false

# 启用严格模式
export SAFE_MODE=true
```

### 动作 2: 禁用高风险入口

```bash
# 通过负载均衡器禁用入口
# - POST /trading/replay/*
# - POST /trading/recovery/*
# - POST /trading/approvals/:id/resolve
# - POST /trading/incidents/:id/resolve
```

### 动作 3: 切回受限运行模式

```bash
# 只读模式
export READ_ONLY_MODE=true

# 允许降级
export FALLBACK_ON_REDIS_DOWN=allow
export FALLBACK_ON_LOCK_FAIL=allow
```

### 动作 4: 保留 Audit/Timeline

**确保审计功能继续工作：**
```bash
# 审计不可关闭
export ENABLE_POLICY_AUDIT=true
export ENABLE_TIMELINE=true
```

### 动作 5: 必要时退回单实例

```bash
# 停止实例 2
systemctl stop openclaw-instance-2

# 保留实例 1（单实例运行）
systemctl status openclaw-instance-1
```

---

## 回滚执行步骤

### Step 1: 确认回滚决定

| 项目 | 内容 |
|------|------|
| 回滚原因 | |
| 触发告警 | |
| 影响范围 | |
| 决策人 | |
| 决策时间 | |

### Step 2: 通知相关方

| 受众 | 方式 | 模板 |
|------|------|------|
| 内部团队 | IM/电话 | "正在执行回滚，预计 XX 分钟完成" |
| 利益相关者 | IM/邮件 | "系统回滚中，服务可能受影响" |
| 用户（如需要） | 公告 | "系统维护中" |

### Step 3: 执行回滚

**时间目标**: < 15 分钟

| 步骤 | 动作 | 预计时间 | 执行人 | 完成 |
|------|------|---------|--------|--------|
| 1 | 关闭 Feature Flags | 2 min | | ☐ |
| 2 | 禁用高风险入口 | 3 min | | ☐ |
| 3 | 切换运行模式 | 2 min | | ☐ |
| 4 | 停止实例（如需要） | 5 min | | ☐ |
| 5 | 清理 Redis 锁 | 3 min | | ☐ |

### Step 4: 回滚后验证

| 验证项 | 方法 | 预期 | 结果 |
|--------|------|------|------|
| 高风险入口已冻结 | 尝试访问 | 403/503 | ☐ |
| Redis/lock 状态已清理 | `redis-cli KEYS "lock:*"` | 无残留 | ☐ |
| Metrics 恢复稳定 | 检查 dashboard | 指标正常 | ☐ |
| 审计链完整 | 检查 audit log | 记录回滚动作 | ☐ |
| 服务可用 | 健康检查 | 200 OK | ☐ |

### Step 5: 通知回滚完成

| 受众 | 方式 | 模板 |
|------|------|------|
| 内部团队 | IM | "回滚完成，服务已恢复" |
| 利益相关者 | 邮件 | "回滚完成，后续将分析问题原因" |

---

## 回滚检查清单

### 回滚前

- [ ] 回滚原因已确认
- [ ] 决策人已批准
- [ ] 相关方已通知
- [ ] 回滚步骤已准备

### 回滚中

- [ ] Feature Flags 已关闭
- [ ] 高风险入口已禁用
- [ ] 运行模式已切换
- [ ] 实例已停止（如需要）
- [ ] Redis 锁已清理

### 回滚后

- [ ] 高风险入口已冻结（验证）
- [ ] Redis/lock 状态已清理（验证）
- [ ] Metrics 恢复稳定（验证）
- [ ] 审计链完整（验证）
- [ ] 服务可用（验证）
- [ ] 相关方已通知

---

## 事后复盘

### 必须记录

| 项目 | 内容 |
|------|------|
| 回滚触发时间 | |
| 回滚完成时间 | |
| 回滚时长 | |
| 根本原因 | |
| 影响范围 | |
| 改进措施 | |

### 复盘会议

- **时间**: 回滚后 24-48 小时内
- **参与**: 发布负责人、技术负责人、运维负责人
- **输出**: 复盘报告 + 改进项清单

---

## 关联文档

| 文档 | 链接 |
|------|------|
| RELEASE_GATE_CHECKLIST.md | ./RELEASE_GATE_CHECKLIST.md |
| GREY_DEPLOYMENT_PLAN.md | ./GREY_DEPLOYMENT_PLAN.md |
| GO_NO_GO_TEMPLATE.md | ./GO_NO_GO_TEMPLATE.md |
| RUNBOOK_INDEX.md | ../runbooks/RUNBOOK_INDEX.md |

---

_最后更新：2026-04-04 22:45_
_版本：1.0_
_状态：Draft_
