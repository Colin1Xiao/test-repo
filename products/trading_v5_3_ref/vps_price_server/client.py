#!/usr/bin/env python3
"""
VPS Price Client - 本地价格客户端

从 VPS 价格服务器获取实时价格

使用：
from vps_price_client import VPSPriceClient

client = VPSPriceClient("http://your-vps-ip:8080")
price = client.get_price("ETH-USDT-SWAP")
"""

import requests
import time
import threading
from typing import Dict, Optional


class VPSPriceClient:
    """VPS 价格客户端"""
    
    def __init__(self, vps_url: str, timeout: float = 1.0, cache_seconds: float = 0.5):
        """
        初始化
        
        Args:
            vps_url: VPS 服务器地址（如 http://1.2.3.4:8080）
            timeout: 请求超时（秒）
            cache_seconds: 本地缓存时间（秒）
        """
        self.vps_url = vps_url.rstrip('/')
        self.timeout = timeout
        self.cache_seconds = cache_seconds
        
        # 本地缓存
        self._cache: Dict[str, Dict] = {}
        self._cache_time: Dict[str, float] = {}
        
        # 统计
        self.stats = {
            'requests': 0,
            'cache_hits': 0,
            'errors': 0
        }
    
    def get_price(self, symbol: str) -> Optional[Dict]:
        """
        获取价格
        
        Args:
            symbol: 交易对（ETH-USDT-SWAP）
            
        Returns:
            {'bid': float, 'ask': float, 'mid': float, 'last': float, 'age_ms': float}
        """
        # 检查本地缓存
        if symbol in self._cache:
            cache_age = time.time() - self._cache_time.get(symbol, 0)
            if cache_age < self.cache_seconds:
                self.stats['cache_hits'] += 1
                data = self._cache[symbol].copy()
                data['age_ms'] = cache_age * 1000
                return data
        
        # 从 VPS 获取
        try:
            self.stats['requests'] += 1
            resp = requests.get(
                f"{self.vps_url}/price/{symbol}",
                timeout=self.timeout
            )
            
            if resp.status_code == 200:
                data = resp.json()
                
                # 更新本地缓存
                self._cache[symbol] = data
                self._cache_time[symbol] = time.time()
                
                return data
            else:
                self.stats['errors'] += 1
                return None
                
        except Exception as e:
            self.stats['errors'] += 1
            return None
    
    def get_all_prices(self) -> Dict:
        """获取所有价格"""
        try:
            resp = requests.get(f"{self.vps_url}/prices", timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
        except:
            pass
        return {}
    
    def check_health(self) -> bool:
        """检查 VPS 健康状态"""
        try:
            resp = requests.get(f"{self.vps_url}/health", timeout=self.timeout)
            return resp.status_code == 200
        except:
            return False
    
    def get_stats(self) -> Dict:
        """获取统计"""
        return self.stats.copy()


# 全局实例
_vps_client: Optional[VPSPriceClient] = None


def get_vps_client(vps_url: str = None) -> VPSPriceClient:
    """
    获取全局 VPS 客户端
    
    Args:
        vps_url: VPS 服务器地址（首次调用必须提供）
    """
    global _vps_client
    if _vps_client is None:
        if vps_url is None:
            raise ValueError("首次调用必须提供 vps_url")
        _vps_client = VPSPriceClient(vps_url)
    return _vps_client


# 测试
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python client.py <vps_url>")
        print("示例: python client.py http://1.2.3.4:8080")
        sys.exit(1)
    
    vps_url = sys.argv[1]
    print(f"🧪 测试 VPS 价格客户端: {vps_url}")
    
    client = VPSPriceClient(vps_url)
    
    # 健康检查
    print(f"\n📊 健康检查: {'✅' if client.check_health() else '❌'}")
    
    # 价格测试
    print("\n📊 价格测试:")
    for i in range(5):
        price = client.get_price('ETH-USDT-SWAP')
        if price:
            print(f"  {i+1}. mid={price['mid']:.2f}, age={price['age_ms']:.0f}ms")
        else:
            print(f"  {i+1}. ❌ 获取失败")
        time.sleep(0.5)
    
    print(f"\n📊 统计: {client.get_stats()}")