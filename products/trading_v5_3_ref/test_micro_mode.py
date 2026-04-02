#!/usr/bin/env python3
"""
MICRO_MODE Mock Test
验证小资金是否正确进入 MICRO_MODE 并记录完整字段
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.capital_controller_v2 import CapitalControllerV2
from core.state_store import state_store, record_trade


async def test_micro_mode():
    """测试 MICRO_MODE 完整流程"""
    print("=" * 60)
    print("🧪 MICRO_MODE Mock Test")
    print("=" * 60)

    # 初始化控制器（使用实际参数）
    controller = CapitalControllerV2(
        base_risk_fraction=0.02,
        min_margin_usdt=0.05,
        max_margin_usdt=5.0,
        leverage=100,
        risk_pct_cap=0.03,
        micro_risk_pct_cap=0.05,
        min_notional_usdt=5.0,
        min_position_size=0.002,
    )

    print("\n✅ CapitalControllerV2 初始化完成")
    print(f"   Risk Pct Cap: {controller.risk_pct_cap:.2%}")
    print(f"   Micro Risk Pct Cap: {controller.micro_risk_pct_cap:.2%}")
    print()

    # 测试 MICRO_MODE 场景
    equity = 1.35  # 当前实际余额
    entry_price = 2500.0

    decision = controller.calculate(
        equity_usdt=equity,
        entry_price=entry_price,
        drawdown=0.0,
        edge_state='STRONG',
        risk_state='NORMAL',
    )

    print("=" * 60)
    print("📋 MICRO_MODE 场景测试")
    print("=" * 60)
    print(f"  Equity: {decision.equity_usdt:.2f} USDT")
    print(f"  Margin: {decision.margin_usdt:.2f} USDT")
    print(f"  Risk Pct: {decision.risk_pct:.2%}")
    print(f"  Capital State: {decision.capital_state}")
    print(f"  Can Trade: {decision.can_trade}")
    print(f"  Reason: {decision.reason}")
    print(f"  Notional: {decision.notional_usdt:.2f} USDT")
    print(f"  Position Size: {decision.position_size:.6f} ETH")
    print()

    if not decision.can_trade:
        print("❌ MICOR_MODE 测试失败：小资金被阻止")
        return

    # 模拟 entry 事件
    entry_event = {
        "event": "entry",
        "timestamp": datetime.now().isoformat(),
        "symbol": "ETH/USDT:USDT",
        "entry_price": entry_price,
        "position_size": decision.position_size,
        "margin_usdt": decision.margin_usdt,
        "notional_usdt": decision.notional_usdt,
        "equity_usdt": decision.equity_usdt,
        "capital_state": decision.capital_state,
        "capital_reason": decision.reason,
        "leverage": decision.leverage,
        "risk_pct": decision.risk_pct,
    }

    record_trade(entry_event)
    print(f"✅ Entry 事件已记录")

    # 模拟 exit 事件
    exit_price = entry_price * 1.001  # +0.1%
    pnl = (exit_price - entry_price) / entry_price

    exit_event = {
        "event": "exit",
        "timestamp": datetime.now().isoformat(),
        "symbol": "ETH/USDT:USDT",
        "entry_price": entry_price,
        "exit_price": exit_price,
        "position_size": decision.position_size,
        "pnl": pnl,
        "exit_source": "TIME_EXIT",
        "margin_usdt": decision.margin_usdt,
        "notional_usdt": decision.notional_usdt,
        "equity_usdt": decision.equity_usdt,
        "capital_state": decision.capital_state,
        "capital_reason": decision.reason,
        "leverage": decision.leverage,
        "risk_pct": decision.risk_pct,
    }

    record_trade(exit_event)
    print(f"✅ Exit 事件已记录")
    print()

    # 验证 state_store
    print("=" * 60)
    print("🔍 StateStore 验证")
    print("=" * 60)

    stats = state_store.to_dict()
    last_trade = stats.get('last_trade', {})
    capital = stats.get('capital', {})

    print(f"  Total Trades: {stats.get('total_trades', 0)}")
    print()

    print("📊 Capital 摘要:")
    for k, v in capital.items():
        print(f"    {k}: {v}")
    print()

    print("📋 Last Trade 字段:")
    required_fields = [
        'entry_price', 'exit_price', 'pnl', 'exit_source',
        'position_size', 'margin_usdt', 'notional_usdt',
        'equity_usdt', 'capital_state', 'capital_reason',
        'leverage', 'risk_pct'
    ]

    missing = []
    for field in required_fields:
        value = last_trade.get(field)
        status = "✅" if value is not None and value != 0 else "❌"
        print(f"    {status} {field}: {value}")
        if value is None or (field != 'pnl' and value == 0):
            missing.append(field)

    print()

    # 最终验证
    print("=" * 60)
    print("🎯 MICRO_MODE 验收结果")
    print("=" * 60)

    checks = [
        ("capital_state = MICRO", capital.get('capital_state') == 'MICRO'),
        ("MICRO_MODE in reason", 'MICRO_MODE' in last_trade.get('capital_reason', '')),
        ("risk_pct recorded", last_trade.get('risk_pct', 0) > 0),
        ("all fields present", len(missing) == 0),
    ]

    all_passed = True
    for check_name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False

    print()

    if all_passed:
        print("🎉 MICRO_MODE 测试全部通过！")
    else:
        print("❌ MICRO_MODE 测试失败")
        if missing:
            print(f"   缺失字段: {missing}")


if __name__ == "__main__":
    asyncio.run(test_micro_mode())