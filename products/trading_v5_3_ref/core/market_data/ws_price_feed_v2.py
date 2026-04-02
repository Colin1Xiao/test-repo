#!/usr/bin/env python3
"""
WebSocket Price Feed V2 - 使用 aiohttp（支持代理）
"""

import asyncio
import json
import time
import threading
import os
from typing import Dict, List, Optional
import aiohttp


class WSPriceFeedV2:
    """WebSocket 价格订阅 V2（支持代理）"""
    
    def __init__(self, cache, symbols: List[str] = None, proxy: str = None):
        self.cache = cache
        self.symbols = symbols or ['ETH-USDT-SWAP']
        self.url = "wss://ws.okx.com:8443/ws/v5/public"
        self.proxy = proxy or os.environ.get('https_proxy', 'http://127.0.0.1:7890')
        
        self.running = False
        self._connected = False
        self._session = None
        self._ws = None
        self._thread = None
        self._loop = None
        self._reconnect_delay = 1
        
        self.stats = {
            'messages_received': 0,
            'prices_updated': 0,
            'reconnects': 0,
            'errors': 0
        }
    
    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"✅ WebSocket V2 已启动 (代理: {self.proxy})")
    
    def stop(self):
        self.running = False
        if self._loop and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(self._loop.stop)
        print("🛑 WebSocket V2 已停止")
    
    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._connect_and_listen())
        except Exception as e:
            print(f"❌ WebSocket V2 错误: {e}")
        finally:
            self._loop.close()
    
    async def _connect_and_listen(self):
        while self.running:
            try:
                print(f"🔌 WebSocket V2 连接中...")
                
                self._session = aiohttp.ClientSession()
                self._ws = await self._session.ws_connect(
                    self.url,
                    proxy=self.proxy,
                    heartbeat=25
                )
                
                self._connected = True
                self._reconnect_delay = 1
                print("✅ WebSocket V2 连接成功")
                
                await self._subscribe()
                await self._listen()
                
            except Exception as e:
                self._connected = False
                self.stats['errors'] += 1
                print(f"❌ WebSocket V2 错误: {e}")
                
                if self._ws:
                    await self._ws.close()
                if self._session:
                    await self._session.close()
                
                if self.running:
                    print(f"⏳ {self._reconnect_delay}秒后重连...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(self._reconnect_delay * 2, 30)
                    self.stats['reconnects'] += 1
    
    async def _subscribe(self):
        args = [{"channel": "tickers", "instId": s} for s in self.symbols]
        await self._ws.send_str(json.dumps({"op": "subscribe", "args": args}))
        print(f"📡 已订阅: {self.symbols}")
    
    async def _listen(self):
        while self.running:
            try:
                msg = await self._ws.receive(timeout=30)
                
                if msg.type == aiohttp.WSMsgType.TEXT:
                    self.stats['messages_received'] += 1
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
                                self.stats['prices_updated'] += 1
                
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    break
                    
            except asyncio.TimeoutError:
                await self._ws.ping()
            except Exception as e:
                print(f"⚠️ 消息处理错误: {e}")
                break
        
        await self._ws.close()
        await self._session.close()
        self._connected = False
    
    def is_connected(self) -> bool:
        return self._connected
    
    def get_stats(self) -> Dict:
        return {**self.stats, 'connected': self._connected, 'running': self.running}


if __name__ == "__main__":
    print("🧪 WebSocket V2 测试（支持代理）")
    
    from price_cache import PriceCache
    
    cache = PriceCache()
    feed = WSPriceFeedV2(cache, ['ETH-USDT-SWAP'])
    feed.start()
    
    time.sleep(10)
    
    print("\n📊 价格测试:")
    for i in range(5):
        price = cache.get_price('ETH-USDT-SWAP')
        print(f"  {i+1}. {'mid=' + str(round(price, 2)) if price else '⚠️ 未获取到价格'}")
        time.sleep(1)
    
    print(f"\n📊 统计: {feed.get_stats()}")
    feed.stop()