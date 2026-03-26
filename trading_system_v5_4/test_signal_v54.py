#!/usr/bin/env python3
"""
V5.4.1 信号层测试脚本

测试场景：
1. L2 硬过滤 - 通过/拒绝
2. L3 评分器 - 分桶决策
3. StateStore 审计字段记录
"""

import sys
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_4/core')
sys.path.insert(0, '/Users/colin/.openclaw/workspace/trading_system_v5_3/core')

from signal_filter_v54 import SignalFilterV54
from signal_scorer_v54 import SignalScorerV54
from state_store_v54 import get_state_store
import json

def test_l2_hard_filters():
    """测试 L2 硬过滤"""
    print("=" * 80)
    print("📋 测试 L2 硬过滤")
    print("=" * 80)
    
    filter_v54 = SignalFilterV54()
    
    # 测试用例 1: 正常通过
    print("\n✅ 测试 1: 正常信号 (应通过)")
    passed, reason, details = filter_v54.check(
        symbol="ETH/USDT:USDT",
        side="buy",
        spread_bps=1.5,
        volatility=0.005,
        price_age_seconds=0.5,
        price_jump_bps=2.0
    )
    print(f"   结果：{'✅ PASS' if passed else '❌ FAIL'}")
    print(f"   原因：{reason}")
    print(f"   通过检查：{len(details['filters_checked'])} 项")
    
    # 测试用例 2: Spread 过宽
    print("\n❌ 测试 2: Spread 过宽 (应拒绝)")
    passed, reason, details = filter_v54.check(
        symbol="ETH/USDT:USDT",
        side="buy",
        spread_bps=5.0,
        volatility=0.005,
        price_age_seconds=0.5,
        price_jump_bps=2.0
    )
    print(f"   结果：{'✅ PASS' if not passed else '❌ FAIL'}")
    print(f"   原因：{reason}")
    
    # 测试用例 3: 波动率过低
    print("\n❌ 测试 3: 波动率过低 (应拒绝)")
    passed, reason, details = filter_v54.check(
        symbol="ETH/USDT:USDT",
        side="buy",
        spread_bps=1.5,
        volatility=0.0003,
        price_age_seconds=0.5,
        price_jump_bps=2.0
    )
    print(f"   结果：{'✅ PASS' if not passed else '❌ FAIL'}")
    print(f"   原因：{reason}")
    
    # 测试用例 4: 价格过期
    print("\n❌ 测试 4: 价格过期 (应拒绝)")
    passed, reason, details = filter_v54.check(
        symbol="ETH/USDT:USDT",
        side="buy",
        spread_bps=1.5,
        volatility=0.005,
        price_age_seconds=5.0,
        price_jump_bps=2.0
    )
    print(f"   结果：{'✅ PASS' if not passed else '❌ FAIL'}")
    print(f"   原因：{reason}")
    
    # 测试用例 5: 市场跳变过大
    print("\n❌ 测试 5: 市场跳变过大 (应拒绝)")
    passed, reason, details = filter_v54.check(
        symbol="ETH/USDT:USDT",
        side="buy",
        spread_bps=1.5,
        volatility=0.005,
        price_age_seconds=0.5,
        price_jump_bps=15.0
    )
    print(f"   结果：{'✅ PASS' if not passed else '❌ FAIL'}")
    print(f"   原因：{reason}")
    
    print("\n" + "=" * 80)

def test_l3_scorer():
    """测试 L3 评分器"""
    print("\n" + "=" * 80)
    print("📊 测试 L3 评分器")
    print("=" * 80)
    
    scorer_v54 = SignalScorerV54()
    
    # 测试用例 1: 高置信度信号 (A 档)
    print("\n🎯 测试 1: 高置信度信号 (应进入 A 档)")
    result = scorer_v54.evaluate(
        trend_consistency=0.9,
        pullback_breakout=0.85,
        volume_confirm=0.8,
        spread_quality=0.9,
        volatility_range=0.85,
        rl_filter=0.8
    )
    print(f"   评分：{result['score']:.1f}")
    print(f"   分桶：{result['bucket']}")
    print(f"   决策：{result['action']}")
    print(f"   允许交易：{result['allow_trade']}")
    
    # 测试用例 2: 正常信号 (B 档)
    print("\n🎯 测试 2: 正常信号 (应进入 B 档)")
    result = scorer_v54.evaluate(
        trend_consistency=0.7,
        pullback_breakout=0.65,
        volume_confirm=0.7,
        spread_quality=0.75,
        volatility_range=0.7,
        rl_filter=0.65
    )
    print(f"   评分：{result['score']:.1f}")
    print(f"   分桶：{result['bucket']}")
    print(f"   决策：{result['action']}")
    print(f"   允许交易：{result['allow_trade']}")
    
    # 测试用例 3: 低质量信号 (C 档 - 仅记录)
    print("\n🎯 测试 3: 低质量信号 (应进入 C 档)")
    result = scorer_v54.evaluate(
        trend_consistency=0.5,
        pullback_breakout=0.45,
        volume_confirm=0.5,
        spread_quality=0.55,
        volatility_range=0.5,
        rl_filter=0.45
    )
    print(f"   评分：{result['score']:.1f}")
    print(f"   分桶：{result['bucket']}")
    print(f"   决策：{result['action']}")
    print(f"   允许交易：{result['allow_trade']}")
    
    # 测试用例 4: 垃圾信号 (D 档 - 丢弃)
    print("\n🎯 测试 4: 垃圾信号 (应进入 D 档)")
    result = scorer_v54.evaluate(
        trend_consistency=0.3,
        pullback_breakout=0.25,
        volume_confirm=0.3,
        spread_quality=0.35,
        volatility_range=0.3,
        rl_filter=0.25
    )
    print(f"   评分：{result['score']:.1f}")
    print(f"   分桶：{result['bucket']}")
    print(f"   决策：{result['action']}")
    print(f"   允许交易：{result['allow_trade']}")
    
    print("\n" + "=" * 80)

def test_state_store_audit_fields():
    """测试 StateStore 审计字段"""
    print("\n" + "=" * 80)
    print("💾 测试 StateStore 审计字段")
    print("=" * 80)
    
    ss = get_state_store()
    
    # 模拟记录一笔完整交易 (带审计字段)
    print("\n📝 记录测试交易...")
    ss.record_trade(
        entry_price=2071.69,
        exit_price=2076.45,
        pnl=0.0014,
        exit_source="TIME_EXIT",
        position_size=0.14,
        stop_ok=True,
        stop_verified=True,
        signal_score=72.4,
        signal_type="trend_pullback_breakout_long",
        trend_alignment=0.81,
        spread_bps=1.8,
        volatility_regime="low_normal",
        cooldown_reason="none",
        signal_bucket="B"
    )
    print("   ✅ 交易已记录")
    
    # 验证字段
    print("\n🔍 验证审计字段...")
    last_trade = ss.get_last_trade()
    
    required_fields = [
        "signal_score",
        "signal_type",
        "trend_alignment",
        "spread_bps",
        "volatility_regime",
        "cooldown_reason",
        "signal_bucket"
    ]
    
    all_present = True
    for field in required_fields:
        value = last_trade.get(field)
        present = value is not None
        all_present = all_present and present
        print(f"   {'✅' if present else '❌'} {field}: {value}")
    
    print(f"\n   审计字段完整性：{'✅ 通过' if all_present else '❌ 失败'}")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    print("\n🧪 V5.4.1 信号层测试\n")
    
    test_l2_hard_filters()
    test_l3_scorer()
    test_state_store_audit_fields()
    
    print("\n✅ 所有测试完成\n")
