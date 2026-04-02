"""
模块职责：
- 定义账户余额、保证金、权益快照等结构
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass
class Balance:
    asset: str
    free: Decimal
    used: Decimal
    total: Decimal


@dataclass
class MarginSnapshot:
    venue: str
    ts: datetime
    equity: Decimal
    initial_margin: Decimal
    maintenance_margin: Decimal
    margin_ratio: Optional[Decimal] = None


@dataclass
class AccountSnapshot:
    account_id: str
    venue: str
    ts: datetime
    balances: list[Balance]
    equity_usd: Optional[Decimal] = None
