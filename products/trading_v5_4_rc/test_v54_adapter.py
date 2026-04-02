#!/usr/bin/env python3
"""
V5.4.1 Adapter 集成测试

测试 V5.3 信号到 V5.4.1 链的转换
"""

import sys
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')

from v54_signal_adapter import V54SignalAdapter

def test_adapter():
    """测试 adapter 功能"""
    print("=" * 80)
    print("🧪 V5.4.1 Adapter 集成测试")
    print("=" * 80)
    
    adapter = V54SignalAdapter()
    
    # 测试用例 1: 高质量信号 (应通过)
    print("\n📋 测试 1: 高质量信号 (score=85, volume=1.5x)")
    allowed, reason, context = adapter.adapt_v53_signal(
        symbol='ETH/USDT:USDT',
        score=85,
        volume_ratio=1.5,
        price_change=0.005,
        regime='trend',
        current_price=2071.69,
        spread_bps=1.5
    )
    print(f"   结果：{'✅ 通过' if allowed else '❌ 拒绝'}")
    print(f"   原因：{reason}")
    if allowed:
        print(f"   signal_score: {context['signal_score']:.1f}")
        print(f"   signal_bucket: {context['signal_bucket']}")
    
    # 测试用例 2: 低质量信号 (应被 L3 拒绝)
    print("\n📋 测试 2: 低质量信号 (score=45, volume=0.5x)")
    allowed, reason, context = adapter.adapt_v53_signal(
        symbol='ETH/USDT:USDT',
        score=45,
        volume_ratio=0.5,
        price_change=0.001,
        regime='range',
        current_price=2071.69,
        spread_bps=1.5
    )
    print(f"   结果：{'✅ 拒绝' if not allowed else '❌ 通过'}")
    print(f"   原因：{reason}")
    
    # 测试用例 3: Spread 过宽 (应被 L2 拒绝)
    print("\n📋 测试 3: Spread 过宽 (5.0 bps)")
    allowed, reason, context = adapter.adapt_v53_signal(
        symbol='ETH/USDT:USDT',
        score=85,
        volume_ratio=1.5,
        price_change=0.005,
        regime='trend',
        current_price=2071.69,
        spread_bps=5.0
    )
    print(f"   结果：{'✅ 拒绝' if not allowed else '❌ 通过'}")
    print(f"   原因：{reason}")
    
    # 测试用例 4: 波动率过低 (应被 L2 拒绝)
    print("\n📋 测试 4: 波动率过低 (price_change=0.0001)")
    allowed, reason, context = adapter.adapt_v53_signal(
        symbol='ETH/USDT:USDT',
        score=85,
        volume_ratio=1.5,
        price_change=0.0001,
        regime='trend',
        current_price=2071.69,
        spread_bps=1.5
    )
    print(f"   结果：{'✅ 拒绝' if not allowed else '❌ 通过'}")
    print(f"   原因：{reason}")
    
    # 打印统计
    print("\n" + "=" * 80)
    print("📊 测试统计:")
    stats = adapter.get_stats()
    print(f"   候选信号数：{stats['candidate_signals']}")
    print(f"   L2 拒绝数：{stats['l2_rejected']}")
    print(f"   L3 拒绝数：{stats['l3_rejected']}")
    print(f"   允许交易数：{stats['trades_allowed']}")
    print("=" * 80)

if __name__ == '__main__':
    test_adapter()
