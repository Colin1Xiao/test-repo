"""
模块职责：
- 将 OKX 原始返回映射为内部 schemas
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

from schemas.market import Tick
from schemas.order import Order
from schemas.enums import OrderStatus, OrderType, Side


def parse_ts_ms(ts_ms: str | int | None) -> datetime:
    if ts_ms is None:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc)


class OkxMapper:
    """
    OKX 数据映射器。
    """

    @staticmethod
    def to_tick(raw: Dict[str, Any], symbol: str) -> Tick:
        return Tick(
            venue="OKX",
            symbol=symbol,
            ts=parse_ts_ms(raw.get("ts")),
            last_price=Decimal(str(raw.get("last", "0"))),
            bid=Decimal(str(raw["bidPx"])) if raw.get("bidPx") else None,
            ask=Decimal(str(raw["askPx"])) if raw.get("askPx") else None,
        )

    @staticmethod
    def to_order(raw: Dict[str, Any]) -> Order:
        return Order(
            order_id=str(raw.get("clOrdId") or raw.get("ordId") or ""),
            venue="OKX",
            symbol=str(raw.get("instId", "")),
            side=Side.BUY if str(raw.get("side", "")).lower() == "buy" else Side.SELL,
            order_type=OrderType.LIMIT,
            status=OrderStatus.ACKED,
            qty=Decimal(str(raw.get("sz", "0"))),
            price=Decimal(str(raw.get("px", "0"))) if raw.get("px") else None,
            client_order_id=raw.get("clOrdId"),
            exchange_order_id=raw.get("ordId"),
            created_at=parse_ts_ms(raw.get("cTime")),
            updated_at=parse_ts_ms(raw.get("uTime")),
        )
