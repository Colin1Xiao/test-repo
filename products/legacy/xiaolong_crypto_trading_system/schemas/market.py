"""
模块职责：
- 定义市场数据标准结构
- 统一 Tick、K线、盘口、资金费率、标记价格的数据模型
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Tuple


PriceLevel = Tuple[Decimal, Decimal]


@dataclass(slots=True)
class Tick:
    venue: str
    symbol: str
    ts: datetime
    last_price: Decimal
    bid: Decimal | None = None
    ask: Decimal | None = None
    mark_price: Decimal | None = None
    index_price: Decimal | None = None
    volume_24h: Decimal | None = None


@dataclass(slots=True)
class Candle:
    venue: str
    symbol: str
    timeframe: str
    open_ts: datetime
    close_ts: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


@dataclass(slots=True)
class OrderBook:
    venue: str
    symbol: str
    ts: datetime
    bids: List[PriceLevel] = field(default_factory=list)
    asks: List[PriceLevel] = field(default_factory=list)
    checksum: str | None = None
    sequence: int | None = None


@dataclass(slots=True)
class FundingRate:
    venue: str
    symbol: str
    ts: datetime
    funding_rate: Decimal
    next_funding_ts: datetime | None = None


@dataclass(slots=True)
class MarketQualitySnapshot:
    venue: str
    symbol: str
    ts: datetime
    latency_ms: int | None = None
    spread_bps: Decimal | None = None
    book_health_score: Decimal | None = None
    feed_staleness_score: Decimal | None = None
    overall_score: Decimal | None = None
    blocked: bool = False
