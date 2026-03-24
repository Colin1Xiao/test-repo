#!/usr/bin/env python3
"""
Stop Loss & Take Profit Calculator
止损止盈价格计算器
"""

import argparse
import json
import sys


def calculate_stoploss(entry_price, stop_loss_pct, take_profit_pct=None, side='long'):
    """
    计算止损止盈价格
    
    Args:
        entry_price: 入场价格
        stop_loss_pct: 止损幅度 (%)
        take_profit_pct: 止盈幅度 (%)
        side: 'long' 或 'short'
    
    Returns:
        dict: 止损止盈信息
    """
    if side == 'long':
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        tp_price = entry_price * (1 + take_profit_pct / 100) if take_profit_pct else None
    else:  # short
        stop_price = entry_price * (1 + stop_loss_pct / 100)
        tp_price = entry_price * (1 - take_profit_pct / 100) if take_profit_pct else None
    
    result = {
        'side': side,
        'entry_price': entry_price,
        'stop_loss_pct': stop_loss_pct,
        'stop_price': stop_price,
        'stop_loss_amount': abs(entry_price - stop_price)
    }
    
    if take_profit_pct:
        result['take_profit_pct'] = take_profit_pct
        result['take_profit_price'] = tp_price
        result['take_profit_amount'] = abs(tp_price - entry_price)
        result['risk_reward_ratio'] = take_profit_pct / stop_loss_pct
    
    return result


def calculate_trailing_stop(entry_price, trailing_pct, side='long'):
    """计算追踪止损"""
    if side == 'long':
        initial_stop = entry_price * (1 - trailing_pct / 100)
    else:
        initial_stop = entry_price * (1 + trailing_pct / 100)
    
    return {
        'side': side,
        'entry_price': entry_price,
        'trailing_pct': trailing_pct,
        'initial_stop': initial_stop,
        'description': '价格每上涨 1%，止损线上移 1%'
    }


def main():
    parser = argparse.ArgumentParser(description="止损止盈计算器")
    parser.add_argument("--entry", type=float, required=True, help="入场价格")
    parser.add_argument("--stop-loss", type=float, required=True, help="止损幅度 (%)")
    parser.add_argument("--take-profit", type=float, help="止盈幅度 (%)")
    parser.add_argument("--trailing", type=float, help="追踪止损 (%)")
    parser.add_argument("--side", default='long', choices=['long', 'short'], help="方向")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    # 基础止损止盈
    result = calculate_stoploss(
        args.entry,
        args.stop_loss,
        args.take_profit,
        args.side
    )
    
    # 追踪止损
    trailing_result = None
    if args.trailing:
        trailing_result = calculate_trailing_stop(args.entry, args.trailing, args.side)
    
    if args.json:
        output = {'stop_loss': result}
        if trailing_result:
            output['trailing_stop'] = trailing_result
        print(json.dumps(output, indent=2))
    else:
        direction = "做多" if args.side == 'long' else "做空"
        print(f"\n{'='*60}")
        print(f"📊 {direction} 止损止盈计算")
        print(f"{'='*60}")
        print(f"入场价格：{result['entry_price']:.2f}")
        print(f"{'='*60}")
        print(f"🛑 止损:")
        print(f"   幅度：{result['stop_loss_pct']}%")
        print(f"   价格：{result['stop_price']:.2f}")
        print(f"   差额：{result['stop_loss_amount']:.2f}")
        
        if 'take_profit_price' in result:
            print(f"\n✅ 止盈:")
            print(f"   幅度：{result['take_profit_pct']}%")
            print(f"   价格：{result['take_profit_price']:.2f}")
            print(f"   差额：{result['take_profit_amount']:.2f}")
            print(f"\n📈 盈亏比：{result['risk_reward_ratio']:.1f}:1")
            
            if result['risk_reward_ratio'] < 2:
                print(f"\n⚠️  盈亏比低于 2:1，建议调整")
        
        if trailing_result:
            print(f"\n🔁 追踪止损:")
            print(f"   幅度：{trailing_result['trailing_pct']}%")
            print(f"   初始止损：{trailing_result['initial_stop']:.2f}")
            print(f"   {trailing_result['description']}")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
