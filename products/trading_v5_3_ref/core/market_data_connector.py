"""
Market Data Connector V5.4 - 真实市场数据源

连接 OKX 真实市场数据，提供给交易系统使用
"""

import json
import asyncio
import ccxt.async_support as ccxt
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from datetime import datetime


class MarketDataConnector:
    """
    市场数据连接器 V5.4
    
    功能:
    - 连接 OKX 真实市场数据
    - 实时价格、订单簿、成交数据
    - 数据验证和异常处理
    - 与 StateStore V5.4 集成
    """
    
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "market_data_v54.json"
        
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.exchange = None
        self.symbol = self.config['symbols']['primary']
        self.okx_symbol = self.config['symbols']['okx_symbol']
        
        # 数据缓存
        self._ticker: Optional[Dict] = None
        self._orderbook: Optional[Dict] = None
        self._last_update: Optional[datetime] = None
        
        # 回调
        self._callbacks: list = []
        
        print("✅ MarketDataConnector V5.4 初始化完成")
        print(f"   交易对: {self.symbol}")
        print(f"   OKX合约: {self.okx_symbol}")
    
    async def connect(self):
        """连接交易所"""
        self.exchange = ccxt.okx({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'swap',
            }
        })
        await self.exchange.load_markets()
        print("✅ OKX 连接成功")
    
    async def disconnect(self):
        """断开连接"""
        if self.exchange:
            await self.exchange.close()
            print("✅ OKX 断开连接")
    
    async def fetch_ticker(self) -> Dict[str, Any]:
        """获取实时价格"""
        try:
            ticker = await self.exchange.fetch_ticker(self.symbol)
            self._ticker = {
                'symbol': ticker['symbol'],
                'last': ticker['last'],
                'bid': ticker['bid'],
                'ask': ticker['ask'],
                'volume': ticker['baseVolume'],
                'timestamp': ticker['timestamp'],
                'datetime': ticker['datetime']
            }
            self._last_update = datetime.utcnow()
            return self._ticker
        except Exception as e:
            print(f"❌ 获取价格失败: {e}")
            return None
    
    async def fetch_orderbook(self, limit: int = 20) -> Dict[str, Any]:
        """获取订单簿"""
        try:
            orderbook = await self.exchange.fetch_order_book(self.symbol, limit)
            self._orderbook = {
                'symbol': self.symbol,
                'bids': orderbook['bids'][:limit],
                'asks': orderbook['asks'][:limit],
                'timestamp': orderbook['timestamp'],
                'datetime': orderbook['datetime']
            }
            
            # 计算买卖价差
            if self._orderbook['bids'] and self._orderbook['asks']:
                best_bid = self._orderbook['bids'][0][0]
                best_ask = self._orderbook['asks'][0][0]
                spread = (best_ask - best_bid) / best_bid * 10000  # bps
                self._orderbook['spread_bps'] = spread
            
            return self._orderbook
        except Exception as e:
            print(f"❌ 获取订单簿失败: {e}")
            return None
    
    async def fetch_balance(self) -> Dict[str, Any]:
        """获取账户余额"""
        try:
            balance = await self.exchange.fetch_balance()
            return {
                'USDT': {
                    'free': balance['USDT']['free'],
                    'used': balance['USDT']['used'],
                    'total': balance['USDT']['total']
                },
                'timestamp': balance['timestamp']
            }
        except Exception as e:
            print(f"❌ 获取余额失败: {e}")
            return None
    
    async def fetch_position(self) -> Optional[Dict[str, Any]]:
        """获取当前持仓"""
        try:
            positions = await self.exchange.fetch_positions([self.symbol])
            for pos in positions:
                if pos['contracts'] != 0:
                    return {
                        'symbol': pos['symbol'],
                        'side': pos['side'],
                        'contracts': pos['contracts'],
                        'notional': pos['notional'],
                        'entry_price': pos['entryPrice'],
                        'mark_price': pos['markPrice'],
                        'unrealized_pnl': pos['unrealizedPnl'],
                        'liquidation_price': pos['liquidationPrice'],
                        'leverage': pos['leverage']
                    }
            return None  # 无持仓
        except Exception as e:
            print(f"❌ 获取持仓失败: {e}")
            return None
    
    def get_cached_ticker(self) -> Optional[Dict]:
        """获取缓存的价格"""
        return self._ticker
    
    def get_cached_orderbook(self) -> Optional[Dict]:
        """获取缓存的订单簿"""
        return self._orderbook
    
    def is_data_fresh(self, max_age_seconds: int = 5) -> bool:
        """检查数据是否新鲜"""
        if not self._last_update:
            return False
        elapsed = (datetime.utcnow() - self._last_update).total_seconds()
        return elapsed < max_age_seconds
    
    def get_spread_bps(self) -> Optional[float]:
        """获取当前价差 (bps)"""
        if self._orderbook and 'spread_bps' in self._orderbook:
            return self._orderbook['spread_bps']
        return None
    
    def get_mid_price(self) -> Optional[float]:
        """获取中间价"""
        if self._ticker:
            return (self._ticker['bid'] + self._ticker['ask']) / 2
        return None
    
    async def run_data_loop(self, interval_seconds: float = 1.0):
        """持续更新数据循环"""
        print(f"🔄 启动数据循环 (间隔: {interval_seconds}s)")
        
        while True:
            try:
                # 获取价格
                await self.fetch_ticker()
                
                # 获取订单簿
                await self.fetch_orderbook()
                
                # 触发回调
                for callback in self._callbacks:
                    try:
                        callback(self._ticker, self._orderbook)
                    except Exception as e:
                        print(f"⚠️ 回调错误: {e}")
                
                await asyncio.sleep(interval_seconds)
                
            except Exception as e:
                print(f"❌ 数据循环错误: {e}")
                await asyncio.sleep(interval_seconds)
    
    def register_callback(self, callback: Callable):
        """注册数据更新回调"""
        self._callbacks.append(callback)
    
    def get_market_summary(self) -> Dict[str, Any]:
        """获取市场摘要"""
        return {
            'symbol': self.symbol,
            'price': self._ticker['last'] if self._ticker else None,
            'spread_bps': self.get_spread_bps(),
            'data_fresh': self.is_data_fresh(),
            'last_update': self._last_update.isoformat() if self._last_update else None
        }


# ============ 便捷函数 ============

async def create_connector() -> MarketDataConnector:
    """创建并连接市场数据连接器"""
    connector = MarketDataConnector()
    await connector.connect()
    return connector


async def test_connector():
    """测试连接器"""
    print("=" * 60)
    print("🧪 MarketDataConnector 测试")
    print("=" * 60)
    
    connector = await create_connector()
    
    # 测试获取价格
    print("\n📊 获取实时价格...")
    ticker = await connector.fetch_ticker()
    if ticker:
        print(f"   最新价: ${ticker['last']}")
        print(f"   买一: ${ticker['bid']}")
        print(f"   卖一: ${ticker['ask']}")
    
    # 测试获取订单簿
    print("\n📚 获取订单簿...")
    orderbook = await connector.fetch_orderbook()
    if orderbook:
        print(f"   价差: {orderbook.get('spread_bps', 0):.2f} bps")
        print(f"   买一: {orderbook['bids'][0][0] if orderbook['bids'] else 'N/A'}")
        print(f"   卖一: {orderbook['asks'][0][0] if orderbook['asks'] else 'N/A'}")
    
    # 测试获取余额
    print("\n💰 获取账户余额...")
    balance = await connector.fetch_balance()
    if balance:
        usdt = balance.get('USDT', {})
        print(f"   USDT 可用: {usdt.get('free', 0)}")
        print(f"   USDT 冻结: {usdt.get('used', 0)}")
        print(f"   USDT 总计: {usdt.get('total', 0)}")
    
    # 测试获取持仓
    print("\n📍 获取当前持仓...")
    position = await connector.fetch_position()
    if position:
        print(f"   方向: {position['side']}")
        print(f"   数量: {position['contracts']}")
        print(f"   开仓价: ${position['entry_price']}")
        print(f"   标记价: ${position['mark_price']}")
        print(f"   未实现盈亏: ${position['unrealized_pnl']}")
    else:
        print("   当前无持仓")
    
    # 断开连接
    await connector.disconnect()
    
    print("\n" + "=" * 60)
    print("✅ 测试完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_connector())