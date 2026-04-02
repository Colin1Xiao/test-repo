"""
Paper Broker — 模拟经纪商

模拟交易所行为，用于：
- Paper Trading（模拟交易）
- Shadow Mode（影子模式）
- 策略回测
- 系统演练

模拟行为：
- 订单接受/拒绝
- 部分/完全成交
- 滑点模拟
- 价格改善（限价单）
"""

import random
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, field
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.order import Order
from schemas.enums import Side as OrderSide, OrderType, OrderStatus


@dataclass
class PaperBrokerConfig:
    """模拟经纪商配置"""
    fill_probability: float = 0.9  # 成交概率
    reject_probability: float = 0.0  # 拒绝概率
    partial_fill_probability: float = 0.3  # 部分成交概率
    partial_fill_ratio_range: Tuple[float, float] = (0.3, 0.7)  # 部分成交比例范围
    default_slippage_pct: float = 0.0001  # 默认滑点 0.01%
    max_slippage_pct: float = 0.01  # 最大滑点 1%
    auto_fill: bool = True  # 自动成交
    fill_delay_range: Tuple[float, float] = (0.1, 1.0)  # 成交延迟范围（秒）


@dataclass
class PaperOrder:
    """模拟订单"""
    order: Order
    venue_order_id: str
    status: OrderStatus = OrderStatus.DRAFT  # PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    filled_quantity: float = 0.0
    average_fill_price: float = 0.0
    fills: List[Dict[str, Any]] = field(default_factory=list)


class PaperBroker:
    """模拟经纪商"""
    
    def __init__(self, config: Optional[PaperBrokerConfig] = None):
        self.config = config or PaperBrokerConfig()
        self._orders: Dict[str, PaperOrder] = {}
        self._market_prices: Dict[str, float] = {}
        self._event_callback: Optional[Callable] = None
        
        # 仓位跟踪
        self._positions: Dict[str, Dict[str, Any]] = {}
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def set_market_price(self, symbol: str, price: float) -> None:
        """设置市场价格"""
        self._market_prices[symbol] = price
    
    def get_market_price(self, symbol: str) -> Optional[float]:
        """获取市场价格"""
        return self._market_prices.get(symbol)
    
    def submit_order(self, order: Order) -> Dict[str, Any]:
        """提交订单"""
        # 检查是否应该拒绝
        if random.random() < self.config.reject_probability:
            reject_reason = random.choice([
                "insufficient_margin",
                "risk_limit_exceeded",
                "invalid_order",
                "market_closed",
            ])
            
            self._publish_event(EventType.ORDER_REJECTED, {
                "order_id": order.order_id,
                "reason": reject_reason,
            })
            
            return {
                "accepted": False,
                "order_id": order.order_id,
                "reject_reason": reject_reason,
            }
        
        # 生成交易所订单 ID
        venue_order_id = f"PAPER-{uuid.uuid4().hex[:8].upper()}"
        
        # 创建模拟订单
        paper_order = PaperOrder(
            order=order,
            venue_order_id=venue_order_id,
        )
        self._orders[order.order_id] = paper_order
        
        # 发布接受事件
        self._publish_event(EventType.ORDER_ACCEPTED, {
            "order_id": order.order_id,
            "venue_order_id": venue_order_id,
        })
        
        # 自动成交
        if self.config.auto_fill:
            delay = random.uniform(*self.config.fill_delay_range)
            time.sleep(delay)
            self._simulate_fill(paper_order)
        
        return {
            "accepted": True,
            "order_id": order.order_id,
            "venue_order_id": venue_order_id,
        }
    
    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """取消订单"""
        paper_order = self._orders.get(order_id)
        
        if not paper_order:
            return {
                "cancelled": False,
                "order_id": order_id,
                "error": "Order not found",
            }
        
        if paper_order.status in [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED]:
            return {
                "cancelled": False,
                "order_id": order_id,
                "error": f"Order already in terminal state: {paper_order.status.value}",
            }
        
        paper_order.status = OrderStatus.CANCELLED
        
        self._publish_event(EventType.ORDER_CANCELLED, {
            "order_id": order_id,
            "venue_order_id": paper_order.venue_order_id,
        })
        
        return {
            "cancelled": True,
            "order_id": order_id,
        }
    
    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """获取订单状态"""
        paper_order = self._orders.get(order_id)
        
        if not paper_order:
            return None
        
        return {
            "order_id": paper_order.order.order_id,
            "venue_order_id": paper_order.venue_order_id,
            "status": paper_order.status.value,
            "filled_quantity": paper_order.filled_quantity,
            "average_fill_price": paper_order.average_fill_price,
            "fills": paper_order.fills,
        }
    
    def get_open_orders(self) -> List[Dict[str, Any]]:
        """获取未平仓订单"""
        return [
            self.get_order(order_id)
            for order_id, order in self._orders.items()
            if order.status in [OrderStatus.DRAFT, OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED]
        ]
    
    def get_fills(self, order_id: str) -> List[Dict[str, Any]]:
        """获取成交记录"""
        paper_order = self._orders.get(order_id)
        return paper_order.fills if paper_order else []
    
    def get_position(self, symbol: str) -> Dict[str, Any]:
        """获取仓位"""
        return self._positions.get(symbol, {
            "symbol": symbol,
            "net_quantity": 0.0,
            "side": "flat",
            "average_price": 0.0,
        })
    
    def _simulate_fill(self, paper_order: PaperOrder) -> None:
        """模拟成交"""
        order = paper_order.order
        symbol = order.symbol
        
        # 获取市场价格
        market_price = self._market_prices.get(symbol, order.price)
        
        # 计算滑点
        slippage = random.uniform(0, self.config.max_slippage_pct)
        slippage_direction = 1 if order.side == OrderSide.BUY else -1
        fill_price = market_price * (1 + slippage * slippage_direction)
        
        # 限价单价格检查
        if order.type == OrderType.LIMIT:
            if order.side == OrderSide.BUY and fill_price > order.price:
                fill_price = order.price  # 价格改善
            elif order.side == OrderSide.SELL and fill_price < order.price:
                fill_price = order.price  # 价格改善
        
        # 决定是否部分成交
        is_partial = (
            random.random() < self.config.partial_fill_probability and
            paper_order.filled_quantity == 0
        )
        
        if is_partial:
            ratio = random.uniform(*self.config.partial_fill_ratio_range)
            fill_quantity = order.quantity * ratio
        else:
            fill_quantity = order.quantity - paper_order.filled_quantity
        
        # 更新订单状态
        paper_order.filled_quantity += fill_quantity
        paper_order.average_fill_price = (
            (paper_order.average_fill_price * (paper_order.filled_quantity - fill_quantity) + fill_price * fill_quantity)
            / paper_order.filled_quantity if paper_order.filled_quantity > 0 else fill_price
        )
        
        # 记录成交
        fill = {
            "fill_id": f"FILL-{uuid.uuid4().hex[:8].upper()}",
            "order_id": order.order_id,
            "venue_order_id": paper_order.venue_order_id,
            "quantity": fill_quantity,
            "price": fill_price,
            "fee": fill_quantity * fill_price * 0.0005,  # 0.05% 手续费
            "timestamp": datetime.utcnow().isoformat(),
        }
        paper_order.fills.append(fill)
        
        # 更新状态
        if paper_order.filled_quantity >= order.quantity:
            paper_order.status = OrderStatus.FILLED
        else:
            paper_order.status = OrderStatus.PARTIALLY_FILLED
        
        # 发布成交事件
        self._publish_event(EventType.ORDER_FILLED, {
            "order_id": order.order_id,
            "venue_order_id": paper_order.venue_order_id,
            "fill_quantity": fill_quantity,
            "fill_price": fill_price,
            "fee": fill["fee"],
            "is_partial": is_partial,
            "side": order.side.value,
            "symbol": symbol,
        })
        
        # 更新仓位
        self._update_position(symbol, order.side, fill_quantity, fill_price)
    
    def _update_position(self, symbol: str, side: OrderSide, quantity: float, price: float) -> None:
        """更新仓位"""
        if symbol not in self._positions:
            self._positions[symbol] = {
                "symbol": symbol,
                "net_quantity": 0.0,
                "side": "flat",
                "average_price": 0.0,
                "long_quantity": 0.0,
                "short_quantity": 0.0,
            }
        
        pos = self._positions[symbol]
        
        if side == OrderSide.BUY:
            pos["long_quantity"] += quantity
        else:
            pos["short_quantity"] += quantity
        
        pos["net_quantity"] = pos["long_quantity"] - pos["short_quantity"]
        
        if pos["net_quantity"] > 0:
            pos["side"] = "long"
        elif pos["net_quantity"] < 0:
            pos["side"] = "short"
        else:
            pos["side"] = "flat"
        
        pos["average_price"] = price  # 简化：使用最新成交价
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.PAPER_BROKER,
                payload=payload,
            )
            self._event_callback(envelope)


# 添加缺失的 EventSource
EventSource.PAPER_BROKER = "paper_broker"


# 使用示例
if __name__ == "__main__":
    broker = PaperBroker(PaperBrokerConfig(
        fill_probability=1.0,
        auto_fill=True,
    ))
    
    # 设置市场价格
    broker.set_market_price("ETH/USDT", 2000.0)
    
    # 创建订单
    order = Order(
        order_id="ORD-TEST-001",
        symbol="ETH/USDT",
        side=OrderSide.BUY,
        type=OrderType.LIMIT,
        quantity=0.1,
        price=2000.0,
    )
    
    # 提交订单
    result = broker.submit_order(order)
    print(f"提交结果：{result}")
    
    # 获取订单状态
    status = broker.get_order(order.order_id)
    print(f"订单状态：{status}")
    
    # 获取仓位
    position = broker.get_position("ETH/USDT")
    print(f"仓位：{position}")
