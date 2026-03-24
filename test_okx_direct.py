#!/usr/bin/env python3
"""直接测试 OKX 连接"""

import os
# 必须在导入 ccxt 之前设置
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']

import ccxt

print("🧪 测试 OKX 连接...")
print(f"代理: {os.environ.get('https_proxy')}")

exchange = ccxt.okx({
    'proxies': {
        'http': 'http://127.0.0.1:7890',
        'https': 'http://127.0.0.1:7890',
    }
})

try:
    ticker = exchange.fetch_ticker('BTC-USDT')
    print(f'✅ 成功! BTC价格: ${ticker["last"]}')
except Exception as e:
    print(f'❌ 失败: {e}')
