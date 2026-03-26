#!/usr/bin/env python3
"""
V5.4 Integration - execution_engine.py 修改指南

你当前的 execute_signal() 在 `core/execution_engine.py` 的 `_execute_signal()` 方法中。

需要替换的关键代码：

## 原代码 (约第 167-175 行)
```python
async def execute_async():
    return await self.executor.execute_signal(
        symbol=signal.symbol,
        signal_price=signal.signal_price,
        margin_usd=signal.margin_usd,
        signal_time=datetime.fromtimestamp(signal.timestamp)
    )
```

## 新代码（Step 4 替换版）
```python
# 导入 V5.4 模块（在文件顶部添加）
from core.safe_execution_assembly import (
    get_safe_execution_v54_cached,
    signal_to_execution_context,
)

# 在 _execute_signal() 中替换 execute_async()
async def execute_async():
    # Step 1: Signal → ExecutionContext 映射
    ctx = signal_to_execution_context(signal)
    if ctx is None:
        print(f"❌ Signal 转 ExecutionContext 失败")
        return None
    
    # Step 2: 调用 SafeExecutionV54 (包含 Lock + Gate + Stop)
    safe_exec = get_safe_execution_v54_cached()
    if safe_exec is None:
        print(f"❌ SafeExecutionV54 未装配")
        return None
    
    # Step 3: 执行并返回结果
    result = await safe_exec.execute_entry(ctx)
    
    # 简单封装符合旧接口的返回格式
    if result.accepted:
        return {
            "ok": True,
            "execution_price": result.order_result.get("execution_price", 0),
            "filled_size": result.order_result.get("filled_size", 0),
            "order_id": result.order_result.get("order_id", ""),
            "stop_ok": result.gate_snapshot.get("stop_ok", False),
            "stop_verified": result.gate_snapshot.get("stop_verified", False),
        }
    else:
        print(f"⚠️ SafeExecutionV54 拒绝: {result.reason}")
        return None
```

## 完整修改清单

### 1. 文件顶部添加导入
```python
from core.safe_execution_assembly import (
    get_safe_execution_v54_cached,
    signal_to_execution_context,
)
```

### 2. 替换 execute_async() 函数
参考上方"新代码"部分替换原 `_execute_signal()` 中的 `execute_async()`。

### 3. 确认状态变量（可选）
检查 `self.executor.has_open_position(signal.symbol)` 是否还需要（V5.4 的 Position Gate 已处理）。

如果确认 V5.4 Gate 已覆盖此逻辑，可以移除这一行：
```python
# if self.executor.has_open_position(signal.symbol):
#     print(f"⚠️ 已有持仓，跳过: {signal.symbol}")
#     self.stats['signals_skipped_position'] += 1
#     return
```

## 验收标准

替换后运行：
```bash
cd ~/.openclaw/workspace/trading_system_v5_3
python -c "
from core.safe_execution_assembly import get_safe_execution_v54_cached
safe_exec = get_safe_execution_v54_cached()
print('✅ Step 4 装配成功' if safe_exec else '❌ Step 4 装配失败')
"
```

结果：
```
✅ Step 4 装配成功
```

---

**完成后，继续 Step 5：Sandbox Safety Test**
- 第 1 笔：正常开仓，确认止损单上交易所
- 第 2 笔：并发或重复信号，确认被 Gate 挡住
- 第 3 笔：TIME_EXIT / 主动平仓，确认 `exit_source` 写对
