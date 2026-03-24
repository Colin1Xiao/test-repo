#!/usr/bin/env python3
"""
VPS Price Server - 生产级价格服务器

部署在海外 VPS（新加坡/香港），提供实时价格 HTTP API

架构：
┌─────────────┐
│ OKX WS      │ → 实时推送
└──────┬──────┘
       ↓
┌─────────────┐
│ Price Cache │ → 内存缓存
└──────┬──────┘
       ↓
┌─────────────┐
│ HTTP API    │ → 本地系统调用
└─────────────┘

使用：
1. 部署到 VPS: python3 server.py
2. 本地调用: curl http://vps-ip:8080/price/ETH-USDT-SWAP
"""

import asyncio
import json
import time
from typing import Dict, Optional
from aiohttp import web
import aiohttp


class PriceCache:
    """线程安全价格缓存"""
    
    def __init__(self):
        self._prices: Dict[str, Dict] = {}
    
    def update(self, symbol: str, bid: float, ask: float, last: float):
        """更新价格"""
        self._prices[symbol] = {
            'bid': bid,
            'ask': ask,
            'mid': (bid + ask) / 2 if bid and ask else last,
            'last': last,
            'ts': time.time()
        }
    
    def get(self, symbol: str) -> Optional[Dict]:
        """获取价格"""
        return self._prices.get(symbol)
    
    def get_all(self) -> Dict:
        """获取所有价格"""
        return self._prices.copy()


class WSPriceFeed:
    """WebSocket 价格订阅"""
    
    def __init__(self, cache: PriceCache, symbols: list):
        self.cache = cache
        self.symbols = symbols
        self.url = "wss://ws.okx.com:8443/ws/v5/public"
        self.running = True
        self._connected = False
        self.stats = {
            'messages': 0,
            'updates': 0,
            'reconnects': 0
        }
    
    async def run(self):
        """运行 WebSocket（直连，无代理）"""
        while self.running:
            try:
                print(f"🔌 WebSocket 连接中...")
                
                async with aiohttp.ClientSession() as session:
                    async with session.ws_connect(
                        self.url,
                        heartbeat=25
                        # 注意：VPS 直连，不需要代理
                    ) as ws:
                        self._connected = True
                        print("✅ WebSocket 连接成功")
                        
                        # 订阅
                        args = [{"channel": "tickers", "instId": s} for s in self.symbols]
                        await ws.send_str(json.dumps({"op": "subscribe", "args": args}))
                        print(f"📡 已订阅: {self.symbols}")
                        
                        # 监听
                        async for msg in ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                self.stats['messages'] += 1
                                data = json.loads(msg.data)
                                
                                if 'data' in data:
                                    for item in data['data']:
                                        symbol = item.get('instId')
                                        if symbol:
                                            self.cache.update(
                                                symbol,
                                                float(item.get('bid', 0)),
                                                float(item.get('ask', 0)),
                                                float(item.get('last', 0))
                                            )
                                            self.stats['updates'] += 1
                            
                            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                                break
                                
            except Exception as e:
                print(f"❌ WebSocket 错误: {e}")
                self._connected = False
                self.stats['reconnects'] += 1
                await asyncio.sleep(2)


class PriceServer:
    """HTTP 价格服务器"""
    
    def __init__(self, cache: PriceCache, ws_feed: WSPriceFeed, port: int = 8080):
        self.cache = cache
        self.ws_feed = ws_feed
        self.port = port
        self.app = web.Application()
        self._setup_routes()
    
    def _setup_routes(self):
        """设置路由"""
        self.app.router.add_get('/price/{symbol}', self.handle_price)
        self.app.router.add_get('/prices', self.handle_prices)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/stats', self.handle_stats)
    
    async def handle_price(self, request):
        """获取单个价格"""
        symbol = request.match_info['symbol']
        data = self.cache.get(symbol)
        
        if data:
            age_ms = (time.time() - data['ts']) * 1000
            return web.json_response({
                'symbol': symbol,
                'bid': data['bid'],
                'ask': data['ask'],
                'mid': data['mid'],
                'last': data['last'],
                'age_ms': round(age_ms, 1),
                'ts': data['ts']
            })
        else:
            return web.json_response({'error': 'symbol not found'}, status=404)
    
    async def handle_prices(self, request):
        """获取所有价格"""
        prices = self.cache.get_all()
        
        result = {}
        for symbol, data in prices.items():
            age_ms = (time.time() - data['ts']) * 1000
            result[symbol] = {
                **data,
                'age_ms': round(age_ms, 1)
            }
        
        return web.json_response(result)
    
    async def handle_health(self, request):
        """健康检查"""
        return web.json_response({
            'status': 'healthy',
            'ws_connected': self.ws_feed._connected,
            'cached_symbols': len(self.cache.get_all())
        })
    
    async def handle_stats(self, request):
        """统计信息"""
        return web.json_response({
            'ws_stats': self.ws_feed.stats,
            'cached_symbols': list(self.cache.get_all().keys())
        })


async def main():
    """主函数"""
    print("=" * 60)
    print("🚀 VPS Price Server 启动")
    print("=" * 60)
    
    # 配置
    symbols = ['ETH-USDT-SWAP', 'BTC-USDT-SWAP']
    port = 8080
    
    # 创建组件
    cache = PriceCache()
    ws_feed = WSPriceFeed(cache, symbols)
    server = PriceServer(cache, ws_feed, port)
    
    # 启动 WebSocket 和 HTTP 服务器
    runner = web.AppRunner(server.app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    
    print(f"✅ HTTP 服务器已启动: http://0.0.0.0:{port}")
    print(f"📡 价格端点:")
    print(f"   GET /price/{{symbol}}  - 获取单个价格")
    print(f"   GET /prices           - 获取所有价格")
    print(f"   GET /health           - 健康检查")
    print(f"   GET /stats            - 统计信息")
    print("=" * 60)
    
    # 运行 WebSocket
    await ws_feed.run()


if __name__ == '__main__':
    asyncio.run(main())