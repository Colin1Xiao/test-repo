#!/usr/bin/env python3
"""快速检查账户状态"""

import sys
import json
import ccxt.async_support as ccxt
import asyncio
from pathlib import Path

async def main():
    # 加载 API 配置
    secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
    
    with open(secrets_path) as f:
        config = json.load(f)
    
    okx = config.get('okx', {})
    
    proxy = 'http://127.0.0.1:7890'
    
    exchange = ccxt.okx({
        'apiKey': okx.get('api_key'),
        'secret': okx.get('secret_key'),
        'password': okx.get('passphrase'),
        'enableRateLimit': True,
        'options': {'defaultType': 'swap'},
        'proxies': {'http': proxy, 'https': proxy},
    })
    
    if okx.get('testnet'):
        exchange.set_sandbox_mode(True)
        print("⚠️ Testnet 模式")
    else:
        print("🟢 Mainnet 模式")
    
    try:
        # 查询余额
        balance = await exchange.fetch_balance({'type': 'swap'})
        usdt = balance.get('USDT', {})
        total = usdt.get('total', 0)
        free = usdt.get('free', 0)
        used = usdt.get('used', 0)
        
        print(f"\n💰 账户余额:")
        print(f"   总计: ${total:.2f} USDT")
        print(f"   可用: ${free:.2f} USDT")
        print(f"   占用: ${used:.2f} USDT")
        
        # 查询持仓
        positions = await exchange.fetch_positions(['ETH/USDT:USDT'])
        eth_pos = [p for p in positions if p.get('symbol') == 'ETH/USDT:USDT']
        
        if eth_pos:
            pos = eth_pos[0]
            size = float(pos.get('contracts', 0))
            if size != 0:
                print(f"\n📊 当前持仓:")
                print(f"   ETH: {size} ({pos.get('side')})")
                print(f"   Entry: {pos.get('entryPrice')}")
                print(f"   PnL: {pos.get('unrealizedPnl')}")
            else:
                print(f"\n📊 当前持仓: 无")
        else:
            print(f"\n📊 当前持仓: 无")
        
        # 查询 ETH 价格
        ticker = await exchange.fetch_ticker('ETH/USDT:USDT')
        price = ticker.get('last', 0)
        print(f"\n📈 ETH 价格: ${price:.2f}")
        
        # 计算可开仓数
        max_pos = min(3, free)  # max_position_usd = 3
        eth_size = max_pos / price * 100  # 100x
        print(f"\n🎯 可开仓:")
        print(f"   最大保证金: ${max_pos:.2f}")
        print(f"   ETH 数量: {eth_size:.4f} ETH (100x)")
        
        return total > 0
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False
    finally:
        await exchange.close()

if __name__ == "__main__":
    asyncio.run(main())