#!/usr/bin/env python3
"""
Risk Assessment Checker
风险评估检查器
"""

import argparse
import json
import sys


def assess_risk(position_size, leverage, balance, side='long'):
    """
    评估仓位风险
    
    Args:
        position_size: 仓位大小 (USDT)
        leverage: 杠杆倍数
        balance: 账户余额 (USDT)
        side: 'long' 或 'short'
    
    Returns:
        dict: 风险评估结果
    """
    margin = position_size / leverage
    margin_pct = (margin / balance) * 100
    
    # 爆仓幅度
    liquidation_pct = 100 / leverage
    
    # 风险等级
    if leverage >= 100:
        risk_level = "EXTREME"
        risk_emoji = "💀"
    elif leverage >= 50:
        risk_level = "VERY_HIGH"
        risk_emoji = "🔴"
    elif leverage >= 20:
        risk_level = "HIGH"
        risk_emoji = "🟠"
    elif leverage >= 10:
        risk_level = "MEDIUM"
        risk_emoji = "🟡"
    else:
        risk_level = "LOW"
        risk_emoji = "🟢"
    
    # 仓位风险
    if margin_pct > 80:
        position_risk = "危险 - 几乎满仓"
    elif margin_pct > 50:
        position_risk = "高风险 - 仓位过重"
    elif margin_pct > 30:
        position_risk = "中等 - 注意补仓"
    else:
        position_risk = "安全"
    
    # 建议
    suggestions = []
    if leverage >= 50:
        suggestions.append("⚠️  建议降低杠杆至 20-50 倍")
    if margin_pct > 50:
        suggestions.append("⚠️  建议降低仓位至 30% 以下")
    if margin_pct < 10:
        suggestions.append("💡  可适当增加仓位")
    
    return {
        'position_size': position_size,
        'leverage': leverage,
        'balance': balance,
        'margin': margin,
        'margin_pct': margin_pct,
        'liquidation_pct': liquidation_pct,
        'risk_level': risk_level,
        'risk_emoji': risk_emoji,
        'position_risk': position_risk,
        'suggestions': suggestions
    }


def main():
    parser = argparse.ArgumentParser(description="风险评估检查器")
    parser.add_argument("--position", type=float, required=True, help="仓位大小 (USDT)")
    parser.add_argument("--leverage", type=int, required=True, help="杠杆倍数")
    parser.add_argument("--balance", type=float, required=True, help="账户余额 (USDT)")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    result = assess_risk(args.position, args.leverage, args.balance)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"{result['risk_emoji']} 风险评估报告")
        print(f"{'='*60}")
        print(f"仓位大小：   {result['position_size']:,.2f} USDT")
        print(f"杠杆倍数：   {result['leverage']}x")
        print(f"账户余额：   {result['balance']:,.2f} USDT")
        print(f"{'='*60}")
        print(f"保证金：     {result['margin']:,.2f} USDT ({result['margin_pct']:.1f}%)")
        print(f"爆仓幅度：   {result['liquidation_pct']:.2f}%")
        print(f"风险等级：   {result['risk_level']}")
        print(f"仓位风险：   {result['position_risk']}")
        print(f"{'='*60}")
        
        if result['suggestions']:
            print(f"\n📋 建议:")
            for s in result['suggestions']:
                print(f"   {s}")
        
        # 爆仓情景模拟
        print(f"\n💥 爆仓情景:")
        print(f"   价格反向波动 {result['liquidation_pct']:.2f}% → 爆仓")
        print(f"   例如：100 倍杠杆，波动 1% 就爆仓")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
