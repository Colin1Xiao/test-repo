# Staging 环境检查清单

_Phase 3A-4: 验证前环境确认。_

---

## 基础设施检查

### 实例部署

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 实例 1 运行中 | `systemctl status openclaw-staging-1` | Active (running) | 🔜 |
| 实例 2 运行中 | `systemctl status openclaw-staging-2` | Active (running) | 🔜 |
| 实例 3 运行中（可选） | `systemctl status openclaw-staging-3` | Active (running) | 🔜 |
| 实例 1 健康 | `curl http://staging-1:3000/health` | `{"status": "healthy"}` | 🔜 |
| 实例 2 健康 | `curl http://staging-2:3001/health` | `{"status": "healthy"}` | 🔜 |

### Redis 连接

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| Redis 运行中 | `redis-cli -h staging-redis ping` | PONG | 🔜 |
| 实例 1 连接 | `curl http://staging-1:3000/ready` | `{"checks": {"redis": "ok"}}` | 🔜 |
| 实例 2 连接 | `curl http://staging-2:3001/ready` | `{"checks": {"redis": "ok"}}` | 🔜 |
| Redis Key 前缀 | `redis-cli KEYS "staging:*" | head` | 有 key 返回 | 🔜 |

### Persistence 存储

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 存储路径存在 | `ls -la /var/openclaw/staging/data` | 目录存在 | 🔜 |
| 实例 1 可写 | `touch /var/openclaw/staging/data/test` | 成功 | 🔜 |
| 实例 2 可写 | `touch /var/openclaw/staging/data/test` | 成功 | 🔜 |

### Audit Log

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 审计路径存在 | `ls -la /var/openclaw/staging/audit` | 目录存在 | 🔜 |
| 实例 1 可写 | `echo test >> /var/openclaw/staging/audit/test.log` | 成功 | 🔜 |

---

## 配置检查

### 环境变量

```bash
# 实例 1
curl http://staging-1:3000/config | jq '
  {
    NODE_ENV,
    INSTANCE_ID,
    REDIS_HOST,
    REDIS_KEY_PREFIX,
    ENABLE_DISTRIBUTED_LOCK,
    ENABLE_IDEMPOTENCY,
    STRICT_COORDINATION_REQUIRED,
    FALLBACK_ON_REDIS_DOWN
  }
'

# 预期输出:
# {
#   "NODE_ENV": "staging",
#   "INSTANCE_ID": "instance-1",
#   "REDIS_HOST": "staging-redis.internal",
#   "REDIS_KEY_PREFIX": "staging:",
#   "ENABLE_DISTRIBUTED_LOCK": true,
#   "ENABLE_IDEMPOTENCY": true,
#   "STRICT_COORDINATION_REQUIRED": false,
#   "FALLBACK_ON_REDIS_DOWN": "allow"
# }
```

### Feature Flags

| Flag | 预期值 | 检查命令 | 状态 |
|------|--------|---------|------|
| `ENABLE_DISTRIBUTED_LOCK` | true | `curl http://staging-1:3000/config \| jq .ENABLE_DISTRIBUTED_LOCK` | 🔜 |
| `ENABLE_IDEMPOTENCY` | true | `curl http://staging-1:3000/config \| jq .ENABLE_IDEMPOTENCY` | 🔜 |
| `ENABLE_REPLAY` | true | `curl http://staging-1:3000/config \| jq .ENABLE_REPLAY` | 🔜 |
| `ENABLE_RECOVERY_SCAN` | true | `curl http://staging-1:3000/config \| jq .ENABLE_RECOVERY_SCAN` | 🔜 |
| `STRICT_COORDINATION_REQUIRED` | false | `curl http://staging-1:3000/config \| jq .STRICT_COORDINATION_REQUIRED` | 🔜 |

---

## 可观测性检查

### Metrics 端点

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 实例 1 /metrics | `curl http://staging-1:3000/metrics` | Prometheus 格式 | 🔜 |
| 实例 2 /metrics | `curl http://staging-2:3001/metrics` | Prometheus 格式 | 🔜 |
| 指标存在 | `curl http://staging-1:3000/metrics \| grep http_requests_total` | 有输出 | 🔜 |

### 告警规则

| 检查项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| Prometheus 运行中 | `systemctl status prometheus` | Active (running) | 🔜 |
| 告警规则加载 | `curl http://prometheus:9090/api/v1/rules` | 规则列表 | 🔜 |
| RedisDisconnected 规则 | `curl http://prometheus:9090/api/v1/rules \| grep RedisDisconnected` | 有输出 | 🔜 |

---

## 预验证测试

### 基础功能测试

| 测试项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 创建 Approval | `curl -X POST http://staging-1:3000/trading/approvals -d '{}'` | 201 Created | 🔜 |
| 查询 Approval | `curl http://staging-1:3000/trading/approvals/:id` | 200 OK | 🔜 |
| 创建 Recovery Session | `curl -X POST http://staging-1:3000/trading/recovery/session/start` | 201 Created | 🔜 |

### 协调功能测试

| 测试项 | 命令 | 预期 | 状态 |
|--------|------|------|------|
| 获取锁 | `curl -X POST http://staging-1:3000/trading/recovery/session/start` | 201 Created | 🔜 |
| 重复获取锁 | `curl -X POST http://staging-2:3001/trading/recovery/session/start` | 409 Conflict | 🔜 |

---

## 检查完成确认

| 项目 | 状态 | 备注 |
|------|------|------|
| 基础设施检查 | 🔜 | |
| 配置检查 | 🔜 | |
| 可观测性检查 | 🔜 | |
| 预验证测试 | 🔜 | |

**检查人**: ___________  
**检查时间**: ___________  
**是否开始验证**: ☐ 是 / ☐ 否

---

_最后更新：2026-04-04 21:20_
_版本：1.0_
_状态：Draft_
