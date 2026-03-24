#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX API 调试工具
详细分析 API 返回数据结构
"""

import requests
import json
from datetime import datetime

print("="*70)
print("🔍 OKX API 详细调试")
print("="*70)
print()

# API 端点
endpoints = [
    {
        'name': '合约行情',
        'url': 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
    },
    {
        'name': '现货行情',
        'url': 'https://www.okx.com/api/v5/market/tickers?instType=SPOT'
    },
    {
        'name': '平台时间',
        'url': 'https://www.okx.com/api/v5/public/time'
    }
]

for i, endpoint in enumerate(endpoints, 1):
    print(f"{i}. 测试：{endpoint['name']}")
    print(f"   URL: {endpoint['url']}")
    print()
    
    try:
        # 先尝试直连
        try:
            response = requests.get(endpoint['url'], timeout=30)
        except:
            # 失败则使用代理
            response = requests.get(
                endpoint['url'],
                proxies={'https': 'http://127.0.0.1:7890', 'http': 'http://127.0.0.1:7890'},
                timeout=30
            )
        
        print(f"   状态码：{response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 显示返回数据结构
            print(f"   ✅ 请求成功")
            print(f"   返回码：{data.get('code', 'N/A')}")
            print(f"   返回消息：{data.get('msg', 'N/A')}")
            print()
            
            # 分析数据
            if 'data' in data:
                data_list = data['data']
                print(f"   数据条数：{len(data_list)}")
                print()
                
                if len(data_list) > 0:
                    # 显示第一条数据的完整结构
                    print(f"   第一条数据结构:")
                    print(f"   {json.dumps(data_list[0], indent=6, ensure_ascii=False)[:2000]}")
                    print()
                    
                    # 分析关键字段
                    if 'instType' in data_list[0]:
                        print(f"   类型：{data_list[0].get('instType', 'N/A')}")
                    
                    if 'instId' in data_list[0]:
                        print(f"   交易对：{data_list[0].get('instId', 'N/A')}")
                    
                    if 'ccy' in data_list[0]:
                        print(f"   计价币：{data_list[0].get('ccy', 'N/A')}")
                    
                    if 'last' in data_list[0]:
                        print(f"   最新价：${float(data_list[0].get('last', 0)):,.2f}")
                    
                    if 'volUsd24h' in data_list[0]:
                        print(f"   24h 量 (USD): ${float(data_list[0].get('volUsd24h', 0)):,.0f}")
                    
                    if 'vol24h' in data_list[0]:
                        print(f"   24h 量 (币): {float(data_list[0].get('vol24h', 0)):,.2f}")
                    
                    if 'open24h' in data_list[0]:
                        print(f"   24h 开盘：${float(data_list[0].get('open24h', 0)):,.2f}")
                    
                    if 'low24h' in data_list[0]:
                        print(f"   24h 最低：${float(data_list[0].get('low24h', 0)):,.2f}")
                    
                    if 'high24h' in data_list[0]:
                        print(f"   24h 最高：${float(data_list[0].get('high24h', 0)):,.2f}")
                    
                    # 计算涨跌幅
                    last = float(data_list[0].get('last', 0))
                    open_24h = float(data_list[0].get('open24h', last))
                    if open_24h > 0:
                        change = (last - open_24h) / open_24h * 100
                        print(f"   24h 涨跌：{change:+.2f}%")
                    
                    print()
                    
                    # 过滤 USDT 合约
                    if 'instType' in data_list[0] and data_list[0]['instType'] == 'SWAP':
                        usdt_contracts = [
                            d for d in data_list 
                            if 'USDT' in d.get('instId', '') and float(d.get('volUsd24h', 0)) > 0
                        ]
                        print(f"   USDT 合约数量：{len(usdt_contracts)}")
                        print()
                        
                        # 按交易量排序
                        usdt_sorted = sorted(
                            usdt_contracts,
                            key=lambda x: float(x.get('volUsd24h', 0)),
                            reverse=True
                        )
                        
                        print(f"   交易量 TOP10:")
                        for j, contract in enumerate(usdt_sorted[:10], 1):
                            inst_id = contract.get('instId', '')
                            vol = float(contract.get('volUsd24h', 0))
                            last = float(contract.get('last', 0))
                            print(f"      {j}. {inst_id}: ${vol:,.0f} (@ ${last:,.2f})")
                        
                        print()
            else:
                print(f"   ⚠️  无 data 字段")
                print(f"   完整返回：{json.dumps(data, indent=2)[:1000]}")
        else:
            print(f"   ❌ HTTP 错误")
            print(f"   返回内容：{response.text[:500]}")
    
    except Exception as e:
        print(f"   ❌ 异常：{e}")
        import traceback
        traceback.print_exc()
    
    print("="*70)
    print()

print("✅ 调试完成！")
