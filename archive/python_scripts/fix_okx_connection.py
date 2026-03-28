#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 OKX API 连接问题
确保可以访问合约市场数据
"""

import requests
import os
from datetime import datetime

print("="*70)
print("🔧 修复 OKX API 连接")
print("="*70)
print()

# 代理配置
proxy = os.getenv('https_proxy', 'http://127.0.0.1:7890')

print("📋 测试连接方式...")
print()

# 测试 1: 直连
print("1️⃣  直连 OKX (不使用代理)...")
try:
    response = requests.get('https://www.okx.com/api/v5/public/time', timeout=10)
    if response.status_code == 200:
        print("   ✅ 直连成功！")
        USE_PROXY = False
    else:
        print(f"   ⚠️  直连失败：{response.status_code}")
        USE_PROXY = True
except Exception as e:
    print(f"   ❌ 直连失败：{e}")
    USE_PROXY = True

# 测试 2: 使用代理
if USE_PROXY:
    print()
    print("2️⃣  使用代理连接...")
    try:
        response = requests.get(
            'https://www.okx.com/api/v5/public/time',
            proxies={'https': proxy, 'http': proxy},
            timeout=10
        )
        if response.status_code == 200:
            print("   ✅ 代理连接成功！")
            USE_PROXY = True
        else:
            print(f"   ❌ 代理失败：{response.status_code}")
    except Exception as e:
        print(f"   ❌ 代理失败：{e}")
        USE_PROXY = None

print()
print("="*70)

if USE_PROXY is False:
    print("✅ 使用直连模式")
    PROXY_CONFIG = {}
elif USE_PROXY is True:
    print(f"✅ 使用代理模式：{proxy}")
    PROXY_CONFIG = {'https': proxy, 'http': proxy}
else:
    print("❌ 无法连接 OKX，请检查网络")
    PROXY_CONFIG = None

# 保存配置
if PROXY_CONFIG is not None:
    config = {
        'use_proxy': USE_PROXY,
        'proxy': proxy if USE_PROXY else None,
        'timestamp': datetime.now().isoformat()
    }
    
    import json
    with open('/Users/colin/.openclaw/workspace/okx_connection_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print()
    print("📄 配置已保存到：okx_connection_config.json")

print()
print("="*70)

# 测试合约市场 API
if PROXY_CONFIG is not None:
    print()
    print("📊 测试合约市场 API...")
    print()
    
    # 测试 1: 获取合约行情
    print("1️⃣  获取合约行情...")
    try:
        url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
        response = requests.get(url, proxies=PROXY_CONFIG, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == '0':
                tickers = data.get('data', [])
                usdt_tickers = [t for t in tickers if t.get('ccy') == 'USDT']
                print(f"   ✅ 获取成功！共{len(usdt_tickers)}个 USDT 合约")
                
                # 显示前 5 个
                print()
                print("   前 5 个合约:")
                for ticker in usdt_tickers[:5]:
                    inst_id = ticker.get('instId', '')
                    last = ticker.get('last', '0')
                    vol = ticker.get('volUsd24h', '0')
                    print(f"      {inst_id}: ${float(last):,.2f} (24h 量：${float(vol):,.0f})")
            else:
                print(f"   ❌ API 错误：{data.get('msg')}")
        else:
            print(f"   ❌ HTTP 错误：{response.status_code}")
    except Exception as e:
        print(f"   ❌ 异常：{e}")
    
    print()
    
    # 测试 2: 获取交易量排名
    print("2️⃣  获取交易量排名 TOP10...")
    try:
        url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
        response = requests.get(url, proxies=PROXY_CONFIG, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == '0':
                tickers = data.get('data', [])
                
                # 按交易量排序
                usdt_tickers = [t for t in tickers if t.get('ccy') == 'USDT']
                sorted_tickers = sorted(
                    usdt_tickers,
                    key=lambda x: float(x.get('volUsd24h', 0)),
                    reverse=True
                )
                
                print(f"   ✅ 获取成功！")
                print()
                print("   交易量 TOP10:")
                for i, ticker in enumerate(sorted_tickers[:10], 1):
                    inst_id = ticker.get('instId', '')
                    vol = float(ticker.get('volUsd24h', 0))
                    if vol > 0:
                        print(f"      {i}. {inst_id}: ${vol:,.0f}")
            else:
                print(f"   ❌ API 错误：{data.get('msg')}")
        else:
            print(f"   ❌ HTTP 错误：{response.status_code}")
    except Exception as e:
        print(f"   ❌ 异常：{e}")

print()
print("="*70)
print("✅ 修复完成！")
print("="*70)
