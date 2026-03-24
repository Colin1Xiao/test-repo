#!/usr/bin/env python3
"""
Price Cache - 线程安全价格缓存

核心功能：
1. 线程安全读写
2. 时间戳追踪
3. 自动过期检测
"""

import threading
import time
from typing import Dict, Optional, Any


class PriceCache:
    """
    线程安全价格缓存
    
    使用方式：
    cache = PriceCache()
    cache.update("ETH-USDT-SWAP", 2200.50)
    price = cache.get_price("ETH-USDT-SWAP")
    """
    
    def __init__(self, max_age_seconds: float = 5.0):
        """
        初始化价格缓存
        
        Args:
            max_age_seconds: 最大缓存年龄（秒）
        """
        self._prices: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.max_age = max_age_seconds
        
        # 统计
        self.stats = {
            'updates': 0,
            'hits': 0,
            'misses': 0,
            'expired': 0
        }
    
    def update(self, symbol: str, bid: float, ask: float, last: float = None):
        """
        更新价格（线程安全）
        
        Args:
            symbol: 交易对（OKX格式：ETH-USDT-SWAP）
            bid: 买价
            ask: 卖价
            last: 最新价（可选）
        """
        with self._lock:
            mid = (bid + ask) / 2 if bid and ask else (last or 0)
            self._prices[symbol] = {
                'bid': float(bid),
                'ask': float(ask),
                'mid': float(mid),
                'last': float(last) if last else float(mid),
                'ts': time.time()
            }
            self.stats['updates'] += 1
    
    def get(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        获取价格数据（线程安全）
        
        Args:
            symbol: 交易对
            
        Returns:
            {'bid': float, 'ask': float, 'mid': float, 'last': float, 'ts': float}
        """
        with self._lock:
            data = self._prices.get(symbol)
            
            if data is None:
                self.stats['misses'] += 1
                return None
            
            # 检查是否过期
            age = time.time() - data['ts']
            if age > self.max_age:
                self.stats['expired'] += 1
                return None
            
            self.stats['hits'] += 1
            return data.copy()
    
    def get_price(self, symbol: str) -> Optional[float]:
        """
        快速获取中间价（线程安全）
        
        Args:
            symbol: 交易对
            
        Returns:
            中间价或 None
        """
        data = self.get(symbol)
        return data['mid'] if data else None
    
    def get_bid_ask(self, symbol: str) -> Optional[tuple]:
        """
        获取买卖价（线程安全）
        
        Args:
            symbol: 交易对
            
        Returns:
            (bid, ask) 或 None
        """
        data = self.get(symbol)
        if data:
            return (data['bid'], data['ask'])
        return None
    
    def get_all(self) -> Dict[str, Dict[str, Any]]:
        """获取所有缓存数据（线程安全）"""
        with self._lock:
            return {k: v.copy() for k, v in self._prices.items()}
    
    def clear(self):
        """清空缓存"""
        with self._lock:
            self._prices.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self._lock:
            total = self.stats['hits'] + self.stats['misses']
            hit_rate = self.stats['hits'] / total * 100 if total > 0 else 0
            
            return {
                **self.stats,
                'cached_symbols': len(self._prices),
                'hit_rate': hit_rate
            }


# 全局单例
_price_cache: Optional[PriceCache] = None


def get_global_price_cache() -> PriceCache:
    """获取全局价格缓存实例"""
    global _price_cache
    if _price_cache is None:
        _price_cache = PriceCache()
    return _price_cache