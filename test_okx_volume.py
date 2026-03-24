#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 OKX 交易量字段
确认使用正确的交易额字段
"""

import requests
import json

print("="*70)
print("🔍 OKX 交易量字段测试")
print("="*70)
print()

url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'

try:
    response = requests.get(url, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        
        if data.get('code') == '0':
            tickers = data.get('data', [])
            
            # 过滤 USDT 合约
            usdt_contracts = []
            for t in tickers:
                inst_id = t.get('instId', '')
                if 'USDT' in inst_id:
                    # 获取不同字段
                    vol_ccy = t.get('volCcy24h', '0')  # USD 计价
                    vol = t.get('vol24h', '0')  # 币数量
                    
                    # 尝试转换
                    try:
                        vol_ccy_num = float(vol_ccy) if vol_ccy else 0
                    except:
                        vol_ccy_num = 0
                    
                    try:
                        vol_num = float(vol) if vol else 0
                    except:
                        vol_num = 0
                    
                    if vol_ccy_num > 0 or vol_num > 0:
                        usdt_contracts.append({
                            'instId': inst_id,
                            'volCcy24h': vol_ccy_num,  # USD
                            'vol24h': vol_num,  # 币数量
                            'last': float(t.get('last', 0))
                        })
            
            # 按 USD 交易额排序
            usdt_sorted = sorted(
                usdt_contracts,
                key=lambda x: x['volCcy24h'],
                reverse=True
            )
            
            print(f"✅ 获取成功！共{len(usdt_contracts)}个 USDT 合约")
            print()
            print("📊 交易量 TOP10 (按 USD 交易额排序):")
            print()
            print(f"{'排名':<6} {'交易对':<25} {'交易额 (USD)':<20} {'币数量':<20} {'价格':<15}")
            print("-"*100)
            
            for i, item in enumerate(usdt_sorted[:10], 1):
                inst_id = item['instId']
                vol_ccy = item['volCcy24h']
                vol = item['vol24h']
                price = item['last']
                
                # 格式化显示
                if vol_ccy >= 1e9:
                    vol_ccy_str = f"${vol_ccy/1e9:.2f}B"
                elif vol_ccy >= 1e6:
                    vol_ccy_str = f"${vol_ccy/1e6:.2f}M"
                elif vol_ccy >= 1e3:
                    vol_ccy_str = f"${vol_ccy/1e3:.2f}K"
                else:
                    vol_ccy_str = f"${vol_ccy:.2f}"
                
                if vol >= 1e9:
                    vol_str = f"{vol/1e9:.2f}B"
                elif vol >= 1e6:
                    vol_str = f"{vol/1e6:.2f}M"
                elif vol >= 1e3:
                    vol_str = f"{vol/1e3:.2f}K"
                else:
                    vol_str = f"{vol:.2f}"
                
                print(f"{i:<6} {inst_id:<25} {vol_ccy_str:<20} {vol_str:<20} ${price:,.4f}")
            
            print()
            print("="*70)
            print("✅ 字段说明:")
            print("   volCcy24h: 24 小时交易额 (USD 计价) ← 应该使用这个")
            print("   vol24h: 24 小时交易量 (币的数量)")
            print("="*70)
            
        else:
            print(f"❌ API 错误：{data.get('msg')}")
    else:
        print(f"❌ HTTP 错误：{response.status_code}")

except Exception as e:
    print(f"❌ 异常：{e}")
