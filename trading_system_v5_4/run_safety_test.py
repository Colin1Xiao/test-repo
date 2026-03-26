#!/usr/bin/env python3
"""
Run Safety Test - V5.4 最小验收测试

测试目标：
1. 并发双请求 → 只能成功 1 笔
2. 另一笔必须被 Position Gate 挡住
3. 最终交易所持仓 = 0.13
4. 下单调用次数 = 1 次

这是 V5.4 Step 1 的验收标准。
"""

from __future__ import annotations
import asyncio
import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "core"))

from core.safe_execution_v54 import (
    SafeExecutionV54,
    ExecutionContext,
    ExecutionResult,
    PositionGateRejected,
    ExecutionRejected,
    build_safe_execution_v54,
)
from core.position_gate_v54 import PositionGateV54, build_position_gate_v54


class FakeStateStore:
    """
    模拟 StateStore
    
    用于测试，不实际写文件
    """
    
    def __init__(self):
        self._current_position = None
        self.events = []
    
    def get_current_position(self):
        """获取当前持仓"""
        return self._current_position
    
    def record_event(self, event_type: str, data: dict):
        """记录事件"""
        self.events.append({"type": event_type, "data": data})
        if event_type == "entry":
            self._current_position = data
        elif event_type == "exit":
            self._current_position = None


class FakeLiveExecutor:
    """
    模拟 LiveExecutor
    
    用于测试，不实际调用 OKX API
    """
    
    def __init__(self):
        self.calls = []
        self.position_size = 0.0
        self.open_positions = {}
    
    def has_open_position(self, symbol: str) -> bool:
        """检查是否有持仓"""
        return symbol in self.open_positions and self.open_positions[symbol].get("size", 0) > 0
    
    async def execute_signal(self, symbol: str, signal_price: float, margin_usd: float, signal_time=None) -> dict:
        """模拟下单"""
        self.calls.append({
            "symbol": symbol,
            "signal_price": signal_price,
            "margin_usd": margin_usd,
        })
        
        # 模拟延迟
        await asyncio.sleep(0.1)
        
        # 更新持仓
        self.position_size = 0.13
        self.open_positions[symbol] = {
            "size": 0.13,
            "entry_price": signal_price,
        }
        
        return {
            "ok": True,
            "symbol": symbol,
            "execution_price": signal_price,
            "filled_size": 0.13,
            "order_id": f"order-{len(self.calls)}",
        }


async def concurrent_entry_test() -> None:
    """
    并发开仓测试
    
    场景：
    - 两个并发请求同时打进来
    - 只能成功 1 笔
    - 另一笔必须被 Position Gate 挡住
    """
    print("=" * 60)
    print("🧪 V5.4 Safety Test - 并发开仓保护")
    print("=" * 60)
    
    # 初始化组件
    state_store = FakeStateStore()
    live_executor = FakeLiveExecutor()
    
    # 创建 Position Gate
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    # 创建 Safe Execution
    safe_execution = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    # 创建两个并发请求
    ctx1 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="req-1",
        strategy="safety_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    ctx2 = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="req-2",
        strategy="safety_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    async def attempt(ctx: ExecutionContext):
        """尝试执行"""
        try:
            result = await safe_execution.execute_entry(ctx)
            # accepted=True 才是真正成功
            if result.accepted:
                return (ctx.request_id, "SUCCESS", result.reason, result.order_result)
            else:
                # accepted=False = 被挡
                return (ctx.request_id, "BLOCKED", result.reason, None)
        except PositionGateRejected as exc:
            return (ctx.request_id, "BLOCKED", str(exc), None)
        except ExecutionRejected as exc:
            return (ctx.request_id, "REJECTED", str(exc), None)
        except Exception as exc:
            return (ctx.request_id, "ERROR", str(exc), None)
    
    # 并发执行
    results = await asyncio.gather(
        attempt(ctx1),
        attempt(ctx2),
    )
    
    # 打印结果
    print("\n📊 执行结果:")
    for row in results:
        print(f"  {row}")
    
    # 验证
    success_count = sum(1 for _, status, _, _ in results if status == "SUCCESS")
    blocked_count = sum(1 for _, status, _, _ in results if status == "BLOCKED")
    
    print(f"\n📈 统计:")
    print(f"  成功：{success_count}")
    print(f"  被挡：{blocked_count}")
    print(f"  下单调用：{len(live_executor.calls)}")
    print(f"  最终持仓：{live_executor.position_size}")
    
    # 断言
    assert success_count == 1, f"❌ 期望 1 次成功，实际 {success_count}"
    assert blocked_count == 1, f"❌ 期望 1 次被挡，实际 {blocked_count}"
    assert len(live_executor.calls) == 1, f"❌ 期望 1 次下单，实际 {len(live_executor.calls)}"
    assert abs(live_executor.position_size - 0.13) < 1e-9, f"❌ 期望持仓 0.13，实际 {live_executor.position_size}"
    
    print("\n✅ PASS: 执行锁 + Position Gate 成功防止重复开仓")
    print("=" * 60)


async def single_entry_test() -> None:
    """
    单笔开仓测试
    
    场景：
    - 单个请求
    - 应该成功
    - 持仓正确记录
    """
    print("\n" + "=" * 60)
    print("🧪 V5.4 Safety Test - 单笔开仓")
    print("=" * 60)
    
    # 初始化组件
    state_store = FakeStateStore()
    live_executor = FakeLiveExecutor()
    
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_execution = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    ctx = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="req-single",
        strategy="safety_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    result = await safe_execution.execute_entry(ctx)
    
    print(f"\n📊 执行结果:")
    print(f"  accepted: {result.accepted}")
    print(f"  reason: {result.reason}")
    print(f"  duration: {result.duration_ms}ms")
    
    assert result.accepted, f"❌ 期望成功，实际 {result.reason}"
    assert len(live_executor.calls) == 1, f"❌ 期望 1 次下单"
    assert state_store._current_position is not None, "❌ 期望 StateStore 记录持仓"
    
    print("\n✅ PASS: 单笔开仓成功")
    print("=" * 60)


async def position_gate_block_test() -> None:
    """
    Position Gate 阻挡测试
    
    场景：
    - 已有持仓
    - 再次开仓请求
    - 应该被 Position Gate 挡住
    """
    print("\n" + "=" * 60)
    print("🧪 V5.4 Safety Test - Position Gate 阻挡")
    print("=" * 60)
    
    # 初始化组件（带已有持仓）
    state_store = FakeStateStore()
    live_executor = FakeLiveExecutor()
    
    # 模拟已有持仓
    state_store._current_position = {
        "symbol": "ETH/USDT:USDT",
        "size": 0.13,
        "entry_price": 2200.0,
    }
    live_executor.open_positions["ETH/USDT:USDT"] = {
        "size": 0.13,
        "entry_price": 2200.0,
    }
    live_executor.position_size = 0.13
    
    position_gate = build_position_gate_v54(
        state_store=state_store,
        live_executor=live_executor,
    )
    
    safe_execution = build_safe_execution_v54(
        live_executor=live_executor,
        state_store=state_store,
        position_gate=position_gate,
        lock_timeout=2.0,
    )
    
    ctx = ExecutionContext(
        symbol="ETH/USDT:USDT",
        side="buy",
        requested_size=0.13,
        request_id="req-blocked",
        strategy="safety_test",
        signal_price=2200.0,
        margin_usd=3.0,
    )
    
    result = await safe_execution.execute_entry(ctx)
    
    print(f"\n📊 执行结果:")
    print(f"  accepted: {result.accepted}")
    print(f"  reason: {result.reason}")
    
    assert not result.accepted, "❌ 期望被拒绝"
    assert "POSITION_GATE_BLOCKED" in result.reason, f"❌ 期望 Position Gate 拒绝，实际 {result.reason}"
    assert len(live_executor.calls) == 0, f"❌ 期望 0 次下单"
    
    print("\n✅ PASS: Position Gate 成功阻挡重复开仓")
    print("=" * 60)


async def main():
    """运行所有测试"""
    try:
        await single_entry_test()
        await position_gate_block_test()
        await concurrent_entry_test()
        
        print("\n" + "🎉" * 20)
        print("✅ ALL TESTS PASSED")
        print("🎉" * 20)
        print("\nV5.4 Step 1 验收通过:")
        print("  ✅ 执行锁正常工作")
        print("  ✅ Position Gate 双层检查有效")
        print("  ✅ 并发请求只允许 1 笔成功")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ TEST ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
