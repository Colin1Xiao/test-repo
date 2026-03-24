#!/usr/bin/env python3
"""
Stop Loss Manager
专业止损管理器

支持多种止损策略：
- 固定百分比止损
- ATR 动态止损
- 支撑/阻力位止损
- 时间止损
- 移动止损（追踪止损）
- 分级止损（部分平仓）
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
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


def calculate_atr(df, length=14):
    """计算 ATR"""
    high = df['high']
    low = df['low']
    close = df['close']
    
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=length).mean()
    
    return atr


def find_support_resistance(df, window=20):
    """
    寻找支撑位和阻力位
    
    Returns:
        dict: 支撑位和阻力位
    """
    highs = df['high'].rolling(window=window).max().dropna()
    lows = df['low'].rolling(window=window).min().dropna()
    
    # 最近的关键位
    recent_high = highs.iloc[-5:].max()
    recent_low = lows.iloc[-5:].min()
    
    return {
        'resistance': recent_high,
        'support': recent_low,
        'mid': (recent_high + recent_low) / 2
    }


def calculate_stoploss(entry_price, side='long', method='fixed', params=None, df=None):
    """
    计算止损价格
    
    Args:
        entry_price: 入场价格
        side: 'long' 或 'short'
        method: 止损方法
        params: 参数
        df: K 线数据（某些方法需要）
    
    Returns:
        dict: 止损信息
    """
    if params is None:
        params = {}
    
    result = {
        'method': method,
        'side': side,
        'entry_price': entry_price,
        'stop_price': 0,
        'stop_pct': 0,
        'description': ''
    }
    
    if method == 'fixed':
        # 固定百分比止损
        stop_pct = params.get('stop_pct', 0.02)
        if side == 'long':
            result['stop_price'] = entry_price * (1 - stop_pct)
        else:
            result['stop_price'] = entry_price * (1 + stop_pct)
        result['stop_pct'] = stop_pct * 100
        result['description'] = f'固定 {stop_pct*100:.1f}% 止损'
    
    elif method == 'atr':
        # ATR 动态止损
        if df is None:
            raise ValueError("ATR 止损需要 K 线数据")
        
        atr = calculate_atr(df, 14)
        atr_value = atr.iloc[-1]
        multiplier = params.get('multiplier', 2.0)
        
        if side == 'long':
            result['stop_price'] = entry_price - (atr_value * multiplier)
        else:
            result['stop_price'] = entry_price + (atr_value * multiplier)
        
        result['stop_pct'] = abs(entry_price - result['stop_price']) / entry_price * 100
        result['description'] = f'ATR({multiplier}x) 止损 - ATR={atr_value:.2f}'
    
    elif method == 'support_resistance':
        # 支撑/阻力位止损
        if df is None:
            raise ValueError("支撑阻力止损需要 K 线数据")
        
        sr = find_support_resistance(df)
        
        if side == 'long':
            # 做多：止损设在支撑位下方
            buffer = params.get('buffer', 0.005)  # 0.5% 缓冲
            result['stop_price'] = sr['support'] * (1 - buffer)
        else:
            # 做空：止损设在阻力位上方
            buffer = params.get('buffer', 0.005)
            result['stop_price'] = sr['resistance'] * (1 + buffer)
        
        result['stop_pct'] = abs(entry_price - result['stop_price']) / entry_price * 100
        result['description'] = f'支撑阻力位止损 (支撑：{sr["support"]:.2f}, 阻力：{sr["resistance"]:.2f})'
    
    elif method == 'time':
        # 时间止损
        hold_hours = params.get('hold_hours', 4)
        expected_move = params.get('expected_move', 0.02)
        
        # 时间止损不直接给出价格，而是给出条件
        result['stop_price'] = entry_price * (1 - expected_move) if side == 'long' else entry_price * (1 + expected_move)
        result['stop_pct'] = expected_move * 100
        result['description'] = f'时间止损：{hold_hours}小时内无{expected_move*100:.0f}%盈利则平仓'
        result['hold_hours'] = hold_hours
    
    elif method == 'trailing':
        # 移动止损（追踪止损）
        current_price = params.get('current_price', entry_price)
        trailing_pct = params.get('trailing_pct', 0.02)
        
        if side == 'long':
            profit_pct = (current_price - entry_price) / entry_price
            result['stop_price'] = current_price * (1 - trailing_pct)
            # 止损只上移
            min_stop = entry_price * (1 - trailing_pct * 0.5)
            result['stop_price'] = max(result['stop_price'], min_stop)
        else:
            profit_pct = (entry_price - current_price) / entry_price
            result['stop_price'] = current_price * (1 + trailing_pct)
            min_stop = entry_price * (1 + trailing_pct * 0.5)
            result['stop_price'] = min(result['stop_price'], min_stop)
        
        result['stop_pct'] = abs(entry_price - result['stop_price']) / entry_price * 100
        result['description'] = f'追踪止损 ({trailing_pct*100:.1f}%) - 当前盈利 {profit_pct*100:.1f}%'
    
    elif method == 'tiered':
        # 分级止损（部分平仓）
        tiers = params.get('tiers', [
            {'pct': 0.01, 'close_pct': 0.3},  # 亏 1% 平 30%
            {'pct': 0.02, 'close_pct': 0.5},  # 亏 2% 平 50%
            {'pct': 0.03, 'close_pct': 0.2},  # 亏 3% 平 20%
        ])
        
        result['tiers'] = []
        for tier in tiers:
            if side == 'long':
                stop_price = entry_price * (1 - tier['pct'])
            else:
                stop_price = entry_price * (1 + tier['pct'])
            
            result['tiers'].append({
                'stop_price': stop_price,
                'stop_pct': tier['pct'] * 100,
                'close_pct': tier['close_pct'] * 100,
                'description': f'亏 {tier["pct"]*100:.1f}% 平 {tier["close_pct"]*100:.0f}%'
            })
        
        result['stop_price'] = result['tiers'][0]['stop_price']
        result['stop_pct'] = result['tiers'][0]['stop_pct']
        result['description'] = f'分级止损 ({len(tiers)}级)'
    
    return result


def compare_stoploss_methods(entry_price, side, df):
    """
    比较不同止损方法
    
    Returns:
        list: 各方法的止损结果
    """
    methods = [
        {'method': 'fixed', 'params': {'stop_pct': 0.02}},
        {'method': 'atr', 'params': {'multiplier': 2.0}},
        {'method': 'atr', 'params': {'multiplier': 2.5}},
        {'method': 'atr', 'params': {'multiplier': 3.0}},
        {'method': 'support_resistance', 'params': {'buffer': 0.005}},
        {'method': 'trailing', 'params': {'current_price': entry_price * 1.02, 'trailing_pct': 0.02}},
        {'method': 'tiered', 'params': {}},
    ]
    
    results = []
    for m in methods:
        try:
            result = calculate_stoploss(entry_price, side, m['method'], m['params'], df)
            results.append(result)
        except Exception as e:
            results.append({
                'method': m['method'],
                'error': str(e)
            })
    
    return results


def main():
    parser = argparse.ArgumentParser(description="专业止损管理器")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="5m", help="时间框架")
    parser.add_argument("--entry", type=float, required=True, help="入场价格")
    parser.add_argument("--side", default='long', choices=['long', 'short'], help="方向")
    parser.add_argument("--method", default='compare', 
                       choices=['fixed', 'atr', 'support_resistance', 'time', 'trailing', 'tiered', 'compare'],
                       help="止损方法")
    parser.add_argument("--stop-pct", type=float, default=2.0, help="固定止损百分比")
    parser.add_argument("--atr-multiplier", type=float, default=2.0, help="ATR 倍数")
    parser.add_argument("--trailing-pct", type=float, default=2.0, help="追踪止损百分比")
    parser.add_argument("--current", type=float, help="当前价格（用于追踪止损）")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"🛑 止损管理器 - {args.symbol}")
    print(f"{'='*60}")
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
        current_price = args.current if args.current else df.iloc[-1]['close']
    except Exception as e:
        print(f"错误：获取数据失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 计算止损
    if args.method == 'compare':
        results = compare_stoploss_methods(args.entry, args.side, df)
        
        if args.json:
            print(json.dumps({
                'timestamp': datetime.now().isoformat(),
                'symbol': args.symbol,
                'entry_price': args.entry,
                'side': args.side,
                'current_price': current_price,
                'methods': results
            }, indent=2, ensure_ascii=False))
        else:
            print(f"\n入场价格：{args.entry:.2f} ({args.side})")
            print(f"当前价格：{current_price:.2f}")
            print(f"{'='*60}")
            print(f"\n不同止损方法对比:")
            print(f"{'-'*60}")
            print(f"{'方法':<20} {'止损价':>12} {'止损幅度':>10} {'说明':>20}")
            print(f"{'-'*60}")
            
            for r in results:
                if 'error' in r:
                    print(f"{r['method']:<20} {'错误':>12} {'-':>10} {r['error'][:20]:>20}")
                else:
                    print(f"{r['method']:<20} {r['stop_price']:>12.2f} {r['stop_pct']:>9.2f}% {r['description'][:20]:>20}")
            
            # 推荐
            print(f"\n💡 推荐:")
            # 根据波动率推荐
            atr = calculate_atr(df, 14).iloc[-1]
            atr_pct = atr / args.entry * 100
            
            if atr_pct < 1:
                print(f"   低波动：使用固定止损 (2-2.5%) 或 ATR(2x)")
            elif atr_pct < 2:
                print(f"   中等波动：使用 ATR(2.5-3x) 或支撑阻力位")
            else:
                print(f"   高波动：使用 ATR(3x+) 或分级止损")
            
            print(f"\n   当前 ATR: {atr:.2f} ({atr_pct:.2f}%)")
    
    else:
        params = {
            'stop_pct': args.stop_pct / 100,
            'multiplier': args.atr_multiplier,
            'trailing_pct': args.trailing_pct / 100,
            'current_price': args.current if args.current else current_price,
        }
        
        result = calculate_stoploss(args.entry, args.side, args.method, params, df)
        
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"\n入场价格：{args.entry:.2f} ({args.side})")
            print(f"当前价格：{current_price:.2f}")
            print(f"{'='*60}")
            print(f"\n止损信息:")
            print(f"   方法：{result['method']}")
            print(f"   止损价格：{result['stop_price']:.2f}")
            print(f"   止损幅度：{result['stop_pct']:.2f}%")
            print(f"   说明：{result['description']}")
            
            if 'tiers' in result:
                print(f"\n   分级详情:")
                for tier in result['tiers']:
                    print(f"      • {tier['description']} @ {tier['stop_price']:.2f}")
            
            # 盈亏比
            if args.side == 'long':
                profit_target = args.entry * 1.04  # 4% 止盈
                loss = args.entry - result['stop_price']
                profit = profit_target - args.entry
            else:
                profit_target = args.entry * 0.96
                loss = result['stop_price'] - args.entry
                profit = args.entry - profit_target
            
            rr_ratio = profit / loss if loss > 0 else 0
            print(f"\n   盈亏比：{rr_ratio:.1f}:1 (止盈 4% / 止损{result['stop_pct']:.2f}%)")
            
            if rr_ratio < 2:
                print(f"\n⚠️  警告：盈亏比低于 2:1，建议调整止损或止盈")
        
        print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
