#!/usr/bin/env python3
"""
Fast Indicator Calculator with Polars
快速指标计算器 - Polars 优化版

优化:
1. 使用 polars 替代 pandas (快 10-100x)
2. 增量计算（只计算新增 K 线）
3. 向量化运算（避免循环）
"""

import sys
import time
from pathlib import Path
from datetime import datetime

try:
    import polars as pl
    import numpy as np
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install polars numpy", file=sys.stderr)
    sys.exit(1)


def calculate_all_indicators(df):
    """
    一次性计算所有指标（向量化，最快）
    
    Args:
        df: polars.DataFrame (包含 OHLCV)
    
    Returns:
        polars.DataFrame: 包含所有指标的 DataFrame
    """
    if df.is_empty():
        return df
    
    start_time = time.time()
    
    # 使用 polars 链式表达式（最快）
    df = df.with_columns([
        # === 均线 ===
        pl.col('close').ewm_mean(span=5).alias('ema_5'),
        pl.col('close').ewm_mean(span=9).alias('ema_9'),
        pl.col('close').ewm_mean(span=20).alias('ema_20'),
        pl.col('close').ewm_mean(span=50).alias('ema_50'),
        pl.col('close').rolling_mean(window_size=20).alias('sma_20'),
        
        # === RSI ===
        pl.when(pl.col('close').diff() > 0)
          .then(pl.col('close').diff())
          .otherwise(0).alias('gain'),
        
        pl.when(pl.col('close').diff() < 0)
          .then(-pl.col('close').diff())
          .otherwise(0).alias('loss'),
        
        # === 成交量 ===
        pl.col('volume').rolling_mean(window_size=20).alias('volume_ma_20'),
        (pl.col('volume') / pl.col('volume').rolling_mean(window_size=20)).alias('volume_ratio'),
        
        # === 动量 ===
        (pl.col('close').pct_change(n=3) * 100).alias('momentum_3'),
        (pl.col('close').pct_change(n=5) * 100).alias('momentum_5'),
        
        # === 波动率 ===
        (pl.col('close').rolling_std(window_size=20) / pl.col('close').rolling_mean(window_size=20)).alias('volatility'),
    ])
    
    # === RSI 计算 (使用 gain/loss 列) ===
    df = df.with_columns([
        (100 - (100 / (1 + (
            pl.col('gain').rolling_mean(window_size=7) /
            pl.col('loss').rolling_mean(window_size=7)
        )))).alias('rsi_7'),
        (100 - (100 / (1 + (
            pl.col('gain').rolling_mean(window_size=14) /
            pl.col('loss').rolling_mean(window_size=14)
        )))).alias('rsi_14'),
    ])
    
    # 删除临时列
    df = df.drop(['gain', 'loss'])
    
    # === MACD (单独计算，避免表达式过长) ===
    ema_12 = df['close'].ewm_mean(span=12)
    ema_26 = df['close'].ewm_mean(span=26)
    macd = ema_12 - ema_26
    macd_signal = macd.ewm_mean(span=9)
    
    df = df.with_columns([
        macd.alias('macd'),
        macd_signal.alias('macd_signal'),
        (macd - macd_signal).alias('macd_hist'),
    ])
    
    # === 布林带 ===
    sma_20 = df['close'].rolling_mean(window_size=20)
    std_20 = df['close'].rolling_std(window_size=20)
    
    df = df.with_columns([
        (sma_20 + 2 * std_20).alias('bb_upper'),
        sma_20.alias('bb_middle'),
        (sma_20 - 2 * std_20).alias('bb_lower'),
    ])
    
    # === KDJ ===
    lowest_low = df['low'].rolling_min(window_size=14)
    highest_high = df['high'].rolling_max(window_size=14)
    
    stoch_k = 100 * (df['close'] - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling_mean(window_size=3)
    
    df = df.with_columns([
        stoch_k.alias('stoch_k'),
        stoch_d.alias('stoch_d'),
        (3 * stoch_k - 2 * stoch_d).alias('stoch_j'),
    ])
    
    elapsed = time.time() - start_time
    print(f"✅ 计算 {len(df.columns)-6} 个指标，耗时 {elapsed:.3f}秒 ({len(df)} 根 K 线)")
    print(f"   速度：{len(df)/elapsed:.0f} 根 K 线/秒")
    
    return df


def calculate_indicators_incremental(df, new_candles):
    """
    增量计算指标（只计算新增部分）
    
    Args:
        df: 历史数据
        new_candles: 新增 K 线
    
    Returns:
        polars.DataFrame: 合并后的数据
    """
    if new_candles.is_empty():
        return df
    
    if df.is_empty():
        return calculate_all_indicators(new_candles)
    
    # 合并数据
    df_combined = pl.concat([df, new_candles])
    
    # 只重新计算最后 N 根（因为指标有依赖性）
    # EMA 需要前 50 根，所以重新计算最后 60 根
    recalculate_count = min(60, len(df_combined))
    
    df_tail = df_combined.tail(recalculate_count)
    df_tail_with_indicators = calculate_all_indicators(df_tail)
    
    # 合并：前面不变，后面替换
    if len(df_combined) > recalculate_count:
        df_head = df_combined.head(len(df_combined) - recalculate_count)
        df_result = pl.concat([df_head, df_tail_with_indicators])
    else:
        df_result = df_tail_with_indicators
    
    return df_result


def generate_signals_fast(df):
    """
    快速生成交易信号（向量化）
    
    Args:
        df: polars.DataFrame (包含所有指标)
    
    Returns:
        dict: 最新信号
    """
    if df.is_empty() or len(df) < 10:
        return {'signal': 'WAIT', 'reason': '数据不足'}
    
    # 获取最新一行
    last = df.tail(1).to_dicts()[0]
    
    score = 0
    signals = []
    
    # EMA 排列
    if last['ema_5'] > last['ema_9'] > last['ema_20']:
        score += 3
        signals.append('EMA 多头')
    elif last['ema_5'] < last['ema_9'] < last['ema_20']:
        score -= 3
        signals.append('EMA 空头')
    
    # RSI
    if last['rsi_7'] < 30:
        score += 3
        signals.append(f'RSI 超卖 ({last["rsi_7"]:.1f})')
    elif last['rsi_7'] > 70:
        score -= 3
        signals.append(f'RSI 超买 ({last["rsi_7"]:.1f})')
    
    # 成交量
    if last['volume_ratio'] > 1.5:
        score += 2
        signals.append(f'放量 {last["volume_ratio"]:.1f}x')
    elif last['volume_ratio'] < 0.7:
        score -= 1
        signals.append(f'缩量 {last["volume_ratio"]:.1f}x')
    
    # 动量
    if last['momentum_3'] > 0.3:
        score += 2
        signals.append(f'动量 +{last["momentum_3"]:.2f}%')
    elif last['momentum_3'] < -0.3:
        score -= 2
        signals.append(f'动量 {last["momentum_3"]:.2f}%')
    
    # 确定信号
    if score >= 5:
        signal = 'STRONG_BUY'
        leverage = 50
    elif score >= 3:
        signal = 'BUY'
        leverage = 30
    elif score <= -5:
        signal = 'STRONG_SELL'
        leverage = 50
    elif score <= -3:
        signal = 'SELL'
        leverage = 30
    else:
        signal = 'HOLD'
        leverage = 0
    
    return {
        'signal': signal,
        'score': score,
        'leverage': leverage,
        'reason': ' + '.join(signals[:3]),
        'price': last['close'],
        'timestamp': datetime.now().isoformat()
    }


def benchmark_performance():
    """性能基准测试"""
    print("\n⚡ 性能基准测试")
    print("="*70)
    
    # 生成测试数据
    import random
    test_data = {
        'timestamp': list(range(1600000000000, 1600000000000 + 1000*60000, 60000)),
        'open': [random.uniform(68000, 69000) for _ in range(1000)],
        'high': [random.uniform(68500, 69500) for _ in range(1000)],
        'low': [random.uniform(67500, 68500) for _ in range(1000)],
        'close': [random.uniform(68000, 69000) for _ in range(1000)],
        'volume': [random.uniform(100, 1000) for _ in range(1000)],
    }
    
    df = pl.DataFrame(test_data)
    print(f"测试数据：{len(df)} 根 K 线")
    
    # 测试全量计算
    print(f"\n📈 全量指标计算:")
    start = time.time()
    df_with_indicators = calculate_all_indicators(df)
    t_full = time.time() - start
    print(f"   耗时：{t_full:.3f}秒")
    
    # 测试增量计算
    print(f"\n📈 增量指标计算:")
    new_candles = pl.DataFrame({
        'timestamp': [test_data['timestamp'][-1] + 60000],
        'open': [random.uniform(68000, 69000)],
        'high': [random.uniform(68500, 69500)],
        'low': [random.uniform(67500, 68500)],
        'close': [random.uniform(68000, 69000)],
        'volume': [random.uniform(100, 1000)],
    })
    
    start = time.time()
    df_incremental = calculate_indicators_incremental(df_with_indicators, new_candles)
    t_incremental = time.time() - start
    print(f"   耗时：{t_incremental:.3f}秒")
    
    # 测试信号生成
    print(f"\n📊 信号生成:")
    start = time.time()
    signal = generate_signals_fast(df_with_indicators)
    t_signal = time.time() - start
    print(f"   耗时：{t_signal*1000:.2f}毫秒")
    print(f"   信号：{signal['signal']} (score={signal['score']})")
    
    # 对比 pandas（如果已安装）
    try:
        import pandas as pd
        print(f"\n📊 与 pandas 对比:")
        df_pd = pd.DataFrame(test_data)
        
        start = time.time()
        # 简化的 pandas 计算
        df_pd['ema_5'] = df_pd['close'].ewm(span=5).mean()
        df_pd['ema_9'] = df_pd['close'].ewm(span=9).mean()
        df_pd['rsi_7'] = 100 - (100 / (1 + (
            df_pd['close'].diff().clip(lower=0).rolling(7).mean() /
            (-df_pd['close'].diff()).clip(lower=0).rolling(7).mean()
        )))
        t_pandas = time.time() - start
        
        print(f"   pandas: {t_pandas:.3f}秒")
        print(f"   polars: {t_full:.3f}秒")
        print(f"   加速比：{t_pandas/t_full:.1f}x")
    except ImportError:
        print(f"\n⚠️  未安装 pandas，无法对比")
    
    print(f"\n{'='*70}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="快速指标计算器")
    parser.add_argument("--benchmark", action="store_true", help="性能测试")
    parser.add_argument("--input", help="输入 CSV 文件")
    parser.add_argument("--output", help="输出 CSV 文件")
    
    args = parser.parse_args()
    
    if args.benchmark:
        benchmark_performance()
        return
    
    if args.input:
        # 从 CSV 加载
        print(f"📂 加载 {args.input}...")
        df = pl.read_csv(args.input)
        
        # 计算指标
        df = calculate_all_indicators(df)
        
        # 生成信号
        signal = generate_signals_fast(df)
        print(f"\n📊 最新信号:")
        print(f"   信号：{signal['signal']}")
        print(f"   评分：{signal['score']}")
        print(f"   原因：{signal['reason']}")
        
        if args.output:
            df.write_csv(args.output)
            print(f"\n✅ 已保存到 {args.output}")


if __name__ == "__main__":
    main()
