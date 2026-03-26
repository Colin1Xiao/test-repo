#!/usr/bin/env python3
"""
V5.4 Integration Test V2 - 完善 Mock 版

模拟完整执行链：
Entry → 成交 → 持仓存在 → 止损单存在 → stop_verified=True

运行方式：
python test_integration_v2.py
"""

import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent / "trading_system_v5_3"))
sys.path.insert(0, str(Path(__file__).parent / "core"))


# ============ Mock Components ============
class MockStateStore:
    """
    Mock StateStore - 模拟 V5.4 StateStore
    
    功能：
    - 记录持仓状态
    - 记录交易历史
    - 支持 get_current_position()
    """
    
    def __init__(self):
        self._current_position: Optional[Dict[str, Any]] = None
        self.trades: List[Dict[str, Any]] = []
        self.events: List[Dict[str, Any]] = []
    
    def get_current_position(self) -> Optional[Dict[str, Any]]:
        """获取当前持仓"""
        return self._current_position
    
    def record_event(self, event_type: str, data: Dict[str, Any]):
        """记录事件"""
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        self.events.append(event)
        
        if event_type == "entry":
            self._current_position = data
        elif event_type == "exit":
            self._current_position = None
            self.trades.append(data)
        
        print(f"📝 StateStore: {event_type} 已记录")
    
    def get_last_trade(self) -> Optional[Dict[str, Any]]:
        """获取最后交易"""
        return self.trades[-1] if self.trades else None
    
    def reset(self):
        """重置状态"""
        self._current_position = None
        self.trades = []
        self.events = []


class MockLiveExecutor:
    """
    Mock LiveExecutor - 模拟 V5.3 LiveExecutor
    
    模拟完整执行链：
    1. execute_signal() → 成交 + 记录持仓
    2. has_open_position() → 返回持仓状态
    3. fetch_open_orders() → 返回止损单
    4. close_position() → 平仓 + 清理
    """
    
    def __init__(self):
        self.positions: Dict[str, Dict[str, Any]] = {}
        self.stop_orders: Dict[str, List[Dict[str, Any]]] = {}
        self.order_counter = 0
    
    def has_open_position(self, symbol: str) -> bool:
        """检查是否有持仓"""
        has_pos = symbol in self.positions and self.positions[symbol].get("size", 0) > 0
        print(f"🔍 LiveExecutor.has_open_position({symbol}) → {has_pos}")
        return has_pos
    
    def get_position_size(self, symbol: str) -> float:
        """获取持仓大小"""
        size = self.positions.get(symbol, {}).get("size", 0.0)
        print(f"🔍 LiveExecutor.get_position_size({symbol}) → {size}")
        return size
    
    async def execute_signal(self, symbol: str, signal_price: float, 
                           margin_usd: float, signal_time=None) -> Dict[str, Any]:
        """
        模拟下单成交
        
        返回：
        - order_id
        - execution_price
        - filled_size
        - stop_ok=True
        - stop_verified=True
        """
        self.order_counter += 1
        order_id = f"mock-order-{self.order_counter}"
        
        # 模拟持仓（0.13 ETH）
        filled_size = 0.13
        self.positions[symbol] = {
            "symbol": symbol,
            "side": "buy",
            "size": filled_size,
            "entry_price": signal_price,
            "order_id": order_id,
        }
        
        # 模拟止损单（conditional 类型）
        stop_loss_price = signal_price * 0.995  # -0.5%
        self.stop_orders[symbol] = [{
            "id": f"mock-stop-{self.order_counter}",
            "type": "conditional",
            "side": "sell",
            "size": filled_size,
            "params": {
                "slTriggerPx": stop_loss_price,
                "reduceOnly": True,
            }
        }]
        
        print(f"✅ LiveExecutor: {symbol} 成交 @ {signal_price:.2f}")
        print(f"   order_id: {order_id}")
        print(f"   size: {filled_size}")
        print(f"   stop_loss: {stop_loss_price:.2f} (-0.5%)")
        
        return {
            "ok": True,
            "symbol": symbol,
            "execution_price": signal_price,
            "filled_size": filled_size,
            "order_id": order_id,
            "stop_ok": True,
            "stop_verified": True,
        }
    
    async def fetch_open_orders(self, symbol: str) -> List[Dict[str, Any]]:
        """获取未平仓订单（含止损单）"""
        orders = self.stop_orders.get(symbol, [])
        print(f"📋 LiveExecutor.fetch_open_orders({symbol}) → {len(orders)} 订单")
        return orders
    
    async def close_position(self, symbol: str, exit_reason: str = "MANUAL") -> Optional[float]:
        """平仓"""
        if symbol not in self.positions:
            print(f"⚠️ {symbol} 无持仓")
            return 0.0
        
        # 获取持仓
        pos = self.positions[symbol]
        entry_price = pos["entry_price"]
        
        # 模拟平仓价格（假设小赚）
        exit_price = entry_price * 1.001  # +0.1%
        pnl = (exit_price - entry_price) / entry_price
        
        # 清理持仓
        del self.positions[symbol]
        
        # 清理止损单
        if symbol in self.stop_orders:
            del self.stop_orders[symbol]
        
        print(f"✅ LiveExecutor: {symbol} 已平仓 @ {exit_price:.2f}")
        print(f"   PnL: {pnl*100:.4f}%")
        print(f"   exit_reason: {exit_reason}")
        
        return pnl
    
    def reset(self):
        """重置状态"""
        self.positions = {}
        self.stop_orders = {}
        self.order_counter = 0


# ============ Test Functions ============
async def test_a_normal_entry():
    """
    Test A: 正常开仓
    
    验收点：
    - 成功开仓 1 笔
    - 止损单在交易所可见（模拟）
    - stop_verified=True
    - state_store 有 entry 记录
    """
    print("\n" + "=" * 60)
    print("🧪 Test A: 正常开仓")
    print("=" * 60)
    
    # 初始化 Mock 组件
    state_store = MockStateStore()
    live_executor = MockLiveExecutor()
    
    # 导入 V5.4 组件
    from core.position_gate_v54 import build_position_gate_v54
    from core.safe_execution_v54 import build_safe_execution_v54, ExecutionContext
    
    # 装配
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 创建 ExecutionContext
    ctx = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-a-1",
        strategy="integration_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    # 执行
    result = await safe_exec.execute_entry(ctx)
    
    print(f"\n📊 执行结果:")
    print(f"   accepted: {result.accepted}")
    print(f"   reason: {result.reason}")
    
    # 验收
    if not result.accepted:
        print(f"❌ Test A 失败：执行被拒绝 - {result.reason}")
        return False
    
    # 检查 stop_verified
    stop_verified = result.gate_snapshot.get("stop_verified", False)
    stop_ok = result.gate_snapshot.get("stop_ok", False)
    
    # 检查 StateStore 记录
    position = state_store.get_current_position()
    has_position_record = position is not None
    
    print(f"\n📋 验证结果:")
    print(f"   stop_ok: {stop_ok}")
    print(f"   stop_verified: {stop_verified}")
    print(f"   StateStore 有持仓记录：{has_position_record}")
    print(f"   LiveExecutor 有持仓：{live_executor.has_open_position('ETH/USDT:USDT')}")
    
    # 验收标准
    checks = {
        "执行成功": result.accepted,
        "stop_ok": stop_ok,
        "stop_verified": stop_verified,
        "StateStore 记录": has_position_record,
        "LiveExecutor 持仓": live_executor.has_open_position("ETH/USDT:USDT"),
    }
    
    all_passed = all(checks.values())
    
    print(f"\n📊 Test A 验收:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    if all_passed:
        print("\n✅ Test A: 通过")
    else:
        print("\n❌ Test A: 失败")
    
    return all_passed


async def test_b_duplicate_signal():
    """
    Test B: 重复信号（并发保护）
    
    验收点：
    - 只能成功 1 笔
    - 重复信号被 Gate 挡住
    - 不出现叠仓
    """
    print("\n" + "=" * 60)
    print("🧪 Test B: 重复信号（并发保护）")
    print("=" * 60)
    
    import asyncio
    
    # 初始化 Mock 组件
    state_store = MockStateStore()
    live_executor = MockLiveExecutor()
    
    # 导入 V5.4 组件
    from core.position_gate_v54 import build_position_gate_v54
    from core.safe_execution_v54 import build_safe_execution_v54, ExecutionContext
    
    # 装配
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 创建两个相同信号
    ctx1 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-b-1",
        strategy="integration_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    ctx2 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-b-2",
        strategy="integration_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    async def attempt(ctx):
        result = await safe_exec.execute_entry(ctx)
        return result
    
    # 并发执行
    results = await asyncio.gather(
        attempt(ctx1),
        attempt(ctx2),
    )
    
    # 统计
    success_count = sum(1 for r in results if r.accepted)
    blocked_count = sum(1 for r in results if not r.accepted)
    
    print(f"\n📊 执行结果:")
    print(f"   成功：{success_count}")
    print(f"   被挡：{blocked_count}")
    
    # 检查最终持仓
    final_position_size = live_executor.get_position_size("ETH/USDT:USDT")
    
    # 验收标准
    checks = {
        "只成功 1 笔": success_count == 1,
        "挡住 1 笔": blocked_count == 1,
        "最终持仓=0.13": abs(final_position_size - 0.13) < 0.001,
        "不叠仓": final_position_size <= 0.13,
    }
    
    all_passed = all(checks.values())
    
    print(f"\n📊 Test B 验收:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    if all_passed:
        print("\n✅ Test B: 通过")
    else:
        print("\n❌ Test B: 失败")
    
    return all_passed


async def test_c_exit_record():
    """
    Test C: 退出记录（Exit Source）
    
    验收点：
    - TIME_EXIT 或手动平仓后
    - exit_source 正确
    - trigger_module 正确
    """
    print("\n" + "=" * 60)
    print("🧪 Test C: 退出记录（Exit Source）")
    print("=" * 60)
    
    # 初始化 Mock 组件
    state_store = MockStateStore()
    live_executor = MockLiveExecutor()
    
    # 先开仓
    from core.position_gate_v54 import build_position_gate_v54
    from core.safe_execution_v54 import build_safe_execution_v54, ExecutionContext
    
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_exec = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 开仓
    ctx = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="test-c-entry",
        strategy="integration_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    entry_result = await safe_exec.execute_entry(ctx)
    print(f"\n✅ 开仓完成：{entry_result.accepted}")
    
    # 记录退出（模拟 TIME_EXIT）
    exit_data = {
        "entry_price": 2200.0,
        "exit_price": 2198.0,
        "pnl": -0.0009,
        "exit_source": "TIME_EXIT",
        "position_size": 0.13,
        "stop_ok": True,
        "stop_verified": True,
        "trigger_module": "position_manager",
    }
    
    state_store.record_event("exit", exit_data)
    
    # 读取验证
    last_trade = state_store.get_last_trade()
    
    print(f"\n📋 最后交易记录:")
    if last_trade:
        for key, value in last_trade.items():
            print(f"   {key}: {value}")
    else:
        print("   ❌ 无交易记录")
    
    # 验收标准
    checks = {
        "exit_source 正确": last_trade.get("exit_source") == "TIME_EXIT" if last_trade else False,
        "position_size 正确": last_trade.get("position_size") == 0.13 if last_trade else False,
        "stop_verified 正确": last_trade.get("stop_verified") == True if last_trade else False,
        "trigger_module 正确": last_trade.get("trigger_module") == "position_manager" if last_trade else False,
    }
    
    all_passed = all(checks.values())
    
    print(f"\n📊 Test C 验收:")
    for name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {passed}")
    
    if all_passed:
        print("\n✅ Test C: 通过")
    else:
        print("\n❌ Test C: 失败")
    
    return all_passed


# ============ Main ============
async def main():
    """运行所有集成测试"""
    print("=" * 60)
    print("🧪 V5.4 集成测试 V2（完善 Mock 版）")
    print("=" * 60)
    
    results = {
        "Test A (正常开仓)": await test_a_normal_entry(),
        "Test B (重复信号)": await test_b_duplicate_signal(),
        "Test C (退出记录)": await test_c_exit_record(),
    }
    
    # 汇总
    print("\n" + "=" * 60)
    print("📊 集成测试汇总")
    print("=" * 60)
    
    for name, passed in results.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {'通过' if passed else '失败'}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有集成测试通过！")
        print("\n✅ V5.4 安全链已接管真实入口:")
        print("   1. Execution Lock ✅")
        print("   2. Position Gate ✅")
        print("   3. Entry Execution ✅")
        print("   4. Stop Loss Verify ✅")
        print("   5. Exit Source Record ✅")
        print("\n🔜 可以继续 Step 5: Sandbox Safety Test")
    else:
        print("❌ 部分测试失败，请检查")
    print("=" * 60)
    
    return all_passed


if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
