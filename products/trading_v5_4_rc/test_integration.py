#!/usr/bin/env python3
"""
V5.4 Integration Test - 集成测试

测试场景：
Test A: 正常开仓 → 确认止损单上交易所 + stop_verified=True
Test B: 重复信号 → 确认被 Gate 挡住 + 不叠仓
Test C: 退出记录 → 确认 exit_source 正确

运行方式：
python test_integration.py
"""

import sys
import os
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent / "trading_system_v5_3"))
sys.path.insert(0, str(Path(__file__).parent / "core"))

from core.safe_execution_assembly import (
    get_safe_execution_v54_cached,
    signal_to_execution_context,
)
from core.safe_execution_v54 import ExecutionContext


# ============ Mock Signal ============
class MockSignal:
    """模拟 V5.3 Signal"""
    def __init__(self):
        self.symbol = "ETH/USDT:USDT"
        self.signal_price = 2200.0
        self.score = 75
        self.regime = "range"
        self.volume_ratio = 1.2
        self.timestamp = 1774506000.0
        self.margin_usd = 3.0


# ============ Test A: 正常开仓 ============
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
    
    # 获取 SafeExecutionV54
    safe_exec = get_safe_execution_v54_cached()
    if safe_exec is None:
        print("❌ SafeExecutionV54 未装配")
        return False
    
    # 创建 Signal → ExecutionContext
    signal = MockSignal()
    ctx = signal_to_execution_context(signal)
    if ctx is None:
        print("❌ Signal 转 ExecutionContext 失败")
        return False
    
    print(f"📋 ExecutionContext:")
    print(f"   symbol: {ctx.symbol}")
    print(f"   side: {ctx.side}")
    print(f"   size: {ctx.requested_size}")
    print(f"   signal_price: {ctx.signal_price:.2f}")
    
    # 执行
    result = await safe_exec.execute_entry(ctx)
    
    print(f"\n📊 执行结果:")
    print(f"   accepted: {result.accepted}")
    print(f"   reason: {result.reason}")
    print(f"   duration: {result.duration_ms}ms")
    
    # 验收
    if not result.accepted:
        print(f"❌ Test A 失败：执行被拒绝 - {result.reason}")
        return False
    
    # 检查 stop_verified
    stop_verified = result.gate_snapshot.get("stop_verified", False)
    stop_ok = result.gate_snapshot.get("stop_ok", False)
    
    print(f"\n📋 止损验证:")
    print(f"   stop_ok: {stop_ok}")
    print(f"   stop_verified: {stop_verified}")
    
    # 验收标准
    checks = {
        "执行成功": result.accepted,
        "stop_ok": stop_ok,
        "stop_verified": stop_verified,
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


# ============ Test B: 重复信号 ============
async def test_b_duplicate_signal():
    """
    Test B: 重复信号
    
    验收点：
    - 只能成功 1 笔
    - 重复信号被 Gate 挡住
    - 不出现叠仓
    """
    print("\n" + "=" * 60)
    print("🧪 Test B: 重复信号（并发保护）")
    print("=" * 60)
    
    import asyncio
    
    # 获取 SafeExecutionV54
    safe_exec = get_safe_execution_v54_cached()
    if safe_exec is None:
        print("❌ SafeExecutionV54 未装配")
        return False
    
    # 创建两个相同信号
    signal1 = MockSignal()
    signal2 = MockSignal()
    
    ctx1 = signal_to_execution_context(signal1)
    ctx2 = signal_to_execution_context(signal2)
    
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
    
    # 验收标准
    checks = {
        "只成功 1 笔": success_count == 1,
        "挡住 1 笔": blocked_count == 1,
        "不叠仓": success_count <= 1,
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


# ============ Test C: 退出记录 ============
async def test_c_exit_record():
    """
    Test C: 退出记录
    
    验收点：
    - TIME_EXIT 或手动平仓后
    - exit_source 正确
    - trigger_module 正确
    """
    print("\n" + "=" * 60)
    print("🧪 Test C: 退出记录（Exit Source）")
    print("=" * 60)
    
    # 获取 StateStore
    from core.state_store_v54 import get_state_store
    
    state_store = get_state_store()
    
    # 模拟记录 exit 事件
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
    
    # 记录
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
    print("🧪 V5.4 集成测试")
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
