#!/usr/bin/env python3
"""
Position Size Calculator
仓位大小计算器 - 基于风险和止损
"""

import argparse
import json
import sys


def calculate_position_size(balance, risk_pct, stop_loss_pct, leverage=1):
    """
    计算仓位大小
    
    Args:
        balance: 账户余额 (USDT)
        risk_pct: 单笔风险 (%) - 愿意亏损的比例
        stop_loss_pct: 止损幅度 (%) - 价格反向波动多少止损
        leverage: 杠杆倍数
    
    Returns:
        dict: 仓位信息
    """
    # 风险金额
    risk_amount = balance * (risk_pct / 100)
    
    # 仓位大小 = 风险金额 ÷ 止损幅度
    position_size = risk_amount / (stop_loss_pct / 100)
    
    # 实际保证金
    margin = position_size / leverage
    
    # 爆仓价格估算（做多）
    liquidation_pct = 100 / leverage if leverage > 1 else 100
    
    return {
        'balance': balance,
        'risk_amount': risk_amount,
        'risk_pct': risk_pct,
        'stop_loss_pct': stop_loss_pct,
        'leverage': leverage,
        'position_size': position_size,
        'margin': margin,
        'margin_pct': (margin / balance) * 100,
        'liquidation_pct': liquidation_pct
    }


def main():
    parser = argparse.ArgumentParser(description="仓位大小计算器")
    parser.add_argument("--balance", type=float, required=True, help="账户余额 (USDT)")
    parser.add_argument("--risk", type=float, default=2.0, help="单笔风险 (%)")
    parser.add_argument("--stop-loss", type=float, required=True, help="止损幅度 (%)")
    parser.add_argument("--leverage", type=int, default=1, help="杠杆倍数")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    result = calculate_position_size(
        args.balance,
        args.risk,
        args.stop_loss,
        args.leverage
    )
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"📊 仓位计算结果")
        print(f"{'='*60}")
        print(f"账户余额：     {result['balance']:,.2f} USDT")
        print(f"单笔风险：     {result['risk_pct']}% ({result['risk_amount']:,.2f} USDT)")
        print(f"止损幅度：     {result['stop_loss_pct']}%")
        print(f"杠杆倍数：     {result['leverage']}x")
        print(f"{'='*60}")
        print(f"开仓大小：     {result['position_size']:,.2f} USDT")
        print(f"需要保证金：   {result['margin']:,.2f} USDT ({result['margin_pct']:.1f}% 仓位)")
        print(f"爆仓幅度：     {result['liquidation_pct']:.1f}%")
        print(f"{'='*60}")
        
        # 风险警告
        if args.leverage >= 50:
            print(f"\n⚠️  高风险警告：{args.leverage}倍杠杆极易爆仓！")
            print(f"   价格反向波动 {result['liquidation_pct']:.1f}% 就会爆仓")
        
        if result['margin_pct'] > 50:
            print(f"\n⚠️  仓位过重：使用 {result['margin_pct']:.0f}% 资金")
            print(f"   建议 ≤30%")
        
        # 示例
        print(f"\n📈 交易示例:")
        entry_price = 68500  # 假设入场价
        position_units = result['position_size'] / entry_price
        stop_price_long = entry_price * (1 - args.stop_loss / 100)
        take_profit_long = entry_price * (1 + args.stop_loss * 2 / 100)
        
        print(f"   入场价：{entry_price:.2f}")
        print(f"   仓位：{position_units:.4f} BTC")
        print(f"   止损价：{stop_price_long:.2f} (-{args.stop_loss}%)")
        print(f"   止盈价：{take_profit_long:.2f} (+{args.stop_loss*2}%)")
        print(f"   盈亏比：2:1")
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
