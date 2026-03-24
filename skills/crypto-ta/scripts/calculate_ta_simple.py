#!/usr/bin/env python3
"""
Simple Technical Analysis Calculator (无 pandas-ta 依赖)
使用基础 pandas 计算技术指标
"""

import argparse
import json
import sys
import numpy as np
import pandas as pd


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


def sma(series, length):
    return series.rolling(window=length).mean()


def ema(series, length):
    return series.ewm(span=length, adjust=False).mean()


def rsi(series, length=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=length).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=length).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def macd(series, fast=12, slow=26, signal=9):
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(series, length=20, std=2):
    middle = sma(series, length)
    std_dev = series.rolling(window=length).std()
    upper = middle + (std_dev * std)
    lower = middle - (std_dev * std)
    return upper, middle, lower


def calculate_all(df):
    """计算所有指标"""
    result = df.copy()
    
    # 均线
    result['ema_9'] = ema(result['close'], 9)
    result['ema_20'] = ema(result['close'], 20)
    result['ema_50'] = ema(result['close'], 50)
    result['sma_20'] = sma(result['close'], 20)
    
    # RSI
    result['rsi_14'] = rsi(result['close'], 14)
    
    # MACD
    macd_line, signal_line, histogram = macd(result['close'])
    result['macd'] = macd_line
    result['macd_signal'] = signal_line
    result['macd_histogram'] = histogram
    
    # 布林带
    bb_upper, bb_middle, bb_lower = bollinger_bands(result['close'])
    result['bb_upper'] = bb_upper
    result['bb_middle'] = bb_middle
    result['bb_lower'] = bb_lower
    
    return result


def main():
    parser = argparse.ArgumentParser(description="计算技术指标 (简化版)")
    parser.add_argument("--input", "-i", required=True, help="输入 CSV 文件")
    parser.add_argument("--output", "-o", help="输出 CSV 文件")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--indicators", default="all", help="指标列表")
    
    args = parser.parse_args()
    
    # 加载数据
    print(f"加载数据：{args.input}")
    df = load_data(args.input)
    print(f"共 {len(df)} 条 K 线")
    
    # 计算指标
    print("计算技术指标...")
    result = calculate_all(df)
    
    # 输出
    if args.json:
        last = result.iloc[-1].to_dict()
        last = {k: (float(v) if isinstance(v, (np.floating, float)) else v) for k, v in last.items()}
        print(json.dumps(last, indent=2, default=str))
    elif args.output:
        result.to_csv(args.output, index=False)
        print(f"已保存到 {args.output}")
    else:
        print(f"\n最新指标值:")
        print(result[['datetime', 'close', 'ema_9', 'ema_20', 'rsi_14', 'macd', 'bb_upper', 'bb_lower']].tail(3).to_string())
    
    # 摘要
    print(f"\n{'='*50}")
    last = result.iloc[-1]
    print(f"最新收盘价：{last['close']:.2f}")
    
    if 'rsi_14' in last:
        rsi_val = last['rsi_14']
        print(f"RSI(14): {rsi_val:.2f}", end="")
        if rsi_val and rsi_val > 70:
            print(" ⚠️ 超买")
        elif rsi_val and rsi_val < 30:
            print(" ⚠️ 超卖")
        else:
            print()
    
    if 'macd' in last and 'macd_signal' in last:
        macd_val = last['macd']
        signal_val = last['macd_signal']
        if macd_val and signal_val:
            print(f"MACD: {macd_val:.2f}, Signal: {signal_val:.2f}", end="")
            if macd_val > signal_val:
                print(" 📈 金叉")
            else:
                print(" 📉 死叉")
    
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
