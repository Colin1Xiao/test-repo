#!/usr/bin/env python3
"""
OKX Testnet 连接诊断

测试：
1. 直接 HTTP 请求（不用 ccxt）
2. ccxt fetch_order_book
3. 代理连通性
"""

import asyncio
import aiohttp
import os

async def test_proxy():
    """测试代理连通性"""
    print("=" * 60)
    print("🔍 测试代理连通性")
    print("=" * 60)
    
    proxy = "http://127.0.0.1:7890"
    test_url = "https://www.okx.com/api/v5/public/time"
    
    print(f"代理：{proxy}")
    print(f"URL: {test_url}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(test_url, proxy=proxy, timeout=10) as resp:
                print(f"状态码：{resp.status}")
                data = await resp.json()
                print(f"响应：{data}")
                return True
    except Exception as e:
        print(f"❌ 失败：{e}")
        return False


async def test_okx_public_api():
    """测试 OKX 公共 API（不用 ccxt）"""
    print("\n" + "=" * 60)
    print("🔍 测试 OKX 公共 API")
    print("=" * 60)
    
    # OKX Testnet API base URL
    base_url = "https://www.okx.com"
    endpoint = "/api/v5/market/books?instId=ETH-USDT-SWAP"
    
    print(f"URL: {base_url}{endpoint}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(base_url + endpoint, timeout=10) as resp:
                print(f"状态码：{resp.status}")
                data = await resp.json()
                print(f"响应码：{data.get('code')}")
                print(f"响应消息：{data.get('msg')}")
                
                if data.get('code') == '0' and data.get('data'):
                    books = data['data'][0].get('bids', [])
                    asks = data['data'][0].get('asks', [])
                    print(f"买档：{len(books)}")
                    print(f"卖档：{len(asks)}")
                    
                    if books:
                        print(f"最佳买价：{books[0][0]}")
                    if asks:
                        print(f"最佳卖价：{asks[0][0]}")
                    
                    return True
                else:
                    print(f"❌ API 返回错误：{data}")
                    return False
                    
    except Exception as e:
        print(f"❌ 失败：{e}")
        import traceback
        traceback.print_exc()
        return False


async def test_ccxt_fetch_order_book():
    """测试 ccxt fetch_order_book"""
    print("\n" + "=" * 60)
    print("🔍 测试 ccxt fetch_order_book")
    print("=" * 60)
    
    import ccxt.async_support as ccxt
    
    proxy = "http://127.0.0.1:7890"
    
    exchange = ccxt.okx({
        'enableRateLimit': True,
        'timeout': 10000,
        'options': {
            'defaultType': 'swap',
        },
        'proxies': {
            'http': proxy,
            'https': proxy,
        },
    })
    
    # Testnet 模式
    exchange.set_sandbox_mode(True)
    
    print(f"交易所：{exchange.id}")
    print(f"代理：{proxy}")
    print(f"Symbol: ETH/USDT:USDT")
    
    try:
        orderbook = await exchange.fetch_order_book("ETH/USDT:USDT")
        print(f"买档：{len(orderbook.get('bids', []))}")
        print(f"卖档：{len(orderbook.get('asks', []))}")
        
        if orderbook.get('bids'):
            print(f"最佳买价：{orderbook['bids'][0][0]}")
        if orderbook.get('asks'):
            print(f"最佳卖价：{orderbook['asks'][0][0]}")
        
        await exchange.close()
        return len(orderbook.get('bids', [])) > 0
        
    except Exception as e:
        print(f"❌ 失败：{e}")
        import traceback
        traceback.print_exc()
        await exchange.close()
        return False


async def main():
    print("=" * 60)
    print("🧪 OKX Testnet 连接诊断")
    print("=" * 60)
    
    results = {
        "代理连通性": await test_proxy(),
        "OKX 公共 API": await test_okx_public_api(),
        "ccxt fetch_order_book": await test_ccxt_fetch_order_book(),
    }
    
    print("\n" + "=" * 60)
    print("📊 诊断结果汇总")
    print("=" * 60)
    
    for name, passed in results.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {name}: {'通过' if passed else '失败'}")
    
    if all(results.values()):
        print("\n✅ 所有连接测试通过")
    else:
        print("\n❌ 部分测试失败，请检查网络/代理配置")
    
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
