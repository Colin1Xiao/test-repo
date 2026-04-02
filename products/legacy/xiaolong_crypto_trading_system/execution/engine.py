"""
模块职责：
- 执行层主入口
- 接收风控通过后的 Intent，生成订单请求并下发给连接器
"""

from __future__ import annotations

from schemas.order import Order, OrderRequest
from schemas.signal import Intent
from schemas.enums import OrderType, TimeInForce
from connectors.base import ExchangeConnector


class ExecutionEngine:
    def __init__(self, connector: ExchangeConnector) -> None:
        self.connector = connector

    def build_order_request(self, intent: Intent) -> OrderRequest:
        """
        将 Intent 转成最小订单请求。
        """
        if intent.requested_qty is None:
            raise ValueError("Intent.requested_qty 不能为空")

        return OrderRequest(
            order_request_id=intent.intent_id,
            venue=intent.venue,
            symbol=intent.symbol,
            side=intent.side,
            order_type=OrderType.MARKET,
            qty=intent.requested_qty,
            time_in_force=TimeInForce.GTC,
            client_order_id=intent.intent_id,
        )

    def execute(self, intent: Intent) -> Order:
        """
        执行意图，当前为最小直连实现。
        """
        request = self.build_order_request(intent)
        return self.connector.place_order(request)
