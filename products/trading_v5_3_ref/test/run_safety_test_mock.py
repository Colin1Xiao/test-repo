#!/usr/bin/env python3
"""
Mock Safety Test V2 - 完整测试框架

验证 4 项核心功能：
1. Execution Lock: 并发信号只成功一个
2. Position Gate: 已有持仓时被拦截
3. Stop Order Verified: 止损单创建并验证
4. TIME_EXIT: 超时自动平仓

通过标准：全部 PASS
"""

import asyncio
import time
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# 添加路径
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / "test"))

from mock_exchange_v2 import MockExchange
from safe_execution_v54_mock import SafeExecutionV54Mock


SYMBOL = "ETH-USDT-SWAP"
SIZE = 0.13  # ETH


class InMemoryRecorder:
    """事件记录器"""
    
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []
    
    def record_trade(self, event: Dict[str, Any]) -> None:
        self.events.append(event)
    
    def last_event(self) -> Optional[Dict[str, Any]]:
        return self.events[-1] if self.events else None


# ========== 测试用例 ==========

async def assert_lock_works(executor: SafeExecutionV54Mock) -> bool:
    """
    Test 1: Execution Lock
    
    两个并发信号，应该只成功一个
    """
    async def run_once(tag: str):
        return await executor.try_execute("buy", SIZE, context={"tag": tag})
    
    r1, r2 = await asyncio.gather(run_once("A"), run_once("B"))
    success_count = sum(1 for x in [r1, r2] if x)
    
    if success_count == 1:
        print("   ✅ Lock 生效：只执行了一个")
        return True
    else:
        print(f"   ❌ Lock 失效：执行了 {success_count} 个")
        return False


async def assert_position_gate(executor: SafeExecutionV54Mock) -> bool:
    """
    Test 2: Position Gate
    
    已有持仓时再次开仓，必须被拦截
    """
    first = await executor.try_execute("buy", SIZE, context={"tag": "first"})
    if not first:
        print("   ❌ 第一次开仓失败")
        return False
    
    second = await executor.try_execute("buy", SIZE, context={"tag": "second"})
    
    if second is None:
        print("   ✅ Position Gate 拦截成功")
        return True
    else:
        print("   ❌ Position Gate 失效：叠仓发生！")
        return False


async def assert_stop_order_verified(exchange: MockExchange) -> bool:
    """
    Test 3: Stop Order Verified
    
    止损单必须存在且状态为 live
    """
    pending = await exchange.private_get_trade_orders_algo_pending({"instId": SYMBOL})
    data = pending.get("data", [])
    
    if len(data) >= 1 and data[0]["state"] == "live":
        print(f"   ✅ 止损单存在: algoId={data[0]['algoId']}")
        return True
    else:
        print(f"   ❌ 止损单不存在或状态错误: {data}")
        return False


async def assert_time_exit(
    executor: SafeExecutionV54Mock, exchange: MockExchange
) -> tuple:
    """
    Test 4: TIME_EXIT
    
    开仓后等待 >30s，TIME_EXIT 应触发
    """
    # 先清理
    if executor._has_position():
        await executor.close_position("MANUAL")
    
    entry = await executor.try_execute("buy", SIZE, context={"tag": "time-exit"})
    if not entry:
        return False, {"reason": "entry_failed"}
    
    start = time.time()
    last_result = None
    
    # 等待 TIME_EXIT（最多 40s）
    while time.time() - start < 40:
        # 模拟价格波动
        base = 2150.0 + ((time.time() - start) * 0.01)
        exchange.set_price(SYMBOL, base)
        
        # 检查 TIME_EXIT
        maybe = await executor.process_open_position()
        if maybe:
            last_result = {
                "exit_source": maybe.exit_source,
                "hold_time": maybe.hold_time,
                "entry_price": maybe.entry_price,
                "exit_price": maybe.exit_price,
            }
            break
        
        await asyncio.sleep(1)
    
    if not last_result:
        return False, {"reason": "time_exit_not_triggered"}
    
    hold_time = last_result.get("hold_time", 0)
    ok = (
        last_result.get("exit_source") == "TIME_EXIT"
        and 25 <= hold_time <= 35
    )
    
    if ok:
        print(f"   ✅ TIME_EXIT 触发正确: hold_time={hold_time:.1f}s")
    else:
        print(f"   ❌ TIME_EXIT 异常: {last_result}")
    
    return ok, last_result


async def cleanup_position(executor: SafeExecutionV54Mock) -> None:
    """清理仓位"""
    if executor._has_position():
        await executor.close_position("MANUAL")


# ========== 主程序 ==========

async def main() -> None:
    print("\n" + "="*70)
    print("🧪 MOCK SAFETY TEST V2")
    print("="*70)
    
    exchange = MockExchange()
    recorder = InMemoryRecorder()
    
    executor = SafeExecutionV54Mock(
        exchange=exchange,
        symbol=SYMBOL,
        record_trade_fn=recorder.record_trade,
        safety_test_mode=True,
    )
    
    print("\n" + "-"*70)
    
    # Test 1: Execution Lock
    print("📋 Test 1: Execution Lock")
    await cleanup_position(executor)
    lock_ok = await assert_lock_works(executor)
    print(f"   Execution Lock: {'PASS' if lock_ok else 'FAIL'}")
    
    await cleanup_position(executor)
    
    # Test 2: Position Gate
    print("\n📋 Test 2: Position Gate")
    exchange.reset()
    gate_ok = await assert_position_gate(executor)
    print(f"   Position Gate: {'PASS' if gate_ok else 'FAIL'}")
    
    # Test 3: Stop Order Verified
    print("\n📋 Test 3: Stop Order Verified")
    stop_ok = await assert_stop_order_verified(exchange)
    print(f"   Stop Verification: {'PASS' if stop_ok else 'FAIL'}")
    
    await cleanup_position(executor)
    exchange.reset()
    
    # Test 4: TIME_EXIT
    print("\n📋 Test 4: TIME_EXIT")
    time_ok, result = await assert_time_exit(executor, exchange)
    print(f"   TIME_EXIT: {'PASS' if time_ok else 'FAIL'}")
    print(f"   TIME_EXIT result: {result}")
    
    # Final Summary
    print("\n" + "="*70)
    print("📊 FINAL SUMMARY")
    print("="*70)
    
    passed = all([lock_ok, gate_ok, stop_ok, time_ok])
    
    print(f"\n  Execution Lock:     {'✅ PASS' if lock_ok else '❌ FAIL'}")
    print(f"  Position Gate:      {'✅ PASS' if gate_ok else '❌ FAIL'}")
    print(f"  Stop Verification:  {'✅ PASS' if stop_ok else '❌ FAIL'}")
    print(f"  TIME_EXIT:          {'✅ PASS' if time_ok else '❌ FAIL'}")
    
    print(f"\n  Overall: {'✅ ALL PASS' if passed else '❌ SOME FAILED'}")
    
    if recorder.events:
        print(f"\n  Recorded events: {len(recorder.events)}")
        if recorder.last_event():
            print(f"  Last event: {recorder.last_event()}")
    
    print("="*70)
    
    if passed:
        print("\n🎉 全部测试通过！可以进入真实 Safety Test")
        print("👉 下一步: 充值 OKX $3+ → 运行真实 Safety Test")
    else:
        print("\n⚠️ 存在失败的测试，需要修复后再继续")
    
    return 0 if passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)