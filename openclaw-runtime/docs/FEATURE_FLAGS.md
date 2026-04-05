# OpenClaw V3 Feature Flags 规范

_定义 Feature Flags 的优先级、层次和决策逻辑。_

---

## Flag 优先级层次

**优先级从高到低**：

```
1. 环境策略 (ENV_POLICY)     — 最高，由 NODE_ENV 决定
2. 安全强制开关 (SAFE_MODE)   — 紧急情况下全局禁用
3. 功能开关 (FEATURE_TOGGLE)  — 按功能启停
4. 降级路径 (FALLBACK)       — 最低，降级行为控制
```

---

## 优先级决策树

```
请求进入
    ↓
[1] 检查环境策略 (NODE_ENV)
    ├─ prod → STRICT_COORDINATION_REQUIRED = true
    ├─ staging → COORDINATION_RECOMMENDED = true
    └─ dev → COORDINATION_OPTIONAL = true
    ↓
[2] 检查安全强制开关 (SAFE_MODE)
    ├─ SAFE_MODE = true → 禁用所有高风险入口
    └─ SAFE_MODE = false → 继续
    ↓
[3] 检查功能开关 (ENABLE_*)
    ├─ ENABLE_DISTRIBUTED_LOCK = false → 跳过锁
    ├─ ENABLE_IDEMPOTENCY = false → 跳过幂等
    └─ 全部 enabled → 继续
    ↓
[4] 应用降级路径 (FALLBACK_*)
    ├─ FALLBACK_ON_REDIS_DOWN = reject → 拒绝
    ├─ FALLBACK_ON_REDIS_DOWN = allow → 允许（记录审计）
    └─ FALLBACK_ON_REDIS_DOWN = queue → 入队
```

---

## Flag 完整列表

### 环境策略（最高优先级）

| Flag | 类型 | dev | staging | prod | 说明 |
|------|------|-----|---------|------|------|
| `STRICT_COORDINATION_REQUIRED` | boolean | false | false | true | 严格协调模式 |
| `ALLOW_LOCK_FALLBACK` | boolean | true | true | false | 允许锁降级 |
| `ALLOW_IDEMPOTENCY_FALLBACK` | boolean | true | false | false | 允许幂等降级 |

### 安全强制开关

| Flag | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `SAFE_MODE` | boolean | false | 安全模式（禁用所有高风险入口） |
| `READ_ONLY_MODE` | boolean | false | 只读模式（禁用所有写入口） |
| `EMERGENCY_STOP` | boolean | false | 紧急停止（禁用所有入口） |

### 功能开关

| Flag | 类型 | dev | staging | prod | 说明 |
|------|------|-----|---------|------|------|
| `ENABLE_REPLAY` | boolean | true | true | false | 重放功能 |
| `ENABLE_RECOVERY_SCAN` | boolean | true | true | true | 恢复扫描 |
| `ENABLE_DISTRIBUTED_LOCK` | boolean | false | true | true | 分布式锁 |
| `ENABLE_IDEMPOTENCY` | boolean | false | true | true | 幂等性保护 |
| `ENABLE_POLICY_AUDIT` | boolean | true | true | true | 策略审计 |
| `ENABLE_TIMELINE` | boolean | true | true | true | 时间线查询 |
| `ENABLE_MULTI_INSTANCE` | boolean | false | true | false | 多实例协调 |
| `ENABLE_ORPHAN_DETECTION` | boolean | false | false | false | 孤儿检测 |

### 降级路径

| Flag | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `FALLBACK_ON_REDIS_DOWN` | enum | reject | reject / allow / queue |
| `FALLBACK_ON_LOCK_FAIL` | enum | reject | reject / allow / retry |
| `FALLBACK_ON_AUDIT_FAIL` | enum | allow | allow / reject / buffer |
| `LOCK_RETRY_COUNT` | number | 3 | 锁失败重试次数 |
| `LOCK_RETRY_DELAY_MS` | number | 100 | 锁重试间隔 |

---

## 决策逻辑伪代码

```typescript
type CoordinationDecision = {
  requireRedis: boolean;
  requireLock: boolean;
  requireIdempotency: boolean;
  allowFallback: boolean;
  reason: string;
};

function decideCoordination(
  routeName: string,
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  env: string,
  flags: FeatureFlags
): CoordinationDecision {
  // 1. 环境策略
  const isProd = env === 'production';
  const isStaging = env === 'staging';
  
  if (isProd && riskLevel === 'CRITICAL') {
    return {
      requireRedis: true,
      requireLock: true,
      requireIdempotency: true,
      allowFallback: false,
      reason: 'PROD_CRITICAL_REQUIREMENT',
    };
  }
  
  // 2. 安全强制开关
  if (flags.SAFE_MODE || flags.READ_ONLY_MODE || flags.EMERGENCY_STOP) {
    return {
      requireRedis: false,
      requireLock: false,
      requireIdempotency: false,
      allowFallback: false,
      reason: 'SAFE_MODE_ACTIVE',
    };
  }
  
  // 3. 功能开关
  const useLock = flags.ENABLE_DISTRIBUTED_LOCK;
  const useIdempotency = flags.ENABLE_IDEMPOTENCY;
  
  // 4. 降级路径
  const allowFallback = !isProd || flags.ALLOW_LOCK_FALLBACK;
  
  return {
    requireRedis: isProd && useLock,
    requireLock: useLock,
    requireIdempotency: useIdempotency,
    allowFallback,
    reason: 'NORMAL_OPERATION',
  };
}
```

---

## 审计要求

**所有 Flag 决策必须记录审计日志**：

```json
{
  "event_type": "coordination_decision",
  "route": "approval.resolve",
  "risk_level": "CRITICAL",
  "environment": "production",
  "decision": {
    "require_redis": true,
    "require_lock": true,
    "allow_fallback": false,
    "reason": "PROD_CRITICAL_REQUIREMENT"
  },
  "flags": {
    "ENABLE_DISTRIBUTED_LOCK": true,
    "ENABLE_IDEMPOTENCY": true,
    "SAFE_MODE": false
  },
  "timestamp": "2026-04-04T19:45:00Z"
}
```

---

## 配置方式

**环境变量映射**：

```bash
# 环境策略
NODE_ENV=production
STRICT_COORDINATION_REQUIRED=true

# 安全强制开关
SAFE_MODE=false
READ_ONLY_MODE=false

# 功能开关
ENABLE_DISTRIBUTED_LOCK=true
ENABLE_IDEMPOTENCY=true
ENABLE_REPLAY=false

# 降级路径
FALLBACK_ON_REDIS_DOWN=reject
LOCK_RETRY_COUNT=3
```

---

_最后更新：2026-04-04 19:40_
