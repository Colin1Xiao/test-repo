#!/usr/bin/env python3
"""
Crypto Technical Analysis Calculator
计算加密货币技术指标
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import pandas as pd
    import pandas_ta as ta
    import numpy as np
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install pandas pandas-ta numpy", file=sys.stderr)
    sys.exit(1)


def load_data(input_path):
    """加载 CSV 数据"""
    df = pd.read_csv(input_path)
    
    # 标准化列名
    column_mapping = {
        'timestamp': 'timestamp',
        'datetime': 'datetime',
        'open': 'open',
        'high': 'high',
        'low': 'low',
        'close': 'close',
        'volume': 'volume'
    }
    
    # 检查必需列
    required = ['open', 'high', 'low', 'close', 'volume']
    for col in required:
        if col not in df.columns:
            # 尝试大小写不匹配
            for c in df.columns:
                if c.lower() == col.lower():
                    df = df.rename(columns={c: col})
                    break
    
    return df


def calculate_indicators(df, indicators):
    """
    计算技术指标
    
    Args:
        df: DataFrame with OHLCV data
        indicators: list of indicator names
    
    Returns:
        DataFrame with indicators added
    """
    result = df.copy()
    
    for ind in indicators:
        try:
            if ind == 'sma' or ind == 'ma':
                length = getattr(args, 'sma_length', 20)
                result[f'sma_{length}'] = ta.sma(result['close'], length=length)
            
            elif ind == 'ema':
                length = getattr(args, 'ema_length', 20)
                result[f'ema_{length}'] = ta.ema(result['close'], length=length)
            
            elif ind == 'rsi':
                length = getattr(args, 'rsi_length', 14)
                result[f'rsi_{length}'] = ta.rsi(result['close'], length=length)
            
            elif ind == 'macd':
                fast = getattr(args, 'macd_fast', 12)
                slow = getattr(args, 'macd_slow', 26)
                signal = getattr(args, 'macd_signal', 9)
                macd_data = ta.macd(result['close'], fast=fast, slow=slow, signal=signal)
                result = pd.concat([result, macd_data], axis=1)
            
            elif ind == 'bbands' or ind == 'bollinger':
                length = getattr(args, 'bb_length', 20)
                std = getattr(args, 'bb_std', 2)
                bbands = ta.bbands(result['close'], length=length, std=std)
                result = pd.concat([result, bbands], axis=1)
            
            elif ind == 'kdj':
                length = getattr(args, 'kdj_length', 9)
                kdj = ta.stoch(result['high'], result['low'], result['close'], k=length, d=3)
                result = pd.concat([result, kdj], axis=1)
                result['kdj_j'] = 3 * result['STOCHk_9_3'] - 2 * result['STOCHd_9_3']
            
            elif ind == 'atr':
                length = getattr(args, 'atr_length', 14)
                result[f'atr_{length}'] = ta.atr(result['high'], result['low'], result['close'], length=length)
            
            elif ind == 'stoch':
                k = getattr(args, 'stoch_k', 14)
                d = getattr(args, 'stoch_d', 3)
                stoch = ta.stoch(result['high'], result['low'], result['close'], k=k, d=d)
                result = pd.concat([result, stoch], axis=1)
            
            elif ind == 'cci':
                length = getattr(args, 'cci_length', 20)
                result[f'cci_{length}'] = ta.cci(result['high'], result['low'], result['close'], length=length)
            
            elif ind == 'adx':
                length = getattr(args, 'adx_length', 14)
                adx = ta.adx(result['high'], result['low'], result['close'], length=length)
                result = pd.concat([result, adx], axis=1)
            
            elif ind == 'all':
                # 计算所有常用指标
                calculate_indicators(result, ['ema', 'rsi', 'macd', 'bbands', 'kdj', 'atr'])
                break
            
        except Exception as e:
            print(f"警告：计算 {ind} 失败 - {e}", file=sys.stderr)
    
    return result


def main():
    global args
    
    parser = argparse.ArgumentParser(description="计算技术指标")
    parser.add_argument("--input", "-i", required=True, help="输入 CSV 文件")
    parser.add_argument("--indicators", required=True, 
                       help="指标列表 (逗号分隔): ema,rsi,macd,bbands,kdj,atr,all")
    parser.add_argument("--output", "-o", help="输出 CSV 文件")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    
    # 指标参数
    parser.add_argument("--sma-length", type=int, default=20)
    parser.add_argument("--ema-length", type=int, default=20)
    parser.add_argument("--rsi-length", type=int, default=14)
    parser.add_argument("--macd-fast", type=int, default=12)
    parser.add_argument("--macd-slow", type=int, default=26)
    parser.add_argument("--macd-signal", type=int, default=9)
    parser.add_argument("--bb-length", type=int, default=20)
    parser.add_argument("--bb-std", type=float, default=2.0)
    parser.add_argument("--kdj-length", type=int, default=9)
    parser.add_argument("--atr-length", type=int, default=14)
    parser.add_argument("--stoch-k", type=int, default=14)
    parser.add_argument("--stoch-d", type=int, default=3)
    parser.add_argument("--cci-length", type=int, default=20)
    parser.add_argument("--adx-length", type=int, default=14)
    
    args = parser.parse_args()
    
    # 加载数据
    print(f"加载数据：{args.input}")
    df = load_data(args.input)
    print(f"共 {len(df)} 条 K 线")
    
    # 解析指标列表
    indicators = [i.strip().lower() for i in args.indicators.split(',')]
    
    # 计算指标
    print(f"计算指标：{', '.join(indicators)}")
    result = calculate_indicators(df, indicators)
    
    # 输出
    if args.json:
        # 输出最后一条数据
        last = result.iloc[-1].to_dict()
        # 清理 NaN
        last = {k: (v if not pd.isna(v) else None) for k, v in last.items()}
        print(json.dumps(last, indent=2))
    elif args.output:
        result.to_csv(args.output, index=False)
        print(f"已保存到 {args.output}")
    else:
        # 显示最后几行
        print(f"\n最新指标值:")
        print(result.tail(3).to_string())
    
    # 显示关键指标摘要
    print(f"\n{'='*50}")
    print(f"最新收盘价：{result['close'].iloc[-1]:.2f}")
    
    if f'rsi_14' in result.columns:
        rsi = result['rsi_14'].iloc[-1]
        print(f"RSI(14): {rsi:.2f}", end="")
        if rsi > 70:
            print(" ⚠️ 超买")
        elif rsi < 30:
            print(" ⚠️ 超卖")
        else:
            print()
    
    if 'MACD_12_26_9' in result.columns:
        macd = result['MACD_12_26_9'].iloc[-1]
        signal = result['MACDs_12_26_9'].iloc[-1]
        print(f"MACD: {macd:.2f}, Signal: {signal:.2f}", end="")
        if macd > signal:
            print(" 📈 金叉")
        else:
            print(" 📉 死叉")
    
    if 'BBU_20_2.0' in result.columns:
        upper = result['BBU_20_2.0'].iloc[-1]
        middle = result['BBM_20_2.0'].iloc[-1]
        lower = result['BBL_20_2.0'].iloc[-1]
        close = result['close'].iloc[-1]
        print(f"布林带：上{upper:.2f} 中{middle:.2f} 下{lower:.2f}")
        if close > upper:
            print("         ⚠️ 突破上轨")
        elif close < lower:
            print("         ⚠️ 跌破下轨")
    
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
