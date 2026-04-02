#!/usr/bin/env python3
"""
Fast OHLCV Data Fetcher with Polars + Cache
快速 K 线数据获取 - Polars + 缓存优化

优化:
1. 使用 polars 替代 pandas (快 10-100x)
2. 添加缓存层（5 分钟内不重复请求）
3. 增量获取（只获取新增 K 线）
"""

import sys
import time
from pathlib import Path
from datetime import datetime

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'crypto-common'))

try:
    import ccxt
    import polars as pl  # 替代 pandas
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt polars", file=sys.stderr)
    sys.exit(1)

from cache import ohlcv_cache


def fetch_ohlcv_cached(symbol, timeframe='1m', limit=100):
    """
    获取 K 线数据（带缓存）
    
    Args:
        symbol: 交易对
        timeframe: 时间框架
        limit: 数量
    
    Returns:
        polars.DataFrame: K 线数据
    """
    # 生成缓存 key
    cache_key = f"{symbol}:{timeframe}:{limit}"
    
    # 尝试从缓存获取
    cached_data = ohlcv_cache.get(cache_key)
    if cached_data is not None:
        # 从缓存恢复 DataFrame
        df = pl.DataFrame(cached_data)
        print(f"✅ 从缓存获取 {symbol} {timeframe} (节省 ~2 秒)")
        return df
    
    # 缓存未命中，实际获取
    print(f"📡 从 OKX 获取 {symbol} {timeframe}...")
    start_time = time.time()
    
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        
        # 使用 polars 创建 DataFrame（比 pandas 快）
        df = pl.DataFrame(ohlcv, schema=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # 添加 datetime 列
        df = df.with_columns(
            pl.from_epoch(pl.col('timestamp'), time_unit='ms').alias('datetime')
        )
        
        # 存入缓存
        ohlcv_cache.set(cache_key, df.to_dicts())
        
        elapsed = time.time() - start_time
        print(f"✅ 获取完成，耗时 {elapsed:.2f}秒，缓存 5 分钟")
        
        return df
        
    except Exception as e:
        print(f"❌ 获取失败：{e}", file=sys.stderr)
        # 返回空 DataFrame
        return pl.DataFrame()


def fetch_ohlcv_incremental(symbol, timeframe='1m', last_timestamp=None):
    """
    增量获取 K 线数据（只获取新增的）
    
    Args:
        symbol: 交易对
        timeframe: 时间框架
        last_timestamp: 上次获取的最后时间戳
    
    Returns:
        polars.DataFrame: 新增的 K 线数据
    """
    exchange = ccxt.okx({'options': {'defaultType': 'future'}})
    
    # 计算需要获取的数量
    # 例如：1 分钟 K 线，距离上次已过去 10 分钟，则获取 10 根
    if last_timestamp:
        now = int(time.time() * 1000)
        minutes_passed = (now - last_timestamp) // (60 * 1000)
        limit = max(minutes_passed + 5, 10)  # 多获取 5 根作为缓冲
    else:
        limit = 100
    
    print(f"📡 增量获取 {symbol} {timeframe} (约 {limit} 根)...")
    
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    
    # 过滤出新增的 K 线
    if last_timestamp:
        ohlcv = [candle for candle in ohlcv if candle[0] > last_timestamp]
    
    df = pl.DataFrame(ohlcv, schema=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    
    if not df.is_empty():
        df = df.with_columns(
            pl.from_epoch(pl.col('timestamp'), time_unit='ms').alias('datetime')
        )
        print(f"✅ 新增 {len(df)} 根 K 线")
    
    return df


def calculate_indicators_fast(df):
    """
    使用 polars 快速计算技术指标
    
    Args:
        df: polars.DataFrame (包含 OHLCV)
    
    Returns:
        polars.DataFrame: 添加指标后的 DataFrame
    """
    if df.is_empty():
        return df
    
    # 使用 polars 表达式计算（比 pandas 快 10-100x）
    
    # EMA 计算
    df = df.with_columns([
        pl.col('close').ewm_mean(span=5).alias('ema_5'),
        pl.col('close').ewm_mean(span=9).alias('ema_9'),
        pl.col('close').ewm_mean(span=20).alias('ema_20'),
        pl.col('close').ewm_mean(span=50).alias('ema_50'),
    ])
    
    # RSI 计算
    delta = pl.col('close').diff()
    gain = delta.clip(min_value=0)
    loss = (-delta).clip(min_value=0)
    
    avg_gain = gain.rolling_mean(window_size=7)
    avg_loss = loss.rolling_mean(window_size=7)
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    df = df.with_columns([
        rsi.alias('rsi_7')
    ])
    
    # 成交量均线
    df = df.with_columns([
        pl.col('volume').rolling_mean(window_size=20).alias('volume_ma_20'),
        (pl.col('volume') / pl.col('volume').rolling_mean(window_size=20)).alias('volume_ratio')
    ])
    
    # 动量
    df = df.with_columns([
        (pl.col('close').pct_change(periods=3) * 100).alias('momentum_3'),
        (pl.col('close').pct_change(periods=5) * 100).alias('momentum_5')
    ])
    
    return df


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="快速 K 线数据获取")
    parser.add_argument("--symbol", default="BTC/USDT", help="交易对")
    parser.add_argument("--timeframe", default="1m", help="时间框架")
    parser.add_argument("--limit", type=int, default=100, help="数量")
    parser.add_argument("--cached", action="store_true", help="使用缓存")
    parser.add_argument("--test-speed", action="store_true", help="速度测试")
    
    args = parser.parse_args()
    
    print(f"🚀 快速 K 线数据获取 - {args.symbol}")
    print("="*70)
    
    if args.test_speed:
        # 速度对比测试
        print("\n⚡ 速度对比测试")
        print("="*70)
        
        # 第一次获取（无缓存）
        print("\n第 1 次获取（无缓存）:")
        start = time.time()
        df1 = fetch_ohlcv_cached(args.symbol, args.timeframe, args.limit)
        t1 = time.time() - start
        
        # 第二次获取（有缓存）
        print("\n第 2 次获取（缓存命中）:")
        start = time.time()
        df2 = fetch_ohlcv_cached(args.symbol, args.timeframe, args.limit)
        t2 = time.time() - start
        
        print(f"\n📊 性能对比:")
        print(f"  无缓存：{t1:.2f}秒")
        print(f"  有缓存：{t2:.2f}秒")
        print(f"  加速比：{t1/t2:.1f}x")
        
        # 指标计算速度
        print(f"\n📈 指标计算测试:")
        start = time.time()
        df_with_indicators = calculate_indicators_fast(df1)
        t_ind = time.time() - start
        print(f"  Polars 计算指标：{t_ind:.3f}秒 ({len(df1)} 根 K 线)")
        
        return
    
    # 正常获取
    if args.cached:
        df = fetch_ohlcv_cached(args.symbol, args.timeframe, args.limit)
    else:
        # 不使用缓存
        exchange = ccxt.okx({'options': {'defaultType': 'future'}})
        ohlcv = exchange.fetch_ohlcv(args.symbol, timeframe=args.timeframe, limit=args.limit)
        df = pl.DataFrame(ohlcv, schema=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df = df.with_columns(
            pl.from_epoch(pl.col('timestamp'), time_unit='ms').alias('datetime')
        )
    
    # 显示结果
    if not df.is_empty():
        print(f"\n📊 数据预览:")
        print(df.head(5))
        
        print(f"\n📈 统计信息:")
        print(f"  总 K 线数：{len(df)}")
        print(f"  最新价格：{df['close'][-1]:.2f}")
        print(f"  最高价：{df['high'].max():.2f}")
        print(f"  最低价：{df['low'].min():.2f}")
        print(f"  时间范围：{df['datetime'][0]} - {df['datetime'][-1]}")


if __name__ == "__main__":
    main()
