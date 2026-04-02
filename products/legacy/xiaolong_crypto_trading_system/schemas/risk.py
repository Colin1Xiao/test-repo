"""
模块职责：
- 定义风险决策、风险告警、风险包络等结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from schemas.enums import RiskDecisionType


@dataclass(slots=True)
class RiskEnvelope:
    max_notional: Decimal | None = None
    max_qty: Decimal | None = None
    max_slippage_bps: Decimal | None = None
    max_retries: int = 0
    require_protection_order: bool = True
    allowed_order_types: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RiskDecision:
    decision_id: str
    ts: datetime
    decision: RiskDecisionType
    reason: str | None = None
    envelope: RiskEnvelope | None = None
    tags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RiskBreach:
    breach_id: str
    ts: datetime
    scope: str
    code: str
    message: str
    severity: str
