from datetime import datetime, timezone
from decimal import Decimal

from portfolio.positions import PositionService
from schemas.enums import Side
from schemas.order import Fill


def test_position_service_apply_fill_creates_position():
    service = PositionService()
    fill = Fill(
        fill_id="f-1",
        venue="OKX",
        symbol="ETH-USDT-SWAP",
        order_id="o-1",
        side=Side.BUY,
        price=Decimal("2000"),
        qty=Decimal("0.01"),
        ts=datetime.now(timezone.utc),
    )
    position = service.apply_fill(fill)
    assert position.symbol == "ETH-USDT-SWAP"
    assert position.qty == Decimal("0.01")
