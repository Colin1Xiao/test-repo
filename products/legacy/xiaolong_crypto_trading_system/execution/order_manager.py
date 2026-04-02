"""
模块职责：
- 管理订单生命周期
- 第一轮仅提供内存态订单登记与状态更新
"""

from __future__ import annotations

from typing import Dict

from schemas.enums import OrderStatus
from schemas.order import Order


class OrderManager:
    def __init__(self) -> None:
        self._orders: Dict[str, Order] = {}

    def register(self, order: Order) -> None:
        self._orders[order.order_id] = order

    def get(self, order_id: str) -> Order | None:
        return self._orders.get(order_id)

    def update_status(self, order_id: str, status: OrderStatus) -> None:
        if order_id not in self._orders:
            raise KeyError(f"未知订单: {order_id}")
        self._orders[order_id].status = status

    def list_active(self) -> list[Order]:
        return [
            order
            for order in self._orders.values()
            if order.status not in {
                OrderStatus.FILLED,
                OrderStatus.CANCELED,
                OrderStatus.REJECTED,
                OrderStatus.EXPIRED,
            }
        ]
