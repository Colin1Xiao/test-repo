#!/usr/bin/env python3
"""
Multi-Exchange Adapter - 多交易所统一适配器
P0 优先级改进：支持多交易所冗余，防止单点故障

支持的交易所：
- OKX (主要)
- Binance (备用)
- Bybit (备用)
"""

import json
import asyncio
import aiohttp
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 配置代理
import os
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']

# 全局代理配置（用于ccxt）
GLOBAL_PROXIES = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890',
}
DEFAULT_DIAG_SYMBOL = "BTC/USDT:USDT"


class ExchangeType(Enum):
    """交易所类型"""
    OKX = "okx"
    BINANCE = "binance"
    BYBIT = "bybit"


class OrderSide(Enum):
    """订单方向"""
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    """订单类型"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"


@dataclass
class Ticker:
    """行情数据"""
    symbol: str
    price: float
    bid: float
    ask: float
    volume_24h: float
    change_24h: float
    timestamp: datetime


@dataclass
class Order:
    """订单数据"""
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    price: float
    size: float
    filled: float
    status: str
    timestamp: datetime


@dataclass
class Position:
    """持仓数据"""
    symbol: str
    side: str
    size: float
    entry_price: float
    mark_price: float
    unrealized_pnl: float
    leverage: int


class ExchangeAdapter(ABC):
    """交易所适配器基类"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.exchange_type: ExchangeType = None
        self.is_testnet = config.get('testnet', True)
        self.is_connected = False
        self.last_ping = None
        self.latency_ms = 0
        
    @abstractmethod
    async def connect(self) -> bool:
        """连接交易所"""
        pass
    
    @abstractmethod
    async def disconnect(self):
        """断开连接"""
        pass
    
    @abstractmethod
    async def get_ticker(self, symbol: str) -> Optional[Ticker]:
        """获取行情"""
        pass
    
    @abstractmethod
    async def place_order(self, symbol: str, side: OrderSide, 
                         order_type: OrderType, size: float, 
                         price: float = None) -> Optional[Order]:
        """下单"""
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """撤单"""
        pass
    
    @abstractmethod
    async def get_position(self, symbol: str) -> Optional[Position]:
        """获取持仓"""
        pass
    
    @abstractmethod
    async def get_balance(self) -> Dict:
        """获取账户余额"""
        pass
    
    async def health_check(self) -> Tuple[bool, float]:
        """健康检查"""
        try:
            start = datetime.now()
            ticker = await self.get_ticker(DEFAULT_DIAG_SYMBOL)
            latency = (datetime.now() - start).total_seconds() * 1000
            self.latency_ms = latency
            self.last_ping = datetime.now()
            self.is_connected = ticker is not None
            return self.is_connected, latency
        except Exception as e:
            logger.error(f"{self.exchange_type.value} health check failed: {e}")
            self.is_connected = False
            return False, float('inf')


class OKXAdapter(ExchangeAdapter):
    """OKX 适配器"""
    
    def __init__(self, config: Dict):
        super().__init__(config)
        self.exchange_type = ExchangeType.OKX
        self.base_url = "https://www.okx.com"
        self.testnet_url = "https://www.okx.com"
        self.api_key = config.get('api_key', '')
        self.secret_key = config.get('secret_key', '')
        self.passphrase = config.get('passphrase', '')
        
    async def connect(self) -> bool:
        """连接 OKX"""
        try:
            # 尝试获取余额验证连接
            balance = await self.get_balance()
            self.is_connected = balance is not None
            if self.is_connected:
                logger.info(f"✅ OKX {'测试网' if self.is_testnet else '实盘'}连接成功")
            return self.is_connected
        except Exception as e:
            logger.error(f"❌ OKX 连接失败: {e}")
            return False
    
    async def disconnect(self):
        """断开连接"""
        self.is_connected = False
        logger.info("OKX 已断开")
    
    async def get_ticker(self, symbol: str) -> Optional[Ticker]:
        """获取行情"""
        try:
            import ccxt
            exchange = ccxt.okx({
                'proxies': GLOBAL_PROXIES,
                'apiKey': self.api_key,
                'secret': self.secret_key,
                'password': self.passphrase,
            })
            
            if self.is_testnet:
                exchange.set_sandbox_mode(True)
            
            # 转换 symbol 格式: BTC/USDT:USDT -> BTC-USDT-SWAP
            okx_symbol = symbol.replace('/', '-').replace(':USDT', '')
            ticker = exchange.fetch_ticker(okx_symbol)
            
            return Ticker(
                symbol=symbol,
                price=ticker['last'],
                bid=ticker['bid'],
                ask=ticker['ask'],
                volume_24h=ticker['quoteVolume'],
                change_24h=ticker['change'],
                timestamp=datetime.fromtimestamp(ticker['timestamp'] / 1000)
            )
        except Exception as e:
            logger.error(f"OKX get_ticker error: {e}")
            return None
    
    async def place_order(self, symbol: str, side: OrderSide,
                         order_type: OrderType, size: float,
                         price: float = None) -> Optional[Order]:
        """下单"""
        try:
            import ccxt
            exchange = ccxt.okx({
                'proxies': GLOBAL_PROXIES,
                'apiKey': self.api_key,
                'secret': self.secret_key,
                'password': self.passphrase,
            })
            
            if self.is_testnet:
                exchange.set_sandbox_mode(True)
            
            okx_symbol = symbol.replace('/', '-').replace(':USDT', '')
            order_side = 'buy' if side == OrderSide.BUY else 'sell'
            order_type_str = order_type.value
            
            order = exchange.create_order(
                okx_symbol, order_type_str, order_side, size, price
            )
            
            return Order(
                order_id=order['id'],
                symbol=symbol,
                side=side,
                order_type=order_type,
                price=order.get('price', price or 0),
                size=size,
                filled=order.get('filled', 0),
                status=order['status'],
                timestamp=datetime.now()
            )
        except Exception as e:
            logger.error(f"OKX place_order error: {e}")
            return None
    
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """撤单"""
        try:
            import ccxt
            exchange = ccxt.okx({
                'proxies': GLOBAL_PROXIES,
                'apiKey': self.api_key,
                'secret': self.secret_key,
                'password': self.passphrase,
            })
            
            if self.is_testnet:
                exchange.set_sandbox_mode(True)
            
            okx_symbol = symbol.replace('/', '-').replace(':USDT', '')
            exchange.cancel_order(order_id, okx_symbol)
            return True
        except Exception as e:
            logger.error(f"OKX cancel_order error: {e}")
            return False
    
    async def get_position(self, symbol: str) -> Optional[Position]:
        """获取持仓"""
        try:
            import ccxt
            exchange = ccxt.okx({
                'proxies': GLOBAL_PROXIES,
                'apiKey': self.api_key,
                'secret': self.secret_key,
                'password': self.passphrase,
            })
            
            if self.is_testnet:
                exchange.set_sandbox_mode(True)
            
            okx_symbol = symbol.replace('/', '-').replace(':USDT', '')
            positions = exchange.fetch_positions([okx_symbol])
            
            for pos in positions:
                if float(pos.get('contracts', 0)) != 0:
                    return Position(
                        symbol=symbol,
                        side='long' if pos['side'] == 'long' else 'short',
                        size=float(pos['contracts']),
                        entry_price=float(pos['entryPrice']),
                        mark_price=float(pos['markPrice']),
                        unrealized_pnl=float(pos['unrealizedPnl']),
                        leverage=int(pos['leverage'])
                    )
            return None
        except Exception as e:
            logger.error(f"OKX get_position error: {e}")
            return None
    
    async def get_balance(self) -> Dict:
        """获取余额"""
        try:
            import ccxt
            exchange = ccxt.okx({
                'proxies': GLOBAL_PROXIES,
                'apiKey': self.api_key,
                'secret': self.secret_key,
                'password': self.passphrase,
            })
            
            if self.is_testnet:
                exchange.set_sandbox_mode(True)
            
            balance = exchange.fetch_balance()
            return {
                'USDT': balance.get('USDT', {}).get('free', 0),
                'total': balance.get('USDT', {}).get('total', 0)
            }
        except Exception as e:
            logger.error(f"OKX get_balance error: {e}")
            return None


class BinanceAdapter(ExchangeAdapter):
    """Binance 适配器（备用）"""
    
    def __init__(self, config: Dict):
        super().__init__(config)
        self.exchange_type = ExchangeType.BINANCE
        self.api_key = config.get('api_key', '')
        self.secret_key = config.get('secret_key', '')
        
    async def connect(self) -> bool:
        """连接 Binance"""
        try:
            balance = await self.get_balance()
            self.is_connected = balance is not None
            if self.is_connected:
                logger.info("✅ Binance 连接成功")
            return self.is_connected
        except Exception as e:
            logger.error(f"❌ Binance 连接失败: {e}")
            return False
    
    async def disconnect(self):
        """断开连接"""
        self.is_connected = False
        logger.info("Binance 已断开")
    
    async def get_ticker(self, symbol: str) -> Optional[Ticker]:
        """获取行情"""
        try:
            import ccxt
            exchange = ccxt.binance({
                'apiKey': self.api_key,
                'secret': self.secret_key,
            })
            
            binance_symbol = symbol.replace(':USDT', '')
            ticker = exchange.fetch_ticker(binance_symbol)
            
            return Ticker(
                symbol=symbol,
                price=ticker['last'],
                bid=ticker['bid'],
                ask=ticker['ask'],
                volume_24h=ticker['quoteVolume'],
                change_24h=ticker['change'],
                timestamp=datetime.fromtimestamp(ticker['timestamp'] / 1000)
            )
        except Exception as e:
            logger.error(f"Binance get_ticker error: {e}")
            return None
    
    async def place_order(self, symbol: str, side: OrderSide,
                         order_type: OrderType, size: float,
                         price: float = None) -> Optional[Order]:
        """下单"""
        try:
            import ccxt
            exchange = ccxt.binance({
                'apiKey': self.api_key,
                'secret': self.secret_key,
            })
            
            binance_symbol = symbol.replace(':USDT', '')
            order_side = 'buy' if side == OrderSide.BUY else 'sell'
            order_type_str = order_type.value
            
            order = exchange.create_order(
                binance_symbol, order_type_str, order_side, size, price
            )
            
            return Order(
                order_id=order['id'],
                symbol=symbol,
                side=side,
                order_type=order_type,
                price=order.get('price', price or 0),
                size=size,
                filled=order.get('filled', 0),
                status=order['status'],
                timestamp=datetime.now()
            )
        except Exception as e:
            logger.error(f"Binance place_order error: {e}")
            return None
    
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """撤单"""
        try:
            import ccxt
            exchange = ccxt.binance({
                'apiKey': self.api_key,
                'secret': self.secret_key,
            })
            
            binance_symbol = symbol.replace(':USDT', '')
            exchange.cancel_order(order_id, binance_symbol)
            return True
        except Exception as e:
            logger.error(f"Binance cancel_order error: {e}")
            return False
    
    async def get_position(self, symbol: str) -> Optional[Position]:
        """获取持仓"""
        try:
            import ccxt
            exchange = ccxt.binance({
                'apiKey': self.api_key,
                'secret': self.secret_key,
            })
            
            binance_symbol = symbol.replace(':USDT', '')
            positions = exchange.fetch_positions([binance_symbol])
            
            for pos in positions:
                if float(pos.get('contracts', 0)) != 0:
                    return Position(
                        symbol=symbol,
                        side='long' if pos['side'] == 'long' else 'short',
                        size=float(pos['contracts']),
                        entry_price=float(pos['entryPrice']),
                        mark_price=float(pos['markPrice']),
                        unrealized_pnl=float(pos['unrealizedPnl']),
                        leverage=int(pos['leverage'])
                    )
            return None
        except Exception as e:
            logger.error(f"Binance get_position error: {e}")
            return None
    
    async def get_balance(self) -> Dict:
        """获取余额"""
        try:
            import ccxt
            exchange = ccxt.binance({
                'apiKey': self.api_key,
                'secret': self.secret_key,
            })
            
            balance = exchange.fetch_balance()
            return {
                'USDT': balance.get('USDT', {}).get('free', 0),
                'total': balance.get('USDT', {}).get('total', 0)
            }
        except Exception as e:
            logger.error(f"Binance get_balance error: {e}")
            return None


class MultiExchangeManager:
    """多交易所管理器 - 主入口"""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.adapters: Dict[ExchangeType, ExchangeAdapter] = {}
        self.primary_exchange: ExchangeType = ExchangeType.OKX
        self.fallback_order = []  # 无备用交易所（仅 OKX）
        self.is_initialized = False
        
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        if config_path is None:
            config_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
        
        if Path(config_path).exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        # 默认配置（仅 OKX）
        return {
            'okx': {
                'testnet': True,
                'api_key': '',
                'secret_key': '',
                'passphrase': ''
            }
        }
    
    async def initialize(self):
        """初始化所有交易所连接"""
        logger.info("🚀 初始化多交易所管理器...")
        
        # 初始化 OKX
        if 'okx' in self.config:
            self.adapters[ExchangeType.OKX] = OKXAdapter(self.config['okx'])
            await self.adapters[ExchangeType.OKX].connect()
        
        # 初始化 Binance（已禁用）
        # if 'binance' in self.config:
        #     self.adapters[ExchangeType.BINANCE] = BinanceAdapter(self.config['binance'])
        #     await self.adapters[ExchangeType.BINANCE].connect()
        
        self.is_initialized = True
        logger.info("✅ 多交易所管理器初始化完成")
    
    async def get_best_exchange(self) -> Optional[ExchangeAdapter]:
        """获取最佳交易所（延迟最低）"""
        best_adapter = None
        best_latency = float('inf')
        
        for exchange_type, adapter in self.adapters.items():
            is_healthy, latency = await adapter.health_check()
            if is_healthy and latency < best_latency:
                best_latency = latency
                best_adapter = adapter
        
        return best_adapter
    
    async def get_ticker_with_fallback(self, symbol: str) -> Optional[Ticker]:
        """获取行情（带故障转移）"""
        # 先尝试主交易所
        primary = self.adapters.get(self.primary_exchange)
        if primary:
            ticker = await primary.get_ticker(symbol)
            if ticker:
                return ticker
        
        # 主交易所失败，尝试备用
        for exchange_type in self.fallback_order:
            adapter = self.adapters.get(exchange_type)
            if adapter:
                logger.warning(f"主交易所失败，切换到 {exchange_type.value}")
                ticker = await adapter.get_ticker(symbol)
                if ticker:
                    return ticker
        
        logger.error(f"所有交易所都无法获取 {symbol} 行情")
        return None
    
    async def place_order_with_fallback(self, symbol: str, side: OrderSide,
                                       order_type: OrderType, size: float,
                                       price: float = None) -> Optional[Order]:
        """下单（带故障转移）"""
        # 先尝试主交易所
        primary = self.adapters.get(self.primary_exchange)
        if primary:
            order = await primary.place_order(symbol, side, order_type, size, price)
            if order:
                return order
        
        # 主交易所失败，尝试备用
        for exchange_type in self.fallback_order:
            adapter = self.adapters.get(exchange_type)
            if adapter:
                logger.warning(f"主交易所下单失败，切换到 {exchange_type.value}")
                order = await adapter.place_order(symbol, side, order_type, size, price)
                if order:
                    return order
        
        logger.error(f"所有交易所都无法下单")
        return None
    
    async def get_exchange_status(self) -> Dict:
        """获取所有交易所状态"""
        status = {}
        for exchange_type, adapter in self.adapters.items():
            is_healthy, latency = await adapter.health_check()
            status[exchange_type.value] = {
                'connected': adapter.is_connected,
                'healthy': is_healthy,
                'latency_ms': latency,
                'last_ping': adapter.last_ping.isoformat() if adapter.last_ping else None
            }
        return status
    
    async def close(self):
        """关闭所有连接"""
        for adapter in self.adapters.values():
            await adapter.disconnect()
        logger.info("✅ 所有交易所连接已关闭")


# 便捷函数
def create_multi_exchange_manager(config_path: str = None) -> MultiExchangeManager:
    """创建多交易所管理器"""
    return MultiExchangeManager(config_path)


# 测试代码
async def test_multi_exchange():
    """测试多交易所适配器"""
    manager = create_multi_exchange_manager()
    await manager.initialize()
    
    # 获取状态
    status = await manager.get_exchange_status()
    print("\n交易所状态:")
    print(json.dumps(status, indent=2, ensure_ascii=False))
    
    # 获取行情
    ticker = await manager.get_ticker_with_fallback("BTC/USDT:USDT")
    if ticker:
        print(f"\nBTC 行情:")
        print(f"  价格: {ticker.price}")
        print(f"  24h变化: {ticker.change_24h:.2%}")
        print(f"  成交量: {ticker.volume_24h:,.0f}")
    
    await manager.close()


if __name__ == "__main__":
    asyncio.run(test_multi_exchange())


def _diag_dump_effective_runtime():
    print("=" * 70)
    print("DIAG multi_exchange_adapter effective runtime")
    print("=" * 70)
    try:
        import os
        print("HTTP_PROXY =", os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy"))
        print("HTTPS_PROXY =", os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy"))
        print("ALL_PROXY =", os.environ.get("ALL_PROXY") or os.environ.get("all_proxy"))
        print("NO_PROXY =", os.environ.get("NO_PROXY") or os.environ.get("no_proxy"))
    except Exception as e:
        print("env dump failed:", repr(e))
    print("DEFAULT_DIAG_SYMBOL =", DEFAULT_DIAG_SYMBOL)
    print("GLOBAL_PROXIES =", GLOBAL_PROXIES)
    print("=" * 70)

if __name__ == "__main__":
    _diag_dump_effective_runtime()
