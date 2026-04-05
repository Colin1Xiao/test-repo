# Runbook: Recovery Session Stuck

_Recovery Session 长时间卡住的应急响应。_

---

## 1. 触发条件

**关联告警**: `RecoverySessionStuck` (P0)

**触发条件**: `recovery_session_in_progress > 10` for `10m`

**其他可能告警**:
- `LockAcquireFailureSpike`
- `RecoveryItemClaimFailureSpike`

---

## 2. 症状 / 告警信号

**主要症状**:
- Recovery Session 数量持续高企
- Session 长时间处于 active 状态
- Item 无法被 claim 或 complete
- Recovery 扫描停滞

**监控指标**:
```promql
# 活跃 Session 数量
recovery_session_in_progress > 10

# Session 完成速率下降
rate(recovery_session_completed_total[10m]) < 1

# Item Claim 失败率上升
rate(recovery_item_claim_failure_total[5m]) > 10
```

---

## 3. 影响范围

**受影响的流程**:
- Recovery Session 创建
- Recovery Item Claim
- Recovery Item Complete
- 事件重放与恢复

**风险等级**:
| 流程 | 风险级 | 说明 |
|------|--------|------|
| Session 创建 | HIGH | 新 Session 无法启动 |
| Item Claim | HIGH | Item 无法被处理 |
| Item Complete | MEDIUM | 已完成 Item 无法标记 |
| Replay | MEDIUM | 重放任务停滞 |

---

## 4. 快速判断

**确认 Session 状态**:
```bash
# 检查活跃 Session
curl http://localhost:3000/trading/recovery/sessions | jq '.[] | select(.status == "active")'

# 检查 Session 详情
curl http://localhost:3000/trading/recovery/session/:id | jq '.'
```

**判断卡住类型**:
| 现象 | 可能原因 |
|------|---------|
| Session active 但无 Item | Session 创建后未分配 Item |
| Session active 有 Item 但未 Claim | Claim 逻辑失败 |
| Session active 有 Claim 但未 Complete | 处理逻辑卡住 |
| 所有 Session 都卡住 | 系统性问题（Redis/锁） |

---

## 5. 立即止血动作

### 动作 1: 识别 Stale Session

```bash
# 找出超过阈值的 Session
curl http://localhost:3000/trading/recovery/sessions | jq '
  .[] | select(.status == "active") |
  select((now - .last_heartbeat) > 600)
'
```

### 动作 2: 检查 Session Owner

```bash
# 检查 Session 的 owner 实例
curl http://localhost:3000/trading/recovery/session/:id | jq '.owner_id'

# 检查 owner 实例是否存活
curl http://owner-instance:3000/health
```

### 动作 3: 回收 Stale Session

```bash
# 强制完成卡住的 Session
curl -X POST http://localhost:3000/trading/recovery/session/:id/complete \
  -H "Content-Type: application/json" \
  -d '{"force": true, "reason": "stale_session_recovery"}'

# 释放 Session 持有的 Item
curl -X POST http://localhost:3000/trading/recovery/items/:id/release \
  -H "Content-Type: application/json" \
  -d '{"reason": "session_stale"}'
```

**⚠️ 警告**: 强制完成 Session 前必须确认：
- Owner 实例已不可用，或
- Session 心跳已超时（> 10 分钟）

### 动作 4: 暂停新 Session 创建（如需要）

```bash
# 设置 Recovery 暂停
export ENABLE_RECOVERY_SCAN=false

# 或设置限流
export RECOVERY_SESSION_LIMIT=5
```

---

## 6. 详细排查步骤

### Step 1: 检查 Session 详细信息

```bash
# 获取所有活跃 Session
curl http://localhost:3000/trading/recovery/sessions | jq '
  .[] | select(.status == "active") | {
    session_id,
    owner_id,
    created_at,
    last_heartbeat,
    items_claimed,
    items_completed
  }
'
```

### Step 2: 检查 Owner 实例状态

```bash
# 列出所有实例
curl http://localhost:3000/trading/instances

# 检查每个实例的健康状态
for instance in $(curl http://localhost:3000/trading/instances | jq -r '.[].id'); do
  echo "Checking $instance..."
  curl http://$instance:3000/health | jq '.'
done
```

### Step 3: 检查 Item 状态

```bash
# 检查被卡住 Session 持有的 Item
curl http://localhost:3000/trading/recovery/session/:id/items | jq '
  .[] | select(.status == "claimed")
'
```

### Step 4: 检查应用日志

```bash
# 查找 Recovery 相关错误
grep -i "recovery.*error" /var/log/openclaw/openclaw.log | tail -50

# 查找 Session 超时
grep -i "session.*timeout" /var/log/openclaw/openclaw.log | tail -50

# 查找 Item Claim 失败
grep -i "item.*claim.*fail" /var/log/openclaw/openclaw.log | tail -50
```

---

## 7. 恢复 / 回滚步骤

### 回收 Stale Session

**Step 1**: 确认 Session 已 stale
```bash
# 检查最后心跳时间
curl http://localhost:3000/trading/recovery/session/:id | jq '.last_heartbeat'

# 应超过 10 分钟（600 秒）
```

**Step 2**: 强制完成 Session
```bash
curl -X POST http://localhost:3000/trading/recovery/session/:id/complete \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Step 3**: 释放 Item
```bash
# 释放所有被 claim 的 Item
curl -X POST http://localhost:3000/trading/recovery/session/:id/items/release
```

### 验证功能恢复

**Step 1**: 检查 Session 数量
```promql
# 活跃 Session 数量应下降
recovery_session_in_progress < 5
```

**Step 2**: 尝试创建新 Session
```bash
curl -X POST http://localhost:3000/trading/recovery/session/start
# 应返回 201 Created
```

**Step 3**: 尝试 Claim Item
```bash
curl -X POST http://localhost:3000/trading/recovery/items/:id/claim \
  -H "Content-Type: application/json" \
  -d '{"session_id": "xxx"}'
# 应返回 200 OK
```

### 防止再次卡住

**检查点**:
- [ ] Session 心跳机制正常
- [ ] Session TTL 设置合理
- [ ] Item 处理逻辑无死锁
- [ ] 异常处理完整

**配置建议**:
```bash
# Session TTL（30 分钟）
export RECOVERY_SESSION_TTL_MS=1800000

# 心跳间隔（5 分钟）
export RECOVERY_HEARTBEAT_INTERVAL_MS=300000

# Item Claim TTL（10 分钟）
export RECOVERY_ITEM_CLAIM_TTL_MS=600000
```

---

## 8. 事后复盘与审计项

### 必须记录

| 项目 | 内容 |
|------|------|
| 卡住开始时间 | `2026-04-04 21:00:00` |
| 发现方式 | 告警 / 用户报告 |
| 影响时长 | `XX 分钟` |
| 卡住 Session 数量 | `XX 个` |
| 根本原因 | Owner 崩溃 / 死锁 / 资源不足 |
| 恢复时间 | `2026-04-04 22:00:00` |

### 审计问题

- [ ] 是否有数据丢失？
- [ ] 是否有 Item 被重复处理？
- [ ] Session 心跳是否正常发送？
- [ ] Owner 实例为何失效？
- [ ] 自动回收机制是否生效？

### 改进项

- [ ] 增加 Session 超时自动回收
- [ ] 增加 Item 超时自动释放
- [ ] 改进 Session 心跳机制
- [ ] 增加 Owner 健康检查
- [ ] 增加死锁检测

---

## 关联文档

- **3A-1**: `docs/FEATURE_FLAGS.md` — Recovery 配置
- **3A-2**: `docs/ALERT_RULES.md` — RecoverySessionStuck 告警
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — Recovery 指标

---

_最后更新：2026-04-04 20:55_
_版本：1.0_
_状态：Draft（待演练验证）_
