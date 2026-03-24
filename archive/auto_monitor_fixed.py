#!/usr/bin/env python3
# 自动监控系统 V2 - 只使用合约数据

import ccxt
import pandas as pd
import os
import time
from datetime import datetime

# 强制设置代理
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

print("="*70)
print("🤖 小龙智能监控系统 V2 (合约模式)")
print("="*70)
print()

# 监控标的
symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT']
leverage_config = {'BTC/USDT:USDT': 100, 'ETH/USDT:USDT': 100, 'default': 50}

print(f"📋 监控标的：{len(symbols)} 个")
for symbol in symbols:
    lev = leverage_config.get(symbol, leverage_config['default'])
    print(f"   - {symbol}: {lev}x 杠杆")
print()

print("🔧 创建交易所实例 (只使用合约)...")
exchange = ccxt.okx({
    'enableRateLimit': True,
    'options': {'defaultType': 'swap'}  # 只使用合约
})
print("✅ 交易所实例创建成功")
print()

print("📊 开始监控...")
print()

while True:
    try:
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        for symbol in symbols[:2]:  # 只监控 BTC 和 ETH
            try:
                # 获取合约 K 线数据
                ohlcv = exchange.fetch_ohlcv(symbol, timeframe='5m', limit=10)
                
                if ohlcv and len(ohlcv) > 0:
                    latest = ohlcv[-1]
                    price = latest[4]
                    print(f"[{timestamp}] ✅ {symbol}: ${price:.2f}")
                else:
                    print(f"[{timestamp}] ⚠️  {symbol}: 无数据")
                    
            except Exception as e:
                print(f"[{timestamp}] ❌ {symbol}: {str(e)[:50]}")
        
        print()
        time.sleep(60)
        
    except KeyboardInterrupt:
        print("\n⛔ 监控已停止")
        break
    except Exception as e:
        print(f"❌ 错误：{e}")
        time.sleep(10)

