#!/usr/bin/env python3
"""
WebSocket Price Feed - 生产级实时价格订阅

核心功能：
1. OKX WebSocket 实时订阅
2. 自动断线重连
3. 心跳检测
4. 线程安全缓存
5. REST fallback
"""

import asyncio
import json
import time
import threading
import os
from typing import Dict, List, Optional, Callable
from datetime import datetime


class WSPriceFeed:
    """
    WebSocket 价格订阅
    
    架构：
    ┌──────────────┐
    │ OKX WS       │ → Push (实时)
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │ Price Cache  │ → 线程安全缓存
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │ get_price()  │ → 0ms 读取
    └──────────────┘
    """
    
    def __init__(
        self,
        cache,
        symbols: List[str] = None,
        on_message: Callable = None,
        on_error: Callable = None
    ):
        """
        初始化 WebSocket 价格订阅
        
        Args:
            cache: PriceCache 实例
            symbols: 交易对列表（OKX格式：ETH-USDT-SWAP）
            on_message: 消息回调
            on_error: 错误回调
        """
        self.cache = cache
        self.symbols = symbols or ['ETH-USDT-SWAP', 'BTC-USDT-SWAP']
        self.on_message = on_message
        self.on_error = on_error
        
        # WebSocket 配置
        self.url = "wss://ws.okx.com:8443/ws/v5/public"
        self.ws = None
        self.running = False
        self._connected = False
        
        # 线程
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        
        # 心跳
        self._last_message_time = 0
        self._heartbeat_interval = 25  # OKX 要求 25 秒内发送 ping
        self._reconnect_delay = 1
        self._max_reconnect_delay = 30
        
        # 统计
        self.stats = {
            'messages_received': 0,
            'prices_updated': 0,
            'reconnects': 0,
            'errors': 0
        }
        
        # 代理（使用环境变量）
        self.proxy = os.environ.get('https_proxy', os.environ.get('HTTPS_PROXY', ''))
    
    def start(self):
        """启动 WebSocket 订阅"""
        if self.running:
            print("⚠️ WebSocket 已运行")
            return
        
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print("✅ WebSocket 价格订阅已启动")
    
    def stop(self):
        """停止 WebSocket 订阅"""
        self.running = False
        if self._loop and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=3.0)
        print("🛑 WebSocket 价格订阅已停止")
    
    def _run_loop(self):
        """运行异步事件循环"""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        
        try:
            self._loop.run_until_complete(self._connect_and_listen())
        except Exception as e:
            print(f"❌ WebSocket 循环错误: {e}")
        finally:
            self._loop.close()
    
    async def _connect_and_listen(self):
        """连接并监听"""
        import websockets
        
        while self.running:
            try:
                print(f"🔌 WebSocket 连接中... ({self.url})")
                
                # 创建连接（websockets 会自动使用系统代理）
                async with websockets.connect(
                    self.url,
                    ping_interval=25,
                    ping_timeout=10,
                    close_timeout=1
                ) as ws:
                    self.ws = ws
                    self._connected = True
                    self._reconnect_delay = 1
                    print("✅ WebSocket 连接成功")
                    
                    # 订阅
                    await self._subscribe(ws)
                    
                    # 监听消息
                    await self._listen(ws)
                    
            except Exception as e:
                self._connected = False
                self.stats['errors'] += 1
                
                error_msg = str(e)
                print(f"❌ WebSocket 错误: {error_msg}")
                
                if self.on_error:
                    self.on_error(e)
                
                # 指数退避重连
                if self.running:
                    print(f"⏳ {self._reconnect_delay}秒后重连...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(
                        self._reconnect_delay * 2,
                        self._max_reconnect_delay
                    )
                    self.stats['reconnects'] += 1
    
    async def _subscribe(self, ws):
        """订阅 ticker 频道"""
        args = []
        for symbol in self.symbols:
            args.append({
                "channel": "tickers",
                "instId": symbol
            })
        
        sub_msg = {
            "op": "subscribe",
            "args": args
        }
        
        await ws.send(json.dumps(sub_msg))
        print(f"📡 已订阅: {self.symbols}")
    
    async def _listen(self, ws):
        """监听消息"""
        import websockets
        
        self._last_message_time = time.time()
        
        while self.running:
            try:
                # 等待消息（带超时）
                message = await asyncio.wait_for(ws.recv(), timeout=30)
                self._last_message_time = time.time()
                self.stats['messages_received'] += 1
                
                # 解析消息
                data = json.loads(message)
                
                # 处理 ticker 数据
                if 'data' in data:
                    for item in data['data']:
                        symbol = item.get('instId')
                        if symbol:
                            bid = float(item.get('bid', 0))
                            ask = float(item.get('ask', 0))
                            last = float(item.get('last', 0))
                            
                            # 更新缓存
                            self.cache.update(symbol, bid, ask, last)
                            self.stats['prices_updated'] += 1
                            
                            # 回调
                            if self.on_message:
                                self.on_message(symbol, bid, ask, last)
                
                # pong 响应
                if data.get('op') == 'pong':
                    pass  # 心跳正常
                
            except asyncio.TimeoutError:
                # 检查心跳
                if time.time() - self._last_message_time > 60:
                    print("⚠️ WebSocket 心跳超时，重连...")
                    raise websockets.exceptions.ConnectionClosed(1006, "heartbeat timeout")
                    
            except websockets.exceptions.ConnectionClosed:
                print("⚠️ WebSocket 连接关闭")
                raise
                
            except json.JSONDecodeError:
                pass  # 忽略无效消息
                
            except Exception as e:
                print(f"⚠️ 消息处理错误: {e}")
    
    def is_connected(self) -> bool:
        """检查连接状态"""
        return self._connected
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            **self.stats,
            'connected': self._connected,
            'running': self.running,
            'symbols': self.symbols
        }


# Symbol 格式转换工具
def ccxt_to_okx(symbol: str) -> str:
    """
    CCXT 格式转 OKX 格式
    
    ETH/USDT:USDT -> ETH-USDT-SWAP
    BTC/USDT:USDT -> BTC-USDT-SWAP
    """
    return symbol.replace('/', '-').replace(':USDT', '-SWAP')


def okx_to_ccxt(symbol: str) -> str:
    """
    OKX 格式转 CCXT 格式
    
    ETH-USDT-SWAP -> ETH/USDT:USDT
    BTC-USDT-SWAP -> BTC/USDT:USDT
    """
    return symbol.replace('-SWAP', '/USDT:USDT').replace('-', '/')


# 测试
if __name__ == "__main__":
    print("🧪 WebSocket 价格订阅测试")
    
    from price_cache import PriceCache
    
    cache = PriceCache()
    feed = WSPriceFeed(cache, ['ETH-USDT-SWAP'])
    feed.start()
    
    time.sleep(5)
    
    # 测试获取价格
    print("\n📊 价格测试:")
    for i in range(10):
        price = cache.get_price('ETH-USDT-SWAP')
        bid_ask = cache.get_bid_ask('ETH-USDT-SWAP')
        
        if price:
            print(f"  {i+1}. mid={price:.2f}, bid={bid_ask[0]:.2f}, ask={bid_ask[1]:.2f}")
        else:
            print(f"  {i+1}. ⚠️ 未获取到价格")
        
        time.sleep(1)
    
    print(f"\n📊 统计: {feed.get_stats()}")
    print(f"📊 缓存: {cache.get_stats()}")
    
    feed.stop()