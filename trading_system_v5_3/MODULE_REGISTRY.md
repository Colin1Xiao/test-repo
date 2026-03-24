# 模块职责注册表（Module Registry）

> 防止模块越权，明确职责边界

---

## 🎯 决策层（Decision Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `decision_hub.py` | **唯一决策源** | 授权/拒绝交易 |
| `execution_gate.py` | 执行门控 | 验证授权 |
| `system_integrity_guard.py` | 完整性验证 | BLOCK/STOP |
| `kill_switch.py` | 系统停止 | 立即停止 |

**规则**: 决策层可以拒绝，但**不直接执行**

---

## ⚙️ 执行层（Execution Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `live_executor.py` | 执行交易 | 接收 Decision |
| `execution_engine.py` | 异步执行引擎 | 队列管理 |
| `execution_profiler.py` | 延迟分析 | 只读分析 |
| `timeout_controller.py` | API超时保护 | 超时取消 |

**规则**: 执行层**必须接收授权 Decision**，不做决策

---

## 💰 资金层（Capital Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `capital_controller.py` | 仓位建议 | 返回 multiplier |
| `position_manager.py` | 持仓管理 | 状态更新 |
| `position_monitor.py` | 持仓监控 | 只读监控 |

**规则**: 资金层只返回**建议**，不直接执行

---

## 🧠 审计层（Audit Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `profit_audit.py` | 收益审计 | 评估 verdict |
| `slippage_decomposer.py` | 滑点分解 | 只读分析 |
| `sample_filter.py` | 样本过滤 | 过滤无效样本 |

**规则**: 审计层只评估，**不干预执行**

---

## 🛡️ 风控层（Risk Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `safety_controller.py` | 安全控制 | 熔断触发 |
| `strategy_guardian.py` | 策略守护 | 连续亏损检测 |

**规则**: 风控层可以熔断，但通过 Decision Hub 执行

---

## 📊 数据层（Data Layer）

| 模块 | 职责 | 权限 |
|------|------|------|
| `price_cache.py` | 价格缓存 | 数据提供 |
| `multi_symbol_analyzer.py` | 多币种分析 | 数据分析 |

**规则**: 数据层只提供数据，不做决策

---

## 🚫 禁止事项

### 跨层调用规则

```
❌ 执行层 → 决策层（禁止）
❌ 数据层 → 执行层（禁止）
❌ 审计层 → 执行层（禁止）

✅ 决策层 → 执行层（允许）
✅ 执行层 → 数据层（允许）
✅ 决策层 → 审计层（允许）
```

### 单一职责

- 每个模块**只能有一个核心职责**
- 禁止模块内部直接执行交易
- 所有执行必须经过 Decision Hub

---

## 📝 版本锁定

```python
# 在关键模块入口验证
assert SYSTEM_VERSION == "V5.3"
```

---

_版本: V5.3 | 更新: 2026-03-20_
