#!/usr/bin/env python3
"""
Crypto OHLCV Data Fetcher
获取加密货币 K 线数据（Open, High, Low, Close, Volume）

支持交易所：OKX, Binance, Bybit, Gate.io
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import ccxt
    import pandas as pd
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt pandas", file=sys.stderr)
    sys.exit(1)


def load_config():
    """加载配置文件"""
    config_paths = [
        Path(__file__).parent.parent / "config.json",
        Path.home() / ".openclaw" / "workspace" / "skills" / "crypto-data" / "config.json",
    ]
    
    for path in config_paths:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    
    # 默认配置（无 API 密钥，仅公共数据）
    return {
        "exchange": "okx",
        "testnet": True
    }


def init_exchange(config):
    """初始化交易所连接"""
    exchange_id = config.get("exchange", "okx").lower()
    
    exchange_class = getattr(ccxt, exchange_id, None)
    if not exchange_class:
        raise ValueError(f"不支持的交易所：{exchange_id}")
    
    exchange = exchange_class({
        "apiKey": config.get("apiKey", ""),
        "secret": config.get("secret", ""),
        "password": config.get("password", ""),
        "enableRateLimit": True,
        "options": {
            "defaultType": "future",  # 合约交易
        }
    })
    
    # 测试网模式
    if config.get("testnet", False):
        if exchange_id == "okx":
            exchange.set_sandbox_mode(True)
    
    return exchange


def fetch_ohlcv(symbol, timeframe="1m", limit=100, exchange=None):
    """
    获取 K 线数据
    
    Args:
        symbol: 交易对 (e.g., "BTC/USDT")
        timeframe: 时间框架 (1m, 5m, 15m, 1h, 4h, 1d)
        limit: 获取数量 (最多 1000)
        exchange: 交易所实例
    
    Returns:
        list: K 线数据列表
    """
    if exchange is None:
        config = load_config()
        exchange = init_exchange(config)
    
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            
            # 转换为标准格式
            data = []
            for candle in ohlcv:
                data.append({
                    "timestamp": candle[0],
                    "datetime": datetime.fromtimestamp(candle[0] / 1000).isoformat(),
                    "open": candle[1],
                    "high": candle[2],
                    "low": candle[3],
                    "close": candle[4],
                    "volume": candle[5]
                })
            
            return data
            
        except (ccxt.RateLimitExceeded, ccxt.RequestTimeout) as e:
            print(f"警告：触发速率限制或超时 - {e}，等待 {retry_delay * 2}秒后重试...", file=sys.stderr)
            time.sleep(retry_delay * 2)
            retry_delay *= 2
        except (ccxt.NetworkError, ccxt.ExchangeError) as e:
            print(f"警告：网络错误 - {e}，等待 {retry_delay}秒后重试...", file=sys.stderr)
            time.sleep(retry_delay)
            retry_delay *= 2
        except Exception as e:
            print(f"错误：获取数据失败 - {e}", file=sys.stderr)
            return None
    
    print("错误：达到最大重试次数", file=sys.stderr)
    return None


def save_to_csv(data, output_path):
    """保存数据到 CSV"""
    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False)
    print(f"已保存 {len(data)} 条记录到 {output_path}")


def main():
    parser = argparse.ArgumentParser(description="获取加密货币 K 线数据")
    parser.add_argument("--symbol", required=True, help="交易对 (e.g., BTC/USDT)")
    parser.add_argument("--timeframe", default="1m", 
                       choices=["1m", "5m", "15m", "1h", "4h", "1d"],
                       help="时间框架 (默认：1m)")
    parser.add_argument("--limit", type=int, default=100, 
                       help="获取数量 (默认：100, 最大：1000)")
    parser.add_argument("--output", "-o", help="输出文件路径 (CSV)")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    parser.add_argument("--exchange", help="交易所 (okx, binance, bybit)")
    
    args = parser.parse_args()
    
    # 初始化交易所
    config = load_config()
    if args.exchange:
        config["exchange"] = args.exchange
    
    try:
        exchange = init_exchange(config)
        print(f"已连接交易所：{config['exchange']} {'(测试网)' if config.get('testnet') else ''}")
    except Exception as e:
        print(f"错误：连接交易所失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 获取数据
    print(f"获取 {args.symbol} {args.timeframe} K 线数据 (最近 {args.limit} 根)...")
    data = fetch_ohlcv(args.symbol, args.timeframe, args.limit, exchange)
    
    if not data:
        sys.exit(1)
    
    # 输出结果
    if args.json:
        print(json.dumps({
            "symbol": args.symbol,
            "timeframe": args.timeframe,
            "count": len(data),
            "data": data
        }, indent=2))
    elif args.output:
        save_to_csv(data, args.output)
    else:
        # 表格输出
        print(f"\n{'时间':<22} {'开盘':>12} {'最高':>12} {'最低':>12} {'收盘':>12} {'成交量':>14}")
        print("-" * 88)
        for candle in data[-10:]:  # 只显示最后 10 条
            print(f"{candle['datetime']:<22} {candle['open']:>12.2f} {candle['high']:>12.2f} "
                  f"{candle['low']:>12.2f} {candle['close']:>12.2f} {candle['volume']:>14.4f}")
        print(f"\n共 {len(data)} 条记录")
    
    # 显示最新价格
    latest = data[-1]
    print(f"\n最新价格：{latest['close']:.2f} ({datetime.fromtimestamp(latest['timestamp']/1000).strftime('%H:%M:%S')})")


if __name__ == "__main__":
    main()
