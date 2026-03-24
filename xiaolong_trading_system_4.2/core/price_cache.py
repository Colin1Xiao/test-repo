#!/usr/bin/env python3
"""
Price Cache - REST 价格缓存模块

核心功能：
1. 后台线程定期更新价格
2. 内存缓存，0ms 读取
3. 自动降级
"""

import threading
import time
import ccxt
import os
from typing import Dict, Optional
from datetime import datetime


class PriceCache:
    """
    价格缓存器
    
    架构：
    ┌──────────────┐
    │ REST API     │ → 后台线程每 2 秒更新
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │ Memory Cache │ → 内存缓存
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │ get_price()  │ → 0ms 读取
    └──────────────┘
    """
    
    def __init__(self, symbols: list = None, update_interval: float = 2.0):
        """
        初始化价格缓存
        
        Args:
            symbols: 交易对列表 ['ETH/USDT:USDT']
            update_interval: 更新间隔（秒）
        """
        self.symbols = symbols or ['ETH/USDT:USDT']
        self.update_interval = update_interval
        
        # 价格缓存
        self.cache: Dict[str, Dict] = {}
        self._last_update: Dict[str, datetime] = {}
        
        # 代理
        self.proxy = os.environ.get('https_proxy', 'http://127.0.0.1:7890')
        
        # 交易所实例
        self.exchange = ccxt.okx({
            'enableRateLimit': True,
            'timeout': 5000,
            'options': {'defaultType': 'swap'},
            'proxies': {'http': self.proxy, 'https': self.proxy}
        })
        
        # 线程控制
        self.running = False
        self._thread: Optional[threading.Thread] = None
        
        # 统计
        self.stats = {
            'updates': 0,
            'errors': 0,
            'cache_hits': 0
        }
    
    def start(self):
        """启动价格缓存"""
        if self.running:
            return
        
        self.running = True
        
        # 首次同步获取
        self._update_all()
        
        # 启动后台线程
        self._thread = threading.Thread(target=self._update_loop, daemon=True)
        self._thread.start()
        
        print(f"✅ 价格缓存已启动 ({len(self.symbols)} 个交易对)")
    
    def stop(self):
        """停止价格缓存"""
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        print("🛑 价格缓存已停止")
    
    def _update_loop(self):
        """后台更新循环"""
        while self.running:
            time.sleep(self.update_interval)
            self._update_all()
    
    def _update_all(self):
        """更新所有价格"""
        for symbol in self.symbols:
            try:
                ticker = self.exchange.fetch_ticker(symbol)
                
                bid = float(ticker.get('bid', 0))
                ask = float(ticker.get('ask', 0))
                last = float(ticker.get('last', 0))
                
                if bid and ask:
                    mid = (bid + ask) / 2
                else:
                    mid = last
                    bid = bid or last
                    ask = ask or last
                
                self.cache[symbol] = {
                    'bid': bid,
                    'ask': ask,
                    'mid': mid,
                    'last': last,
                    'timestamp': datetime.now().isoformat()
                }
                self._last_update[symbol] = datetime.now()
                self.stats['updates'] += 1
                
            except Exception as e:
                self.stats['errors'] += 1
                # 静默失败，使用旧缓存
    
    def get_price(self, symbol: str) -> Optional[Dict]:
        """
        获取价格（0ms 读取）
        
        Args:
            symbol: ETH/USDT:USDT 格式
            
        Returns:
            {'bid': float, 'ask': float, 'mid': float, 'last': float, 'timestamp': str}
        """
        price = self.cache.get(symbol)
        
        if price:
            self.stats['cache_hits'] += 1
            
            # 检查新鲜度（10秒内有效）
            last = self._last_update.get(symbol)
            if last and (datetime.now() - last).total_seconds() < 10:
                return price
        
        # 缓存过期或不存在，同步更新
        self._update_symbol(symbol)
        return self.cache.get(symbol)
    
    def _update_symbol(self, symbol: str):
        """更新单个价格"""
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            
            bid = float(ticker.get('bid', 0))
            ask = float(ticker.get('ask', 0))
            last = float(ticker.get('last', 0))
            
            if bid and ask:
                mid = (bid + ask) / 2
            else:
                mid = last
                bid = bid or last
                ask = ask or last
            
            self.cache[symbol] = {
                'bid': bid,
                'ask': ask,
                'mid': mid,
                'last': last,
                'timestamp': datetime.now().isoformat()
            }
            self._last_update[symbol] = datetime.now()
            
        except Exception as e:
            pass
    
    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            **self.stats,
            'cached_symbols': len(self.cache),
            'running': self.running
        }


# 全局实例
_price_cache: Optional[PriceCache] = None


def get_price_cache(symbols: list = None) -> PriceCache:
    """获取全局价格缓存实例"""
    global _price_cache
    if _price_cache is None:
        _price_cache = PriceCache(symbols)
        _price_cache.start()
    return _price_cache


def get_cached_price(symbol: str) -> Optional[Dict]:
    """快速获取缓存价格"""
    cache = get_price_cache([symbol])
    return cache.get_price(symbol)


# 测试
if __name__ == "__main__":
    print("🧪 价格缓存测试")
    
    cache = PriceCache(['ETH/USDT:USDT', 'BTC/USDT:USDT'])
    cache.start()
    
    time.sleep(1)
    
    print("\n📊 价格获取测试:")
    for i in range(5):
        start = time.time()
        price = cache.get_price('ETH/USDT:USDT')
        elapsed = (time.time() - start) * 1000
        
        if price:
            print(f"  {i+1}. bid={price['bid']:.2f}, ask={price['ask']:.2f}, mid={price['mid']:.2f} ({elapsed:.1f}ms)")
        else:
            print(f"  {i+1}. ⚠️ 未获取到价格")
        
        time.sleep(1)
    
    print(f"\n📊 统计: {cache.get_stats()}")
    cache.stop()