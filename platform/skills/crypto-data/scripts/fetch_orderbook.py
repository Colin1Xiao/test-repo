#!/usr/bin/env python3
"""
Crypto Order Book Fetcher
获取实时订单簿深度数据
"""

import argparse
import json
import sys

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt", file=sys.stderr)
    sys.exit(1)


def load_config():
    from pathlib import Path
    config_paths = [
        Path(__file__).parent.parent / "config.json",
        Path.home() / ".openclaw" / "workspace" / "skills" / "crypto-data" / "config.json",
    ]
    for path in config_paths:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    return {"exchange": "okx"}


def init_exchange(config):
    exchange_id = config.get("exchange", "okx").lower()
    exchange_class = getattr(ccxt, exchange_id, None)
    if not exchange_class:
        raise ValueError(f"不支持的交易所：{exchange_id}")
    
    exchange = exchange_class({
        "enableRateLimit": True,
        "options": {"defaultType": "future"}
    })
    
    if config.get("testnet", False) and exchange_id == "okx":
        exchange.set_sandbox_mode(True)
    
    return exchange


def fetch_orderbook(symbol, depth=20, exchange=None, max_retries=3):
    """
    获取订单簿（带重试机制）
    
    Args:
        symbol: 交易对
        depth: 深度
        exchange: 交易所实例
        max_retries: 最大重试次数
    
    Returns:
        dict: 订单簿数据或 None
    """
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            orderbook = exchange.fetch_order_book(symbol, limit=depth)
            
            bids = orderbook.get('bids', [])
            asks = orderbook.get('asks', [])
            
            # 计算深度指标
            bid_volume = sum(b[1] for b in bids)
            ask_volume = sum(a[1] for a in asks)
            
            spread = asks[0][0] - bids[0][0] if asks and bids else 0
            mid_price = (bids[0][0] + asks[0][0]) / 2 if asks and bids else 0
            spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0
            
            return {
                "symbol": symbol,
                "timestamp": orderbook.get('timestamp'),
                "bids": [{"price": b[0], "amount": b[1]} for b in bids],
                "asks": [{"price": a[0], "amount": a[1]} for a in asks],
                "spread": spread,
                "spread_pct": spread_pct,
                "bid_volume": bid_volume,
                "ask_volume": ask_volume,
                "bid_ask_ratio": bid_volume / ask_volume if ask_volume > 0 else 0
            }
            
        except ccxt.RateLimitError:
            retry_delay *= 2
            print(f"警告：触发速率限制，等待 {retry_delay}秒后重试... (尝试 {attempt+1}/{max_retries})", file=sys.stderr)
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
        except ccxt.NetworkError as e:
            retry_delay *= 2
            print(f"警告：网络错误 - {e}，等待 {retry_delay}秒后重试... (尝试 {attempt+1}/{max_retries})", file=sys.stderr)
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
        except Exception as e:
            print(f"错误：获取订单簿失败 - {e}", file=sys.stderr)
            return None
    
    print("错误：达到最大重试次数，无法获取订单簿", file=sys.stderr)
    return None


def main():
    parser = argparse.ArgumentParser(description="获取实时订单簿")
    parser.add_argument("--symbol", required=True, help="交易对 (e.g., BTC/USDT)")
    parser.add_argument("--depth", type=int, default=20, help="深度 (默认：20)")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    parser.add_argument("--exchange", help="交易所")
    
    args = parser.parse_args()
    
    config = load_config()
    if args.exchange:
        config["exchange"] = args.exchange
    
    try:
        exchange = init_exchange(config)
    except Exception as e:
        print(f"错误：连接失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    print(f"获取 {args.symbol} 订单簿 (深度：{args.depth})...")
    data = fetch_orderbook(args.symbol, args.depth, exchange)
    
    if not data:
        sys.exit(1)
    
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"交易对：{data['symbol']}")
        print(f"时间：{data['timestamp']}")
        print(f"{'='*60}")
        
        # 卖盘 (asks) - 从低到高
        print(f"\n📈 卖盘 (Asks):")
        print(f"{'价格':>14} {'数量':>14} {'累计':>14}")
        print("-" * 45)
        cumsum = 0
        for ask in reversed(data['asks'][:10]):
            cumsum += ask['amount']
            print(f"{ask['price']:>14.2f} {ask['amount']:>14.4f} {cumsum:>14.4f}")
        
        # 中间价和价差
        print(f"\n中间价：{(data['bids'][0]['price'] + data['asks'][0]['price'])/2:.2f}")
        print(f"价差：{data['spread']:.2f} ({data['spread_pct']:.4f}%)")
        
        # 买盘 (bids) - 从高到低
        print(f"\n📉 买盘 (Bids):")
        print(f"{'价格':>14} {'数量':>14} {'累计':>14}")
        print("-" * 45)
        cumsum = 0
        for bid in data['bids'][:10]:
            cumsum += bid['amount']
            print(f"{bid['price']:>14.2f} {bid['amount']:>14.4f} {cumsum:>14.4f}")
        
        # 深度分析
        print(f"\n{'='*60}")
        print(f"买盘总量：{data['bid_volume']:.4f}")
        print(f"卖盘总量：{data['ask_volume']:.4f}")
        print(f"买卖比：{data['bid_ask_ratio']:.2f}")
        
        if data['bid_ask_ratio'] > 1.2:
            print("信号：买盘较强 → 短期可能上涨")
        elif data['bid_ask_ratio'] < 0.8:
            print("信号：卖盘较强 → 短期可能下跌")
        else:
            print("信号：买卖平衡")
        
        print(f"{'='*60}")


if __name__ == "__main__":
    main()
