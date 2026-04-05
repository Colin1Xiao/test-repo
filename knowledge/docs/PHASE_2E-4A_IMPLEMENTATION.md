# Phase 2E-4A: Duplicate Safety - 实施文档

**状态**: 🟡 **进行中**  
**时间**: 2026-04-04 10:25 (Asia/Shanghai)

---

## 📋 实施目标

**目标**: 消除重复执行，提供幂等性和分布式锁保护

**范围**:
- ✅ Idempotency Manager
- ✅ Distributed Lock
- 🟡 HTTP 中间件集成
- 🟡 关键端点接入
- 🟡 审计日志

---

## 🏗️ 架构设计

```
HTTP Request
    ↓
Idempotency Middleware
    ├── Idempotency Check (Redis)
    └── Distributed Lock (Redis)
    ↓
Handler
    ↓
Idempotency Complete/Fail
```

---

## 📦 已交付文件

| 文件 | 职责 | 行数 | 状态 |
|------|------|------|------|
| `redis_client.ts` | Redis 客户端封装 | ~130 | ✅ 完成 |
| `idempotency_manager.ts` | 幂等性管理器 | ~250 | ✅ 完成 |
| `distributed_lock.ts` | 分布式锁 | ~220 | ✅ 完成 |
| `idempotency_middleware.ts` | HTTP 中间件 | ~260 | ✅ 完成 |

**总代码**: ~860 行

---

## 🔧 配置要求

### Redis 配置

```typescript
{
  host: 'localhost',
  port: 6379,
  password?: string,
  db?: 0,
  keyPrefix: 'openclaw:',
}
```

### 环境变量

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=openclaw:
```

---

## 📋 幂等键设计

### Webhook

```
idemp:webhook:{provider}:{eventId}
```

**示例**:
- `idemp:webhook:github:12345`
- `idemp:webhook:circleci:67890`

---

### Approval 决策

```
idemp:approval:{approvalId}:{decision}
```

**示例**:
- `idemp:approval:approval_001:approved`
- `idemp:approval:approval_001:rejected`

---

### Incident 动作

```
idemp:incident:{incidentId}:{action}
```

**示例**:
- `idemp:incident:incident_001:acknowledge`
- `idemp:incident:incident_001:resolve`

---

### Replay

```
idemp:replay:{targetType}:{targetId}:{requestHash}
```

**示例**:
- `idemp:replay:incident:incident_001:abc123`

---

### Recovery

```
idemp:recovery:{scope}:{requestHash}
```

**示例**:
- `idemp:recovery:scan:abc123`

---

## 🔐 锁键设计

### Approval

```
lock:approval:{approvalId}
```

### Incident

```
lock:incident:{incidentId}
```

### Replay

```
lock:replay:{jobId}
```

### Recovery

```
lock:recovery:{sessionId}
```

### Webhook

```
lock:webhook:{provider}:{eventId}
```

---

## 🎯 关键端点接入计划

### 第一批（P0）

| 端点 | 幂等键 | 锁键 | 状态 |
|------|--------|------|------|
| `POST /trading/incidents/:id/acknowledge` | ✅ | ✅ | 🟡 待接入 |
| `POST /trading/incidents/:id/resolve` | ✅ | ✅ | 🟡 待接入 |
| `POST /trading/approvals/:id/resolve` | ✅ | ✅ | 🟡 待接入 |
| `POST /trading/replay/run` | ✅ | ✅ | 🟡 待接入 |
| `POST /trading/recovery/scan` | ✅ | ✅ | 🟡 待接入 |
| `POST /trading/webhooks/*` | ✅ | ✅ | 🟡 待接入 |

---

## 📊 审计日志事件

| 事件类型 | 说明 |
|----------|------|
| `idempotency_hit` | 幂等命中，返回已有结果 |
| `idempotency_created` | 创建新的幂等记录 |
| `lock_acquired` | 成功获取锁 |
| `lock_acquire_failed` | 获取锁失败 |
| `lock_released` | 释放锁 |
| `lock_expired` | 锁过期 |

---

## ✅ 验收标准

### 幂等性

- [ ] 同一幂等键重复提交，返回相同结果
- [ ] in_progress 状态防止并发处理
- [ ] completed/failed 状态返回已有结果

### 锁

- [ ] 并发两个实例处理同一资源，只有一个成功
- [ ] Lease 到期后可被其他实例接管
- [ ] Owner 不匹配不能 release/renew

### 审计

- [ ] 能看到 idempotency 命中
- [ ] 能看到 lock acquire/release/fail
- [ ] 能看到 recovery claim/complete

---

## 🚀 下一步

### 立即执行

1. ✅ Redis 客户端实现
2. ✅ Idempotency Manager 实现
3. ✅ Distributed Lock 实现
4. ✅ HTTP 中间件实现
5. 🟡 集成到 Trading HTTP Server
6. 🟡 测试验证

### 本周内

1. 接入第一批关键端点
2. 审计日志集成
3. 多实例测试

### 下周内

1. Phase 2E-4B: Ownership & Ordering
2. Performance benchmark
3. Phase 2E 最终报告

---

## 📋 使用示例

### 创建 Redis 客户端

```typescript
import { createRedisClient, getDefaultRedisConfig } from './infrastructure/redis/redis_client';

const redis = createRedisClient(getDefaultRedisConfig());
await redis.ping(); // 检查连接
```

### 创建 Idempotency Manager

```typescript
import { createIdempotencyManager, createIdempotencyKeyGenerator } from './infrastructure/idempotency/idempotency_manager';

const keyGenerator = createIdempotencyKeyGenerator('openclaw');
const idempotency = createIdempotencyManager(redis);

// 开始幂等检查
const key = keyGenerator.incident('incident_001', 'acknowledge');
const result = await idempotency.begin(key, requestHash);

if (!result.accepted) {
  // 返回已有结果
  return result.existing.response;
}

// 处理请求...

// 完成
await idempotency.complete(key, { response: result });
```

### 创建 Distributed Lock

```typescript
import { createDistributedLock, createLockKeyGenerator } from './infrastructure/lock/distributed_lock';

const lockGenerator = createLockKeyGenerator('openclaw');
const lock = createDistributedLock(redis);

// 获取锁
const lockKey = lockGenerator.incident('incident_001');
const result = await lock.tryAcquire(lockKey, ownerId);

if (result.acquired) {
  try {
    // 处理资源...
  } finally {
    await lock.release(lockKey, ownerId);
  }
} else {
  // 锁已被其他实例持有
  console.log('Lock held by:', result.ownerId);
}
```

### 使用 HTTP 中间件

```typescript
import { createIdempotencyMiddleware, withIdempotency } from './infrastructure/idempotency/idempotency_middleware';

const middleware = createIdempotencyMiddleware({
  keyGenerator: createIdempotencyKeyGenerator('openclaw'),
  lockGenerator: createLockKeyGenerator('openclaw'),
  idempotencyManager: idempotency,
  lock: lock,
  lockTtlMs: 30000,
});

// 包装 Handler
const handler = withIdempotency(
  async (req, res) => {
    // 实际处理逻辑
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  },
  middleware,
  'incident',
  (req) => req.url?.split('/')[3] || 'unknown'
);
```

---

**记录时间**: 2026-04-04 10:25  
**完成度**: 70% (核心实现完成，待集成)

---

_从「无保护」到「幂等 + 锁」_
