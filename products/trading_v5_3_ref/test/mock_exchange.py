#!/usr/bin/env python3
"""
Mock Exchange - 用于 Safety Test 的模拟交易所

设计目标：
1. 不连接任何真实交易所
2. 只实现 Safety Test 需要的最小接口
3. 完全可控的测试环境

验证的功能：
- Execution Lock
- Position Gate 双层检查
- Stop Loss 创建与验证逻辑
- 执行路径唯一
- TIME_EXIT
"""

import time
import asyncio
import itertools
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import threading


@dataclass
class MockOrder:
    """模拟订单"""
    id: str
    symbol: str
    type: str
    side: str
    amount: float
    price: float
    status: str = 'open'
    created_at: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'symbol': self.symbol,
            'type': self.type,
            'side': self.side,
            'amount': self.amount,
            'price': self.price,
            'status': self.status,
            'created_at': self.created_at,
        }


@dataclass
class MockPosition:
    """模拟持仓"""
    symbol: str
    size: float  # ETH
    side: str
    entry_price: float
    created_at: float = 0.0


class MockExchange:
    """
    模拟交易所
    
    完全内存操作，不连接任何外部服务
    """
    
    def __init__(self, initial_balance: float = 100.0):
        self._id_gen = itertools.count(1000001)
        
        # 账户状态
        self.balance = initial_balance  # USDT
        self.positions: Dict[str, MockPosition] = {}
        self.orders: Dict[str, MockOrder] = {}
        self.algo_orders: Dict[str, MockOrder] = {}  # 止损单等
        
        # 市场状态
        self.last_prices: Dict[str, float] = {
            'ETH/USDT:USDT': 2150.0,
            'ETH-USDT-SWAP': 2150.0,
        }
        self.orderbooks: Dict[str, Dict] = {}
        
        # 锁
        self._lock = threading.Lock()
        
        # 统计
        self.stats = {
            'orders_created': 0,
            'orders_filled': 0,
            'stop_orders_created': 0,
            'stop_orders_verified': 0,
        }
        
        # 初始化订单簿
        self._init_orderbook()
        
        print("🎭 Mock Exchange 初始化完成")
        print(f"   初始余额: ${initial_balance:.2f}")
        print(f"   ETH 价格: ${self.last_prices['ETH/USDT:USDT']:.2f}")
    
    def _init_orderbook(self):
        """初始化模拟订单簿"""
        price = self.last_prices['ETH/USDT:USDT']
        self.orderbooks['ETH/USDT:USDT'] = {
            'bids': [[price - 1.0, 10.0], [price - 2.0, 20.0]],
            'asks': [[price + 1.0, 10.0], [price + 2.0, 20.0]],
        }
    
    def _next_id(self) -> str:
        return str(next(self._id_gen))
    
    # ========== 公共 API ==========
    
    async def load_markets(self) -> Dict:
        """加载市场信息"""
        return {
            'ETH/USDT:USDT': {
                'id': 'ETH-USDT-SWAP',
                'symbol': 'ETH/USDT:USDT',
                'type': 'swap',
                'contract': True,
                'contractSize': 10.0,  # 10 ETH per contract
                'active': True,
            }
        }
    
    async def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """获取行情"""
        return {
            'symbol': symbol,
            'last': self.last_prices.get(symbol, 2150.0),
            'bid': self.last_prices.get(symbol, 2150.0) - 1.0,
            'ask': self.last_prices.get(symbol, 2150.0) + 1.0,
        }
    
    async def fetch_order_book(self, symbol: str, limit: int = 10) -> Dict:
        """获取订单簿"""
        return self.orderbooks.get(symbol, {
            'bids': [[2150.0, 10.0]],
            'asks': [[2151.0, 10.0]],
        })
    
    async def fetch_positions(self, symbols: List[str] = None) -> List[Dict]:
        """
        获取持仓
        
        返回格式与 CCXT 一致
        """
        with self._lock:
            results = []
            for symbol, pos in self.positions.items():
                if symbols and symbol not in symbols:
                    continue
                results.append({
                    'symbol': symbol,
                    'contracts': pos.size,
                    'contractSize': 10.0,
                    'side': pos.side,
                    'avgPx': str(pos.entry_price),
                    'entryPrice': pos.entry_price,
                    'notional': pos.size * pos.entry_price,
                    'leverage': 100.0,
                    'unrealizedPnl': 0.0,
                })
            return results
    
    async def fetch_balance(self) -> Dict:
        """获取余额"""
        with self._lock:
            return {
                'USDT': {
                    'free': self.balance,
                    'used': 0.0,
                    'total': self.balance,
                }
            }
    
    async def fetch_open_orders(self, symbol: str = None) -> List[Dict]:
        """获取未完成订单"""
        with self._lock:
            orders = []
            for order in self.orders.values():
                if order.status == 'open':
                    if symbol is None or order.symbol == symbol:
                        orders.append(order.to_dict())
            for order in self.algo_orders.values():
                if order.status == 'open':
                    if symbol is None or order.symbol == symbol:
                        orders.append(order.to_dict())
            return orders
    
    # ========== 交易 API ==========
    
    async def create_market_order(
        self, 
        symbol: str, 
        type: str, 
        side: str, 
        amount: float,
        price: float = None,
        params: Dict = None
    ) -> Dict:
        """
        创建市价单
        
        模拟真实成交逻辑：
        1. 如果无仓位 → 开仓
        2. 如果有反向仓位 → 平仓
        """
        with self._lock:
            order_id = self._next_id()
            current_price = self.last_prices.get(symbol, 2150.0)
            
            # 滑点模拟
            if side == 'buy':
                fill_price = current_price + 0.5  # 买入滑点
            else:
                fill_price = current_price - 0.5  # 卖出滑点
            
            # 检查现有仓位
            existing_pos = self.positions.get(symbol)
            
            if existing_pos:
                # 有仓位，检查是否平仓
                if (existing_pos.side == 'long' and side == 'sell') or \
                   (existing_pos.side == 'short' and side == 'buy'):
                    # 平仓
                    pnl = (fill_price - existing_pos.entry_price) * existing_pos.size
                    if existing_pos.side == 'short':
                        pnl = -pnl
                    
                    del self.positions[symbol]
                    self.balance += pnl
                    
                    print(f"📊 Mock: 平仓 {symbol}")
                    print(f"   入场价: {existing_pos.entry_price:.2f}")
                    print(f"   平仓价: {fill_price:.2f}")
                    print(f"   盈亏: ${pnl:.2f}")
                else:
                    # 叠仓（这是我们要检测的错误）
                    print(f"⚠️ Mock: 检测到叠仓！现有 {existing_pos.size:.4f} ETH")
                    existing_pos.size += amount
                    existing_pos.entry_price = (
                        existing_pos.entry_price * existing_pos.size + fill_price * amount
                    ) / (existing_pos.size + amount)
            else:
                # 新开仓
                self.positions[symbol] = MockPosition(
                    symbol=symbol,
                    size=amount,
                    side='long' if side == 'buy' else 'short',
                    entry_price=fill_price,
                    created_at=time.time(),
                )
                print(f"📊 Mock: 开仓 {symbol}")
                print(f"   方向: {side}")
                print(f"   数量: {amount:.4f} ETH")
                print(f"   价格: {fill_price:.2f}")
            
            # 记录订单
            order = MockOrder(
                id=order_id,
                symbol=symbol,
                type='market',
                side=side,
                amount=amount,
                price=fill_price,
                status='closed',
                created_at=time.time(),
            )
            self.orders[order_id] = order
            self.stats['orders_created'] += 1
            self.stats['orders_filled'] += 1
            
            return order.to_dict()
    
    async def create_order(
        self,
        symbol: str,
        type: str,
        side: str,
        amount: float,
        price: float = None,
        params: Dict = None
    ) -> Dict:
        """创建订单（统一接口）"""
        params = params or {}
        
        # 检查是否是止损单
        if type == 'stop' or params.get('ordType') == 'trigger':
            return await self._create_stop_order(symbol, side, amount, price, params)
        
        return await self.create_market_order(symbol, type, side, amount, price, params)
    
    async def _create_stop_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        stop_price: float,
        params: Dict
    ) -> Dict:
        """
        创建止损单
        
        模拟 OKX 止损单行为
        """
        with self._lock:
            order_id = self._next_id()
            
            order = MockOrder(
                id=order_id,
                symbol=symbol,
                type='stop',
                side=side,
                amount=amount,
                price=stop_price,
                status='open',  # 止损单保持 open 状态
                created_at=time.time(),
            )
            
            self.algo_orders[order_id] = order
            self.stats['stop_orders_created'] += 1
            
            print(f"🔴 Mock: 止损单已创建")
            print(f"   ID: {order_id}")
            print(f"   触发价: {stop_price:.2f}")
            print(f"   数量: {amount:.4f} ETH")
            
            return order.to_dict()
    
    async def cancel_order(self, order_id: str, symbol: str = None) -> Dict:
        """取消订单"""
        with self._lock:
            if order_id in self.orders:
                self.orders[order_id].status = 'cancelled'
                return {'id': order_id, 'status': 'cancelled'}
            if order_id in self.algo_orders:
                self.algo_orders[order_id].status = 'cancelled'
                return {'id': order_id, 'status': 'cancelled'}
            return {'id': order_id, 'status': 'not_found'}
    
    # ========== OKX 原生 API 模拟 ==========
    
    async def private_post_trade_order_algo(self, params: Dict) -> Dict:
        """OKX 原生止损单接口"""
        symbol = params.get('instId', 'ETH-USDT-SWAP')
        side = params.get('side', 'sell')
        amount = float(params.get('sz', 1)) * 10  # 张数转 ETH
        stop_price = float(params.get('triggerPx', 2140.0))
        
        order = await self._create_stop_order(
            symbol.replace('-USDT-SWAP', '/USDT:USDT'),
            side,
            amount,
            stop_price,
            params
        )
        
        return {
            'code': '0',
            'msg': '',
            'data': [{'algoId': order['id']}]
        }
    
    # ========== 测试辅助方法 ==========
    
    def set_position(self, symbol: str, size: float, side: str = 'long', entry_price: float = None):
        """手动设置仓位（用于测试）"""
        with self._lock:
            self.positions[symbol] = MockPosition(
                symbol=symbol,
                size=size,
                side=side,
                entry_price=entry_price or self.last_prices.get(symbol, 2150.0),
                created_at=time.time(),
            )
            print(f"🔧 Mock: 手动设置仓位 {symbol} = {size:.4f} ETH ({side})")
    
    def clear_position(self, symbol: str):
        """清除仓位"""
        with self._lock:
            if symbol in self.positions:
                del self.positions[symbol]
                print(f"🔧 Mock: 仓位已清除 {symbol}")
    
    def has_position(self, symbol: str) -> bool:
        """检查是否有仓位"""
        return symbol in self.positions and self.positions[symbol].size > 0
    
    def has_stop_order(self, symbol: str) -> bool:
        """检查是否有止损单"""
        for order in self.algo_orders.values():
            if order.symbol == symbol and order.status == 'open':
                return True
        return False
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return self.stats.copy()
    
    def reset(self):
        """重置所有状态"""
        with self._lock:
            self.positions.clear()
            self.orders.clear()
            self.algo_orders.clear()
            self.stats = {
                'orders_created': 0,
                'orders_filled': 0,
                'stop_orders_created': 0,
                'stop_orders_verified': 0,
            }
            print("🔧 Mock: 状态已重置")