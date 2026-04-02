# [P0] Capital Read Path Missing - 修复任务清单

**问题定性**: Mainnet execute path missing real balance fetch; capital checks rely on StateStore/placeholder values

**严重级别**: P0/P1 (影响真实下单、风控判断、主网验证)

## 🚨 核心问题

1. `get_account_equity_usdt()` 没有真实读取交易所余额 (`exchange.fetch_balance()`)
2. 最终退回到 `StateStore` 中的 `equity_usdt: 0.0`
3. `PRE_TRADE_CHECK` 使用硬编码占位值 `available_balance = 1.55`
4. 系统存在三套不可信资金口径：
   - `StateStore`: 0.0 (空)
   - `PRE_TRADE_CHECK`: 1.55 (硬编码占位)
   - `真实交易所余额`: 未知 (未读取)

## ✅ 已确认成立

- ✅ 主网连接成立
- ✅ 实盘模式成立
- ✅ 信号链正常工作
- ✅ 执行触发真实发生
- ✅ 风控拦截成立

## ❌ 尚未成立

- ❌ 真实资金读取
- ❌ 真实余额可用性判断
- ❌ 真实下单前资本校验

---

## 🔧 修复任务清单

### Task 1: 实现 `get_account_equity_usdt()` 真实余额读取

**位置**: `run_v52_live.py:396`

**修改前**:
```python
def get_account_equity_usdt(self) -> float:
    """获取账户权益（统一接口）"""
    # 优先从 state_store 读取最新 equity
    # ... 多个回退逻辑，最终返回 0.0
```

**修改后**:
```python
async def get_account_equity_usdt(self) -> float:
    """获取账户权益（统一接口）- 优先从交易所读取"""
    # 1. 从 executor.exchange.fetch_balance() 读取真实余额
    if hasattr(self, "executor") and self.executor:
        try:
            balance = await self.executor.exchange.fetch_balance()
            usdt_free = balance.get('USDT', {}).get('free', 0.0)
            usdt_total = balance.get('USDT', {}).get('total', 0.0)
            
            if usdt_free > 0 or usdt_total > 0:
                equity = max(usdt_free, usdt_total)
                # 更新 runtime capital snapshot
                self._update_capital_snapshot(equity)
                print(f"[CAPITAL_FETCH] source=exchange success=True equity_usdt={equity:.2f}")
                return float(equity)
        except Exception as e:
            print(f"[CAPITAL_FETCH] source=exchange success=False error={e}")
            # 不静默回落到 0.0
    
    # 2. 回退到 previous logic (保留用于审计)
    # ... existing code ...
    
    # 3. 明确报错，不返回 0.0
    raise RuntimeError("CAPITAL_SOURCE_UNAVAILABLE: 无法从交易所获取真实余额")
```

**验收点**:
- [ ] 调用 `exchange.fetch_balance()`
- [ ] 返回真实 `USDT.free` 余额
- [ ] 记录 `[CAPITAL_FETCH]` 日志
- [ ] 失败时明确报错，不返回 0.0

---

### Task 2: 实现 `_update_capital_snapshot()` 私有方法

**位置**: `run_v52_live.py` 中 `get_account_equity_usdt()` 附近

**功能**: 更新 runtime capital snapshot

```python
def _update_capital_snapshot(self, equity_usdt: float, margin_usdt: float = 0.0):
    """更新 runtime capital snapshot (内存快照)"""
    self.account_equity_usdt = equity_usdt
    self.account_margin_usdt = margin_usdt
    self.last_capital_fetch_time = time.time()
```

**验证点**:
- [ ] 更新 `self.account_equity_usdt`
- [ ] 更新 `self.account_margin_usdt`
- [ ] 记录 `last_capital_fetch_time`

---

### Task 3: 修复 `PRE_TRADE_CHECK` 硬编码

**位置**: `run_v52_live.py` 中 `[PRE_TRADE_CHECK]` 附近

**修改前**:
```python
# 📝 [PRE_TRADE_CHECK] 下单前约束检查
available_balance = 1.55  # TODO: 从交易所实时读取
requested_notional = 3.0 * 100  # 3 USD * 100x
min_order_size = 0.01  # ETH 最小下单量
print(f"[PRE_TRADE_CHECK] available_balance={available_balance}USDT requested_notional={requested_notional}USDT min_order_size={min_order_size}ETH")
```

**修改后**:
```python
# 📝 [PRE_TRADE_CHECK] 下单前约束检查
available_balance = await self.get_account_equity_usdt()  # 从真实读取
requested_notional = 3.0 * 100  # 3 USD * 100x
min_order_size = 0.01  # ETH 最小下单量
print(f"[PRE_TRADE_CHECK] available_balance={available_balance:.2f}USDT balance_source=exchange_runtime requested_notional={requested_notional}USDT min_order_size={min_order_size}ETH")
```

**验收点**:
- [ ] 移除硬编码 `available_balance = 1.55`
- [ ] 改为 `await self.get_account_equity_usdt()`
- [ ] 日志中包含 `balance_source=exchange_runtime`

---

### Task 4: 更新 StateStore 文档注释

**位置**: `run_v52_live.py:430`

**修改前**:
```python
# 🐉 Phase 1 主网灰度：使用专用干净 StateStore
state_file = Path(__file__).parent / "logs" / "state_store_mainnet_v541_phase1.json"
```

**修改后**:
```python
# 🐉 Phase 1 主网灰度：StateStore 仅作审计快照，不用于真实交易判断
state_file = Path(__file__).parent / "logs" / "state_store_mainnet_v541_phase1.json"
```

---

### Task 5: 统一失败日志格式

**位置**: `run_v52_live.py:1052` 附近

**修改前**:
```python
if not capital_decision.can_trade:
    print(f"⛔ Capital blocked trade: {capital_decision.reason}")
    return None
```

**修改后**:
```python
if not capital_decision.can_trade:
    print(f"[CAPITAL_BLOCK] reason={capital_decision.reason} equity={equity_usdt:.2f}")
    return None
```

---

## 📋 修复后验收标准

### 功能验收
- [ ] `get_account_equity_usdt()` 能成功从交易所读取余额
- [ ] 返回值是真实 `USDT.free` 余额
- [ ] 日志包含 `[CAPITAL_FETCH] source=exchange success=True`
- [ ] `PRE_TRADE_CHECK` 使用真实余额
- [ ] 不再出现 `EQUITY_NON_POSITIVE` (除非余额是真的 0)
- [ ] 出现余额获取失败时，日志包含 `CAPITAL_SOURCE_UNAVAILABLE`

### 代码验收
- [ ] 移除所有硬编码金额占位符
- [ ] 所有资金检查统一使用 `get_account_equity_usdt()`
- [ ] StateStore 文档注释已更新
- [ ] 失败日志格式统一

### 端到端验收
1. 启动系统，观察日志:
   ```
   [CAPITAL_FETCH] source=exchange success=True equity_usdt=1.55
   ```
2. 等待下一个合格信号:
   ```
   [CAPITAL_FETCH] source=exchange success=True equity_usdt=1.55
   [PRE_TRADE_CHECK] available_balance=1.55 balance_source=exchange_runtime ...
   ```
3. 如果资金检查通过:
   ```
   💰 Capital | equity=1.55 margin=... notional=... state=NORMAL
   ```

---

## 🚦 修复后操作流程

1. **修复代码**
2. **重启系统** (保持参数不变)
3. **验证余额读取** (启动日志)
4. **观察下一次合格信号**:
   - 应该看到 `[CAPITAL_FETCH]` 日志
   - 应该看到 `[PRE_TRADE_CHECK]` 使用真实余额
   - 如果通过资金检查，应该看到 `[ORDER_RESULT]`
5. **记录结果**:
   - 如果成交 → 完整复审
   - 如果失败 → 明确失败原因

---

## 📊 修复前后对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 资金来源 | StateStore (0.0) |交易所 API |
| PRE_TRADE_CHECK | 硬编码 1.55 | 真实余额 |
| 失败原因 | EQUITY_NON_POSITIVE | BALANCE_FETCH_UNAVAILABLE (如适用) |
| 日志 | 无明确资金来源标记 | [CAPITAL_FETCH] [PRE_TRADE_CHECK] |
| 资金真值源 | ❌ StateStore | ✅ 交易所 |

---

**当前状态**: 🔴 资金读取功能缺失  
**修复优先级**: P0  
**预计影响**: 实现后可看到真正的交易所下单结果