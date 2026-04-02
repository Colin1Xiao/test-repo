#!/usr/bin/env python3
"""
Simple Cache Module
简单缓存模块 - 避免重复计算
"""

import json
import time
from pathlib import Path
from functools import wraps


class SimpleCache:
    """简单文件缓存"""
    
    def __init__(self, cache_dir=None, ttl=300):
        """
        Args:
            cache_dir: 缓存目录
            ttl: 生存时间（秒），默认 5 分钟
        """
        if cache_dir is None:
            cache_dir = Path.home() / '.openclaw' / 'workspace' / 'cache'
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl
    
    def _get_cache_path(self, key):
        """获取缓存文件路径"""
        # 将 key 转换为安全的文件名
        safe_key = key.replace('/', '_').replace(':', '_').replace('?', '_')
        return self.cache_dir / f"{safe_key}.json"
    
    def get(self, key, default=None):
        """获取缓存"""
        cache_path = self._get_cache_path(key)
        
        if not cache_path.exists():
            return default
        
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            
            # 检查是否过期
            if time.time() - data['timestamp'] > self.ttl:
                cache_path.unlink()  # 删除过期缓存
                return default
            
            return data['value']
        except:
            return default
    
    def set(self, key, value):
        """设置缓存"""
        cache_path = self._get_cache_path(key)
        
        data = {
            'timestamp': time.time(),
            'value': value
        }
        
        with open(cache_path, 'w') as f:
            json.dump(data, f)
    
    def delete(self, key):
        """删除缓存"""
        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            cache_path.unlink()
    
    def clear(self):
        """清空所有缓存"""
        for cache_file in self.cache_dir.glob('*.json'):
            cache_file.unlink()


# 全局缓存实例
ohlcv_cache = SimpleCache(ttl=300)  # K 线数据缓存 5 分钟
indicator_cache = SimpleCache(ttl=60)  # 指标缓存 1 分钟
signal_cache = SimpleCache(ttl=10)  # 信号缓存 10 秒


def cached(cache_instance, key_prefix=''):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存 key
            key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # 尝试从缓存获取
            result = cache_instance.get(key)
            if result is not None:
                return result
            
            # 执行函数
            result = func(*args, **kwargs)
            
            # 存入缓存
            cache_instance.set(key, result)
            
            return result
        return wrapper
    return decorator


# 使用示例
if __name__ == '__main__':
    # 测试缓存
    cache = SimpleCache(ttl=10)
    
    cache.set('test', {'data': [1, 2, 3]})
    print(f"获取缓存：{cache.get('test')}")
    
    # 测试装饰器
    @cached(ohlcv_cache, key_prefix='ohlcv')
    def fetch_data(symbol, timeframe):
        print(f"Fetching {symbol} {timeframe}...")
        return {'symbol': symbol, 'timeframe': timeframe}
    
    # 第一次调用（实际获取）
    result1 = fetch_data('BTC/USDT', '1m')
    print(f"结果 1: {result1}")
    
    # 第二次调用（从缓存）
    result2 = fetch_data('BTC/USDT', '1m')
    print(f"结果 2: {result2}")
    
    print("✅ 缓存测试完成")
