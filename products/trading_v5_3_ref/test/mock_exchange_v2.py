#!/usr/bin/env python3
"""
Mock Exchange V2 - 更贴近 OKX 真实 API

支持：
- private_post_trade_order_algo (条件单)
- private_get_trade_orders_algo_pending (查询挂单)
- 完整的仓位/订单管理
"""

import time
import asyncio
import itertools
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class MockPosition:
    symbol: str
    side: str
    size: float
    entry_price: float
    entry_time: float = field(default_factory=time.time)


@dataclass
class MockOrder:
    id: str
    symbol: str
    side: str
    amount: float
    price: float
    average: float
    status: str = "closed"
    timestamp: int = field(default_factory=lambda: int(time.time() * 1000))


class MockExchange:
    """
    Mock Exchange - 模拟 OKX 交易所
    """
    
    def __init__(self):
        self._id_gen = itertools.count(1000001)
        
        # 状态
        self.positions: Dict[str, Dict] = {}
        self.orders: Dict[str, Dict] = {}
        self.algo_orders: Dict[str, Dict] = {}  # 条件单
        
        # 市场价格
        self.last_prices: Dict[str, float] = {
            "ETH-USDT-SWAP": 2150.0,
            "ETH/USDT:USDT": 2150.0,
        }
        
        print("🎭 MockExchange V2 初始化")
    
    def _next_id(self) -> str:
        return str(next(self._id_gen))
    
    # ========== 市场数据 ==========
    
    async def fetch_ticker(self, symbol: str) -> Dict:
        price = self.last_prices.get(symbol, 2150.0)
        return {
            "symbol": symbol,
            "last": price,
            "bid": price - 1.0,
            "ask": price + 1.0,
        }
    
    async def fetch_order_book(self, symbol: str, limit: int = 10) -> Dict:
        price = self.last_prices.get(symbol, 2150.0)
        return {
            "bids": [[price - 1.0, 100.0]],
            "asks": [[price + 1.0, 100.0]],
        }
    
    # ========== 账户 ==========
    
    async def fetch_positions(self, symbols: List[str] = None) -> List[Dict]:
        results = []
        for symbol, pos in self.positions.items():
            if symbols and symbol not in symbols:
                continue
            results.append({
                "symbol": symbol,
                "contracts": pos["size"],
                "side": pos["side"],
                "avgPx": str(pos["entry_price"]),
                "entryPrice": pos["entry_price"],
            })
        return results
    
    async def fetch_balance(self) -> Dict:
        return {"USDT": {"free": 100.0, "used": 0.0, "total": 100.0}}
    
    # ========== 订单 ==========
    
    async def create_order(
        self,
        symbol: str,
        type: str,
        side: str,
        amount: float,
        price: float = None,
        params: Dict = None,
    ) -> Dict:
        """
        创建订单
        """
        params = params or {}
        order_id = self._next_id()
        
        # 获取成交价
        market_price = self.last_prices.get(symbol, 2150.0)
        if type == "market":
            if side == "buy":
                fill_price = market_price + 0.5
            else:
                fill_price = market_price - 0.5
        else:
            fill_price = price or market_price
        
        # 检查是否平仓
        existing = self.positions.get(symbol)
        if existing:
            if (existing["side"] == "long" and side == "sell") or \
               (existing["side"] == "short" and side == "buy"):
                # 平仓
                pnl = (fill_price - existing["entry_price"]) * existing["size"]
                if existing["side"] == "short":
                    pnl = -pnl
                del self.positions[symbol]
                print(f"📊 Mock: 平仓 {symbol}, PnL=${pnl:.2f}")
            else:
                # 叠仓（错误行为）
                print(f"⚠️ Mock: 检测到叠仓！现有 {existing['size']:.4f}")
                existing["size"] += amount
        else:
            # 开仓
            if not params.get("reduceOnly"):
                self.positions[symbol] = {
                    "side": "long" if side == "buy" else "short",
                    "size": amount,
                    "entry_price": fill_price,
                    "entry_time": time.time(),
                }
                print(f"📊 Mock: 开仓 {symbol} {side} {amount:.4f} @ {fill_price:.2f}")
        
        order = {
            "id": order_id,
            "symbol": symbol,
            "side": side,
            "amount": amount,
            "price": fill_price,
            "average": fill_price,
            "status": "closed",
            "timestamp": int(time.time() * 1000),
        }
        self.orders[order_id] = order
        return order
    
    async def create_market_order(
        self, symbol: str, side: str, amount: float, params: Dict = None
    ) -> Dict:
        return await self.create_order(symbol, "market", side, amount, params=params)
    
    async def fetch_open_orders(self, symbol: str = None) -> List[Dict]:
        results = []
        for order in self.orders.values():
            if order["status"] == "open":
                if symbol is None or order["symbol"] == symbol:
                    results.append(order)
        # 包含条件单
        for algo in self.algo_orders.values():
            if algo["state"] == "live":
                results.append({
                    "id": algo["algoId"],
                    "symbol": algo["instId"],
                    "status": "open",
                    "type": "stop",
                })
        return results
    
    async def cancel_order(self, order_id: str, symbol: str = None) -> Dict:
        if order_id in self.orders:
            self.orders[order_id]["status"] = "cancelled"
        if order_id in self.algo_orders:
            self.algo_orders[order_id]["state"] = "cancelled"
        return {"id": order_id, "status": "cancelled"}
    
    async def private_post_trade_cancel_algos(self, params: Dict) -> Dict:
        """
        OKX 取消条件单接口
        """
        algo_ids = params.get("algoIds", [])
        results = []
        
        for algo_id in algo_ids:
            if algo_id in self.algo_orders:
                self.algo_orders[algo_id]["state"] = "cancelled"
                results.append({"algoId": algo_id, "sCode": "0"})
                print(f"   🧹 Mock: 条件单已取消 {algo_id}")
            else:
                results.append({"algoId": algo_id, "sCode": "1", "sMsg": "not found"})
        
        return {"code": "0", "data": results}
    
    # ========== OKX 原生 API ==========
    
    async def private_post_trade_order_algo(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        OKX 条件单接口
        """
        algo_id = self._next_id()
        record = {
            "algoId": algo_id,
            "instId": params["instId"],
            "state": "live",
            "slTriggerPx": params.get("slTriggerPx") or params.get("triggerPx"),
            "slOrdPx": params.get("slOrdPx") or params.get("orderPx"),
            "sz": params.get("sz"),
            "side": params.get("side"),
            "ordType": params.get("ordType", "trigger"),
            "tdMode": params.get("tdMode", "cross"),
            "cTime": str(int(time.time() * 1000)),
        }
        self.algo_orders[algo_id] = record
        print(f"🔴 Mock: 条件单创建 algoId={algo_id}")
        return {"code": "0", "data": [record]}
    
    async def private_get_trade_orders_algo_pending(
        self, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        查询挂起的条件单
        """
        inst_id = params.get("instId")
        data = [
            v for v in self.algo_orders.values()
            if v["instId"] == inst_id and v["state"] == "live"
        ]
        return {"code": "0", "data": data}
    
    # ========== 测试辅助 ==========
    
    def set_price(self, symbol: str, price: float) -> None:
        """设置价格"""
        self.last_prices[symbol] = price
        # 同时更新两种格式
        if "-" in symbol:
            self.last_prices[symbol.replace("-USDT-SWAP", "/USDT:USDT")] = price
        else:
            self.last_prices[symbol.replace("/USDT:USDT", "-USDT-SWAP")] = price
    
    def reset(self) -> None:
        """重置状态"""
        self.positions.clear()
        self.orders.clear()
        self.algo_orders.clear()
        print("🔧 Mock: 状态已重置")
    
    def has_position(self, symbol: str) -> bool:
        return symbol in self.positions
    
    def has_algo_order(self, symbol: str) -> bool:
        for algo in self.algo_orders.values():
            if algo["instId"] == symbol and algo["state"] == "live":
                return True
        return False