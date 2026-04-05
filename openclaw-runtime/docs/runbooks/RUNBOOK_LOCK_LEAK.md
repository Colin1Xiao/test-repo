# Runbook: Lock Leak

_锁未释放 / 锁竞争异常的应急响应。_

---

## 1. 触发条件

**关联告警**: `LockAcquireFailureSpike` (P0)

**触发条件**: `rate(lock_acquire_failure_total[5m]) > 10`

**其他可能告警**:
- `RecoverySessionStuck`
- `LockHeldDurationAnomaly`（待定义）

---

## 2. 症状 / 告警信号

**主要症状**:
- 锁获取失败率急剧上升
- 锁持有时长异常
- Recovery Session 卡住
- 资源无法被访问

**监控指标**:
```promql
# 锁获取失败速率
rate(lock_acquire_failure_total[5m]) > 10

# 锁竞争速率
rate(lock_contention_total[5m]) > 20

# 活跃锁数量
sum(lock_in_progress_total) > 50
```

---

## 3. 影响范围

**受影响的资源**:
- Approval 审批锁
- Incident 事件锁
- Recovery Session 锁
- Recovery Item Claim 锁
- Replay 执行锁

**风险等级**:
| 资源类型 | 风险级 | 说明 |
|---------|--------|------|
| approval:lock | CRITICAL | 审批无法 resolve |
| incident:lock | CRITICAL | 事件无法处理 |
| recovery:session:lock | HIGH | Session 无法创建 |
| recovery:item:lock | HIGH | Item 无法 claim |
| replay:lock | MEDIUM | 重放无法执行 |

---

## 4. 快速判断

**确认锁泄漏**:
```bash
# 检查 Redis 中的锁
redis-cli KEYS "lock:*"

# 检查锁的 TTL
redis-cli TTL "lock:approval:123"

# 检查锁的 owner（如果有记录）
redis-cli GET "lock:approval:123:owner"
```

**判断泄漏类型**:
| 现象 | 可能原因 |
|------|---------|
| 锁存在但 TTL 正常 | 持有者处理慢 |
| 锁存在但 TTL 已过期 | 持有者崩溃未释放 |
| 大量锁同时存在 | 并发竞争或批量操作 |
| 锁不存在但获取失败 | 可能是其他原因 |

---

## 5. 立即止血动作

### 动作 1: 识别异常锁

```bash
# 列出所有锁
redis-cli KEYS "lock:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  echo "$key: TTL=$ttl"
done

# 找出 TTL 异常的锁（已过期但未被清理）
redis-cli KEYS "lock:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" -lt 0 ]; then
    echo "Stale lock: $key"
  fi
done
```

### 动作 2: 安全释放过期锁

```bash
# 只释放已过期的锁（TTL < 0）
redis-cli KEYS "lock:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" -lt 0 ]; then
    echo "Releasing stale lock: $key"
    redis-cli DEL "$key"
  fi
done
```

**⚠️ 警告**: 不要释放 TTL 仍为正的锁！这会导致并发冲突。

### 动作 3: 通知持有者（如可能）

```bash
# 检查锁的 owner 信息
redis-cli GET "lock:approval:123:owner"

# 如果有 owner，尝试通知释放
# （需要实现 owner 通知机制）
```

### 动作 4: 启用限流（如泄漏持续）

```bash
# 限制并发锁请求
export LOCK_RETRY_COUNT=1
export LOCK_RETRY_DELAY_MS=500
```

---

## 6. 详细排查步骤

### Step 1: 分析锁持有者

```bash
# 检查锁的元数据
redis-cli KEYS "lock:*:owner" | while read key; do
  owner=$(redis-cli GET "$key")
  echo "$key: owner=$owner"
done
```

### Step 2: 检查持有锁的实例

```bash
# 检查哪个实例持有锁
# （需要实现实例注册机制）
curl http://localhost:3000/trading/recovery/sessions | jq '.[] | select(.status == "active")'
```

### Step 3: 检查锁竞争模式

```bash
# 查看锁获取失败的资源分布
# （需要实现指标查询）
curl "http://localhost:9090/api/v1/query?query=lock_acquire_failure_total"
```

### Step 4: 检查应用日志

```bash
# 查找锁相关错误
grep -i "lock.*fail" /var/log/openclaw/openclaw.log | tail -50

# 查找锁获取超时
grep -i "lock.*timeout" /var/log/openclaw/openclaw.log | tail -50
```

---

## 7. 恢复 / 回滚步骤

### 清理泄漏锁

**Step 1**: 确认锁已过期
```bash
redis-cli TTL "lock:approval:123"
# 应返回 -1 或 -2（已过期）
```

**Step 2**: 删除过期锁
```bash
redis-cli DEL "lock:approval:123"
```

**Step 3**: 验证锁已释放
```bash
redis-cli GET "lock:approval:123"
# 应返回 (nil)
```

### 验证功能恢复

**Step 1**: 尝试获取锁
```bash
curl -X POST http://localhost:3000/trading/approvals/123/resolve
# 应返回 200 或 201
```

**Step 2**: 检查锁指标
```promql
# 锁获取失败率应下降
rate(lock_acquire_failure_total[5m]) < 1
```

### 防止再次泄漏

**检查点**:
- [ ] 所有锁都有合理的 TTL
- [ ] 所有锁获取都有 try-finally 释放
- [ ] 异常处理中也有锁释放逻辑
- [ ] 锁续期逻辑正常

**代码审查清单**:
```typescript
// 正确的锁使用模式
const lock = await acquireLock(resource, ttl);
try {
  await doWork();
} finally {
  await releaseLock(lock);
}
```

---

## 8. 事后复盘与审计项

### 必须记录

| 项目 | 内容 |
|------|------|
| 泄漏开始时间 | `2026-04-04 21:00:00` |
| 发现方式 | 告警 / 用户报告 |
| 影响时长 | `XX 分钟` |
| 泄漏锁数量 | `XX 个` |
| 根本原因 | 代码缺陷 / 异常未捕获 / TTL 过短 |
| 恢复时间 | `2026-04-04 21:30:00` |

### 审计问题

- [ ] 是否有数据不一致？
- [ ] 是否有重复执行？
- [ ] 锁释放逻辑是否有 bug？
- [ ] TTL 设置是否合理？
- [ ] 异常处理是否完整？

### 改进项

- [ ] 增加锁泄漏自动检测
- [ ] 增加锁持有时间监控
- [ ] 增加自动清理机制
- [ ] 改进锁使用模式（使用 async/await + try-finally）
- [ ] 增加锁续期机制（对长任务）

---

## 关联文档

- **3A-1**: `docs/FEATURE_FLAGS.md` — 锁配置
- **3A-1**: `docs/ENTRY_RISK_MATRIX.md` — 入口风险分级
- **3A-2**: `docs/ALERT_RULES.md` — LockAcquireFailureSpike 告警
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — Lock 指标

---

_最后更新：2026-04-04 20:50_
_版本：1.0_
_状态：Draft（待演练验证）_
