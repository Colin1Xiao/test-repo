"""
模块职责：
- 定义全系统通用枚举
- 作为策略、风控、执行、仓位、事件的统一状态语言

当前阶段：
- 第一轮占位实现，先定义最小可用枚举集合

后续依赖：
- schemas.market
- schemas.signal
- schemas.order
- schemas.position
- schemas.risk
- schemas.events
"""

from __future__ import annotations

from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class PositionSide(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    FLAT = "FLAT"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    TAKE_PROFIT = "TAKE_PROFIT"
    TRAILING_STOP = "TRAILING_STOP"


class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTING = "SUBMITTING"
    ACKED = "ACKED"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCEL_PENDING = "CANCEL_PENDING"
    CANCELED = "CANCELED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    UNKNOWN_RECOVERING = "UNKNOWN_RECOVERING"


class PositionStatus(str, Enum):
    FLAT = "FLAT"
    OPENING = "OPENING"
    OPEN = "OPEN"
    REDUCING = "REDUCING"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"
    RECONCILING = "RECONCILING"


class SignalType(str, Enum):
    ENTRY = "ENTRY"
    EXIT = "EXIT"
    REDUCE = "REDUCE"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


class RiskDecisionType(str, Enum):
    PASS = "PASS"
    REJECT = "REJECT"
    REVIEW = "REVIEW"


class EventType(str, Enum):
    ALL = "all"  # 通配符
    MARKET_DATA = "market_data"
    TRADING_SIGNAL = "trading_signal"
    ORDER_SUBMITTED = "order_submitted"
    ORDER_ACCEPTED = "order_accepted"
    ORDER_REJECTED = "order_rejected"
    ORDER_FILLED = "order_filled"
    ORDER_CANCELLED = "order_cancelled"
    POSITION_UPDATED = "position_updated"
    RISK_RULE_TRIGGERED = "risk_rule_triggered"
    BREAKER_TRIPPED = "breaker_tripped"
    BREAKER_RESET = "breaker_reset"
    TRADING_MODE_CHANGED = "trading_mode_changed"
    SYSTEM_FROZEN = "system_frozen"
    SYSTEM_UNFROZEN = "system_unfrozen"
    MASS_CANCEL = "mass_cancel"
    EMERGENCY_SHUTDOWN = "emergency_shutdown"
    CONNECTION_LOST = "connection_lost"
    CONNECTION_RESTORED = "connection_restored"
    MARKET = "market"
    SIGNAL = "signal"
    RISK = "risk"
    EXECUTION = "execution"
    POSITION = "position"
    ACCOUNT = "account"
    SYSTEM = "system"
    AUDIT = "audit"
    INCIDENT = "incident"


class SystemMode(str, Enum):
    DEV = "DEV"
    REPLAY = "REPLAY"
    PAPER = "PAPER"
    SHADOW = "SHADOW"
    CANARY = "CANARY"
    LIVE = "LIVE"


TradingMode = SystemMode  # 别名


class TimeInForce(str, Enum):
    GTC = "GTC"
    IOC = "IOC"
    FOK = "FOK"
    POST_ONLY = "POST_ONLY"


class RejectCode(str, Enum):
    RISK_REJECTED = "RISK_REJECTED"
    INVALID_ORDER = "INVALID_ORDER"
    EXCHANGE_REJECTED = "EXCHANGE_REJECTED"
    MARKET_QUALITY_BLOCK = "MARKET_QUALITY_BLOCK"
    SYSTEM_DEGRADED = "SYSTEM_DEGRADED"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
