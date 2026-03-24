#!/usr/bin/env python3
"""
Crypto Trade Executor
加密货币交易执行 - 开仓、平仓、查询
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

try:
    import ccxt
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    print("运行：pip3 install ccxt", file=sys.stderr)
    sys.exit(1)


def load_config():
    """加载配置"""
    config_paths = [
        Path(__file__).parent.parent / "config.json",
        Path.home() / ".openclaw" / "workspace" / "skills" / "crypto-execute" / "config.json",
    ]
    
    for path in config_paths:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    
    return {"exchange": "okx", "testnet": True}


def init_exchange(config):
    """初始化交易所"""
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
            "defaultType": "future",
        }
    })
    
    if config.get("testnet", False) and exchange_id == "okx":
        exchange.set_sandbox_mode(True)
        print("ℹ️  测试网模式")
    
    return exchange


def get_position(exchange, symbol):
    """查询仓位"""
    try:
        positions = exchange.fetch_positions([symbol])
        for pos in positions:
            if pos['symbol'] == symbol and float(pos['contracts']) != 0:
                return pos
        return None
    except Exception as e:
        print(f"查询仓位失败：{e}", file=sys.stderr)
        return None


def get_balance(exchange):
    """查询余额"""
    try:
        balance = exchange.fetch_balance()
        return balance.get('total', {}).get('USDT', 0)
    except Exception as e:
        print(f"查询余额失败：{e}", file=sys.stderr)
        return 0


def open_position(exchange, symbol, side, size, leverage=10, price=None):
    """
    开仓
    
    Args:
        exchange: 交易所实例
        symbol: 交易对
        side: 'buy' (做多) 或 'sell' (做空)
        size: 仓位大小 (USDT)
        leverage: 杠杆倍数
        price: 限价单价格 (None 为市价单)
    """
    # 设置杠杆
    try:
        exchange.set_leverage(leverage, symbol)
        print(f"✓ 杠杆设置为 {leverage}x")
    except Exception as e:
        print(f"设置杠杆失败：{e}", file=sys.stderr)
    
    # 计算合约数量
    ticker = exchange.fetch_ticker(symbol)
    current_price = ticker['last']
    contracts = size / current_price
    
    # 下单
    order_type = 'limit' if price else 'market'
    order_price = price if price else current_price
    
    try:
        order = exchange.create_order(
            symbol=symbol,
            type=order_type,
            side=side,
            amount=contracts,
            price=order_price
        )
        
        return {
            'success': True,
            'order_id': order['id'],
            'symbol': symbol,
            'side': side,
            'size': size,
            'price': order_price,
            'leverage': leverage,
            'status': order['status'],
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def close_position(exchange, symbol, pct=100):
    """
    平仓
    
    Args:
        exchange: 交易所实例
        symbol: 交易对
        pct: 平仓比例 (0-100)
    """
    position = get_position(exchange, symbol)
    
    if not position:
        return {'success': False, 'error': '无仓位'}
    
    contracts = float(position['contracts'])
    side = position['side']
    
    # 平仓方向与仓位相反
    close_side = 'sell' if side == 'long' else 'buy'
    close_amount = contracts * (pct / 100)
    
    try:
        order = exchange.create_order(
            symbol=symbol,
            type='market',
            side=close_side,
            amount=close_amount,
            params={'reduceOnly': True}
        )
        
        return {
            'success': True,
            'order_id': order['id'],
            'symbol': symbol,
            'closed_pct': pct,
            'status': order['status']
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    parser = argparse.ArgumentParser(description="加密货币交易执行")
    parser.add_argument("--symbol", help="交易对 (e.g., BTC/USDT)")
    parser.add_argument("--side", choices=['buy', 'sell'], help="方向 (buy=做多，sell=做空)")
    parser.add_argument("--size", type=float, help="仓位大小 (USDT)")
    parser.add_argument("--leverage", type=int, default=10, help="杠杆倍数")
    parser.add_argument("--price", type=float, help="限价单价格")
    parser.add_argument("--close-all", action="store_true", help="平掉所有仓位")
    parser.add_argument("--close-pct", type=float, help="平仓比例 (%)")
    parser.add_argument("--get-position", action="store_true", help="查询仓位")
    parser.add_argument("--get-balance", action="store_true", help="查询余额")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--dry-run", action="store_true", help="模拟模式")
    
    args = parser.parse_args()
    
    # 加载配置
    config = load_config()
    
    try:
        exchange = init_exchange(config)
    except Exception as e:
        print(f"错误：连接交易所失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 查询余额
    if args.get_balance:
        balance = get_balance(exchange)
        result = {'balance_usdt': balance}
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"\n💰 账户余额：{balance:.2f} USDT\n")
        return
    
    # 查询仓位
    if args.get_position and args.symbol:
        position = get_position(exchange, args.symbol)
        if args.json:
            print(json.dumps(position or {}, indent=2))
        else:
            if position:
                print(f"\n📊 {args.symbol} 仓位:")
                print(f"   方向：{position['side']}")
                print(f"   数量：{position['contracts']}")
                print(f"   入场价：{position['entryPrice']:.2f}")
                print(f"   未实现盈亏：{position['unrealizedPnl']:.2f} USDT")
            else:
                print(f"\n无 {args.symbol} 仓位\n")
        return
    
    # 平仓
    if args.close_all and args.symbol:
        result = close_position(exchange, args.symbol, 100)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result['success']:
                print(f"\n✓ 已平掉 {args.symbol} 所有仓位\n")
            else:
                print(f"\n✗ 平仓失败：{result.get('error')}\n")
        return
    
    if args.close_pct and args.symbol:
        result = close_position(exchange, args.symbol, args.close_pct)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result['success']:
                print(f"\n✓ 已平掉 {args.symbol} {args.close_pct}% 仓位\n")
            else:
                print(f"\n✗ 平仓失败：{result.get('error')}\n")
        return
    
    # 开仓
    if args.symbol and args.side and args.size:
        if args.dry_run:
            print(f"\n🔸 [模拟] {args.side.upper()} {args.symbol}")
            print(f"   仓位：{args.size} USDT")
            print(f"   杠杆：{args.leverage}x")
            print(f"   价格：{args.price or '市价'}\n")
            return
        
        result = open_position(exchange, args.symbol, args.side, args.size, 
                              args.leverage, args.price)
        
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result['success']:
                print(f"\n✓ 开仓成功!")
                print(f"   订单 ID: {result['order_id']}")
                print(f"   交易对：{result['symbol']}")
                print(f"   方向：{'做多' if result['side'] == 'buy' else '做空'}")
                print(f"   仓位：{result['size']} USDT @ {result['leverage']}x")
                print(f"   状态：{result['status']}\n")
            else:
                print(f"\n✗ 开仓失败：{result.get('error')}\n")
        return
    
    # 无操作
    parser.print_help()


if __name__ == "__main__":
    main()
