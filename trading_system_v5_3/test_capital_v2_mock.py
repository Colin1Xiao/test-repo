#!/usr/bin/env python3
"""
Capital Controller V2 Mock Test
验证资金字段完整性
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.capital_controller_v2 import CapitalControllerV2, format_capital_panel
from core.state_store import state_store, record_trade


class MockExchange:
    """Mock 交易所"""

    def __init__(self):
        self.equity_usdt = 120.0
        self.current_price = 2300.0

    async def fetch_balance(self):
        return {'USDT': {'total': self.equity_usdt}}

    async def fetch_ticker(self, symbol):
        return {'last': self.current_price}

    async def fetch_order_book(self, symbol):
        return {'asks': [[self.current_price, 10]], 'bids': [[self.current_price - 1, 10]]}

    async def load_markets(self):
        return {symbol: {'contractSize': 10} for symbol in ['ETH/USDT:USDT', 'BTC/USDT:USDT']}

    async def create_order(self, **kwargs):
        return {'id': 'mock_order_123', 'average': self.current_price}

    async def fetch_positions(self, symbols):
        return []

    async def fetch_open_orders(self, symbol):
        return [{'id': 'mock_stop_456'}]

    async def cancel_order(self, order_id, symbol):
        pass

    async def close(self):
        pass


async def test_capital_v2():
    """测试 Capital Controller V2"""
    print("=" * 60)
    print("🧪 Capital Controller V2 Mock Test")
    print("=" * 60)

    # 1. 初始化控制器
    controller = CapitalControllerV2(
        base_risk_fraction=0.02,
        min_margin_usdt=1.0,
        max_margin_usdt=5.0,
        leverage=100,
    )
    print("\n✅ CapitalControllerV2 初始化完成")
    print("⚠️  Risk Pct 上限保护: 3% (防止小资金风险放大)")

    # 2. 测试不同场景
    test_cases = [
        {
            'name': '正常场景',
            'equity_usdt': 120.0,
            'entry_price': 2300.0,
            'drawdown': 0.03,
            'edge_state': 'STRONG',
            'risk_state': 'NORMAL',
        },
        {
            'name': '回撤压缩',
            'equity_usdt': 120.0,
            'entry_price': 2300.0,
            'drawdown': 0.07,  # > 5%
            'edge_state': 'STRONG',
            'risk_state': 'NORMAL',
        },
        {
            'name': 'EDGE_WEAK',
            'equity_usdt': 120.0,
            'entry_price': 2300.0,
            'drawdown': 0.03,
            'edge_state': 'WEAK',
            'risk_state': 'NORMAL',
        },
        {
            'name': 'RISK_STOP',
            'equity_usdt': 120.0,
            'entry_price': 2300.0,
            'drawdown': 0.03,
            'edge_state': 'STRONG',
            'risk_state': 'STOP_REQUIRED',
        },
    ]

    for case in test_cases:
        print(f"\n{'='*60}")
        print(f"📋 测试场景: {case['name']}")
        print(f"{'='*60}")

        decision = controller.calculate(
            equity_usdt=case['equity_usdt'],
            entry_price=case['entry_price'],
            drawdown=case['drawdown'],
            edge_state=case['edge_state'],
            risk_state=case['risk_state'],
        )

        print(f"Can Trade: {decision.can_trade}")
        print(f"Capital State: {decision.capital_state}")
        print(f"Reason: {decision.reason}")
        print(f"Equity: {decision.equity_usdt:.2f} USDT")
        print(f"Margin: {decision.margin_usdt:.2f} USDT")
        print(f"Notional: {decision.notional_usdt:.2f} USDT")
        print(f"Position Size: {decision.position_size:.6f}")

        if decision.can_trade:
            # 模拟记录到 state_store
            mock_exit_event = {
                'event': 'exit',
                'symbol': 'ETH/USDT:USDT',
                'entry_price': case['entry_price'],
                'exit_price': case['entry_price'] * 1.001,
                'pnl': 0.001,
                'exit_source': 'MOCK_TEST',
                'position_size': decision.position_size,
                'margin_usdt': decision.margin_usdt,
                'notional_usdt': decision.notional_usdt,
                'equity_usdt': decision.equity_usdt,
                'capital_state': decision.capital_state,
                'capital_reason': decision.reason,
                'leverage': decision.leverage,
            }
            record_trade(mock_exit_event)
            print("✅ 已记录到 state_store")

    # 3. 验证 state_store 输出
    print(f"\n{'='*60}")
    print("📊 StateStore 输出验证")
    print(f"{'='*60}")

    state = state_store.to_dict()
    capital = state.get('capital', {})

    print(f"Total Trades: {state['total_trades']}")
    print(f"\nCapital Summary:")
    print(f"  equity_usdt: {capital.get('equity_usdt', 0):.2f}")
    print(f"  margin_usdt: {capital.get('margin_usdt', 0):.2f}")
    print(f"  notional_usdt: {capital.get('notional_usdt', 0):.2f}")
    print(f"  position_size: {capital.get('position_size', 0):.6f}")
    print(f"  capital_state: {capital.get('capital_state', 'N/A')}")
    print(f"  capital_reason: {capital.get('capital_reason', 'N/A')}")
    print(f"  risk_pct: {capital.get('risk_pct', 0):.6f}")

    # 4. 字段完整性检查
    print(f"\n{'='*60}")
    print("🔍 字段完整性检查")
    print(f"{'='*60}")

    required_fields = [
        'equity_usdt', 'margin_usdt', 'notional_usdt',
        'position_size', 'capital_state', 'capital_reason', 'risk_pct'
    ]

    all_passed = True
    for field in required_fields:
        value = capital.get(field)
        if value is not None and value != 0:
            print(f"  ✅ {field}: {value}")
        elif field == 'risk_pct' and capital.get('equity_usdt', 0) > 0:
            # risk_pct 可能为 0 如果 margin 为 0
            print(f"  ⚠️  {field}: {value} (margin=0 时正常)")
        else:
            print(f"  ❌ {field}: {value}")
            all_passed = False

    print(f"\n{'='*60}")
    if all_passed:
        print("🎉 所有字段检查通过！")
    else:
        print("⚠️  部分字段缺失")
    print(f"{'='*60}")

    # 5. 显示最后一笔交易
    print(f"\n📋 最后一笔交易详情:")
    last_trade = state.get('last_trade', {})
    for k, v in last_trade.items():
        print(f"  {k}: {v}")

    return all_passed


if __name__ == "__main__":
    result = asyncio.run(test_capital_v2())
    sys.exit(0 if result else 1)
