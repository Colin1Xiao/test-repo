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


@dataclass(slots=True)
class Signal:
    signal_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    signal_type: SignalType
    side: Side | None = None
    confidence: Decimal | None = None
    reason: str | None = None
    features: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class DecisionSnapshot:
    snapshot_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    features: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Intent:
    intent_id: str
    signal_id: str
    strategy_id: str
    strategy_revision: str
    venue: str
    symbol: str
    ts: datetime
    side: Side
    requested_notional: Decimal | None = None
    requested_qty: Decimal | None = None
    max_slippage_bps: Decimal | None = None
    max_holding_seconds: int | None = None
    entry_style: str | None = None
    tags: list[str] = field(default_factory=list)
