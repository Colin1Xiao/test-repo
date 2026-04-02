"""
模块职责：
- 定义订单、成交、保护单等标准结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from schemas.enums import OrderStatus, OrderType, Side, TimeInForce


@dataclass(slots=True)
class OrderRequest:
    order_request_id: str
    venue: str
    symbol: str
    side: Side
    order_type: OrderType
    qty: Decimal | None = None
    price: Decimal | None = None
    reduce_only: bool = False
    time_in_force: TimeInForce = TimeInForce.GTC
    client_order_id: str | None = None


@dataclass(slots=True)
class Order:
    order_id: str
    venue: str
    symbol: str
    side: Side
    order_type: OrderType
    status: OrderStatus
    qty: Decimal | None = None
    price: Decimal | None = None
    filled_qty: Decimal = Decimal("0")
    avg_fill_price: Decimal | None = None
    reduce_only: bool = False
    client_order_id: str | None = None
    exchange_order_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class Fill:
    fill_id: str
    venue: str
    symbol: str
    order_id: str
    side: Side
    price: Decimal
    qty: Decimal
    fee: Decimal = Decimal("0")
    fee_asset: str | None = None
    ts: datetime | None = None


@dataclass(slots=True)
class ProtectionOrder:
    protection_id: str
    parent_order_id: str
    venue: str
    symbol: str
    order_type: OrderType
    trigger_price: Decimal | None = None
    price: Decimal | None = None
    qty: Decimal | None = None
    reduce_only: bool = True
    active: bool = False
