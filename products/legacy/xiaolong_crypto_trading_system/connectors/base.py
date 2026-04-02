"""
模块职责：
- 定义交易所连接器抽象接口
- 统一市场数据、账户、订单、仓位相关的最低能力边界
"""

from __future__ import annotations

from decimal import Decimal
from typing import Protocol

from schemas.market import Tick
from schemas.order import Order, OrderRequest
from schemas.position import Position


class ExchangeConnector(Protocol):
    venue: str

    def connect(self) -> None:
        """
        建立连接。
        """
        ...

    def disconnect(self) -> None:
        """
        断开连接。
        """
        ...

    def get_latest_tick(self, symbol: str) -> Tick:
        """
        获取最新标准化行情。
        """
        ...

    def place_order(self, request: OrderRequest) -> Order:
        """
        提交订单请求。
        """
        ...

    def cancel_order(self, symbol: str, order_id: str) -> None:
        """
        撤销订单。
        """
        ...

    def fetch_position(self, symbol: str) -> Position | None:
        """
        查询当前仓位。
        """
        ...

    def fetch_balance(self, asset: str) -> Decimal:
        """
        查询账户资产。
        """
        ...
