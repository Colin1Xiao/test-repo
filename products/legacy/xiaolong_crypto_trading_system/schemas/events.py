"""
模块职责：
- 定义事件总线中使用的标准事件结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict

from schemas.enums import EventType


@dataclass(slots=True)
class Event:
    event_id: str
    event_type: EventType
    event_name: str
    ts: datetime
    payload: Dict[str, Any] = field(default_factory=dict)
    source: str | None = None
    correlation_id: str | None = None


@dataclass(slots=True)
class MarketEvent(Event):
    pass


@dataclass(slots=True)
class SignalEvent(Event):
    pass


@dataclass(slots=True)
class RiskEvent(Event):
    pass


@dataclass(slots=True)
class ExecutionEvent(Event):
    pass


@dataclass(slots=True)
class PositionEvent(Event):
    pass
