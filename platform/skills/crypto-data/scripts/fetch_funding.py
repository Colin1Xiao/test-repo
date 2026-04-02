#!/usr/bin/env python3
"""
Crypto Funding Rate Fetcher
获取合约资金费率

资金费率是永续合约特有的机制，用于使合约价格锚定现货价格。
正费率：多头支付空头（市场看涨）
负费率：空头支付多头（市场看跌）
"""

import argparse
import json
import sys
from datetime import datetime

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt", file=sys.stderr)
    sys.exit(1)


def load_config():
    """加载配置文件"""
    from pathlib import Path
    config_paths = [
        Path(__file__).parent.parent / "config.json",
        Path.home() / ".openclaw" / "workspace" / "skills" / "crypto-data" / "config.json",
    ]
    
    for path in config_paths:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    
    return {"exchange": "okx", "testnet": False}


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
        "options": {"defaultType": "future"}
    })
    
    if config.get("testnet", False) and exchange_id == "okx":
        exchange.set_sandbox_mode(True)
    
    return exchange


def fetch_funding_rate(symbol, exchange=None):
    """
    获取资金费率
    
    Args:
        symbol: 交易对 (e.g., "BTC/USDT")
        exchange: 交易所实例
    
    Returns:
        dict: 资金费率信息
    """
    try:
        # 获取资金费率历史
        funding_rate = exchange.fetch_funding_rate(symbol)
        
        return {
            "symbol": symbol,
            "funding_rate": funding_rate.get("fundingRate", 0),
            "funding_timestamp": funding_rate.get("fundingTimestamp"),
            "next_funding_time": funding_rate.get("nextFundingTime"),
            "mark_price": funding_rate.get("markPrice"),
            "index_price": funding_rate.get("indexPrice")
        }
    except Exception as e:
        print(f"警告：获取资金费率失败 - {e}", file=sys.stderr)
        return None


def fetch_funding_history(symbol, limit=10, exchange=None):
    """获取资金费率历史"""
    try:
        history = exchange.fetch_funding_rate_history(symbol, limit=limit)
        return history
    except Exception as e:
        print(f"警告：获取历史费率失败 - {e}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description="获取合约资金费率")
    parser.add_argument("--symbol", required=True, help="交易对 (e.g., BTC/USDT)")
    parser.add_argument("--history", type=int, default=0, help="获取历史费率数量")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    parser.add_argument("--exchange", help="交易所 (okx, binance, bybit)")
    
    args = parser.parse_args()
    
    # 初始化
    config = load_config()
    if args.exchange:
        config["exchange"] = args.exchange
    
    try:
        exchange = init_exchange(config)
    except Exception as e:
        print(f"错误：连接失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 获取当前资金费率
    print(f"获取 {args.symbol} 资金费率...")
    funding = fetch_funding_rate(args.symbol, exchange)
    
    if not funding:
        sys.exit(1)
    
    # 输出
    if args.json:
        result = {"current": funding}
        if args.history > 0:
            result["history"] = fetch_funding_history(args.symbol, args.history, exchange)
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*50}")
        print(f"交易对：{funding['symbol']}")
        print(f"{'='*50}")
        
        rate = funding['funding_rate']
        rate_pct = rate * 100
        print(f"当前资金费率：{rate:.6f} ({rate_pct:+.4f}%)")
        
        if funding.get('mark_price'):
            print(f"标记价格：{funding['mark_price']:.2f}")
        
        if funding.get('index_price'):
            print(f"指数价格：{funding['index_price']:.2f}")
        
        if funding.get('next_funding_time'):
            next_time = datetime.fromtimestamp(funding['next_funding_time'] / 1000)
            print(f"下次结算：{next_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 费率解读
        print(f"\n{'='*50}")
        if rate > 0.0001:
            print(f"解读：费率为正 → 多头支付空头 (市场情绪偏多)")
            print(f"     每 10000U 仓位支付：{abs(rate * 10000):.2f} USDT/8 小时")
        elif rate < -0.0001:
            print(f"解读：费率为负 → 空头支付多头 (市场情绪偏空)")
            print(f"     每 10000U 仓位支付：{abs(rate * 10000):.2f} USDT/8 小时")
        else:
            print(f"解读：费率接近平衡")
        
        print(f"{'='*50}")
        
        # 历史记录
        if args.history > 0:
            history = fetch_funding_history(args.symbol, args.history, exchange)
            if history:
                print(f"\n最近 {len(history)} 次资金费率:")
                print(f"{'时间':<22} {'费率':>12} {'年化':>12}")
                print("-" * 50)
                for h in history[-5:]:
                    ts = h.get('fundingTimestamp', 0)
                    rate = h.get('fundingRate', 0)
                    if ts:
                        dt = datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d %H:%M')
                        annual = rate * 3 * 365 * 100  # 年化估算
                        print(f"{dt:<22} {rate:>12.6f} {annual:>11.2f}%")


if __name__ == "__main__":
    main()
