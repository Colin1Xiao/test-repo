# StopLossManager 排查清单

**目标**: 找出为什么止损单没有提交到交易所

**排查顺序**: 从调用链顶层到底层

---

## Step 1: 检查 SafeExecutionV54 是否调用 _place_stop_loss

**文件**: `core/safe_execution_v54.py`

**检查点**:

```python
# 在 execute_entry() 方法中查找：
if self.stop_loss_manager and order_result:
    try:
        stop_loss_result = await self._place_stop_loss(ctx, execution_price, filled_size)
```

**验证方法**:

```python
# 在 _place_stop_loss 入口添加日志
logger.info(f"[DEBUG] _place_stop_loss 被调用：symbol={ctx.symbol}, price={execution_price}")
```

**预期结果**: 日志中应该看到 `_place_stop_loss 被调用`

**如果没看到**: 说明调用链在更上层就断了，检查：
- `self.stop_loss_manager` 是否为 None
- `order_result` 是否为空

---

## Step 2: 检查 _place_stop_loss 实现

**文件**: `core/safe_execution_v54.py`

**检查代码**:

```python
async def _place_stop_loss(self, ctx, execution_price, filled_size):
    if not self.stop_loss_manager:
        logger.warning("[V5.4] StopLossManager 未配置")
        return {"stop_ok": False, "stop_verified": False}
    
    result = await self.stop_loss_manager.place_stop_loss(
        symbol=ctx.symbol,
        entry_price=execution_price,
        position_size=filled_size,
        side=ctx.side,
    )
    
    return {
        "stop_ok": result.stop_ok,
        "stop_verified": result.stop_verified,
        "stop_order_id": result.stop_order_id,
        "stop_price": result.stop_price,
    }
```

**验证方法**: 添加日志确认 `place_stop_loss` 被调用

---

## Step 3: 检查 StopLossManager.place_stop_loss

**文件**: `core/stop_loss_manager_v54.py`

**检查点 1: 止损价计算**

```python
if side == "buy":  # 做多
    stop_price = entry_price * (1 - self.stop_loss_pct)  # 应该是 entry * 0.995
    stop_side = "sell"
else:  # 做空
    stop_price = entry_price * (1 + self.stop_loss_pct)  # 应该是 entry * 1.005
    stop_side = "buy"
```

**验证**: 如果 entry=$2079.85, stop_loss_pct=0.005, 则 stop_price 应该是 $2069.45

**检查点 2: OKX API 参数**

```python
order_params = {
    "symbol": symbol,                    # 应该是 "ETH/USDT:USDT"
    "type": "conditional",               # 条件单类型
    "side": stop_side,                   # "sell" (平多)
    "size": str(position_size),          # "0.14"
    "tdMode": "cross",                   # 全仓 (必须)
    "reduceOnly": True,                  # 防止反向开仓 (必须)
    "slTriggerPx": str(stop_price),      # 止损触发价
    "slOrdPx": "-1",                     # -1 = 市价止损
}
```

**常见错误**:
- ❌ `tdMode` 缺失 → OKX 静默失败
- ❌ `reduceOnly` 缺失 → 可能反向开仓
- ❌ `slOrdPx` 不是 "-1" → 限价止损可能不成交
- ❌ `symbol` 格式错误 → 应该是 ccxt 格式 "ETH/USDT:USDT"

**检查点 3: API 调用**

```python
order = await self.exchange.create_order(
    symbol=symbol,
    type="conditional",
    side=stop_side,
    amount=position_size,
    params=order_params,
)
```

**验证方法**: 在调用前后添加日志：
```python
logger.info(f"[DEBUG] 调用 create_order: {order_params}")
try:
    order = await self.exchange.create_order(...)
    logger.info(f"[DEBUG] create_order 返回：{order}")
except Exception as e:
    logger.error(f"[DEBUG] create_order 异常：{e}")
    raise  # 必须抛出异常
```

**检查点 4: 异常处理**

```python
except RuntimeError as e:
    # 🔴 硬失败：无止损 = 系统停止
    raise RuntimeError(f"STOP_LOSS_FAILED - SYSTEM_STOP: {error_msg}")
except Exception as e:
    # ⚠️ 其他异常，记录但继续
    stop_loss_result = {"stop_ok": False, "stop_verified": False, "error": str(e)}
```

**问题**: 这里可能吞掉了异常！应该检查：
- 是否捕获了异常但没有 raise
- 是否记录了错误日志

---

## Step 4: 检查 StopLossManager 装配

**文件**: `core/safe_execution_assembly.py`

**检查点**:

```python
# 是否创建了 StopLossManager 实例？
stop_loss_manager = build_stop_loss_manager_v54(
    exchange=live_executor.exchange,
    stop_loss_pct=STOP_LOSS_PCT,
)

# 是否传递给了 SafeExecutionV54？
safe_execution = build_safe_execution_v54(
    live_executor=live_executor,
    state_store=state_store,
    position_gate=position_gate,
    stop_loss_manager=stop_loss_manager,  # ← 这个参数是否存在？
    lock_timeout=10.0,
)
```

**验证方法**:

```python
# 在装配完成后添加检查
print(f"StopLossManager: {stop_loss_manager}")
print(f"SafeExecutionV54.stop_loss_manager: {safe_execution.stop_loss_manager}")
```

---

## Step 5: 检查 OKX API 响应

**可能情况**:

1. **API 返回成功，但订单未创建**
   - OKX 可能返回 `code: 0` 但实际订单未创建
   - 需要检查返回的 `ordId` 是否为空

2. **API 返回失败，但被忽略**
   - 检查 `order` 是否为 None
   - 检查 `order.get("id")` 是否存在

3. **条件单需要不同的 API**
   - OKX 可能有专门的条件单 API
   - 检查 ccxt 的 `create_order` 是否支持 conditional 类型

**验证方法**:

```python
# 打印完整响应
logger.info(f"[DEBUG] OKX 完整响应：{json.dumps(order, indent=2)}")

# 检查关键字段
if not order:
    logger.error("[DEBUG] order is None")
if not order.get("id"):
    logger.error(f"[DEBUG] order.id is missing: {order}")
if not order.get("info", {}).get("ordId"):
    logger.error(f"[DEBUG] order.info.ordId is missing: {order}")
```

---

## Step 6: 检查条件单查询

**问题**: 可能止损单创建了，但查询方式不对

**OKX 条件单查询**:
- 普通订单：`fetch_open_orders`
- 条件单：可能需要 `fetch_open_orders` + 特定参数，或用其他 API

**验证方法**:

```python
# 查询所有未完成订单 (包括条件单)
orders = await okx.fetch_open_orders('ETH/USDT:USDT')
print(f"普通订单：{len(orders)}")

# 尝试查询条件单
# (检查 ccxt 文档，可能需要特定参数)
```

---

## 快速诊断脚本

创建 `debug_stoploss.py`:

```python
#!/usr/bin/env python3
"""
StopLossManager 快速诊断脚本
"""
import asyncio
import os
import sys

sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

os.environ['OKX_API_KEY'] = '8705ea66-bb2a-4eb3-b58a-768346d83657'
os.environ['OKX_API_SECRET'] = '8D2DF7BEA6EA559FE5BD1F36E11C44B1'
os.environ['OKX_PASSPHRASE'] = 'Xzl405026.'

async def debug():
    from core.live_executor import LiveExecutor
    from core.stop_loss_manager_v54 import StopLossManagerV54
    
    # 初始化
    live_executor = LiveExecutor(
        api_key=os.environ['OKX_API_KEY'],
        api_secret=os.environ['OKX_API_SECRET'],
        passphrase=os.environ['OKX_PASSPHRASE'],
        testnet=False,
    )
    
    stop_loss_manager = StopLossManagerV54(
        exchange=live_executor.exchange,
        stop_loss_pct=0.005,
    )
    
    # 测试止损单提交
    print("测试止损单提交...")
    print(f"  Symbol: ETH/USDT:USDT")
    print(f"  Entry Price: 2079.85")
    print(f"  Position Size: 0.14")
    print(f"  Side: buy")
    print(f"  Expected Stop Price: {2079.85 * 0.995:.2f}")
    
    try:
        result = await stop_loss_manager.place_stop_loss(
            symbol='ETH/USDT:USDT',
            entry_price=2079.85,
            position_size=0.14,
            side='buy',
        )
        
        print(f"\n结果:")
        print(f"  stop_ok: {result.stop_ok}")
        print(f"  stop_verified: {result.stop_verified}")
        print(f"  stop_order_id: {result.stop_order_id}")
        print(f"  stop_price: {result.stop_price}")
        print(f"  reason: {result.reason}")
        
    except Exception as e:
        print(f"\n异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(debug())
```

---

## 检查顺序总结

| Step | 检查点 | 预期 |
|------|--------|------|
| 1 | SafeExecutionV54 调用 _place_stop_loss | 日志中有调用记录 |
| 2 | _place_stop_loss 调用 StopLossManager | 日志中有调用记录 |
| 3 | StopLossManager.place_stop_loss 参数 | 参数正确 |
| 4 | OKX API 调用 | 无异常，返回有效 order_id |
| 5 | StopLossManager 装配 | stop_loss_manager 不为 None |
| 6 | 条件单查询 | 能找到已创建的止损单 |

---

_排查清单版本: 1.0 | 创建时间: 2026-03-26_
