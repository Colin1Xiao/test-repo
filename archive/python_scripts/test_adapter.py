#!/usr/bin/env python3
"""测试 multi_exchange_adapter"""

import os
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']

import asyncio
from multi_exchange_adapter import OKXAdapter

async def test():
    print("🧪 测试 OKXAdapter...")
    adapter = OKXAdapter({
        'api_key': '',
        'secret_key': '',
        'passphrase': ''
    })
    
    # 测试 get_ticker
    print("测试 get_ticker...")
    ticker = await adapter.get_ticker("BTC/USDT")
    if ticker:
        print(f"✅ 成功! BTC: ${ticker.price}")
    else:
        print("❌ 失败")

asyncio.run(test())
