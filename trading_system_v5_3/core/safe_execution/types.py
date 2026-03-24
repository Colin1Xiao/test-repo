"""
Safe Execution V5.4 - 类型定义模块

核心数据类型和结果类
"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class TradeResult:
    """
    交易结果
    
    必须包含的字段:
    - 基础 5 字段: entry_price, exit_price, pnl, exit_source, position_size
    - 资金字段: margin_usdt, notional_usdt, equity_usdt, capital_state, risk_pct
    - 安全字段: stop_ok, stop_verified
    """
    # 基础字段
    entry_price: float
    exit_price: float
    pnl: float
    exit_source: str
    position_size: float

    # 资金字段
    margin_usdt: float = 0.0
    notional_usdt: float = 0.0
    equity_usdt: float = 0.0
    capital_state: str = "UNKNOWN"
    capital_reason: str = ""
    leverage: int = 100
    risk_pct: float = 0.0

    # 安全字段
    stop_ok: bool = False
    stop_verified: bool = False
    second_entry_blocked: bool = False
    protection_orders_cleared: str = "NO"


@dataclass
class PositionData:
    """持仓数据"""
    entry_price: float
    size: float
    contracts: float
    entry_time: float
    order_id: str
    margin_usdt: float = 0.0
    notional_usdt: float = 0.0
    equity_usdt: float = 0.0
    capital_state: str = "UNKNOWN"
    capital_reason: str = ""
    leverage: int = 100
    risk_pct: float = 0.0


@dataclass
class CapitalDecision:
    """资本决策结果"""
    margin_usdt: float
    notional_usdt: float
    equity_usdt: float
    position_size: float
    leverage: int
    capital_state: str
    reason: str
    risk_pct: float
    can_trade: bool = True