#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
动态标的管理系统
每小时更新监控标的
OKX 交易量 TOP10 + 5 分钟涨跌幅 TOP5
"""

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
import requests

class DynamicSymbolsManager:
    """动态标的管理器"""
    
    def __init__(self):
        self.workspace = Path(__file__).parent
        self.config_file = self.workspace / 'symbols_config.json'
        self.history_file = self.workspace / 'symbols_history.json'
        self.proxy = os.getenv('https_proxy', 'http://127.0.0.1:7890')
        
        # 默认标的
        self.default_symbols = [
            'BTC/USDT:USDT',
            'ETH/USDT:USDT',
            'SOL/USDT:USDT',
        ]
        
        # 加载配置
        self.load_config()
    
    def load_config(self):
        """加载配置"""
        if self.config_file.exists():
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                self.symbols = config.get('symbols', self.default_symbols)
                self.last_update = config.get('last_update', None)
        else:
            self.symbols = self.default_symbols.copy()
            self.last_update = None
    
    def save_config(self):
        """保存配置"""
        config = {
            'symbols': self.symbols,
            'last_update': self.last_update,
            'volume_top10': self.volume_top10 if hasattr(self, 'volume_top10') else [],
            'change_top5': self.change_top5 if hasattr(self, 'change_top5') else []
        }
        
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    
    def save_history(self):
        """保存历史记录"""
        history = []
        
        if self.history_file.exists():
            with open(self.history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        # 添加新记录
        record = {
            'timestamp': datetime.now().isoformat(),
            'symbols': self.symbols.copy(),
            'volume_top10': self.volume_top10 if hasattr(self, 'volume_top10') else [],
            'change_top5': self.change_top5 if hasattr(self, 'change_top5') else []
        }
        
        history.append(record)
        
        # 保留最近 100 条记录
        history = history[-100:]
        
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    
    def fetch_volume_ranking(self, limit=10):
        """获取交易量排名"""
        try:
            url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
            
            # 尝试不使用代理直连
            try:
                response = requests.get(url, timeout=10)
            except:
                response = requests.get(
                    url,
                    proxies={'https': self.proxy, 'http': self.proxy},
                    timeout=30
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == '0':
                    tickers = data.get('data', [])
                    
                    # 按 24 小时交易量排序
                    tickers_sorted = sorted(
                        [t for t in tickers if t.get('ccy') == 'USDT'],
                        key=lambda x: float(x.get('volUsd24h', 0)),
                        reverse=True
                    )
                    
                    # 取前 limit 个
                    top_symbols = []
                    for ticker in tickers_sorted[:limit]:
                        inst_id = ticker.get('instId', '')
                        if inst_id and 'USDT' in inst_id:
                            symbol = inst_id.replace('-USDT', '/USDT:USDT')
                            top_symbols.append(symbol)
                    
                    return top_symbols
                else:
                    print(f"❌ OKX API 错误：{data.get('msg')}")
            else:
                print(f"❌ HTTP 错误：{response.status_code}")
        except Exception as e:
            print(f"❌ 获取交易量排名失败：{e}")
        
        return []
    
    def fetch_change_ranking(self, timeframe='5m', limit=5):
        """获取涨跌幅排名"""
        try:
            # OKX K 线 API
            url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
            
            # 尝试不使用代理直连
            try:
                response = requests.get(url, timeout=10)
            except:
                response = requests.get(
                    url,
                    proxies={'https': self.proxy, 'http': self.proxy},
                    timeout=30
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == '0':
                    tickers = data.get('data', [])
                    
                    # 计算 5 分钟涨跌幅 (使用最新价和开盘价)
                    change_data = []
                    for ticker in tickers:
                        if ticker.get('ccy') == 'USDT':
                            inst_id = ticker.get('instId', '')
                            last = float(ticker.get('last', 0))
                            open_24h = float(ticker.get('open24h', last))
                            
                            if last > 0 and open_24h > 0:
                                change_pct = (last - open_24h) / open_24h * 100
                                change_data.append({
                                    'symbol': inst_id.replace('-USDT', '/USDT:USDT'),
                                    'change': change_pct,
                                    'price': last
                                })
                    
                    # 按涨跌幅排序 (取绝对值最大的)
                    change_sorted = sorted(
                        change_data,
                        key=lambda x: abs(x['change']),
                        reverse=True
                    )
                    
                    # 取前 limit 个
                    top_symbols = [item['symbol'] for item in change_sorted[:limit]]
                    
                    return change_sorted[:limit], top_symbols
                else:
                    print(f"❌ OKX API 错误：{data.get('msg')}")
            else:
                print(f"❌ HTTP 错误：{response.status_code}")
        except Exception as e:
            print(f"❌ 获取涨跌幅排名失败：{e}")
        
        return [], []
    
    def update_symbols(self):
        """更新监控标的"""
        print("="*70)
        print("🔄 更新监控标的")
        print("="*70)
        print()
        
        # 获取交易量 TOP10
        print("📊 获取交易量排名 TOP10...")
        volume_top10 = self.fetch_volume_ranking(limit=10)
        
        if volume_top10:
            self.volume_top10 = volume_top10
            print(f"   ✅ 获取成功")
            for i, symbol in enumerate(volume_top10[:5], 1):
                print(f"      {i}. {symbol.replace('/USDT:USDT', '')}")
            if len(volume_top10) > 5:
                print(f"      ... 还有{len(volume_top10)-5}个")
        else:
            print(f"   ❌ 获取失败，使用默认标的")
            volume_top10 = self.default_symbols.copy()
            self.volume_top10 = volume_top10
        
        print()
        
        # 获取涨跌幅 TOP5
        print("📈 获取 5 分钟涨跌幅 TOP5...")
        change_data, change_top5 = self.fetch_change_ranking(limit=5)
        
        if change_top5:
            self.change_top5 = change_top5
            print(f"   ✅ 获取成功")
            for item in change_data[:5]:
                arrow = "📈" if item['change'] > 0 else "📉"
                print(f"      {arrow} {item['symbol'].replace('/USDT:USDT', '')}: {item['change']:+.2f}%")
        else:
            print(f"   ❌ 获取失败，使用默认标的")
            change_top5 = []
            self.change_top5 = change_top5
        
        print()
        
        # 合并标的 (去重)
        all_symbols = []
        seen = set()
        
        # 优先添加交易量 TOP10
        for symbol in volume_top10:
            if symbol not in seen:
                all_symbols.append(symbol)
                seen.add(symbol)
        
        # 添加涨跌幅 TOP5 (不重复的)
        for symbol in change_top5:
            if symbol not in seen:
                all_symbols.append(symbol)
                seen.add(symbol)
        
        # 确保至少有 3 个标的
        if len(all_symbols) < 3:
            for symbol in self.default_symbols:
                if symbol not in seen:
                    all_symbols.append(symbol)
                    seen.add(symbol)
        
        # 限制最多 15 个标的
        all_symbols = all_symbols[:15]
        
        # 更新配置
        self.symbols = all_symbols
        self.last_update = datetime.now().isoformat()
        
        # 保存配置
        self.save_config()
        self.save_history()
        
        print("="*70)
        print("📋 最终监控标的列表")
        print("="*70)
        print(f"   总数：{len(self.symbols)} 个")
        print()
        
        for i, symbol in enumerate(self.symbols, 1):
            source = ""
            if symbol in volume_top10:
                source = "📊 交易量"
            if symbol in change_top5:
                source += " 📈 涨跌幅"
            
            print(f"   {i}. {symbol.replace('/USDT:USDT', ''):<20} {source}")
        
        print()
        print(f"⏰ 下次更新：1 小时后")
        print("="*70)
        
        return self.symbols
    
    def should_update(self):
        """检查是否应该更新"""
        if self.last_update is None:
            return True
        
        last_update = datetime.fromisoformat(self.last_update)
        now = datetime.now()
        
        # 超过 1 小时则更新
        return (now - last_update) > timedelta(hours=1)
    
    def get_symbols(self):
        """获取当前监控标的"""
        # 检查是否需要更新
        if self.should_update():
            print("⏰ 距离上次更新已超过 1 小时，自动更新标的...")
            self.update_symbols()
        
        return self.symbols

# 全局管理器实例
symbols_manager = DynamicSymbolsManager()

# 便捷函数
def get_symbols():
    return symbols_manager.get_symbols()

def update_symbols():
    return symbols_manager.update_symbols()

def should_update():
    return symbols_manager.should_update()

if __name__ == '__main__':
    # 测试
    manager = DynamicSymbolsManager()
    
    print("🔍 测试动态标的管理系统...")
    print()
    
    # 检查是否需要更新
    if manager.should_update():
        print("⏰ 需要更新标的")
        print()
        
        # 更新标的
        manager.update_symbols()
    else:
        print("✅ 标的为最新，无需更新")
        print()
        
        # 显示当前标的
        print("📋 当前监控标的:")
        for i, symbol in enumerate(manager.symbols, 1):
            print(f"   {i}. {symbol}")
    
    print()
    print("✅ 测试完成！")
