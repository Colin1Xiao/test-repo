"""
模块职责：
- 定义 OKX 交易规则、精度、最小下单量等静态/动态规格接口
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(slots=True)
class InstrumentSpec:
    symbol: str
    tick_size: Decimal
    lot_size: Decimal
    min_qty: Decimal
    min_notional: Decimal | None = None
    max_leverage: Decimal | None = None


class OkxSpecsProvider:
    """
    OKX 规格信息提供器占位实现。
    """

    def get_instrument_spec(self, symbol: str) -> InstrumentSpec:
        raise NotImplementedError("TODO: 从 OKX instruments 接口加载合约规格")
