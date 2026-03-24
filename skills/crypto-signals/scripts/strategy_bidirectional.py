#!/usr/bin/env python3
"""
Bidirectional Trading Strategy
双向交易策略 - 做多 + 做空 + 精确买卖点

核心优化:
1. 精确买入时机（多指标共振 + 动量确认）
2. 精确卖出时机（盈利目标 + 动量衰竭 + 追踪止损）
3. 双向交易（做多/做空自动判断）
4. 大波动标的筛选（高波动率币种）
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


# 大波动标的列表（高波动率币种）
HIGH_VOLATILITY_SYMBOLS = [
    'BTC/USDT',      # 比特币 - 流动性最好
    'ETH/USDT',      # 以太坊
    'SOL/USDT',      # Solana - 高波动
    'AVAX/USDT',     # Avalanche
    'MATIC/USDT',    # Polygon
    'DOGE/USDT',     # 狗狗币 - 高波动
    'ADA/USDT',      # 卡尔达诺
    'DOT/USDT',      # 波卡
    'LINK/USDT',     # Chainlink
    'UNI/USDT',      # Uniswap
]


def fetch_ohlcv(symbol, timeframe='1m', limit=100):
    """获取 K 线数据"""
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df


def calculate_volatility_rank(symbol, period=7):
    """
    计算波动率排名
    
    Returns:
        float: 相对波动率（1.0=平均，>1.5=高波动）
    """
    try:
        # 获取日线数据
        exchange = ccxt.okx({'options': {'defaultType': 'future'}})
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe='1d', limit=period)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # 计算日均波动率
        daily_range = (df['high'] - df['low']) / df['open']
        avg_volatility = daily_range.mean()
        
        # BTC 作为基准（约 2-3% 日均波动）
        btc_benchmark = 0.025
        
        relative_volatility = avg_volatility / btc_benchmark
        return relative_volatility
    except:
        return 1.0


def calculate_indicators(df):
    """计算高级指标"""
    result = df.copy()
    
    # === 趋势指标 ===
    result['ema_5'] = result['close'].ewm(span=5, adjust=False).mean()
    result['ema_9'] = result['close'].ewm(span=9, adjust=False).mean()
    result['ema_20'] = result['close'].ewm(span=20, adjust=False).mean()
    result['ema_50'] = result['close'].ewm(span=50, adjust=False).mean()
    
    # === 动量指标 ===
    # RSI (7 周期，敏感)
    delta = result['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=7).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=7).mean()
    rs = gain / loss
    result['rsi_7'] = 100 - (100 / (1 + rs))
    
    # RSI (14 周期，标准)
    result['rsi_14'] = 100 - (100 / (1 + (gain.rolling(window=14).mean() / (-loss.rolling(window=14).mean()))))
    
    # 随机指标
    lowest_low = result['low'].rolling(window=14).min()
    highest_high = result['high'].rolling(window=14).max()
    result['stoch_k'] = 100 * (result['close'] - lowest_low) / (highest_high - lowest_low)
    result['stoch_d'] = result['stoch_k'].rolling(window=3).mean()
    
    # === 波动率指标 ===
    high = result['high']
    low = result['low']
    close = result['close']
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    result['atr_14'] = tr.rolling(window=14).mean()
    result['volatility'] = result['atr_14'] / result['close']
    
    # === 成交量指标 ===
    result['volume_ma'] = result['volume'].rolling(window=20).mean()
    result['volume_ratio'] = result['volume'] / result['volume_ma']
    
    # === MACD ===
    ema_12 = result['close'].ewm(span=12, adjust=False).mean()
    ema_26 = result['close'].ewm(span=26, adjust=False).mean()
    result['macd'] = ema_12 - ema_26
    result['macd_signal'] = result['macd'].ewm(span=9, adjust=False).mean()
    result['macd_hist'] = result['macd'] - result['macd_signal']
    
    # === 动量强度 ===
    result['momentum_3'] = result['close'].pct_change(periods=3) * 100
    result['momentum_5'] = result['close'].pct_change(periods=5) * 100
    
    return result


def find_optimal_entry(df, side='long', volume_price_score=0):
    """
    寻找最佳入场时机
    
    Args:
        df: K 线数据
        side: 'long' 或 'short'
        volume_price_score: 量价分析评分 (-5 to +5)
    
    Returns:
        dict: 入场信号
    """
    if len(df) < 30:
        return {'entry': False, 'reason': '数据不足'}
    
    last = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]
    
    signal = {
        'entry': False,
        'side': side,
        'reason': [],
        'confidence': 0.0,
        'suggested_leverage': 30,
        'stop_loss': 0.5,
        'take_profit': 1.0
    }
    
    # 量价关系权重 60%，其他指标 40%
    score = volume_price_score * 0.6
    max_score = 15
    
    if side == 'long':
        # === 做多条件 ===
        
        # 1. 趋势确认（4 分）
        if last['ema_5'] > last['ema_9'] > last['ema_20']:
            score += 3
            signal['reason'].append('EMA 多头排列')
            if last['close'] > last['ema_5']:
                score += 1
                signal['reason'].append('价格>EMA5')
        
        # 2. RSI 超卖反弹（3 分）
        if last['rsi_7'] < 30:
            score += 3
            signal['reason'].append(f'RSI 超卖 ({last["rsi_7"]:.1f})')
        elif last['rsi_7'] < 40 and prev['rsi_7'] < last['rsi_7']:
            score += 2
            signal['reason'].append(f'RSI 反弹 ({last["rsi_7"]:.1f})')
        
        # 3. KDJ 金叉（2 分）
        if last['stoch_k'] > last['stoch_d']:
            score += 1
            signal['reason'].append('KDJ 金叉')
            if prev['stoch_k'] <= prev['stoch_d']:
                score += 1
                signal['reason'].append('刚金叉')
        
        # 4. MACD 金叉（2 分）
        if last['macd'] > last['macd_signal']:
            score += 1
            signal['reason'].append('MACD 金叉')
            if prev['macd'] <= prev['macd_signal']:
                score += 1
                signal['reason'].append('刚金叉')
        
        # 5. 成交量放大（2 分）
        if last['volume_ratio'] > 1.5:
            score += 2
            signal['reason'].append(f'放量 {last["volume_ratio"]:.1f}x')
        elif last['volume_ratio'] > 1.2:
            score += 1
            signal['reason'].append(f'放量 {last["volume_ratio"]:.1f}x')
        
        # 6. 动量确认（2 分）
        if last['momentum_3'] > 0.3:
            score += 1
            signal['reason'].append(f'动量 +{last["momentum_3"]:.2f}%')
        if last['momentum_5'] > 0.5:
            score += 1
            signal['reason'].append(f'强动量 +{last["momentum_5"]:.2f}%')
    
    else:  # short
        # === 做空条件 ===
        
        # 1. 趋势确认（4 分）
        if last['ema_5'] < last['ema_9'] < last['ema_20']:
            score += 3
            signal['reason'].append('EMA 空头排列')
            if last['close'] < last['ema_5']:
                score += 1
                signal['reason'].append('价格<EMA5')
        
        # 2. RSI 超买回调（3 分）
        if last['rsi_7'] > 70:
            score += 3
            signal['reason'].append(f'RSI 超买 ({last["rsi_7"]:.1f})')
        elif last['rsi_7'] > 60 and prev['rsi_7'] > last['rsi_7']:
            score += 2
            signal['reason'].append(f'RSI 回调 ({last["rsi_7"]:.1f})')
        
        # 3. KDJ 死叉（2 分）
        if last['stoch_k'] < last['stoch_d']:
            score += 1
            signal['reason'].append('KDJ 死叉')
            if prev['stoch_k'] >= prev['stoch_d']:
                score += 1
                signal['reason'].append('刚死叉')
        
        # 4. MACD 死叉（2 分）
        if last['macd'] < last['macd_signal']:
            score += 1
            signal['reason'].append('MACD 死叉')
            if prev['macd'] >= prev['macd_signal']:
                score += 1
                signal['reason'].append('刚死叉')
        
        # 5. 成交量放大（2 分）
        if last['volume_ratio'] > 1.5:
            score += 2
            signal['reason'].append(f'放量 {last["volume_ratio"]:.1f}x')
        
        # 6. 动量确认（2 分）
        if last['momentum_3'] < -0.3:
            score += 1
            signal['reason'].append(f'动量 {last["momentum_3"]:.2f}%')
        if last['momentum_5'] < -0.5:
            score += 1
            signal['reason'].append(f'强动量 {last["momentum_5"]:.2f}%')
    
    # === 确定信号 ===
    threshold = 9  # 高置信度门槛
    
    if score >= threshold:
        signal['entry'] = True
        signal['confidence'] = min(score / max_score, 0.95)
        
        # 根据置信度调整杠杆
        if score >= 12:
            signal['suggested_leverage'] = 50
            signal['take_profit'] = 1.2
        elif score >= 10:
            signal['suggested_leverage'] = 40
            signal['take_profit'] = 1.0
        else:
            signal['suggested_leverage'] = 30
            signal['take_profit'] = 0.8
        
        # 根据波动率调整止损
        if 'volatility' in last and last['volatility'] > 0.03:
            signal['stop_loss'] = 0.7  # 高波动放宽止损
        else:
            signal['stop_loss'] = 0.5
    
    return signal


def find_optimal_exit(df, position, current_price):
    """
    寻找最佳出场时机
    
    Args:
        position: 持仓信息 {'entry_price': float, 'side': 'long/short', 'leverage': int}
        current_price: 当前价格
    
    Returns:
        dict: 出场信号
    """
    if len(df) < 10:
        return {'exit': False, 'reason': '数据不足'}
    
    last = df.iloc[-1]
    prev = df.iloc[-2]
    
    # 计算当前盈亏
    if position['side'] == 'long':
        pnl_pct = (current_price - position['entry_price']) / position['entry_price'] * 100
    else:
        pnl_pct = (position['entry_price'] - current_price) / position['entry_price'] * 100
    
    pnl_with_leverage = pnl_pct * position['leverage']
    
    signal = {
        'exit': False,
        'reason': [],
        'exit_type': None,
        'pnl_pct': pnl_pct,
        'pnl_with_leverage': pnl_with_leverage
    }
    
    # === 止盈条件 ===
    
    # 1. 达到目标盈利
    if position['side'] == 'long':
        target_reached = current_price >= position['entry_price'] * (1 + position['take_profit'] / 100)
    else:
        target_reached = current_price <= position['entry_price'] * (1 - position['take_profit'] / 100)
    
    if target_reached and pnl_with_leverage >= 30:
        signal['exit'] = True
        signal['exit_type'] = 'TAKE_PROFIT'
        signal['reason'].append(f'达到止盈目标 (+{pnl_with_leverage:.1f}%)')
    
    # 2. 动量衰竭（盈利回撤）
    if pnl_with_leverage > 20:  # 曾经盈利>20%
        if position['side'] == 'long':
            # 价格从高点回撤
            recent_high = df['high'].iloc[-10:].max()
            pullback = (recent_high - current_price) / recent_high * 100
            if pullback > 0.5:
                signal['exit'] = True
                signal['exit_type'] = 'PULLBACK'
                signal['reason'].append(f'从高点回撤 {pullback:.2f}%')
        else:
            recent_low = df['low'].iloc[-10:].min()
            pullback = (current_price - recent_low) / recent_low * 100
            if pullback > 0.5:
                signal['exit'] = True
                signal['exit_type'] = 'PULLBACK'
                signal['reason'].append(f'从低点反弹 {pullback:.2f}%')
    
    # 3. RSI 极端（反向信号）
    if position['side'] == 'long':
        if last['rsi_7'] > 75:
            signal['exit'] = True
            signal['exit_type'] = 'RSI_OVERBOUGHT'
            signal['reason'].append(f'RSI 超买 ({last["rsi_7"]:.1f})')
    else:
        if last['rsi_7'] < 25:
            signal['exit'] = True
            signal['exit_type'] = 'RSI_OVERSOLD'
            signal['reason'].append(f'RSI 超卖 ({last["rsi_7"]:.1f})')
    
    # 4. MACD 反向交叉
    if position['side'] == 'long':
        if prev['macd'] > prev['macd_signal'] and last['macd'] <= last['macd_signal']:
            signal['exit'] = True
            signal['exit_type'] = 'MACD_CROSSDOWN'
            signal['reason'].append('MACD 死叉')
    else:
        if prev['macd'] < prev['macd_signal'] and last['macd'] >= last['macd_signal']:
            signal['exit'] = True
            signal['exit_type'] = 'MACD_CROSSUP'
            signal['reason'].append('MACD 金叉')
    
    # === 止损条件 ===
    
    # 5. 硬止损
    if position['side'] == 'long':
        stop_triggered = current_price <= position['entry_price'] * (1 - position['stop_loss'] / 100)
    else:
        stop_triggered = current_price >= position['entry_price'] * (1 + position['stop_loss'] / 100)
    
    if stop_triggered:
        signal['exit'] = True
        signal['exit_type'] = 'STOP_LOSS'
        signal['reason'].append(f'触发止损 ({-position["stop_loss"]:.1f}%)')
    
    # 6. 时间止损（持仓>30 分钟无盈利）
    # 这里简化处理，实际需要根据时间判断
    
    return signal


def scan_high_volatility_symbols(timeframe='1m'):
    """扫描高波动率标的"""
    print("\n🔍 扫描高波动率标的...")
    print("="*70)
    
    results = []
    
    for symbol in HIGH_VOLATILITY_SYMBOLS[:5]:  # 只检查前 5 个
        try:
            vol_rank = calculate_volatility_rank(symbol)
            df = fetch_ohlcv(symbol, timeframe, limit=50)
            df = calculate_indicators(df)
            
            # 计算当前波动
            recent_volatility = df['volatility'].iloc[-1] * 100
            
            results.append({
                'symbol': symbol,
                'volatility_rank': vol_rank,
                'current_volatility': recent_volatility,
                'price': df['close'].iloc[-1]
            })
        except Exception as e:
            continue
    
    # 按波动率排序
    results.sort(key=lambda x: x['current_volatility'], reverse=True)
    
    print(f"{'标的':<15} {'相对波动':>10} {'当前波动':>10} {'价格':>12}")
    print("-"*70)
    for r in results:
        print(f"{r['symbol']:<15} {r['volatility_rank']:>10.2f}x {r['current_volatility']:>9.2f}% ${r['price']:>10,.2f}")
    
    print("="*70)
    
    return results


def main():
    parser = argparse.ArgumentParser(description="双向交易策略 - 精确买卖点")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="1m", help="时间框架")
    parser.add_argument("--capital", type=float, default=500, help="本金")
    parser.add_argument("--scan", action="store_true", help="扫描高波动标的")
    parser.add_argument("--position", type=float, help="持仓入场价（检测出场）")
    parser.add_argument("--side", default='long', choices=['long', 'short'], help="持仓方向")
    parser.add_argument("--leverage", type=int, default=30, help="杠杆倍数")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    print(f"🎯 双向交易策略 - {args.symbol}")
    print("="*70)
    print(f"本金：¥{args.capital:,.0f} | 杠杆：{args.leverage}x")
    print("="*70)
    
    # 扫描高波动标的
    if args.scan:
        scan_high_volatility_symbols(args.timeframe)
        return
    
    # 获取数据
    try:
        df = fetch_ohlcv(args.symbol, args.timeframe, limit=100)
    except Exception as e:
        print(f"错误：获取数据失败 - {e}")
        print("提示：可能需要代理访问 OKX")
        sys.exit(1)
    
    # 计算指标
    df = calculate_indicators(df)
    
    # 检测入场信号（双向）
    long_signal = find_optimal_entry(df, 'long')
    short_signal = find_optimal_entry(df, 'short')
    
    # 检测出场信号（如果有持仓）
    exit_signal = None
    if args.position:
        position = {
            'entry_price': args.position,
            'side': args.side,
            'leverage': args.leverage,
            'take_profit': 1.0,
            'stop_loss': 0.5
        }
        current_price = df['close'].iloc[-1]
        exit_signal = find_optimal_exit(df, position, current_price)
    
    # 输出
    if args.json:
        result = {
            'timestamp': datetime.now().isoformat(),
            'symbol': args.symbol,
            'price': df['close'].iloc[-1],
            'long_entry': long_signal,
            'short_entry': short_signal,
            'exit': exit_signal
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        current_price = df['close'].iloc[-1]
        print(f"\n当前价格：{current_price:.2f}")
        
        # 做多信号
        print(f"\n{'='*70}")
        print(f"📈 做多信号")
        print(f"{'='*70}")
        if long_signal['entry']:
            emoji = '🚀' if long_signal['confidence'] > 0.8 else '📈'
            print(f"{emoji} 入场信号：STRONG_BUY" if long_signal['confidence'] > 0.8 else f"{emoji} 入场信号：BUY")
            print(f"置信度：{long_signal['confidence']*100:.0f}%")
            print(f"原因：{' + '.join(long_signal['reason'][:3])}")
            print(f"建议杠杆：{long_signal['suggested_leverage']}x")
            print(f"止损：-{long_signal['stop_loss']}% | 止盈：+{long_signal['take_profit']}%")
        else:
            print(f"⏸️ 暂无做多信号")
            print(f"原因：{' '.join(long_signal['reason']) if long_signal['reason'] else '条件不满足'}")
        
        # 做空信号
        print(f"\n{'='*70}")
        print(f"📉 做空信号")
        print(f"{'='*70}")
        if short_signal['entry']:
            emoji = '💥' if short_signal['confidence'] > 0.8 else '📉'
            print(f"{emoji} 入场信号：STRONG_SELL" if short_signal['confidence'] > 0.8 else f"{emoji} 入场信号：SELL")
            print(f"置信度：{short_signal['confidence']*100:.0f}%")
            print(f"原因：{' + '.join(short_signal['reason'][:3])}")
            print(f"建议杠杆：{short_signal['suggested_leverage']}x")
            print(f"止损：+{short_signal['stop_loss']}% | 止盈：-{short_signal['take_profit']}%")
        else:
            print(f"⏸️ 暂无做空信号")
            print(f"原因：{' '.join(short_signal['reason']) if short_signal['reason'] else '条件不满足'}")
        
        # 出场信号（如果有持仓）
        if exit_signal:
            print(f"\n{'='*70}")
            print(f"💰 持仓出场检测")
            print(f"{'='*70}")
            print(f"入场价：{args.position:.2f} ({args.side})")
            print(f"当前价：{current_price:.2f}")
            print(f"盈亏：{exit_signal['pnl_pct']:+.2f}% ({exit_signal['pnl_with_leverage']:+.1f}% with {args.leverage}x)")
            
            if exit_signal['exit']:
                emoji = '✅' if exit_signal['pnl_with_leverage'] > 0 else '❌'
                print(f"\n{emoji} 出场信号：{exit_signal['exit_type']}")
                print(f"原因：{' + '.join(exit_signal['reason'])}")
            else:
                print(f"\n⏸️ 继续持有")
                if exit_signal['reason']:
                    print(f"关注：{' + '.join(exit_signal['reason'])}")
        
        # 高波动标的推荐
        print(f"\n{'='*70}")
        print(f"🔥 高波动标的推荐")
        print(f"{'='*70}")
        print(f"使用 --scan 参数扫描实时高波动标的")
        print(f"推荐：BTC/USDT, ETH/USDT, SOL/USDT, DOGE/USDT")
        
        print(f"\n{'='*70}\n")


if __name__ == "__main__":
    main()
