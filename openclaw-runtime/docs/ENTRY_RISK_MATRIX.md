# OpenClaw V3 入口风险分级

_定义所有 HTTP 入口的风险级别与协调要求。_

---

## 风险分级定义

| 级别 | 说明 | 协调要求 | 示例 |
|------|------|---------|------|
| **CRITICAL** | 高风险写入口 | 必须 Redis + 锁 + 幂等 | approval resolve, recovery claim |
| **HIGH** | 中等风险写入口 | 必须 Redis + 锁 | incident resolve, recovery scan |
| **MEDIUM** | 低风险写入口 | 建议 Redis + 幂等 | webhook ingest |
| **LOW** | 只读/查询入口 | 可选 Redis | timeline query, metrics |

---

## 高风险写入口（CRITICAL + HIGH）

### Approval 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/approvals/:id/resolve` | POST | CRITICAL | Redis + 锁 + 幂等 | 503 Coordination Unavailable |
| `POST /trading/approvals/:id/acknowledge` | POST | HIGH | Redis + 锁 | 503 Coordination Unavailable |

### Incident 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/incidents/:id/resolve` | POST | CRITICAL | Redis + 锁 + 幂等 + 状态验证 | 503 / 409 Invalid Transition |
| `POST /trading/incidents/:id/acknowledge` | POST | HIGH | Redis + 锁 + 状态验证 | 503 / 409 Invalid Transition |

### Recovery 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/recovery/session/start` | POST | HIGH | Redis + 排他 | 409 Session Exists |
| `POST /trading/recovery/session/:id/renew` | POST | MEDIUM | Redis + 所有权验证 | 403 Not Owner |
| `POST /trading/recovery/session/:id/complete` | POST | MEDIUM | Redis + 所有权验证 | 403 Not Owner |
| `POST /trading/recovery/items/:id/claim` | POST | CRITICAL | Redis + 原子 claim + 所有权 | 409 Already Claimed |
| `POST /trading/recovery/items/:id/complete` | POST | HIGH | Redis + 所有权验证 | 403 Not Owner |

### Replay 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/replay/run` | POST | HIGH | Redis + 锁 + 只读模式可选 | 503 / 423 Locked |
| `POST /trading/replay/plan` | POST | MEDIUM | 只读，可选 Redis | 200 (降级为 dry-run) |

### Webhook 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/webhook/:provider/ingest` | POST | MEDIUM | Redis + 幂等 | 409 Duplicate / 503 Unavailable |
| `POST /trading/webhook/:provider/replay` | POST | HIGH | Redis + 锁 | 423 Locked |

### State Transition 相关

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `POST /trading/state/transition` | POST | CRITICAL | Redis + 锁 + 状态验证 | 409 Invalid Transition |
| `POST /trading/deployments/:id/execute` | POST | CRITICAL | Redis + 锁 + 状态验证 | 503 / 409 |

---

## 只读/查询入口（LOW）

| 入口 | 方法 | 风险级 | 协调要求 | 失效行为 |
|------|------|--------|---------|---------|
| `GET /trading/approvals` | GET | LOW | 可选 Redis | 200 (可能 stale) |
| `GET /trading/incidents` | GET | LOW | 可选 Redis | 200 (可能 stale) |
| `GET /trading/recovery/sessions` | GET | LOW | 可选 Redis | 200 (可能 stale) |
| `GET /trading/recovery/items` | GET | LOW | 可选 Redis | 200 (可能 stale) |
| `GET /trading/timeline` | GET | LOW | 可选 Redis | 200 (可能 stale) |
| `GET /trading/metrics` | GET | LOW | 无 | 200 |
| `GET /health` | GET | LOW | 无 | 200 / 503 |

---

## 环境分级策略

| 环境 | CRITICAL | HIGH | MEDIUM | LOW |
|------|----------|------|--------|-----|
| **dev** | 允许降级（无锁） | 允许降级（无锁） | 允许降级 | 无限制 |
| **staging** | 必须锁 | 必须锁 | 建议锁 | 无限制 |
| **prod** | 必须锁 + 幂等 | 必须锁 | 必须幂等 | 无限制 |

---

## 失效行为定义

### HTTP 状态码语义

| 状态码 | 场景 | 响应体 |
|--------|------|--------|
| `503` | Redis 不可用（严格模式） | `{ error: "COORDINATION_UNAVAILABLE", message: "..." }` |
| `409` | 资源冲突（已存在/已 claim） | `{ error: "CONFLICT", message: "..." }` |
| `423` | 资源被锁 | `{ error: "LOCKED", message: "..." }` |
| `403` | 无所有权/无权限 | `{ error: "NOT_OWNER", message: "..." }` |
| `400` | 非法状态迁移 | `{ error: "INVALID_TRANSITION", allowed: [...] }` |
| `202` | 异步处理中 | `{ status: "IN_PROGRESS", id: "..." }` |

---

_最后更新：2026-04-04 19:40_
