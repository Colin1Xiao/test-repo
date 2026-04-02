#!/usr/bin/env python3
"""
V5.4.1 TIME_EXIT 集成测试

测试场景：
1. 最小持仓时间保护 (20 秒)
2. 浮亏轻微保护期 (15 秒内 pnl > -0.1% 不砍)
3. 正常超时平仓 (60 秒)
"""

import sys
import time
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3/core')

from position_monitor import PositionMonitor

def test_time_exit_v54():
    """测试 TIME_EXIT 优化逻辑"""
    print("=" * 80)
    print("🕐 测试 V5.4.1 TIME_EXIT 优化")
    print("=" * 80)
    
    monitor = PositionMonitor()
    
    # 测试用例 1: 15 秒内，浮亏轻微 (-0.05%) → 不触发
    print("\n📋 测试 1: 15 秒内，浮亏轻微 (应不触发)")
    entry_time = time.time() - 10  # 10 秒前
    monitor.register_position(
        symbol="ETH/USDT:USDT",
        side="buy",
        size=0.14,
        entry_price=2071.69,
        entry_time=entry_time
    )
    current_price = 2071.69 * 0.9995  # -0.05%
    
    status = monitor.check_position("ETH/USDT:USDT", current_price)
    
    if status and not status.should_close:
        print(f"   ✅ 通过：持仓{status.hold_time_seconds:.0f}s，浮亏{status.unrealized_pnl_pct*100:.2f}%，不触发")
    else:
        print(f"   ❌ 失败：应不触发")
    
    monitor.remove_position("ETH/USDT:USDT")
    
    # 测试用例 2: 15 秒内，浮亏较大 (-0.6%) → 触发止损
    print("\n📋 测试 2: 15 秒内，浮亏较大 (应触发止损)")
    entry_time = time.time() - 10  # 10 秒前
    monitor.register_position(
        symbol="ETH/USDT:USDT",
        side="buy",
        size=0.14,
        entry_price=2071.69,
        entry_time=entry_time
    )
    current_price = 2071.69 * 0.994  # -0.6%
    
    status = monitor.check_position("ETH/USDT:USDT", current_price)
    
    if status and status.should_close and "止损" in status.close_reason:
        print(f"   ✅ 通过：浮亏{status.unrealized_pnl_pct*100:.2f}% <= stop_loss({monitor.DEFAULT_STOP_LOSS*100}%)，触发止损")
    else:
        print(f"   ❌ 失败：应触发止损 (should_close={status.should_close if status else 'N/A'}, reason={status.close_reason if status else 'N/A'})")
    
    monitor.remove_position("ETH/USDT:USDT")
    
    # 测试用例 3: 30 秒，盈亏正常 (+0.1%) → 继续持有
    print("\n📋 测试 3: 30 秒，盈亏正常 (应继续持有)")
    entry_time = time.time() - 30  # 30 秒前
    monitor.register_position(
        symbol="ETH/USDT:USDT",
        side="buy",
        size=0.14,
        entry_price=2071.69,
        entry_time=entry_time
    )
    current_price = 2071.69 * 1.001  # +0.1%
    
    status = monitor.check_position("ETH/USDT:USDT", current_price)
    
    if status and not status.should_close:
        print(f"   ✅ 通过：持仓{status.hold_time_seconds:.0f}s，盈亏{status.unrealized_pnl_pct*100:.2f}%，继续持有")
    else:
        print(f"   ❌ 失败：应继续持有 (should_close={status.should_close if status else 'N/A'}, reason={status.close_reason if status else 'N/A'})")
    
    monitor.remove_position("ETH/USDT:USDT")
    
    # 测试用例 4: 65 秒超时，盈亏正常 (+0.05%) → TIME_EXIT
    print("\n📋 测试 4: 65 秒超时 (应触发 TIME_EXIT)")
    entry_time = time.time() - 65  # 65 秒前
    monitor.register_position(
        symbol="ETH/USDT:USDT",
        side="buy",
        size=0.14,
        entry_price=2071.69,
        entry_time=entry_time
    )
    current_price = 2071.69 * 1.0005  # +0.05%
    
    status = monitor.check_position("ETH/USDT:USDT", current_price)
    
    if status and status.should_close and "超时" in status.close_reason:
        print(f"   ✅ 通过：持仓{status.hold_time_seconds:.0f}s >= max_hold({status.max_hold_seconds}s)，触发 TIME_EXIT")
    else:
        print(f"   ❌ 失败：应触发 TIME_EXIT (should_close={status.should_close if status else 'N/A'}, reason={status.close_reason if status else 'N/A'})")
    
    monitor.remove_position("ETH/USDT:USDT")
    
    # 测试用例 5: 10 秒内止盈触发 (+0.25%) → 优先止盈
    print("\n📋 测试 5: 10 秒内止盈触发 (应优先止盈)")
    entry_time = time.time() - 10  # 10 秒前
    monitor.register_position(
        symbol="ETH/USDT:USDT",
        side="buy",
        size=0.14,
        entry_price=2071.69,
        entry_time=entry_time
    )
    current_price = 2071.69 * 1.0025  # +0.25%
    
    status = monitor.check_position("ETH/USDT:USDT", current_price)
    
    if status and status.should_close and "止盈" in status.close_reason:
        print(f"   ✅ 通过：止盈{status.unrealized_pnl_pct*100:.2f}% >= take_profit({monitor.DEFAULT_TAKE_PROFIT*100}%)，触发止盈")
    else:
        print(f"   ❌ 失败：应触发止盈 (should_close={status.should_close if status else 'N/A'}, reason={status.close_reason if status else 'N/A'})")
    
    monitor.remove_position("ETH/USDT:USDT")
    
    print("\n" + "=" * 80)
    print(f"\n📊 V5.4.1 TIME_EXIT 配置:")
    print(f"   min_hold: {monitor.DEFAULT_MIN_HOLD}s (前 20 秒不普通 TIME_EXIT)")
    print(f"   break_even_guard: {monitor.DEFAULT_BREAK_EVEN_GUARD}s (15 秒内浮亏轻微不砍)")
    print(f"   max_hold: {monitor.DEFAULT_MAX_HOLD}s (60 秒超时)")
    print(f"   take_profit: {monitor.DEFAULT_TAKE_PROFIT*100}%")
    print(f"   stop_loss: {monitor.DEFAULT_STOP_LOSS*100}%")
    print(f"   liquidation_exit: {monitor.DEFAULT_LIQUIDATION*100}%")

if __name__ == "__main__":
    test_time_exit_v54()
