#!/usr/bin/env python3
"""
Unified Data Pipeline
统一数据管道 - 整合所有数据源

数据源:
- 市场数据：OKX API
- 链上数据：Glassnode API (可选)
- 情绪数据：Alternative.me + CryptoPanic
- 宏观数据：财经日历
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import sys
import os
try:
    import ccxt
    import aiohttp
except ImportError as e:
    print(f"错误：缺少依赖包 - {e}", file=sys.stderr)
    sys.exit(1)

# 自动检测并配置 ClashX 代理
PROXY_URL = os.getenv('https_proxy', 'http://127.0.0.1:7890')
if not os.getenv('https_proxy'):
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        if s.connect_ex(('127.0.0.1', 7890)) == 0:
            PROXY_URL = 'http://127.0.0.1:7890'
            os.environ['https_proxy'] = PROXY_URL
            os.environ['http_proxy'] = 'http://127.0.0.1:7890'
            print("✅ 自动检测到 ClashX 代理")
        s.close()
    except:
        pass


class UnifiedDataPipeline:
    """统一数据管道"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.cache = {}
        self.cache_ttl = 300  # 5 分钟缓存
        
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        default_config = {
            'okx': {
                'enabled': True,
                'testnet': False
            },
            'glassnode': {
                'enabled': False,
                'api_key': ''
            },
            'alternative_me': {
                'enabled': True,
                'url': 'https://api.alternative.me/fng/'
            },
            'cryptopanic': {
                'enabled': False,
                'api_key': ''
            },
            'cache_ttl': 300  # 5 分钟
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                file_config = json.load(f)
                default_config.update(file_config)
        
        self.cache_ttl = default_config.get('cache_ttl', 300)
        return default_config
    
    def _get_cache_key(self, source: str, params: Dict) -> str:
        """生成缓存 key"""
        return f"{source}:{json.dumps(params, sort_keys=True)}"
    
    def _get_from_cache(self, key: str) -> Optional[Dict]:
        """从缓存获取"""
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.cache_ttl:
                return data
            else:
                del self.cache[key]
        return None
    
    def _set_cache(self, key: str, data: Dict):
        """设置缓存"""
        self.cache[key] = (data, time.time())
    
    async def fetch_market_data(self, symbol: str = 'BTC/USDT', 
                                timeframe: str = '5m', 
                                limit: int = 100) -> Dict:
        """获取市场数据"""
        cache_key = self._get_cache_key('market', {
            'symbol': symbol,
            'timeframe': timeframe,
            'limit': limit
        })
        
        # 检查缓存
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            exchange = ccxt.okx({
                'enableRateLimit': True,
                'options': {'defaultType': 'future'}
            })
            
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            
            data = {
                'symbol': symbol,
                'timeframe': timeframe,
                'ohlcv': ohlcv,
                'timestamp': datetime.now().isoformat()
            }
            
            # 设置缓存
            self._set_cache(cache_key, data)
            
            return data
            
        except Exception as e:
            print(f"获取市场数据失败：{e}", file=sys.stderr)
            return {'error': str(e)}
    
    async def fetch_fear_greed(self) -> Dict:
        """获取恐惧贪婪指数"""
        cache_key = self._get_cache_key('fng', {})
        
        # 检查缓存
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        if not self.config['alternative_me']['enabled']:
            return {'error': 'Alternative.me 未启用'}
        
        try:
            import ssl
            # 创建 SSL 上下文（禁用证书验证用于测试）
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            async with aiohttp.ClientSession(connector=connector) as session:
                url = self.config['alternative_me']['url']
                proxy = PROXY_URL if PROXY_URL else None
                async with session.get(url, timeout=10, proxy=proxy) as response:
                    result = await response.json()
                    
                    data = {
                        'value': int(result['data'][0]['value']),
                        'value_classification': result['data'][0]['value_classification'],
                        'timestamp': result['data'][0]['timestamp']
                    }
                    
                    # 设置缓存 (恐惧贪婪指数每日更新)
                    self._set_cache(cache_key, data)
                    
                    return data
                    
        except Exception as e:
            print(f"获取恐惧贪婪指数失败：{e}", file=sys.stderr)
            return {'error': str(e)}
    
    async def fetch_news(self, limit: int = 10) -> Dict:
        """获取新闻"""
        cache_key = self._get_cache_key('news', {'limit': limit})
        
        # 检查缓存
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        if not self.config['cryptopanic']['enabled']:
            # 返回空数据
            return {'posts': [], 'note': 'CryptoPanic 未启用'}
        
        try:
            async with aiohttp.ClientSession() as session:
                url = 'https://cryptopanic.com/api/v1/posts/'
                params = {
                    'auth_token': self.config['cryptopanic']['api_key'],
                    'currencies': 'BTC,ETH',
                    'kind': 'news',
                    'limit': limit
                }
                
                proxy = PROXY_URL if PROXY_URL else None
                async with session.get(url, params=params, timeout=10, proxy=proxy) as response:
                    result = await response.json()
                    
                    data = {
                        'posts': result.get('results', []),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # 设置缓存 (15 分钟)
                    self._set_cache(cache_key, data)
                    
                    return data
                    
        except Exception as e:
            print(f"获取新闻失败：{e}", file=sys.stderr)
            return {'error': str(e)}
    
    async def fetch_macro_events(self, days: int = 7) -> Dict:
        """获取宏观事件"""
        cache_key = self._get_cache_key('macro', {'days': days})
        
        # 检查缓存
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # 模拟事件数据 (实际应接入财经日历 API)
        events = [
            {
                'date': '2026-03-15',
                'event': '美联储利率决议',
                'impact': 'HIGH',
                'actual': None,
                'forecast': '5.25%',
                'previous': '5.25%'
            },
            {
                'date': '2026-03-18',
                'event': '美国 CPI 数据',
                'impact': 'HIGH',
                'actual': None,
                'forecast': '3.1%',
                'previous': '3.2%'
            }
        ]
        
        data = {
            'events': events,
            'timestamp': datetime.now().isoformat()
        }
        
        # 设置缓存 (1 小时)
        self._set_cache(cache_key, data)
        
        return data
    
    async def fetch_all(self, symbol: str = 'BTC/USDT') -> Dict:
        """获取所有数据"""
        tasks = [
            self.fetch_market_data(symbol),
            self.fetch_fear_greed(),
            self.fetch_news(limit=5),
            self.fetch_macro_events()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        data = {
            'market': results[0] if not isinstance(results[0], Exception) else {'error': str(results[0])},
            'fear_greed': results[1] if not isinstance(results[1], Exception) else {'error': str(results[1])},
            'news': results[2] if not isinstance(results[2], Exception) else {'error': str(results[2])},
            'macro_events': results[3] if not isinstance(results[3], Exception) else {'error': str(results[3])},
            'timestamp': datetime.now().isoformat()
        }
        
        return data
    
    def clear_cache(self):
        """清空缓存"""
        self.cache.clear()
        print("缓存已清空")


# 使用示例
async def main():
    # 创建数据管道
    pipeline = UnifiedDataPipeline()
    
    print("="*70)
    print("📊 统一数据管道")
    print("="*70)
    
    # 获取所有数据
    print("\n获取所有数据...")
    data = await pipeline.fetch_all('BTC/USDT')
    
    # 显示结果
    print(f"\n市场数据：{len(data['market'].get('ohlcv', []))} 根 K 线")
    print(f"恐惧贪婪：{data['fear_greed'].get('value', 'N/A')} ({data['fear_greed'].get('value_classification', 'N/A')})")
    print(f"新闻数量：{len(data['news'].get('posts', []))} 条")
    print(f"宏观事件：{len(data['macro_events'].get('events', []))} 个")
    
    print("\n" + "="*70)
    print("✅ 数据管道就绪")
    print("="*70)


if __name__ == '__main__':
    asyncio.run(main())
