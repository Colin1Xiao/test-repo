#!/usr/bin/env python3
from okx_api_client import OKXClient

client = OKXClient()

print("🔍 测试 OKXClient...")
print()

# 测试不同格式的标的
test_symbols = [
    'BTC-USDT-SWAP',
    'BTC/USDT:USDT-SWAP',
    'BTC/USDT:USDT',
]

for symbol in test_symbols:
    print(f"测试：{symbol}")
    result = client.fetch_ticker(symbol)
    if result['success']:
        ticker = result['data'][0]
        print(f"   ✅ ${float(ticker.get('last', 0)):,.2f}")
    else:
        print(f"   ❌ {result['error']}")
    print()
