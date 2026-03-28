# [P0] Capital Read Path Missing - 最小修复执行单

**最终定性**: Cost of missing real balance fetch base capability  
**不是**: Capital Sync Gap (数据没跟上)  
**而是**: Capital Read Path Missing (基础能力缺失)

---

## 🚨 核心问题

1. `get_account_equity_usdt()` **没有从交易所读余额**
2. `PRE_TRADE_CHECK` 使用硬编码占位值 `1.55`
3. `StateStore` 中只有初始化的 `0.0`
4. 执行器**没有可信资本真值源**

---

## ✅ 已修复（验证完成）

| 项目 | 状态 | 说明 |
|------|------|------|
| `get_account_equity_usdt()` | ✅ | 已改为 async，从交易所读取 |
| `_update_capital_snapshot()` | ✅ | 已实现 |
| `PRE_TRADE_CHECK` 硬编码 | ✅ | 已移除 |
| 状态日志格式 | ✅ | `[CAPITAL_FETCH]` / `[CAPITAL_SNAPSHOT]` |

---

## 🔧 最小修复执行单（按优先级）

### Step 1: 实现统一入口 `fetch_capital_snapshot_from_exchange()`

**目的**: 一次读取，处处复用

```python
async def fetch_capital_snapshot_from_exchange(self) -> Dict[str, Any]:
    """
    从交易所读取真实资金快照（唯一真值源）
    
    返回结构:
    {
        "equity_usdt": float,          # 权益（自由保证金 + 已用保证金）
        "available_usdt": float,       # 可用余额
        "used_margin_usdt": float,     # 已用保证金
        "notional_usdt": float,        # 持仓价值
        "source": "exchange",
        "fetched_at": datetime,
        "is_valid": bool
    }
    """
```

**验收**: 日志看到 `[CAPITAL_FETCH]` 且有实际数值

---

### Step 2: 移除 `PRE_TRADE_CHECK` 硬编码

**位置**: `run_v52_live.py:665` 和 `run_v52_live.py:1045`

**修改前**:
```python
available_balance = 1.55  # TODO: 从交易所实时读取
```

**修改后**:
```python
capital_snapshot = await self.fetch_capital_snapshot_from_exchange()
available_balance = capital_snapshot['available_usdt']
```

**验收**: 两处 `PRE_TRADE_CHECK` 都打印真实余额

---

### Step 3: 验证 `StateStore` 角色

**必须保证**: `StateStore` 只做审计快照，不用于交易放行

**失败处理**: 
- 如果交易所读取失败，StateStore **保留最近一次成功快照**
- 更新 `capital_state = FETCH_FAILED`
- 不覆盖回 0.0

---

### Step 4: 统一资金对象

**确保**: PRE_TRADE_CHECK / executor capital check / StateStore 使用同一份 snapshot

```python
# 一次读取
capital_snapshot = await self.fetch_capital_snapshot_from_exchange()

# 处处复用
[PRE_TRADE_CHECK] 使用 capital_snapshot['available_usdt']
executor 使用 capital_snapshot['equity_usdt']
StateStore 记录 capital_snapshot
```

---

### Step 5: 补日志和错误码

**必须出现**:
```
[CAPITAL_FETCH] source=exchange success=True equity_usdt=...
[CAPITAL_FETCH] source=exchange success=False error=...
[CAPITAL_SNAPSHOT] equity=... available=... used_margin=... source=exchange_runtime
[CAPITAL_BLOCK] reason=BALANCE_FETCH_UNAVAILABLE
```

---

## 📋 验收标准（分层）

### Layer 1: 资金读取成立
- [ ] 日志中能看到从交易所成功读取
- [ ] 不是硬编码
- [ ] 不是 StateStore 回读

### Layer 2: 资金口径统一
- [ ] PRE_TRADE_CHECK 和 executor 使用同一份数据
- [ ] StateStore 记录的是同一份快照
- [ ] 字段语义清晰（equity vs available）

### Layer 3: 进入真实订单结果
- [ ] `[ORDER_RESULT]` 不再是 `[ORDER_RESULT] accepted=False reason=shadow_mode`
- [ ] 而是交易所真正的拒绝/成交

---

## 🚀 现在立刻要做的

1. **实现** `fetch_capital_snapshot_from_exchange()` 统一入口
2. **修改** `PRE_TRADE_CHECK` 使用真实余额
3. **验证** `StateStore` 不覆盖回 0.0
4. **重启** 系统验证日志

---

**最终验收**: 看到 `[CAPITAL_FETCH] source=exchange success=True equity_usdt=1.55` 这条日志

这将是我们修复完成的真正信号。