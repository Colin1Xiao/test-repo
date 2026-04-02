"""
模块职责：
- 定义订单、成交、保护单等标准结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from schemas.enums import OrderStatus, OrderType, Side, TimeInForce


@dataclass
class OrderRequest:
    order_request_id: str
    venue: str
    symbol: str
    side: Side
    order_type: OrderType
    qty: Optional[Decimal] = None
    price: Optional[Decimal] = None
    reduce_only: bool = False
    time_in_force: TimeInForce = TimeInForce.GTC
    client_order_id: Optional[str] = None


@dataclass
class Order:
    order_id: str
    venue: str
    symbol: str
    side: Side
    order_type: OrderType
    status: OrderStatus
    qty: Optional[Decimal] = None
    price: Optional[Decimal] = None
    filled_qty: Decimal = Decimal("0")
    avg_fill_price: Optional[Decimal] = None
    reduce_only: bool = False
    client_order_id: Optional[str] = None
    exchange_order_id: Optional[str] = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tags: list[str] = field(default_factory=list)


@dataclass
class Fill:
    fill_id: str
    venue: str
    symbol: str
    order_id: str
    side: Side
    price: Decimal
    qty: Decimal
    fee: Decimal = Decimal("0")
    fee_asset: Optional[str] = None
    ts: datetime | None = None


@dataclass
class ProtectionOrder:
    protection_id: str
    parent_order_id: str
    venue: str
    symbol: str
    order_type: OrderType
    trigger_price: Optional[Decimal] = None
    price: Optional[Decimal] = None
    qty: Optional[Decimal] = None
    reduce_only: bool = True
    active: bool = False
