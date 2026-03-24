#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动监控系统 V7
- 动态标的管理 (每小时更新)
- 自动交易 (信号出现自动交易)
- 60 秒检查一次
"""

import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from dynamic_symbols_manager_v3 import DynamicSymbolsManager
from okx_api_client import OKXClient
from auto_trader import AutoTrader

# 设置代理
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

print("="*70)
print("🤖 小龙智能监控系统 V7 (带自动交易)")
print("="*70)
print()

# 初始化
symbols_manager = DynamicSymbolsManager()
client = OKXClient()
trader = AutoTrader()

# 首次更新标的
print("📋 初始化监控标的...")
symbols = symbols_manager.update_symbols()
print()

# 上次标的更新时间
last_symbols_update = datetime.now()

# 价格历史记录
last_prices = {}

print("📊 开始监控...")
print()

check_count = 0
symbols_update_count = 0
trades_count = 0

while True:
    try:
        timestamp = datetime.now().strftime('%H:%M:%S')
        check_count += 1
        
        # 每小时更新一次标的
        if (datetime.now() - last_symbols_update) > timedelta(hours=1):
            print()
            print("="*70)
            print(f"⏰ [{timestamp}] 更新监控标的...")
            symbols = symbols_manager.update_symbols()
            last_symbols_update = datetime.now()
            symbols_update_count += 1
            print()
        
        # 收集当前价格
        current_prices = {}
        
        # 监控每个标的
        for symbol in symbols:
            try:
                # 获取行情
                result = client.fetch_ticker(symbol)
                
                if result['success']:
                    ticker = result['data'][0]
                    price = float(ticker['last'])
                    current_prices[symbol] = price
                    
                    # 计算变化
                    if symbol in last_prices:
                        change = (price - last_prices[symbol]) / last_prices[symbol] * 100
                        
                        # 显示价格
                        if abs(change) >= 0.1:  # 变化超过 0.1% 才显示
                            arrow = "📈" if change > 0 else "📉"
                            print(f"[{timestamp}] {arrow} {symbol.replace('/USDT:USDT', '')}: ${price:,.2f} ({change:+.2f}%)")
                            
                            # 大幅波动告警 (>1%)
                            if abs(change) >= 1.0:
                                signal = "BUY" if change > 0 else "SELL"
                                print(f"           ⚠️  大幅波动！{signal}信号")
                    else:
                        print(f"[{timestamp}] ✅ {symbol.replace('/USDT:USDT', '')}: ${price:,.2f}")
                    
                    last_prices[symbol] = price
                else:
                    print(f"[{timestamp}] ⚠️ {symbol}: {result['error']}")
                    
            except Exception as e:
                print(f"[{timestamp}] ❌ {symbol}: {str(e)[:50]}")
        
        # 自动交易检测
        if trader.config['enabled'] and current_prices:
            # 准备价格数据
            price_data = {}
            for symbol in current_prices:
                if symbol in last_prices:
                    price_data[symbol] = {
                        'current': current_prices[symbol],
                        'prev': last_prices[symbol]
                    }
            
            # 检测并执行交易
            if price_data:
                trader.monitor_and_trade(symbols, price_data)
        
        # 显示统计
        if check_count % 10 == 0:
            print()
            print(f"📊 运行统计：检查{check_count}次 | 更新标的{symbols_update_count}次 | 监控{len(symbols)}个标的 | 交易{trades_count}笔")
            print()
        
        # 等待 60 秒
        time.sleep(60)
        
    except KeyboardInterrupt:
        print()
        print("⛔ 监控已停止")
        print(f"📊 总计：检查{check_count}次 | 更新标的{symbols_update_count}次 | 交易{trades_count}笔")
        break
    except Exception as e:
        print(f"❌ 错误：{e}")
        time.sleep(10)
