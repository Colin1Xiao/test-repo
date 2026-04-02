"""
模块职责：
- 定义仓位、分笔 lot、盈亏视图、敞口等结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from schemas.enums import PositionSide, PositionStatus


@dataclass
class Lot:
    lot_id: str
    fill_id: str
    qty: Decimal
    price: Decimal
    ts: datetime


@dataclass
class Position:
    position_id: str
    venue: str
    symbol: str
    side: PositionSide
    status: PositionStatus
    qty: Decimal = Decimal("0")
    avg_entry_price: Optional[Decimal] = None
    mark_price: Optional[Decimal] = None
    unrealized_pnl: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    opened_at: datetime | None = None
    updated_at: datetime | None = None
    lots: list[Lot] = field(default_factory=list)


@dataclass
class Exposure:
    venue: str
    symbol: str
    gross_notional: Decimal = Decimal("0")
    net_notional: Decimal = Decimal("0")
    leverage: Optional[Decimal] = None


@dataclass
class PnLView:
    symbol: str
    realized_pnl: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    total_fees: Decimal = Decimal("0")
