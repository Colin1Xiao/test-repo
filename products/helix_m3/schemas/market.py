"""
模块职责：
- 定义市场数据标准结构
- 统一 Tick、K线、盘口、资金费率、标记价格的数据模型
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Tuple, Optional


PriceLevel = Tuple[Decimal, Decimal]


@dataclass
class Tick:
    venue: str
    symbol: str
    ts: datetime
    last_price: Decimal
    bid: Optional[Decimal] = None
    ask: Optional[Decimal] = None
    mark_price: Optional[Decimal] = None
    index_price: Optional[Decimal] = None
    volume_24h: Optional[Decimal] = None


@dataclass
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


@dataclass
class OrderBook:
    venue: str
    symbol: str
    ts: datetime
    bids: List[PriceLevel] = field(default_factory=list)
    asks: List[PriceLevel] = field(default_factory=list)
    checksum: Optional[str] = None
    sequence: Optional[int] = None


@dataclass
class FundingRate:
    venue: str
    symbol: str
    ts: datetime
    funding_rate: Decimal
    next_funding_ts: datetime | None = None


@dataclass
class MarketQualitySnapshot:
    venue: str
    symbol: str
    ts: datetime
    latency_ms: Optional[int] = None
    spread_bps: Optional[Decimal] = None
    book_health_score: Optional[Decimal] = None
    feed_staleness_score: Optional[Decimal] = None
    overall_score: Optional[Decimal] = None
    blocked: bool = False
