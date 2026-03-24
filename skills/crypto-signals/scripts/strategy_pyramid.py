#!/usr/bin/env python3
"""
Pyramid Position Building Strategy
单边行情滚仓策略（金字塔加仓）

在确认的单边行情中，通过金字塔式加仓扩大收益：
- 初始仓位：40%
- 第一次加仓：30%（盈利 2% 后）
- 第二次加仓：20%（再盈利 2% 后）
- 第三次加仓：10%（再盈利 2% 后）
- 每次加仓后上移止损
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-data' / 'scripts'))

try:
    import ccxt
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def fetch_ohlcv(symbol, timeframe='5m', limit=100):
    """获取 K 线数据"""
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df


def calculate_trend_strength(df):
    """
    计算趋势强度
    
    Returns:
        dict: 趋势信息
    """
    if len(df) < 50:
        return {'trend': 'UNKNOWN', 'strength': 0, 'signals': []}
    
    latest = df.iloc[-1]
    
    # 均线排列
    ema_9 = df['close'].ewm(span=9, adjust=False).mean().iloc[-1]
    ema_20 = df['close'].ewm(span=20, adjust=False).mean().iloc[-1]
    ema_50 = df['close'].ewm(span=50, adjust=False).mean().iloc[-1]
    
    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
    rs = gain / loss if loss != 0 else 0
    rsi = 100 - (100 / (1 + rs))
    
    # 趋势判断
    signals = []
    strength = 0
    
    # 多头排列
    if ema_9 > ema_20 > ema_50:
        signals.append('均线多头排列')
        strength += 2
        if latest['close'] > ema_9:
            signals.append('价格在 EMA9 上方')
            strength += 1
    
    # 空头排列
    elif ema_9 < ema_20 < ema_50:
        signals.append('均线空头排列')
        strength -= 2
        if latest['close'] < ema_9:
            signals.append('价格在 EMA9 下方')
            strength -= 1
    
    # RSI 强度
    if rsi > 70:
        signals.append(f'RSI 超买 ({rsi:.1f})')
        strength += 1
    elif rsi > 55:
        signals.append(f'RSI 偏强 ({rsi:.1f})')
        strength += 0.5
    elif rsi < 30:
        signals.append(f'RSI 超卖 ({rsi:.1f})')
        strength -= 1
    elif rsi < 45:
        signals.append(f'RSI 偏弱 ({rsi:.1f})')
        strength -= 0.5
    
    # 确定趋势
    if strength >= 3:
        trend = 'STRONG_BULL'
    elif strength >= 1.5:
        trend = 'BULL'
    elif strength <= -3:
        trend = 'STRONG_BEAR'
    elif strength <= -1.5:
        trend = 'BEAR'
    else:
        trend = 'SIDEWAY'
    
    return {
        'trend': trend,
        'strength': strength,
        'rsi': rsi,
        'signals': signals
    }


def calculate_pyramid_levels(base_position, total_capital):
    """
    计算金字塔加仓层级
    
    Args:
        base_position: 初始仓位 (USDT)
        total_capital: 总资金 (USDT)
    
    Returns:
        list: 加仓计划
    """
    # 金字塔比例：40% - 30% - 20% - 10%
    levels = [
        {'level': 0, 'type': 'initial', 'ratio': 0.40, 'price_offset': 0, 'stop_loss_offset': -0.02},
        {'level': 1, 'type': 'add', 'ratio': 0.30, 'price_offset': 0.02, 'stop_loss_offset': 0.01},
        {'level': 2, 'type': 'add', 'ratio': 0.20, 'price_offset': 0.04, 'stop_loss_offset': 0.02},
        {'level': 3, 'type': 'add', 'ratio': 0.10, 'price_offset': 0.06, 'stop_loss_offset': 0.03},
    ]
    
    plan = []
    for level in levels:
        position_size = total_capital * level['ratio']
        plan.append({
            'level': level['level'],
            'type': level['type'],
            'position_size': position_size,
            'price_offset_pct': level['price_offset'] * 100,
            'stop_loss_offset_pct': level['stop_loss_offset'] * 100,
            'cumulative_position': sum(total_capital * l['ratio'] for l in levels[:level['level']+1]),
            'avg_price_note': f'价格{level["price_offset"]*100:+.0f}%时执行'
        })
    
    return plan


def calculate_trailing_stop(entry_price, current_price, side='long', trailing_pct=0.02):
    """
    计算追踪止损
    
    Args:
        entry_price: 入场价格
        current_price: 当前价格
        side: 'long' 或 'short'
        trailing_pct: 追踪幅度
    
    Returns:
        float: 止损价格
    """
    if side == 'long':
        profit_pct = (current_price - entry_price) / entry_price
        stop_price = current_price * (1 - trailing_pct)
        # 止损只上移不下移
        min_stop = entry_price * (1 - 0.01)  # 最多亏 1%
        return max(stop_price, min_stop)
    else:
        profit_pct = (entry_price - current_price) / entry_price
        stop_price = current_price * (1 + trailing_pct)
        min_stop = entry_price * (1 + 0.01)
        return min(stop_price, min_stop)


def get_pyramid_recommendation(trend_info, current_level, entry_price, current_price, side='long'):
    """
    获取加仓建议
    
    Returns:
        dict: 加仓建议
    """
    recommendation = {
        'action': 'HOLD',
        'reason': '',
        'next_level_price': 0,
        'suggested_stop_loss': 0
    }
    
    # 检查趋势是否仍然有利
    if side == 'long' and trend_info['trend'] not in ['BULL', 'STRONG_BULL']:
        recommendation['action'] = 'REDUCE'
        recommendation['reason'] = f'趋势转弱 ({trend_info["trend"]})'
        return recommendation
    
    if side == 'short' and trend_info['trend'] not in ['BEAR', 'STRONG_BEAR']:
        recommendation['action'] = 'REDUCE'
        recommendation['reason'] = f'趋势转弱 ({trend_info["trend"]})'
        return recommendation
    
    # 计算当前盈利
    if side == 'long':
        profit_pct = (current_price - entry_price) / entry_price * 100
    else:
        profit_pct = (entry_price - current_price) / entry_price * 100
    
    # 加仓条件
    if current_level == 0 and profit_pct >= 2:
        recommendation['action'] = 'ADD_1'
        recommendation['reason'] = f'盈利 {profit_pct:.1f}%，执行第 1 次加仓'
        recommendation['next_level_price'] = entry_price * (1 + 0.04 if side == 'long' else 0.96)
    elif current_level == 1 and profit_pct >= 4:
        recommendation['action'] = 'ADD_2'
        recommendation['reason'] = f'盈利 {profit_pct:.1f}%，执行第 2 次加仓'
        recommendation['next_level_price'] = entry_price * (1 + 0.06 if side == 'long' else 0.94)
    elif current_level == 2 and profit_pct >= 6:
        recommendation['action'] = 'ADD_3'
        recommendation['reason'] = f'盈利 {profit_pct:.1f}%，执行第 3 次加仓'
    elif profit_pct < 0:
        recommendation['action'] = 'HOLD'
        recommendation['reason'] = f'当前亏损 {profit_pct:.1f}%，不加仓'
    else:
        recommendation['action'] = 'HOLD'
        recommendation['reason'] = f'盈利 {profit_pct:.1f}%，等待下一次加仓机会'
    
    # 计算追踪止损
    recommendation['suggested_stop_loss'] = calculate_trailing_stop(entry_price, current_price, side, 0.02)
    
    return recommendation


def main():
    parser = argparse.ArgumentParser(description="金字塔滚仓策略")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="5m", help="时间框架")
    parser.add_argument("--capital", type=float, default=10000, help="总资金 (USDT)")
    parser.add_argument("--side", default='long', choices=['long', 'short'], help="方向")
    parser.add_argument("--entry", type=float, help="初始入场价格")
    parser.add_argument("--current", type=float, help="当前价格（可选，默认使用最新价）")
    parser.add_argument("--level", type=int, default=0, help="当前加仓级别 (0-3)")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"📐 金字塔滚仓策略 - {args.symbol}")
    print(f"{'='*60}")
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
        current_price = args.current if args.current else df.iloc[-1]['close']
    except Exception as e:
        print(f"错误：获取数据失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 计算趋势
    trend_info = calculate_trend_strength(df)
    
    # 加仓计划
    pyramid_plan = calculate_pyramid_levels(args.capital * 0.4, args.capital)
    
    # 加仓建议
    if args.entry:
        recommendation = get_pyramid_recommendation(
            trend_info, 
            args.level, 
            args.entry, 
            current_price, 
            args.side
        )
    else:
        recommendation = {
            'action': 'WAIT',
            'reason': '未提供入场价格，无法计算加仓建议',
            'next_level_price': 0,
            'suggested_stop_loss': 0
        }
    
    # 输出
    if args.json:
        result = {
            'timestamp': datetime.now().isoformat(),
            'symbol': args.symbol,
            'current_price': current_price,
            'trend': trend_info,
            'pyramid_plan': pyramid_plan,
            'recommendation': recommendation
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        # 趋势信息
        trend_emoji = {
            'STRONG_BULL': '🚀', 'BULL': '📈', 'SIDEWAY': '➡️',
            'BEAR': '📉', 'STRONG_BEAR': '💥'
        }.get(trend_info['trend'], '❓')
        
        print(f"\n{trend_emoji} 趋势：{trend_info['trend']} (强度：{trend_info['strength']:.1f})")
        print(f"当前价格：{current_price:.2f}")
        print(f"RSI: {trend_info['rsi']:.1f}")
        
        if trend_info['signals']:
            print(f"信号:")
            for s in trend_info['signals'][:3]:
                print(f"   • {s}")
        
        # 金字塔计划
        print(f"\n📐 金字塔加仓计划:")
        print(f"{'='*60}")
        print(f"{'级别':<6} {'类型':<8} {'仓位':>10} {'加仓条件':>15} {'累计仓位':>10}")
        print(f"{'-'*60}")
        for level in pyramid_plan:
            type_text = '开仓' if level['type'] == 'initial' else f"+{level['type']}"
            print(f"{level['level']:<6} {type_text:<8} ${level['position_size']:>8.0f} "
                  f"{level['avg_price_note']:>15} {level['cumulative_position']:>8.0f}")
        
        # 加仓建议
        if recommendation['action'] != 'WAIT':
            print(f"\n💡 当前建议:")
            print(f"{'='*60}")
            
            action_emoji = {
                'HOLD': '⏸️', 'ADD_1': '➕', 'ADD_2': '➕', 'ADD_3': '➕',
                'REDUCE': '➖'
            }.get(recommendation['action'], '❓')
            
            print(f"{action_emoji} 动作：{recommendation['action']}")
            print(f"原因：{recommendation['reason']}")
            
            if recommendation['next_level_price'] > 0:
                print(f"下次加仓价格：{recommendation['next_level_price']:.2f}")
            
            if recommendation['suggested_stop_loss'] > 0:
                print(f"建议止损价格：{recommendation['suggested_stop_loss']:.2f}")
        
        # 风险提示
        print(f"\n⚠️  风险提示:")
        print(f"   • 只在确认的单边行情中使用")
        print(f"   • 每次加仓后必须上移止损")
        print(f"   • 趋势反转立即清仓")
        print(f"   • 总仓位不超过资金的 50%")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
