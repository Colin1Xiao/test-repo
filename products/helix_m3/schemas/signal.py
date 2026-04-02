"""
模块职责：
- 定义策略信号、交易意图、决策快照等结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict

from schemas.enums import Side, SignalType


@dataclass
class Signal:
    signal_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    signal_type: SignalType
    side: Side | None = None
    confidence: Optional[Decimal] = None
    reason: Optional[str] = None
    features: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DecisionSnapshot:
    snapshot_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    features: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Intent:
    intent_id: str
    signal_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    side: Side
    requested_notional: Optional[Decimal] = None
    requested_qty: Optional[Decimal] = None
    max_slippage_bps: Optional[Decimal] = None
    max_holding_seconds: Optional[int] = None
    entry_style: Optional[str] = None
    tags: list[str] = field(default_factory=list)
