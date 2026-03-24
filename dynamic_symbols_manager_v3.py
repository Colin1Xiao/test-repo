#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
动态标的管理系统 V3 (交易额修复版)
每小时更新监控标的
OKX 合约市场交易额 TOP10 + 24 小时涨跌幅 TOP5
使用 vol24h × price 计算真实交易额
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
        
        # 加载连接配置
        self.use_proxy = False
        self.proxy = None
        conn_config_file = self.workspace / 'okx_connection_config.json'
        if conn_config_file.exists():
            with open(conn_config_file, 'r') as f:
                config = json.load(f)
                self.use_proxy = config.get('use_proxy', False)
                self.proxy = config.get('proxy')
        
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
            'volume_top10': self.volume_top10_formatted if hasattr(self, 'volume_top10_formatted') else [],
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
            'volume_top10': self.volume_top10_formatted if hasattr(self, 'volume_top10_formatted') else [],
            'change_top5': self.change_top5 if hasattr(self, 'change_top5') else []
        }
        
        history.append(record)
        
        # 保留最近 100 条记录
        history = history[-100:]
        
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    
    def fetch_volume_ranking(self, limit=10):
        """获取合约交易额排名 (修复版：使用 vol24h × price)"""
        try:
            url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
            
            if self.use_proxy and self.proxy:
                proxies = {'https': self.proxy, 'http': self.proxy}
            else:
                proxies = {}
            
            response = requests.get(url, proxies=proxies, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == '0':
                    tickers = data.get('data', [])
                    
                    # 过滤 USDT 合约并计算真实交易额
                    usdt_contracts = []
                    for t in tickers:
                        inst_id = t.get('instId', '')
                        
                        # 只处理 USDT 合约
                        if 'USDT' in inst_id:
                            # 获取数据
                            vol_24h = t.get('vol24h', '0')  # 币数量
                            last_price = t.get('last', '0')  # 价格
                            
                            # 转换数字
                            try:
                                vol_num = float(vol_24h) if vol_24h else 0
                            except:
                                vol_num = 0
                            
                            try:
                                price = float(last_price) if last_price else 0
                            except:
                                price = 0
                            
                            # 计算真实交易额 (USD)
                            volume_usd = vol_num * price
                            
                            if volume_usd > 10000:  # 过滤低流动性 (>1 万 USD)
                                # 转换符号格式
                                symbol = inst_id.replace('-USDT', '/USDT:USDT')
                                
                                usdt_contracts.append({
                                    'symbol': symbol,
                                    'volume_usd': volume_usd,
                                    'vol24h': vol_num,
                                    'price': price,
                                    'instId': inst_id
                                })
                    
                    # 按交易额排序
                    usdt_contracts_sorted = sorted(
                        usdt_contracts,
                        key=lambda x: x['volume_usd'],
                        reverse=True
                    )
                    
                    # 取前 limit 个
                    top_symbols = [item['symbol'] for item in usdt_contracts_sorted[:limit]]
                    
                    # 格式化显示数据
                    self.volume_top10_formatted = []
                    for item in usdt_contracts_sorted[:limit]:
                        vol_usd = item['volume_usd']
                        if vol_usd >= 1e9:
                            vol_str = f"${vol_usd/1e9:.2f}B"
                        elif vol_usd >= 1e6:
                            vol_str = f"${vol_usd/1e6:.2f}M"
                        elif vol_usd >= 1e3:
                            vol_str = f"${vol_usd/1e3:.2f}K"
                        else:
                            vol_str = f"${vol_usd:.2f}"
                        
                        self.volume_top10_formatted.append({
                            'symbol': item['symbol'],
                            'volume_display': vol_str,
                            'volume_usd': vol_usd,
                            'instId': item['instId'],
                            'price': item['price']
                        })
                    
                    return top_symbols, usdt_contracts_sorted[:limit]
                else:
                    print(f"❌ OKX API 错误：{data.get('msg')}")
            else:
                print(f"❌ HTTP 错误：{response.status_code}")
        except Exception as e:
            print(f"❌ 获取交易额排名失败：{e}")
        
        return [], []
    
    def fetch_change_ranking(self, limit=5):
        """获取涨跌幅排名 (分别获取涨幅榜和跌幅榜)"""
        try:
            url = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP'
            
            if self.use_proxy and self.proxy:
                proxies = {'https': self.proxy, 'http': self.proxy}
            else:
                proxies = {}
            
            response = requests.get(url, proxies=proxies, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == '0':
                    tickers = data.get('data', [])
                    
                    # 计算涨跌幅
                    change_data = []
                    for ticker in tickers:
                        inst_id = ticker.get('instId', '')
                        
                        # 只处理 USDT 合约
                        if 'USDT' in inst_id:
                            last = float(ticker.get('last', 0))
                            open_24h = float(ticker.get('open24h', last))
                            vol_24h = float(ticker.get('vol24h', 0))
                            price = last
                            
                            # 计算交易额
                            volume_usd = vol_24h * price
                            
                            if last > 0 and open_24h > 0 and volume_usd > 100000:  # 过滤低流动性 (>10 万 USD)
                                change_pct = (last - open_24h) / open_24h * 100
                                change_data.append({
                                    'symbol': inst_id.replace('-USDT', '/USDT:USDT'),
                                    'change': change_pct,
                                    'price': last,
                                    'volume_usd': volume_usd,
                                    'instId': inst_id
                                })
                    
                    # 分别排序：涨幅榜 (正数) 和跌幅榜 (负数)
                    gainers = sorted(
                        [x for x in change_data if x['change'] > 0],
                        key=lambda x: x['change'],
                        reverse=True
                    )[:limit]
                    
                    losers = sorted(
                        [x for x in change_data if x['change'] < 0],
                        key=lambda x: x['change'],
                        reverse=False
                    )[:limit]
                    
                    # 合并：涨幅榜 TOP5 + 跌幅榜 TOP5
                    change_sorted = gainers + losers
                    
                    # 取符号
                    top_symbols = [item['symbol'] for item in change_sorted]
                    
                    # 格式化显示
                    self.gainers_top5 = []  # 涨幅榜
                    self.losers_top5 = []   # 跌幅榜
                    
                    for item in gainers:
                        vol_usd = item['volume_usd']
                        if vol_usd >= 1e9:
                            vol_str = f"${vol_usd/1e9:.2f}B"
                        elif vol_usd >= 1e6:
                            vol_str = f"${vol_usd/1e6:.2f}M"
                        elif vol_usd >= 1e3:
                            vol_str = f"${vol_usd/1e3:.2f}K"
                        else:
                            vol_str = f"${vol_usd:.2f}"
                        
                        self.gainers_top5.append({
                            'symbol': item['symbol'],
                            'change': item['change'],
                            'price': item['price'],
                            'volume_display': vol_str,
                            'instId': item['instId']
                        })
                    
                    for item in losers:
                        vol_usd = item['volume_usd']
                        if vol_usd >= 1e9:
                            vol_str = f"${vol_usd/1e9:.2f}B"
                        elif vol_usd >= 1e6:
                            vol_str = f"${vol_usd/1e6:.2f}M"
                        elif vol_usd >= 1e3:
                            vol_str = f"${vol_usd/1e3:.2f}K"
                        else:
                            vol_str = f"${vol_usd:.2f}"
                        
                        self.losers_top5.append({
                            'symbol': item['symbol'],
                            'change': item['change'],
                            'price': item['price'],
                            'volume_display': vol_str,
                            'instId': item['instId']
                        })
                    
                    return change_sorted, top_symbols
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
        
        # 获取交易额 TOP10
        print("📊 获取合约交易额排名 TOP10 (USD)...")
        volume_top10, volume_data = self.fetch_volume_ranking(limit=10)
        
        if volume_data:
            self.volume_top10 = volume_data
            print(f"   ✅ 获取成功 ({len(volume_data)}个)")
            for i, item in enumerate(volume_data[:5], 1):
                vol_usd = item['volume_usd']
                if vol_usd >= 1e9:
                    vol_str = f"${vol_usd/1e9:.2f}B"
                elif vol_usd >= 1e6:
                    vol_str = f"${vol_usd/1e6:.2f}M"
                else:
                    vol_str = f"${vol_usd:,.0f}"
                
                print(f"      {i}. {item['instId']}: {vol_str} (@ ${item['price']:,.4f})")
            if len(volume_data) > 5:
                print(f"      ... 还有{len(volume_data)-5}个")
        else:
            print(f"   ❌ 获取失败，使用默认标的")
            volume_top10 = self.default_symbols.copy()
            self.volume_top10 = [{'symbol': s, 'volume_usd': 0, 'instId': s, 'price': 0} for s in volume_top10]
        
        print()
        
        # 获取涨幅榜 TOP5 和跌幅榜 TOP5
        print("📈 获取涨幅榜 TOP5...")
        print("📉 获取跌幅榜 TOP5...")
        change_data, change_top5 = self.fetch_change_ranking(limit=5)
        
        if change_data:
            self.change_top5 = change_data
            print(f"   ✅ 获取成功")
            print()
            
            # 显示涨幅榜
            if hasattr(self, 'gainers_top5') and self.gainers_top5:
                print(f"   📈 涨幅榜 TOP5:")
                for i, item in enumerate(self.gainers_top5[:5], 1):
                    vol_usd = item.get('volume_usd', item.get('volume_display', 0))
                    if isinstance(vol_usd, str):
                        vol_str = vol_usd
                    elif vol_usd >= 1e9:
                        vol_str = f"${vol_usd/1e9:.2f}B"
                    elif vol_usd >= 1e6:
                        vol_str = f"${vol_usd/1e6:.2f}M"
                    else:
                        vol_str = f"${vol_usd:,.0f}"
                    
                    print(f"      {i}. {item.get('instId', 'N/A')}: {item.get('change', 0):+.2f}% (${item.get('price', 0):,.4f}, Vol: {vol_str})")
            
            print()
            
            # 显示跌幅榜
            if hasattr(self, 'losers_top5') and self.losers_top5:
                print(f"   📉 跌幅榜 TOP5:")
                for i, item in enumerate(self.losers_top5[:5], 1):
                    vol_usd = item.get('volume_usd', item.get('volume_display', 0))
                    if isinstance(vol_usd, str):
                        vol_str = vol_usd
                    elif vol_usd >= 1e9:
                        vol_str = f"${vol_usd/1e9:.2f}B"
                    elif vol_usd >= 1e6:
                        vol_str = f"${vol_usd/1e6:.2f}M"
                    else:
                        vol_str = f"${vol_usd:,.0f}"
                    
                    print(f"      {i}. {item.get('instId', 'N/A')}: {item.get('change', 0):+.2f}% (${item.get('price', 0):,.4f}, Vol: {vol_str})")
        else:
            print(f"   ❌ 获取失败，使用默认标的")
            change_top5 = []
            self.change_top5 = []
        
        print()
        
        # 合并标的 (去重)
        all_symbols = []
        seen = set()
        
        # 优先添加交易额 TOP10
        for item in self.volume_top10:
            symbol = item.get('symbol', item) if isinstance(item, dict) else item
            if symbol not in seen:
                all_symbols.append(symbol)
                seen.add(symbol)
        
        # 添加涨幅榜 TOP5 (不重复的)
        if hasattr(self, 'gainers_top5'):
            for item in self.gainers_top5:
                symbol = item.get('symbol')
                if symbol not in seen:
                    all_symbols.append(symbol)
                    seen.add(symbol)
        
        # 添加跌幅榜 TOP5 (不重复的)
        if hasattr(self, 'losers_top5'):
            for item in self.losers_top5:
                symbol = item.get('symbol')
                if symbol not in seen:
                    all_symbols.append(symbol)
                    seen.add(symbol)
        
        # 确保至少有 3 个标的
        if len(all_symbols) < 3:
            for symbol in self.default_symbols:
                if symbol not in seen:
                    all_symbols.append(symbol)
                    seen.add(symbol)
        
        # 限制最多 20 个标的
        all_symbols = all_symbols[:20]
        
        # 更新配置
        self.symbols = all_symbols
        self.last_update = datetime.now().isoformat()
        
        # 保存配置
        self.save_config()
        self.save_history()
        
        print("="*70)
        print("📋 最终监控标的列表")
        print("="*70)
        print(f"   总数：{len(self.symbols)} 个 (最多 20 个)")
        print()
        
        for i, symbol in enumerate(self.symbols, 1):
            source = ""
            if any((item.get('symbol') if isinstance(item, dict) else item) == symbol for item in self.volume_top10):
                source = "📊 交易额"
            if any((item.get('symbol') if isinstance(item, dict) else item) == symbol for item in self.change_top5):
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
    
    print("🔍 测试动态标的管理系统 V3 (交易额修复版)...")
    print()
    
    # 强制更新
    print("⏰ 强制更新标的")
    print()
    
    # 更新标的
    manager.update_symbols()
    
    print()
    print("✅ 测试完成！")
