# Runbook: Redis Outage

_Redis 协调层不可用时的应急响应。_

---

## 1. 触发条件

**关联告警**: `RedisDisconnected` (P0)

**触发条件**: `redis_connected == 0` for `1m`

**其他可能告警**:
- `LockAcquireFailureSpike`
- `IdempotencyHitAnomaly`
- `RecoverySessionStuck`

---

## 2. 症状 / 告警信号

**主要症状**:
- Redis 连接状态显示 disconnected
- 锁获取失败率急剧上升
- 幂等性检查失败
- Recovery Session 卡住

**监控指标**:
```promql
# Redis 连接状态
redis_connected == 0

# 锁失败率
rate(lock_acquire_failure_total[5m]) > 10

# 幂等命中异常
rate(idempotency_hit_total[5m]) > 100
```

---

## 3. 影响范围

**高风险入口**（CRITICAL）:
- `POST /trading/approvals/:id/resolve` — **拒绝**（prod）
- `POST /trading/incidents/:id/resolve` — **拒绝**（prod）
- `POST /trading/recovery/items/:id/claim` — **拒绝**（prod）

**中风险入口**（HIGH）:
- `POST /trading/incidents/:id/acknowledge` — **降级**（staging/dev 允许）
- `POST /trading/recovery/session/start` — **拒绝**

**只读入口**（LOW）:
- `GET /trading/approvals` — **允许**（可能 stale）
- `GET /trading/incidents` — **允许**（可能 stale）
- `GET /metrics` — **允许**

---

## 4. 快速判断

**确认 Redis 状态**:
```bash
# 检查 Redis 连接
curl http://localhost:3000/ready

# 检查 Redis 进程
ps aux | grep redis

# 尝试 Redis CLI
redis-cli ping
```

**判断影响范围**:
- 单实例故障 → 切换到备用实例
- 集群故障 → 进入降级模式
- 网络分区 → 等待网络恢复

---

## 5. 立即止血动作

### Prod 环境（严格模式）

**动作 1**: 冻结高风险入口
```bash
# 设置 SAFE_MODE
export SAFE_MODE=true

# 或设置 READ_ONLY_MODE
export READ_ONLY_MODE=true
```

**动作 2**: 通知相关方
- 通知运维团队
- 通知业务方（审批/事件处理暂停）

**动作 3**: 启用备用 Redis（如有）
```bash
# 切换 Redis 连接
export REDIS_HOST=redis-backup.internal
systemctl restart openclaw
```

### Staging/Dev 环境（降级模式）

**动作 1**: 允许降级执行
```bash
# 设置降级策略
export FALLBACK_ON_REDIS_DOWN=allow
export FALLBACK_ON_LOCK_FAIL=allow
```

**动作 2**: 记录审计日志
- 所有降级操作必须记录审计日志
- 标记为 `coordination_bypass: true`

---

## 6. 详细排查步骤

### Step 1: 确认 Redis 故障类型

```bash
# 检查 Redis 服务状态
systemctl status redis

# 检查 Redis 日志
tail -100 /var/log/redis/redis.log

# 检查网络连接
netstat -an | grep 6379
```

### Step 2: 检查 OpenClaw 连接状态

```bash
# 查看 OpenClaw 日志
tail -100 /var/log/openclaw/openclaw.log | grep -i redis

# 检查当前连接池状态
curl http://localhost:3000/health | jq '.redis'
```

### Step 3: 判断恢复时间

| 故障类型 | 预计恢复时间 | 动作 |
|---------|------------|------|
| Redis 进程崩溃 | < 5 分钟 | 重启 Redis |
| 内存溢出 | 5-15 分钟 | 清理内存/扩容 |
| 网络分区 | 不确定 | 等待网络恢复 |
| 硬件故障 | > 30 分钟 | 切换备用实例 |

---

## 7. 恢复 / 回滚步骤

### Redis 恢复后验证

**Step 1**: 验证 Redis 连接
```bash
redis-cli ping
# 应返回 PONG
```

**Step 2**: 验证 OpenClaw 连接
```bash
curl http://localhost:3000/ready
# 应返回 {"status": "ready", "checks": {"redis": "ok", ...}}
```

**Step 3**: 验证锁功能
```bash
# 尝试获取锁
curl -X POST http://localhost:3000/trading/recovery/session/start
# 应返回 201 Created
```

**Step 4**: 验证幂等功能
```bash
# 发送重复请求
curl -X POST http://localhost:3000/trading/approvals/123/resolve
curl -X POST http://localhost:3000/trading/approvals/123/resolve
# 第二次应返回幂等响应
```

### 解除降级模式

```bash
# 恢复严格模式
export SAFE_MODE=false
export READ_ONLY_MODE=false
export FALLBACK_ON_REDIS_DOWN=reject

# 重启服务（如需要）
systemctl restart openclaw
```

### 数据一致性检查

**检查锁泄漏**:
```bash
# 检查是否有未释放的锁
redis-cli KEYS "lock:*"
```

**检查 Recovery Session**:
```bash
# 检查是否有卡住的 Session
curl http://localhost:3000/trading/recovery/sessions | jq '.[] | select(.status == "active")'
```

**检查审计日志**:
```bash
# 检查降级期间的审计记录
grep "coordination_bypass" /var/log/openclaw/audit.log
```

---

## 8. 事后复盘与审计项

### 必须记录

| 项目 | 内容 |
|------|------|
| 故障开始时间 | `2026-04-04 20:45:00` |
| 故障发现方式 | 告警 / 用户报告 |
| 影响时长 | `XX 分钟` |
| 影响入口 | 列出所有受影响的 API |
| 降级操作 | 列出所有降级执行的操作 |
| 恢复时间 | `2026-04-04 21:30:00` |
| 根本原因 | Redis 崩溃 / 网络 / 其他 |

### 审计问题

- [ ] 是否有数据丢失？
- [ ] 是否有重复执行？
- [ ] 降级操作是否有完整审计日志？
- [ ] 告警是否及时触发？
- [ ] Runbook 执行是否顺利？

### 改进项

- [ ] 是否需要增加 Redis 高可用？
- [ ] 是否需要优化告警阈值？
- [ ] 是否需要改进降级策略？
- [ ] 是否需要增加自动化恢复？

---

## 关联文档

- **3A-1**: `docs/ENVIRONMENT_MATRIX.md` — 环境配置
- **3A-1**: `docs/FEATURE_FLAGS.md` — Feature Flags
- **3A-1**: `docs/ENTRY_RISK_MATRIX.md` — 入口风险分级
- **3A-2**: `docs/ALERT_RULES.md` — RedisDisconnected 告警
- **3A-2**: `docs/OBSERVABILITY_SPEC.md` — Redis 指标

---

_最后更新：2026-04-04 20:45_
_版本：1.0_
_状态：Draft（待演练验证）_
