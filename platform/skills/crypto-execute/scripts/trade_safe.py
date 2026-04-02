#!/usr/bin/env python3
"""
Safe Trade Executor (with confirmation)
安全交易执行 - 带二次确认
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
        "timeout": 30000,
        "options": {"defaultType": "future"}
    })
    
    if config.get("testnet", False) and exchange_id == "okx":
        exchange.set_sandbox_mode(True)
        print("ℹ️  测试网模式")
    
    return exchange


def confirm_trade(symbol, side, size, leverage, price=None):
    """
    交易二次确认
    
    Returns:
        bool: 用户是否确认
    """
    print(f"\n{'='*60}")
    print(f"⚠️  交易确认")
    print(f"{'='*60}")
    print(f"交易对：  {symbol}")
    print(f"方向：    {'做多 (BUY)' if side == 'buy' else '做空 (SELL)'}")
    print(f"仓位：    {size} USDT")
    print(f"杠杆：    {leverage}x")
    if price:
        print(f"价格：    {price} USDT (限价单)")
    else:
        print(f"价格：    市价单")
    print(f"{'='*60}")
    
    # 风险提示
    if leverage >= 50:
        print(f"\n🔴 高风险警告：{leverage}倍杠杆极易爆仓！")
        liquidation_pct = 100 / leverage
        print(f"   价格反向波动 {liquidation_pct:.1f}% 就会爆仓")
    
    if size >= 10000:
        print(f"\n⚠️  大额交易警告：{size} USDT")
        print(f"   建议分批建仓")
    
    print(f"\n{'='*60}")
    
    # 确认输入
    while True:
        response = input("\n确认执行此交易？(yes/no): ").strip().lower()
        if response in ['yes', 'y']:
            return True
        elif response in ['no', 'n']:
            return False
        else:
            print("请输入 yes 或 no")


def open_position_safe(exchange, symbol, side, size, leverage=10, price=None, require_confirm=True):
    """
    安全开仓（带确认）
    
    Args:
        exchange: 交易所实例
        symbol: 交易对
        side: 'buy' 或 'sell'
        size: 仓位大小
        leverage: 杠杆
        price: 限价（None 为市价）
        require_confirm: 是否需要确认
    
    Returns:
        dict: 交易结果
    """
    # 二次确认
    if require_confirm:
        if not confirm_trade(symbol, side, size, leverage, price):
            return {'success': False, 'error': '用户取消交易'}
    
    # 设置杠杆
    try:
        exchange.set_leverage(leverage, symbol)
        print(f"✓ 杠杆设置为 {leverage}x")
    except Exception as e:
        print(f"设置杠杆失败：{e}", file=sys.stderr)
    
    # 获取当前价格
    ticker = exchange.fetch_ticker(symbol)
    current_price = ticker['last']
    contracts = size / current_price
    
    # 下单
    order_type = 'limit' if price else 'market'
    order_price = price if price else current_price
    
    try:
        print(f"\n正在下单...")
        order = exchange.create_order(
            symbol=symbol,
            type=order_type,
            side=side,
            amount=contracts,
            price=order_price
        )
        
        result = {
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
        
        print(f"\n✓ 开仓成功!")
        print(f"   订单 ID: {order['id']}")
        print(f"   状态：{order['status']}")
        
        return result
        
    except ccxt.InsufficientFunds:
        error_msg = "余额不足"
        print(f"\n✗ 开仓失败：{error_msg}", file=sys.stderr)
        return {'success': False, 'error': error_msg}
    except ccxt.InvalidOrder as e:
        error_msg = f"订单无效：{e}"
        print(f"\n✗ 开仓失败：{error_msg}", file=sys.stderr)
        return {'success': False, 'error': error_msg}
    except Exception as e:
        error_msg = str(e)
        print(f"\n✗ 开仓失败：{error_msg}", file=sys.stderr)
        return {'success': False, 'error': error_msg}


def main():
    parser = argparse.ArgumentParser(description="安全交易执行（带确认）")
    parser.add_argument("--symbol", help="交易对")
    parser.add_argument("--side", choices=['buy', 'sell'], help="方向")
    parser.add_argument("--size", type=float, help="仓位大小")
    parser.add_argument("--leverage", type=int, default=10, help="杠杆倍数")
    parser.add_argument("--price", type=float, help="限价单价格")
    parser.add_argument("--no-confirm", action="store_true", help="跳过确认（脚本模式）")
    parser.add_argument("--dry-run", action="store_true", help="模拟模式")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    
    args = parser.parse_args()
    
    # 加载配置
    config = load_config()
    
    try:
        exchange = init_exchange(config)
    except Exception as e:
        print(f"错误：连接交易所失败 - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 模拟模式
    if args.dry_run:
        print(f"\n🔸 [模拟] {args.side.upper()} {args.symbol}")
        print(f"   仓位：{args.size} USDT")
        print(f"   杠杆：{args.leverage}x")
        print(f"   价格：{args.price or '市价'}")
        print(f"   状态：未执行（dry-run）\n")
        return
    
    # 开仓
    if args.symbol and args.side and args.size:
        result = open_position_safe(
            exchange, 
            args.symbol, 
            args.side, 
            args.size, 
            args.leverage, 
            args.price,
            require_confirm=not args.no_confirm
        )
        
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if not result['success']:
                print(f"\n交易失败：{result.get('error')}\n")
        return
    
    # 无操作
    parser.print_help()


if __name__ == "__main__":
    main()
