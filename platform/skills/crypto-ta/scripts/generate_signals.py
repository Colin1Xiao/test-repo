#!/usr/bin/env python3
"""
Trading Signal Generator
基于技术指标生成交易信号
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import pandas as pd
    import numpy as np
    import talib
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)


def load_data(input_path):
    df = pd.read_csv(input_path)
    required = ['open', 'high', 'low', 'close', 'volume']
    for col in required:
        if col not in df.columns:
            for c in df.columns:
                if c.lower() == col.lower():
                    df = df.rename(columns={c: col})
                    break
    return df


def calculate_all_indicators(df):
    """计算所有需要的指标"""
    result = df.copy()
    
    # 均线
    result['ema_9'] = talib.EMA(result['close'], timeperiod=9)
    result['ema_20'] = talib.EMA(result['close'], timeperiod=20)
    result['ema_50'] = talib.EMA(result['close'], timeperiod=50)
    
    # RSI
    result['rsi_14'] = talib.RSI(result['close'], timeperiod=14)
    
    # MACD
    result['MACD_12_26_9'], result['MACDs_12_26_9'], result['MACDh_12_26_9'] = talib.MACD(
        result['close'], fastperiod=12, slowperiod=26, signalperiod=9
    )
    
    # 布林带
    result['BB_upper'], result['BB_middle'], result['BB_lower'] = talib.BBANDS(
        result['close'], timeperiod=20, nbdevup=2, nbdevdn=2, matype=0
    )
    
    # KDJ (Stochastic)
    result['STOCHk_9_3'], result['STOCHd_9_3'] = talib.STOCH(
        result['high'], result['low'], result['close'],
        fastk_period=9, slowk_period=3, slowd_period=3
    )
    result['kdj_j'] = 3 * result['STOCHk_9_3'] - 2 * result['STOCHd_9_3']
    
    return result


def generate_ma_cross_signal(df):
    """均线交叉策略"""
    signals = []
    
    for i in range(1, len(df)):
        prev_ema9 = df['ema_9'].iloc[i-1]
        prev_ema20 = df['ema_20'].iloc[i-1]
        curr_ema9 = df['ema_9'].iloc[i]
        curr_ema20 = df['ema_20'].iloc[i]
        
        signal = {'timestamp': df['timestamp'].iloc[i], 'type': 'HOLD'}
        
        # 金叉：快线上穿慢线
        if pd.notna(prev_ema9) and pd.notna(prev_ema20) and pd.notna(curr_ema9) and pd.notna(curr_ema20):
            if prev_ema9 <= prev_ema20 and curr_ema9 > curr_ema20:
                signal['type'] = 'BUY'
                signal['reason'] = f"EMA 金叉 (9 上穿 20)"
                signal['price'] = df['close'].iloc[i]
            
            # 死叉：快线下穿慢线
            elif prev_ema9 >= prev_ema20 and curr_ema9 < curr_ema20:
                signal['type'] = 'SELL'
                signal['reason'] = f"EMA 死叉 (9 下穿 20)"
                signal['price'] = df['close'].iloc[i]
        
        signals.append(signal)
    
    return signals


def generate_rsi_signal(df, oversold=30, overbought=70):
    """RSI 超买超卖策略"""
    signals = []
    
    for i in range(1, len(df)):
        prev_rsi = df['rsi_14'].iloc[i-1]
        curr_rsi = df['rsi_14'].iloc[i]
        
        signal = {'timestamp': df['timestamp'].iloc[i], 'type': 'HOLD'}
        
        if pd.notna(prev_rsi) and pd.notna(curr_rsi):
            # 超卖反弹
            if prev_rsi <= oversold and curr_rsi > oversold:
                signal['type'] = 'BUY'
                signal['reason'] = f"RSI 超卖反弹 ({curr_rsi:.1f})"
                signal['price'] = df['close'].iloc[i]
            
            # 超买回调
            elif prev_rsi >= overbought and curr_rsi < overbought:
                signal['type'] = 'SELL'
                signal['reason'] = f"RSI 超买回调 ({curr_rsi:.1f})"
                signal['price'] = df['close'].iloc[i]
        
        signals.append(signal)
    
    return signals


def generate_macd_signal(df):
    """MACD 交叉策略"""
    signals = []
    
    for i in range(1, len(df)):
        prev_macd = df['MACD_12_26_9'].iloc[i-1]
        prev_signal = df['MACDs_12_26_9'].iloc[i-1]
        curr_macd = df['MACD_12_26_9'].iloc[i]
        curr_signal_line = df['MACDs_12_26_9'].iloc[i]
        
        signal = {'timestamp': df['timestamp'].iloc[i], 'type': 'HOLD'}
        
        if pd.notna(prev_macd) and pd.notna(prev_signal) and pd.notna(curr_macd) and pd.notna(curr_signal_line):
            # 金叉
            if prev_macd <= prev_signal and curr_macd > curr_signal_line:
                signal['type'] = 'BUY'
                signal['reason'] = f"MACD 金叉"
                signal['price'] = df['close'].iloc[i]
            
            # 死叉
            elif prev_macd >= prev_signal and curr_macd < curr_signal_line:
                signal['type'] = 'SELL'
                signal['reason'] = f"MACD 死叉"
                signal['price'] = df['close'].iloc[i]
        
        signals.append(signal)
    
    return signals


def generate_combo_signal(df):
    """多指标组合策略（更可靠）"""
    signals = []
    
    for i in range(1, len(df)):
        signal = {'timestamp': df['timestamp'].iloc[i], 'type': 'HOLD', 'score': 0}
        
        curr_rsi = df['rsi_14'].iloc[i]
        curr_macd = df['MACD_12_26_9'].iloc[i]
        curr_signal_line = df['MACDs_12_26_9'].iloc[i]
        curr_close = df['close'].iloc[i]
        curr_ema9 = df['ema_9'].iloc[i]
        curr_ema20 = df['ema_20'].iloc[i]
        
        if not all(pd.notna([curr_rsi, curr_macd, curr_signal_line, curr_ema9, curr_ema20])):
            signals.append(signal)
            continue
        
        # 买入信号评分
        buy_score = 0
        if curr_rsi < 40:
            buy_score += 1
        if curr_macd > curr_signal_line:
            buy_score += 1
        if curr_close > curr_ema9 > curr_ema20:
            buy_score += 1
        
        # 卖出信号评分
        sell_score = 0
        if curr_rsi > 60:
            sell_score += 1
        if curr_macd < curr_signal_line:
            sell_score += 1
        if curr_close < curr_ema9 < curr_ema20:
            sell_score += 1
        
        signal['score'] = buy_score - sell_score
        
        if buy_score >= 3:
            signal['type'] = 'STRONG_BUY'
            signal['reason'] = f"多指标共振买入 (RSI={curr_rsi:.1f}, MACD 金叉，均线多头)"
            signal['price'] = curr_close
        elif buy_score >= 2:
            signal['type'] = 'BUY'
            signal['reason'] = f"多数指标看涨 (score={buy_score})"
            signal['price'] = curr_close
        elif sell_score >= 3:
            signal['type'] = 'STRONG_SELL'
            signal['reason'] = f"多指标共振卖出 (RSI={curr_rsi:.1f}, MACD 死叉，均线空头)"
            signal['price'] = curr_close
        elif sell_score >= 2:
            signal['type'] = 'SELL'
            signal['reason'] = f"多数指标看跌 (score={-sell_score})"
            signal['price'] = curr_close
        
        signals.append(signal)
    
    return signals


def main():
    parser = argparse.ArgumentParser(description="生成交易信号")
    parser.add_argument("--input", "-i", required=True, help="输入 CSV 文件")
    parser.add_argument("--strategy", required=True,
                       choices=['ma_cross', 'rsi', 'macd', 'bbands', 'combo'],
                       help="策略类型")
    parser.add_argument("--output", "-o", help="输出文件")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    
    args = parser.parse_args()
    
    # 加载数据
    print(f"加载数据：{args.input}")
    df = load_data(args.input)
    
    # 计算指标
    print("计算技术指标...")
    df = calculate_all_indicators(df)
    
    # 生成信号
    print(f"生成 {args.strategy} 策略信号...")
    
    if args.strategy == 'ma_cross':
        signals = generate_ma_cross_signal(df)
    elif args.strategy == 'rsi':
        signals = generate_rsi_signal(df)
    elif args.strategy == 'macd':
        signals = generate_macd_signal(df)
    elif args.strategy == 'combo':
        signals = generate_combo_signal(df)
    else:
        print(f"不支持的策略：{args.strategy}")
        sys.exit(1)
    
    # 统计
    buy_count = sum(1 for s in signals if 'BUY' in s['type'])
    sell_count = sum(1 for s in signals if 'SELL' in s['type'])
    
    print(f"\n{'='*50}")
    print(f"信号统计:")
    print(f"  买入信号：{buy_count}")
    print(f"  卖出信号：{sell_count}")
    print(f"  总计：{len(signals)} 条 K 线")
    print(f"{'='*50}")
    
    # 显示最新信号
    latest_signals = [s for s in signals if s['type'] != 'HOLD'][-5:]
    if latest_signals:
        print(f"\n最近信号:")
        for s in latest_signals:
            print(f"  {s['type']}: {s.get('reason', '')} @ {s.get('price', 0):.2f}")
    
    # 输出
    if args.json:
        # 转换 numpy 类型为 Python 原生类型
        def convert_to_native(obj):
            if isinstance(obj, dict):
                return {k: convert_to_native(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            elif isinstance(obj, (np.integer, np.int64)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float64)):
                return float(obj)
            elif pd.isna(obj):
                return None
            else:
                return obj
        
        signals_native = convert_to_native(signals)
        print(json.dumps(signals_native, indent=2))
    elif args.output:
        pd.DataFrame(signals).to_csv(args.output, index=False)
        print(f"\n已保存到 {args.output}")


if __name__ == "__main__":
    main()
