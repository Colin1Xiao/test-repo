#!/usr/bin/env python3
"""
Real-time Signal Monitor
实时监控市场并生成交易信号
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

# 添加父目录到路径以导入其他技能模块
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-data' / 'scripts'))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-ta' / 'scripts'))

try:
    import ccxt
    import pandas as pd
    import pandas_ta as ta
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def fetch_ohlcv(symbol, timeframe='1m', limit=100):
    """获取 K 线数据"""
    exchange = ccxt.okx({'enableRateLimit': True, 'options': {'defaultType': 'future'}})
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df
    except Exception as e:
        print(f"获取数据失败：{e}", file=sys.stderr)
        return None


def calculate_indicators(df):
    """计算技术指标"""
    result = df.copy()
    
    # 均线
    result['ema_9'] = ta.ema(result['close'], length=9)
    result['ema_20'] = ta.ema(result['close'], length=20)
    result['ema_50'] = ta.ema(result['close'], length=50)
    
    # RSI
    result['rsi_14'] = ta.rsi(result['close'], length=14)
    
    # MACD
    macd_data = ta.macd(result['close'], fast=12, slow=26, signal=9)
    result = pd.concat([result, macd_data], axis=1)
    
    # 布林带
    bbands = ta.bbands(result['close'], length=20, std=2)
    result = pd.concat([result, bbands], axis=1)
    
    return result


def generate_signal(df, strategy='combo'):
    """生成交易信号"""
    if len(df) < 50:
        return {'signal': 'WAIT', 'reason': '数据不足'}
    
    last = df.iloc[-1]
    prev = df.iloc[-2]
    
    signal = {
        'timestamp': datetime.now().isoformat(),
        'price': last['close'],
        'signal': 'HOLD',
        'reason': '',
        'confidence': 0.0
    }
    
    if strategy == 'combo':
        # 多指标组合
        score = 0
        
        # RSI 评分
        if last['rsi_14'] < 35:
            score += 2
        elif last['rsi_14'] < 45:
            score += 1
        elif last['rsi_14'] > 65:
            score -= 2
        elif last['rsi_14'] > 55:
            score -= 1
        
        # MACD 评分
        if last['MACD_12_26_9'] > last['MACDs_12_26_9']:
            score += 1
            if prev['MACD_12_26_9'] <= prev['MACDs_12_26_9']:
                score += 1  # 刚金叉
        else:
            score -= 1
            if prev['MACD_12_26_9'] >= prev['MACDs_12_26_9']:
                score -= 1  # 刚死叉
        
        # 均线评分
        if last['close'] > last['ema_9'] > last['ema_20']:
            score += 2
        elif last['close'] < last['ema_9'] < last['ema_20']:
            score -= 2
        
        # 确定信号
        if score >= 4:
            signal['signal'] = 'STRONG_BUY'
            signal['reason'] = f"多指标共振买入 (score={score})"
            signal['confidence'] = min(score / 6, 0.95)
        elif score >= 2:
            signal['signal'] = 'BUY'
            signal['reason'] = f"多数指标看涨 (score={score})"
            signal['confidence'] = 0.6 + score * 0.05
        elif score <= -4:
            signal['signal'] = 'STRONG_SELL'
            signal['reason'] = f"多指标共振卖出 (score={score})"
            signal['confidence'] = min(abs(score) / 6, 0.95)
        elif score <= -2:
            signal['signal'] = 'SELL'
            signal['reason'] = f"多数指标看跌 (score={score})"
            signal['confidence'] = 0.6 + abs(score) * 0.05
        else:
            signal['signal'] = 'HOLD'
            signal['reason'] = f"指标不明朗 (score={score})"
            signal['confidence'] = 0.5
    
    elif strategy == 'ma_cross':
        # 均线交叉
        if prev['ema_9'] <= prev['ema_20'] and last['ema_9'] > last['ema_20']:
            signal['signal'] = 'BUY'
            signal['reason'] = 'EMA 金叉'
            signal['confidence'] = 0.7
        elif prev['ema_9'] >= prev['ema_20'] and last['ema_9'] < last['ema_20']:
            signal['signal'] = 'SELL'
            signal['reason'] = 'EMA 死叉'
            signal['confidence'] = 0.7
    
    elif strategy == 'rsi':
        # RSI 超买超卖
        if last['rsi_14'] < 30:
            signal['signal'] = 'BUY'
            signal['reason'] = f'RSI 超卖 ({last["rsi_14"]:.1f})'
            signal['confidence'] = 0.65
        elif last['rsi_14'] > 70:
            signal['signal'] = 'SELL'
            signal['reason'] = f'RSI 超买 ({last["rsi_14"]:.1f})'
            signal['confidence'] = 0.65
    
    return signal


def main():
    parser = argparse.ArgumentParser(description="实时监控交易信号")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--symbols", help="多个交易对 (逗号分隔)")
    parser.add_argument("--timeframe", default="5m", choices=['1m', '5m', '15m', '1h'], help="时间框架")
    parser.add_argument("--strategy", default="combo", 
                       choices=['ma_cross', 'rsi', 'macd', 'combo', 'scalp'],
                       help="策略")
    parser.add_argument("--interval", type=int, default=30, help="检查间隔 (秒)")
    parser.add_argument("--continuous", action="store_true", help="持续监控")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    symbols = args.symbols.split(',') if args.symbols else [args.symbol]
    
    print(f"🚀 开始监控 {len(symbols)} 个交易对...")
    print(f"策略：{args.strategy} | 时间框架：{args.timeframe}")
    print(f"{'='*60}")
    
    last_signals = {}
    
    try:
        while True:
            for symbol in symbols:
                try:
                    # 获取数据
                    df = fetch_ohlcv(symbol, args.timeframe, limit=100)
                    if df is None:
                        continue
                    
                    # 计算指标
                    df = calculate_indicators(df)
                    
                    # 生成信号
                    signal = generate_signal(df, args.strategy)
                    signal['symbol'] = symbol
                    
                    # 只在信号变化时输出
                    signal_key = f"{symbol}_{args.timeframe}"
                    if last_signals.get(signal_key) != signal['signal']:
                        now = datetime.now().strftime('%H:%M:%S')
                        
                        if args.json:
                            print(json.dumps(signal))
                        else:
                            emoji = {'STRONG_BUY': '🚀', 'BUY': '📈', 'HOLD': '⏸️', 
                                    'SELL': '📉', 'STRONG_SELL': '💥'}.get(signal['signal'], '📊')
                            
                            print(f"[{now}] {emoji} {symbol}")
                            print(f"       信号：{signal['signal']}")
                            print(f"       价格：{signal['price']:.2f}")
                            print(f"       原因：{signal['reason']}")
                            print(f"       置信度：{signal['confidence']*100:.0f}%")
                            print()
                        
                        last_signals[signal_key] = signal['signal']
                
                except Exception as e:
                    # 单个币种失败不影响其他币种
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 错误：{symbol} - {e}", file=sys.stderr)
                    continue
            
            if not args.continuous:
                break
            
            time.sleep(args.interval)
    
    except KeyboardInterrupt:
        print("\n停止监控")
    except Exception as e:
        print(f"\n监控异常：{e}", file=sys.stderr)
        print("建议：检查网络连接或降低监控频率", file=sys.stderr)


if __name__ == "__main__":
    main()
