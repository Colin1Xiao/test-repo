#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能缓存系统
加速响应速度，减少重复计算
"""

import json
import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path

class SmartCache:
    """智能缓存系统"""
    
    def __init__(self, cache_dir=None, default_ttl=300):
        """
        初始化缓存系统
        
        Args:
            cache_dir: 缓存目录 (默认：workspace/cache)
            default_ttl: 默认 TTL (秒)，默认 5 分钟
        """
        if cache_dir is None:
            cache_dir = Path(__file__).parent / 'cache'
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.default_ttl = default_ttl
        self.memory_cache = {}  # 内存缓存 (热数据)
    
    def _generate_key(self, key_data):
        """生成缓存键"""
        if isinstance(key_data, str):
            key_str = key_data
        else:
            key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, key, ttl=None):
        """
        获取缓存数据
        
        Args:
            key: 缓存键
            ttl: 自定义 TTL (秒)
        
        Returns:
            缓存数据，如果不存在或过期则返回 None
        """
        if ttl is None:
            ttl = self.default_ttl
        
        cache_key = self._generate_key(key)
        
        # 先查内存缓存
        if cache_key in self.memory_cache:
            data, timestamp = self.memory_cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=ttl):
                return data
        
        # 再查文件缓存
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                timestamp = datetime.fromisoformat(cached_data['timestamp'])
                if datetime.now() - timestamp < timedelta(seconds=ttl):
                    # 加载到内存缓存
                    self.memory_cache[cache_key] = (cached_data['data'], timestamp)
                    return cached_data['data']
                else:
                    # 过期删除
                    cache_file.unlink()
            except Exception:
                pass
        
        return None
    
    def set(self, key, data, ttl=None):
        """
        设置缓存数据
        
        Args:
            key: 缓存键
            data: 缓存数据
            ttl: 自定义 TTL (秒)
        """
        if ttl is None:
            ttl = self.default_ttl
        
        cache_key = self._generate_key(key)
        timestamp = datetime.now()
        
        # 保存到内存缓存
        self.memory_cache[cache_key] = (data, timestamp)
        
        # 保存到文件缓存
        cache_file = self.cache_dir / f"{cache_key}.json"
        cached_data = {
            'data': data,
            'timestamp': timestamp.isoformat(),
            'ttl': ttl
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cached_data, f, indent=2, ensure_ascii=False)
    
    def delete(self, key):
        """删除缓存"""
        cache_key = self._generate_key(key)
        
        # 删除内存缓存
        if cache_key in self.memory_cache:
            del self.memory_cache[cache_key]
        
        # 删除文件缓存
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            cache_file.unlink()
    
    def clear(self):
        """清空所有缓存"""
        self.memory_cache.clear()
        
        # 清空文件缓存
        for cache_file in self.cache_dir.glob('*.json'):
            cache_file.unlink()
    
    def cleanup(self, max_age=3600):
        """清理过期缓存"""
        cleaned = 0
        for cache_file in self.cache_dir.glob('*.json'):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                timestamp = datetime.fromisoformat(cached_data['timestamp'])
                ttl = cached_data.get('ttl', self.default_ttl)
                
                if datetime.now() - timestamp > timedelta(seconds=ttl):
                    cache_file.unlink()
                    cleaned += 1
            except Exception:
                pass
        
        return cleaned
    
    def stats(self):
        """获取缓存统计信息"""
        memory_count = len(self.memory_cache)
        file_count = len(list(self.cache_dir.glob('*.json')))
        
        # 计算缓存大小
        total_size = sum(f.stat().st_size for f in self.cache_dir.glob('*.json'))
        
        return {
            'memory_cache_count': memory_count,
            'file_cache_count': file_count,
            'total_cache_size_bytes': total_size,
            'total_cache_size_mb': round(total_size / 1024 / 1024, 2)
        }

# 全局缓存实例
global_cache = SmartCache()

# 便捷函数
def cache_get(key, ttl=300):
    return global_cache.get(key, ttl)

def cache_set(key, data, ttl=300):
    global_cache.set(key, data, ttl)

def cache_delete(key):
    global_cache.delete(key)

def cache_clear():
    global_cache.clear()

def cache_stats():
    return global_cache.stats()

if __name__ == '__main__':
    # 测试缓存系统
    print("🧪 测试智能缓存系统...")
    
    cache = SmartCache()
    
    # 测试设置缓存
    print("\n1. 设置缓存...")
    cache.set('test_key', {'data': 'test_value'}, ttl=60)
    print("   ✅ 缓存已设置")
    
    # 测试获取缓存
    print("\n2. 获取缓存...")
    data = cache.get('test_key')
    print(f"   ✅ 获取成功：{data}")
    
    # 测试缓存统计
    print("\n3. 缓存统计...")
    stats = cache.stats()
    print(f"   📊 {stats}")
    
    # 测试缓存清理
    print("\n4. 清理缓存...")
    cleaned = cache.cleanup()
    print(f"   ✅ 清理了{cleaned}个过期缓存")
    
    print("\n✅ 缓存系统测试完成！")
