# Runbook: Replay Misfire

_Replay 误触发 / 重复触发的应急响应。_

---

## 1. 触发条件

**关联告警**: `ReplayFailureSpike` (P0)

**触发条件**: `rate(business_replay_failure_total[5m]) > 5`

**其他可能告警**:
- `StateTransitionRejectSpike`
- `IdempotencyHitAnomaly`

---

## 2. 症状 / 告警信号

**主要症状**:
- Replay 失败率急剧上升
- 状态迁移拒绝增多
- 重复执行告警
- 审计日志异常

**监控指标**:
```promql
# Replay 失败速率
rate(business_replay_failure_total[5m]) > 5

# 状态迁移拒绝
rate(state_transition_rejected_total[5m]) > 20

# 幂等命中异常
rate(idempotency_hit_total[5m]) > 100
```

---

## 3. 影响范围

**受影响的流程**:
- 事件重放执行
- 状态恢复
- 审计日志完整性

**风险等级**:
| 流程 | 风险级 | 说明 |
|------|--------|------|
| Replay 执行 | HIGH | 可能重复执行事件 |
| 状态恢复 | MEDIUM | 状态可能不一致 |
| 审计日志 | MEDIUM | 审计记录可能混乱 |

---

## 4. 快速判断

**确认 Replay 状态**:
```bash
# 检查正在进行的 Replay
curl http://localhost:3000/trading/replay/active | jq '.'

# 检查 Replay 历史
curl http://localhost:3000/trading/replay/history?limit=10 | jq '.'
```

**判断误触发类型**:
| 现象 | 可能原因 |
|------|---------|
| Replay 重复执行 | 幂等性失效 / 重复触发 |
| Replay 执行失败 | 目标状态不存在 / 状态迁移非法 |
| Replay 部分成功 | 部分事件已执行 / 部分失败 |

---

## 5. 立即止血动作

### 动作 1: 冻结 Replay 入口

```bash
# 禁用 Replay 功能
export ENABLE_REPLAY=false

# 或设置 READ_ONLY_MODE
export READ_ONLY_MODE=true
```

### 动作 2: 识别受影响的 Replay

```bash
# 检查最近的 Replay 记录
curl http://localhost:3000/trading/replay/history?limit=20 | jq '
  .[] | select(.status == "failed" or .status == "in_progress") | {
    replay_id,
    target,
    status,
    started_at,
    error
  }
'
```

### 动作 3: 停止进行中的 Replay

```bash
# 停止指定的 Replay
curl -X POST http://localhost:3000/trading/replay/:id/stop \
  -H "Content-Type: application/json" \
  -d '{"reason": "emergency_stop"}'

# 或停止所有 Replay
curl -X POST http://localhost:3000/trading/replay/stop-all
```

### 动作 4: 检查副作用

```bash
# 检查审计日志
grep "replay" /var/log/openclaw/audit.log | tail -100

# 检查状态变化
curl http://localhost:3000/trading/timeline?limit=50 | jq '.'
```

---

## 6. 详细排查步骤

### Step 1: 分析 Replay 失败原因

```bash
# 获取 Replay 详情
curl http://localhost:3000/trading/replay/:id | jq '.'

# 检查 Replay 日志
curl http://localhost:3000/trading/replay/:id/logs | jq '.'
```

### Step 2: 检查幂等性状态

```bash
# 检查幂等记录
redis-cli KEYS "idempotency:replay:*" | while read key; do
  echo "$key: $(redis-cli GET "$key")"
done
```

### Step 3: 检查状态一致性

```bash
# 检查目标对象的当前状态
curl http://localhost:3000/trading/approvals/:id | jq '.status'
curl http://localhost:3000/trading/incidents/:id | jq '.status'

# 对比 Replay 期望状态
curl http://localhost:3000/trading/replay/:id | jq '.expected_state'
```

### Step 4: 检查触发来源

```bash
# 检查谁触发了 Replay
curl http://localhost:3000/trading/replay/:id | jq '.triggered_by'

# 检查触发时间
curl http://localhost:3000/trading/replay/:id | jq '.triggered_at'

# 检查是否有重复触发
curl "http://localhost:3000/trading/replay/history?target=:target" | jq '
  group_by(.target) | .[] | select(length > 1)
'
```

---

## 7. 恢复 / 回滚步骤

### 评估影响范围

**Step 1**: 列出所有受影响的事件
```bash
curl http://localhost:3000/trading/replay/:id/events | jq '
  .[] | {
    event_id,
    event_type,
    executed,
    success
  }
'
```

**Step 2**: 识别已执行的事件
```bash
# 检查审计日志中的执行记录
grep "replay.*execute" /var/log/openclaw/audit.log | grep ":id"
```

### 回滚策略

**选项 1**: 接受已执行的事件（如果可以容忍）
```bash
# 标记 Replay 为部分完成
curl -X POST http://localhost:3000/trading/replay/:id/complete \
  -H "Content-Type: application/json" \
  -d '{"status": "partial", "reason": "some_events_executed"}'
```

**选项 2**: 手动回滚已执行的事件
```bash
# 对每个已执行的事件执行反向操作
# （需要根据具体事件类型定义回滚逻辑）
```

**选项 3**: 恢复备份（如果影响严重）
```bash
# 从备份恢复状态
# （需要实现备份恢复机制）
```

### 恢复 Replay 功能

**Step 1**: 修复根本问题
- 修复幂等性逻辑
- 修复状态迁移验证
- 修复触发机制

**Step 2**: 逐步恢复
```bash
# 先启用 Dry-run 模式
export REPLAY_DRY_RUN=true

# 验证无误后启用正常模式
export REPLAY_DRY_RUN=false
export ENABLE_REPLAY=true
```

**Step 3**: 验证功能
```bash
# 执行测试 Replay
curl -X POST http://localhost:3000/trading/replay/test \
  -H "Content-Type: application/json" \
  -d '{"target": "test", "dry_run": true}'
```

---

## 8. 事后复盘与审计项

### 必须记录

| 项目 | 内容 |
|------|------|
| 误触发时间 | `2026-04-04 22:00:00` |
| 发现方式 | 告警 / 用户报告 |
| 影响时长 | `XX 分钟` |
| 受影响 Replay 数量 | `XX 个` |
| 已执行事件数量 | `XX 个` |
| 根本原因 | 代码缺陷 / 配置错误 / 外部触发 |
| 恢复时间 | `2026-04-04 23:00:00` |

### 审计问题

- [ ] 是否有数据不一致？
- [ ] 是否有重复执行？
- [ ] 幂等性是否失效？
- [ ] 触发机制是否有 bug？
- [ ] 审计日志是否完整？

### 改进项

- [ ] 增加 Replay 触发确认机制
- [ ] 增加 Replay 执行前检查
- [ ] 增加 Replay 进度监控
- [ ] 改进幂等性保护
- [ ] 增加自动回滚机制

---

## 关联文档

- **3A-1**: `docs/FEATURE_FLAGS.md` — Replay 配置
- **3A-1**: `docs/ENTRY_RISK_MATRIX.md` — Replay 风险分级
- **3A-2**: `docs/ALERT_RULES.md` — ReplayFailureSpike 告警
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — Replay 指标

---

_最后更新：2026-04-04 21:00_
_版本：1.0_
_状态：Draft（待演练验证）_
