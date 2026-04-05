# OpenClaw V3 环境变量矩阵

_所有环境配置的权威来源。_

---

## 核心配置

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `NODE_ENV` | development | staging | production | 运行环境 |
| `PORT` | 3000 | 3000 | 3000 | HTTP 服务端口 |
| `HOST` | localhost | 0.0.0.0 | 0.0.0.0 | 监听地址 |

## Redis 配置

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `REDIS_HOST` | localhost | staging-redis.internal | prod-redis-cluster.internal | Redis 主机 |
| `REDIS_PORT` | 6379 | 6379 | 6379 | Redis 端口 |
| `REDIS_PASSWORD` | (empty) | `${REDIS_PASSWORD}` | `${REDIS_PASSWORD}` | Redis 密码 |
| `REDIS_DB` | 0 | 1 | 2 | Redis DB 索引 |
| `REDIS_KEY_PREFIX` | dev: | staging: | prod: | Key 前缀 |
| `REDIS_CONNECTION_TIMEOUT` | 5000 | 5000 | 3000 | 连接超时 (ms) |
| `REDIS_RETRY_COUNT` | 3 | 3 | 5 | 重试次数 |

## Persistence 配置

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `PERSISTENCE_PATH` | ./data/dev | ./data/staging | /var/openclaw/data | 持久化路径 |
| `AUDIT_LOG_PATH` | ./logs/dev | ./logs/staging | /var/log/openclaw/audit | 审计日志路径 |
| `AUDIT_LOG_LEVEL` | debug | info | warn | 审计日志级别 |
| `AUDIT_RETENTION_DAYS` | 7 | 30 | 365 | 审计日志保留期 |

## Feature Flags

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `STRICT_COORDINATION_REQUIRED` | false | false | true | 严格协调模式 |
| `ALLOW_LOCK_FALLBACK` | true | true | false | 允许锁降级 |
| `ENABLE_REPLAY` | true | true | false | 重放功能 |
| `ENABLE_RECOVERY_SCAN` | true | true | true | 恢复扫描 |
| `ENABLE_DISTRIBUTED_LOCK` | false | true | true | 分布式锁 |
| `ENABLE_IDEMPOTENCY` | false | true | true | 幂等性保护 |
| `ENABLE_POLICY_AUDIT` | true | true | true | 策略审计 |
| `ENABLE_TIMELINE` | true | true | true | 时间线查询 |
| `ENABLE_MULTI_INSTANCE` | false | true | false | 多实例协调 |
| `ENABLE_ORPHAN_DETECTION` | false | false | false | 孤儿检测 |

## 安全开关

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `SAFE_MODE` | false | false | false | 安全模式 |
| `READ_ONLY_MODE` | false | false | false | 只读模式 |
| `EMERGENCY_STOP` | false | false | false | 紧急停止 |

## 降级配置

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `FALLBACK_ON_REDIS_DOWN` | allow | allow | reject | Redis 不可用时行为 |
| `FALLBACK_ON_LOCK_FAIL` | allow | retry | reject | 锁失败时行为 |
| `FALLBACK_ON_AUDIT_FAIL` | allow | allow | buffer | 审计失败时行为 |
| `LOCK_RETRY_COUNT` | 1 | 3 | 5 | 锁重试次数 |
| `LOCK_RETRY_DELAY_MS` | 50 | 100 | 200 | 锁重试间隔 |

## 外部服务

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `OKX_API_KEY` | (none) | `${OKX_API_KEY}` | `${OKX_API_KEY}` | OKX API Key |
| `OKX_API_SECRET` | (none) | `${OKX_API_SECRET}` | `${OKX_API_SECRET}` | OKX API Secret |
| `OKX_PASSPHRASE` | (none) | `${OKX_PASSPHRASE}` | `${OKX_PASSPHRASE}` | OKX 密码 |
| `OKX_NETWORK` | testnet | testnet | mainnet | OKX 网络 |
| `GITHUB_TOKEN` | (none) | `${GITHUB_TOKEN}` | `${GITHUB_TOKEN}` | GitHub Token |
| `WEBHOOK_SECRET` | test-secret | `${WEBHOOK_SECRET}` | `${WEBHOOK_SECRET}` | Webhook 密钥 |

## 日志与监控

| 变量名 | dev | staging | prod | 说明 |
|--------|-----|---------|------|------|
| `LOG_LEVEL` | debug | info | warn | 日志级别 |
| `LOG_FORMAT` | pretty | json | json | 日志格式 |
| `METRICS_ENABLED` | false | true | true | 指标导出 |
| `METRICS_PORT` | (none) | 9090 | 9090 | 指标端口 |
| `TRACING_ENABLED` | false | true | true | 链路追踪 |

---

## 环境变量加载顺序

```
1. 系统环境变量 (最高优先级)
2. .env.{NODE_ENV}.local (本地覆盖，不提交)
3. .env.{NODE_ENV} (环境配置)
4. .env.example (默认值，提交到 git)
```

---

## 验证脚本

```bash
#!/bin/bash
# 验证环境变量是否完整

set -e

REQUIRED_VARS=(
  NODE_ENV
  REDIS_HOST
  REDIS_PORT
  PERSISTENCE_PATH
  AUDIT_LOG_PATH
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  fi
done

echo "✅ All required variables are set"
```

---

_最后更新：2026-04-04 19:45_
