# V5.4 安全执行架构文档

**版本**: V5.4  
**状态**: ✅ 安全验证通过  
**最后更新**: 2026-03-26  

---

## 核心问题

V5.3 及之前版本存在**叠仓风险**：
- 并发信号 → 多笔开仓 → 风险指数级放大
- 止损"逻辑止损"而非"订单级止损" → 网络卡顿会失效
- 缺少执行原子化保证 → 状态竞争

V5.4 通过**三层防护**解决：
```
Execution Lock → Position Gate (双层) → Stop Loss (交易所托管)
```

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Signal Input                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              🔒 SafeExecutionV54 (协调器)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step 1: Execution Lock (asyncio.Lock)               │    │
│  │ - 同一时间只允许 1 个执行线程                         │    │
│  │ - 超时保护 (10s)                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step 2: Position Gate V54 (双层门控)                 │    │
│  │ - Layer 1: 本地状态 (StateStore._current_position)  │    │
│  │ - Layer 2: 交易所状态 (LiveExecutor.has_open_position)│  │
│  │ - 任一发现持仓 → 拒绝                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step 3: Order Executor (下单)                        │    │
│  │ - 调用 OKX API 开仓                                  │    │
│  │ - 返回 execution_price, filled_size, order_id       │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step 4: Stop Loss Manager (止损管理)                 │    │
│  │ - 基于真实成交价计算止损价                            │    │
│  │ - 提交止损单到交易所 (reduceOnly=True)              │    │
│  │ - 二次验证止损单存在                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step 5: StateStore 持久化                            │    │
│  │ - 记录 entry 事件                                    │    │
│  │ - 更新 _current_position                             │    │
│  │ - 文件锁保护并发写入                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ExecutionResult                           │
│  - accepted: bool                                           │
│  - reason: str (拒绝原因/成功)                              │
│  - order_result: Dict (execution_price, filled_size, ...)   │
│  - gate_snapshot: Dict (门控检查快照)                        │
│  - duration_ms: int                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心模块

### 1. SafeExecutionV54 (`core/safe_execution_v54.py`)

**职责**: 原子化执行协调器

**关键方法**:
```python
async def execute_entry(self, ctx: ExecutionContext) -> ExecutionResult:
    """
    受保护的开仓执行
    
    原子流程:
    1. 获取执行锁 (asyncio.Lock)
    2. 运行 Position Gate (双层检查)
    3. 调用 LiveExecutor 下单
    4. 持久化到 StateStore
    5. 释放执行锁
    """
```

**依赖注入**:
```python
safe_exec = SafeExecutionV54(
    position_gate=position_gate,      # PositionGateV54 实例
    order_executor=order_executor,    # async 函数 (ExecutionContext → Dict)
    state_store=state_store,          # StateStore 实例
    lock_timeout=10.0,                # 锁超时 (秒)
)
```

**失败语义**:
| 异常类型 | 触发条件 | 处理方式 |
|---------|---------|---------|
| `ExecutionLockTimeout` | 锁获取超时 (>10s) | 返回 rejected result, reason=`EXECUTION_LOCK_TIMEOUT` |
| `PositionGateRejected` | Gate 检查失败 | 返回 rejected result, reason=`POSITION_GATE_REJECTED: {reason}` |
| `RuntimeError` | 下单/持久化异常 | 抛出异常，由上层捕获处理 |

---

### 2. PositionGateV54 (`core/position_gate_v54.py`)

**职责**: 双层持仓门控，防叠仓第一道防线

**检查顺序**:
```
Layer 1: 本地状态 (StateStore._current_position)
    ↓ (通过)
Layer 2: 交易所状态 (LiveExecutor.has_open_position)
    ↓ (通过)
允许开仓
```

**关键方法**:
```python
async def check(self, symbol: str) -> GateResult:
    """
    执行双层门控检查
    
    Returns:
        GateResult (passed=True 才允许开仓)
    """
```

**GateResult 结构**:
```python
@dataclass
class GateResult:
    passed: bool           # 是否通过
    reason: str            # 拒绝原因 (如失败)
    local_check: bool      # 本地检查结果
    exchange_check: bool   # 交易所检查结果
    gate_snapshot: Dict    # 检查快照 (用于审计)
```

**拒绝场景**:
| 场景 | local_check | exchange_check | reason |
|------|-------------|----------------|--------|
| 本地有持仓 | ❌ | ✅ (跳过) | `POSITION_GATE_REJECTED: Local position exists` |
| 交易所有持仓 | ✅ | ❌ | `POSITION_GATE_REJECTED: Exchange position exists (size={size})` |
| 两者都无 | ✅ | ✅ | 通过 |

---

### 3. StopLossManager (`core/stop_loss_manager_v54.py`)

**职责**: 订单级止损管理（交易所托管）

**关键原则**:
- ❌ 不用"逻辑止损"(轮询触发) → 网络卡顿会失效
- ✅ 必须"订单级止损"(交易所托管) → 最安全

**关键方法**:
```python
async def place_stop_loss(
    self,
    symbol: str,
    entry_price: float,
    position_size: float,
    side: str
) -> Dict[str, Any]:
    """
    提交止损单到交易所
    
    关键参数:
    - stopPrice: entry_price * 0.995 (做多) / 1.005 (做空)
    - reduceOnly: True (防止反向开仓)
    - tdMode: cross/isolated (必须指定，否则静默失败)
    
    Returns:
        Dict with stop_ok, stop_verified, stop_order_id
    """
```

**二次验证**:
```python
# 提交后必须验证止损单真正存在
stop_orders = await self.exchange.fetch_open_orders(symbol)
stop_verified = any(
    o.get("type") == "stop" and o.get("stopPrice") == expected_stop_price
    for o in stop_orders
)
```

**OKX 止损订单完整参数**:
```python
{
    "symbol": "ETH/USDT:USDT",
    "type": "conditional",
    "side": "sell",
    "size": "0.13",
    "tdMode": "cross",
    "reduceOnly": True,
    "slTriggerPx": "2100.00",  # 止损触发价
    "slOrdPx": "-1",           # -1 = 市价止损
}
```

---

### 4. StateStore V54 (`core/state_store_v54.py`)

**职责**: 状态持久化 + 文件锁保护

**关键修复**:
| 问题 | V5.3 | V5.4 |
|------|------|------|
| 并发写入 | ❌ 可能损坏 | ✅ 文件锁保护 |
| 每次读取文件 | ❌ 慢 | ✅ 缓存 |
| event/trade 混用 | ❌ 混淆 | ✅ 区分 |

**数据结构**:
```json
{
  "total_events": 2,        // entry + exit
  "total_trades": 1,        // 仅 exit 算 trade
  "last_event": {...},      // 最近事件
  "last_trade": {...},      // 最近完整交易
  "_current_position": {...} // 当前持仓 (Position Gate 用)
}
```

**关键方法**:
```python
def record_event(self, event_type: str, data: dict):
    """
    记录事件 (带文件锁)
    
    event_type: "entry" | "exit"
    data: 事件数据 (必须包含 5 字段)
    """
```

**硬验收字段** (每笔 trade 必须包含):
- `entry_price` - 入场价
- `exit_price` - 出场价
- `pnl` - 盈亏
- `exit_source` - 退出原因 (STOP_LOSS/TAKE_PROFIT/TIME_EXIT/MANUAL)
- `position_size` - 仓位大小

缺任何一个 → 不合格

---

### 5. SafeExecutionAssembly (`core/safe_execution_assembly.py`)

**职责**: 模块装配 + 依赖注入

**关键函数**:
```python
def build_safe_execution_v54() -> SafeExecutionV54:
    """
    装配 V5.4 完整执行链
    
    依赖:
    - StateStoreV54
    - LiveExecutor (OKX API)
    - PositionGateV54
    - StopLossManagerV54
    
    Returns:
        SafeExecutionV54 实例
    """

def get_safe_execution_v54_cached() -> Optional[SafeExecutionV54]:
    """获取缓存的 V5.4 实例 (单例模式)"""
```

---

## 调用顺序

### 正常开仓流程

```
1. Signal 生成
   ↓
2. execution_engine._execute_signal() 调用
   ↓
3. signal_to_execution_context(signal) → ExecutionContext
   ↓
4. get_safe_execution_v54_cached() → SafeExecutionV54
   ↓
5. safe_exec.execute_entry(ctx)
   │
   ├─→ 5.1: Execution Lock 获取
   ├─→ 5.2: Position Gate 检查
   │      ├─→ Layer 1: StateStore._current_position
   │      └─→ Layer 2: LiveExecutor.has_open_position
   ├─→ 5.3: LiveExecutor.execute_signal() (下单)
   ├─→ 5.4: StopLossManager.place_stop_loss()
   │        └─→ 二次验证止损单存在
   └─→ 5.5: StateStore.record_event("entry", data)
   ↓
6. 返回 ExecutionResult
   │
   ├─→ accepted=True → 开仓成功
   └─→ accepted=False → 被拒绝 (reason 字段说明原因)
```

---

## 依赖注入图

```
execution_engine.py
    │
    ├─→ imports: safe_execution_assembly
    │            ├─→ get_safe_execution_v54_cached()
    │            └─→ signal_to_execution_context()
    │
    └─→ calls: safe_exec.execute_entry(ctx)
               │
               ├─→ depends: PositionGateV54
               │            ├─→ StateStoreV54
               │            └─→ LiveExecutor
               │
               ├─→ depends: order_executor (函数)
               │            └─→ LiveExecutor.execute_signal()
               │
               ├─→ depends: StopLossManagerV54
               │            └─→ OKX API (直接调用，绕过 ccxt)
               │
               └─→ depends: StateStoreV54
                            └─→ 文件系统 (带锁)
```

---

## 失败语义与恢复

### 各阶段失败处理

| 阶段 | 失败类型 | 行为 | 恢复 |
|------|---------|------|------|
| Lock | 超时 (>10s) | rejected, reason=`EXECUTION_LOCK_TIMEOUT` | 自动释放，可重试 |
| Gate | 本地有持仓 | rejected, reason=`POSITION_GATE_REJECTED` | 不平仓则不可重试 |
| Gate | 交易所有持仓 | rejected, reason=`POSITION_GATE_REJECTED` | 不平仓则不可重试 |
| Order | API 失败 | 抛出异常 | 需手动干预 |
| Stop | 止损提交失败 | `RuntimeError("STOP_LOSS_FAILED")` | **系统停止** (硬失败) |
| Stop | 二次验证失败 | `stop_verified=False` | 告警，建议手动检查 |
| Persist | 文件锁失败 | 抛出异常 | 需手动干预 |

### 关键原则

**无止损 = 系统停止**:
```python
if not stop_result.get("stop_ok"):
    raise RuntimeError("STOP_LOSS_FAILED - SYSTEM_STOP")
```

这是**不可恢复**的错误——没有止损的单子不允许存在。

---

## 与 V5.3 的差异

| 特性 | V5.3 | V5.4 |
|------|------|------|
| 执行锁 | ❌ 无 | ✅ asyncio.Lock |
| Position Gate | ❌ 仅本地检查 | ✅ 双层 (本地 + 交易所) |
| 止损类型 | ❌ 逻辑止损 (轮询) | ✅ 订单级止损 (交易所) |
| 止损验证 | ❌ 无 | ✅ 二次验证 |
| 状态持久化 | ❌ 无锁 | ✅ 文件锁 |
| 数据完整性 | ❌ 字段可能缺失 | ✅ 硬验收 5 字段 |
| 失败语义 | ❌ 模糊 | ✅ 显式、可审计 |

---

## 集成指南

### 在 `execution_engine.py` 中替换

**原代码** (V5.3):
```python
async def execute_async():
    return await self.executor.execute_signal(
        symbol=signal.symbol,
        signal_price=signal.signal_price,
        margin_usd=signal.margin_usd,
        signal_time=datetime.fromtimestamp(signal.timestamp)
    )
```

**新代码** (V5.4):
```python
from core.safe_execution_assembly import (
    get_safe_execution_v54_cached,
    signal_to_execution_context,
)

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
    
    # 封装返回格式
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
        print(f"⚠️ SafeExecutionV54 拒绝：{result.reason}")
        return None
```

---

## 验收标准

### Step 1: 装配验证
```bash
python -c "
from core.safe_execution_assembly import get_safe_execution_v54_cached
safe_exec = get_safe_execution_v54_cached()
print('✅ Step 4 装配成功' if safe_exec else '❌ Step 4 装配失败')
"
```

### Step 2: 并发测试
- 并发双请求 → 只能成功 1 笔
- 另一笔必须被 Position Gate 挡住
- 最终交易所持仓 = 0.13 ETH
- 下单调用次数 = 1 次

### Step 3: 高级场景测试
- ✅ STOP_LOSS 真实触发
- ✅ TIME_EXIT 路径
- ✅ 止损校验失败 → 硬失败
- ✅ 部分成交处理
- ✅ 异常恢复

---

## 文件清单

```
trading_system_v5_4/
├── core/
│   ├── safe_execution_v54.py       # 执行协调器 (原子化)
│   ├── position_gate_v54.py        # 双层门控
│   ├── safe_execution_assembly.py  # 模块装配
│   └── stop_loss_manager_v54.py    # 止损管理 (订单级)
├── run_safety_test.py              # 最小验收测试
├── test_integration.py             # 集成测试
├── test_integration_v2.py          # 集成测试 V2
├── test_sandbox.py                 # Sandbox 测试
├── test_sandbox_mock.py            # Mock 测试
├── test_sandbox_mock_advanced.py   # 高级异常场景
├── test_okx_connection.py          # OKX 连接测试
└── V5_4_ARCHITECTURE.md            # 本文档
```

---

_文档版本: 1.0 | 最后更新: 2026-03-26_
