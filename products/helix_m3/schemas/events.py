"""
模块职责：
- 定义事件总线中使用的标准事件结构
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional
from enum import Enum
import uuid

from schemas.enums import EventType


class EventSource(Enum):
    """事件来源"""
    MARKET_DATA_ENGINE = "market_data_engine"
    STRATEGY_ENGINE = "strategy_engine"
    RISK_ENGINE = "risk_engine"
    EXECUTION_ENGINE = "execution_engine"
    CONNECTOR = "connector"
    ADMIN_CONTROL = "admin_control"
    SYSTEM = "system"


@dataclass
class EventEnvelope:
    """事件信封 - 统一事件结构"""
    event_type: EventType
    source: EventSource
    payload: Dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "source": self.source.value,
            "timestamp": self.timestamp.isoformat(),
            "payload": self.payload,
            "correlation_id": self.correlation_id,
            "causation_id": self.causation_id,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> EventEnvelope:
        """从字典反序列化"""
        return cls(
            event_type=EventType(data["event_type"]),
            source=EventSource(data["source"]),
            payload=data.get("payload", {}),
            event_id=data.get("event_id", str(uuid.uuid4())),
            timestamp=datetime.fromisoformat(data["timestamp"]) if "timestamp" in data else datetime.utcnow(),
            correlation_id=data.get("correlation_id"),
            causation_id=data.get("causation_id"),
        )


@dataclass
class Event:
    event_id: str
    event_type: EventType
    event_name: str
    ts: datetime
    payload: Dict[str, Any] = field(default_factory=dict)
    source: Optional[str] = None
    correlation_id: Optional[str] = None


@dataclass
class MarketEvent(Event):
    pass


@dataclass
class SignalEvent(Event):
    pass


@dataclass
class RiskEvent(Event):
    pass


@dataclass
class ExecutionEvent(Event):
    pass


@dataclass
class PositionEvent(Event):
    pass
