from decimal import Decimal

from execution.engine import ExecutionEngine
from schemas.enums import Side
from schemas.order import Order
from schemas.signal import Intent
from schemas.enums import OrderStatus, OrderType


class DummyConnector:
    venue = "DUMMY"

    def place_order(self, request):
        return Order(
            order_id="o-1",
            venue=request.venue,
            symbol=request.symbol,
            side=request.side,
            order_type=OrderType.MARKET,
            status=OrderStatus.ACKED,
            qty=request.qty,
            client_order_id=request.client_order_id,
        )


def test_execution_engine_builds_and_places_order():
    engine = ExecutionEngine(connector=DummyConnector())
    intent = Intent(
        intent_id="i-1",
        signal_id="s-1",
        strategy_id="stg-1",
        strategy_revision="r1",
        venue="OKX",
        symbol="ETH-USDT-SWAP",
        ts=None,
        side=Side.BUY,
        requested_qty=Decimal("0.01"),
    )
    order = engine.execute(intent)
    assert order.order_id == "o-1"
    assert order.qty == Decimal("0.01")
