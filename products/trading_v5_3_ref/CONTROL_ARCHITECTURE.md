# OpenClaw 全局系统控制图

## 🎯 系统分层架构

```
┌──────────────────────────────────────────────┐
│ 🧠 Strategy Layer (V12-V20)                  │
│    职责: 产生信号（score/direction）          │
│    状态: ⚠️ 简化版本（V4.3 scoring）          │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 🎯 Decision Hub (唯一决策源)                 │
│    统一决策: Guard → Risk → Audit → Control  │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ ⚙️ Trading Infrastructure (V5.3)             │
│    Execution + Risk + Audit + Control        │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 🌐 OpenClaw Gateway & Control Layer          │
│    API / Telegram / Memory / Routing         │
└────────────────┬─────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────┐
│ 🔌 Exchange (OKX / Market)                   │
└──────────────────────────────────────────────┘
```

## 🏗️ Layer 2: Trading Infrastructure (V5.3 核心)

### 决策链（唯一路径）

```
Signal → Integrity Guard → Risk Checks → Audit → Capital Controller → Decision
```

### 子模块职责

| 模块 | 文件 | 职责 | 输出 |
|------|------|------|------|
| **Decision Hub** | `decision_hub.py` | **唯一决策入口** | EXECUTE/SKIP/BLOCK/STOP |
| Integrity Guard | `system_integrity_guard.py` | 系统一致性验证 | can_trade() |
| Risk Layer | `live_executor.py` | 五层保护 | 跳过/执行 |
| Audit Layer | `profit_audit.py` | 收益真实性审计 | verdict |
| Capital Controller | `capital_controller.py` | 仓位决策 | position_multiplier |
| Kill Switch | `kill_switch.py` | 系统停止 | STOP |

### 关键规则

```
Integrity Guard: SKIPPED = BLOCK
Kill Switch:     触发 = STOP
Capital:         should_reduce → 仓位×0.5
```

## 🚨 结构风险控制

### ❌ 风险 1：多中心决策

**解决方案**：Decision Hub 作为唯一入口

```python
# ❌ 错误：分散决策
if guard.can_trade() and controller.can_trade():
    execute()

# ✅ 正确：统一决策
decision = hub.evaluate(signal)
if decision.can_trade:
    execute(decision)
```

### ❌ 风险 2：数据来源不一致

**解决方案**：Price Cache 作为唯一数据源

```
Price Cache → Execution
           → Audit
           → Dashboard
```

### ❌ 风险 3：外部误控

**解决方案**：外部命令只能改参数，不能直接执行交易

```
Telegram/API → 改参数 ✅
            → 执行交易 ❌
```

## 📊 系统状态定义

| 状态 | 含义 | 动作 |
|------|------|------|
| EXECUTE | 所有检查通过 | 正常交易 |
| SKIP | 信号不满足条件 | 跳过本次 |
| REDUCE | 部分检查警告 | 减半仓位 |
| BLOCK | 关键检查失败 | 禁止交易 |
| STOP | 系统不可信 | 立即停止 |

## 🎯 运行模式定义

### ✅ 当前允许

- RANGE 市场
- 低波动
- 止盈 0.2%
- 止损 -0.5%

### ❌ 当前禁止

- BREAKOUT 行情
- 高动量追单
- 新闻事件
- 秒级机会

## 🔧 启动前检查清单

### 🔴 P0（必须确认）

- [ ] Integrity Guard = ENABLED
- [ ] Timeout Control = ENABLED
- [ ] Kill Switch = ENABLED
- [ ] Decision Hub = ACTIVE
- [ ] Audit = Execution 一致

### 🟡 P1（建议确认）

- [ ] Dashboard 正常输出
- [ ] 延迟 P50 < 1100ms
- [ ] 无 SKIPPED 误判

## 📁 文件结构

```
core/
├── decision_hub.py           # 唯一决策源 ⭐
├── system_integrity_guard.py # 完整性守护
├── capital_controller.py     # 资金控制
├── profit_audit.py           # 收益审计
├── kill_switch.py            # 系统停止
├── live_ops_dashboard.py     # 运营监控
└── execution_engine.py       # 执行引擎
```

## 💡 一句话定义

> **OpenClaw = 控制层**
> **V5.3 = 执行基础设施**
> **Strategy = 信号来源（可替换）**

---

_版本: V5.3_
_更新: 2026-03-20_