"""
模块职责：
- 管理本地仓位真相的最小内存模型
- 第一轮先支持单 symbol 查询与更新
"""

from __future__ import annotations

from decimal import Decimal
from typing import Dict

from schemas.enums import PositionSide, PositionStatus, Side
from schemas.order import Fill
from schemas.position import Lot, Position


class PositionService:
    def __init__(self) -> None:
        self._positions: Dict[str, Position] = {}

    def get(self, symbol: str) -> Position | None:
        return self._positions.get(symbol)

    def apply_fill(self, fill: Fill) -> Position:
        """
        依据成交更新最小仓位视图。
        当前版本只处理单向净仓位的最简逻辑。
        """
        current = self._positions.get(fill.symbol)
        if current is None:
            side = PositionSide.LONG if fill.side == Side.BUY else PositionSide.SHORT
            position = Position(
                position_id=f"{fill.venue}:{fill.symbol}",
                venue=fill.venue,
                symbol=fill.symbol,
                side=side,
                status=PositionStatus.OPEN,
                qty=fill.qty,
                avg_entry_price=fill.price,
                lots=[Lot(lot_id=fill.fill_id, fill_id=fill.fill_id, qty=fill.qty, price=fill.price, ts=fill.ts)],
            )
            self._positions[fill.symbol] = position
            return position

        new_qty = current.qty + fill.qty
        current.qty = new_qty
        current.status = PositionStatus.OPEN if new_qty != Decimal("0") else PositionStatus.CLOSED
        current.lots.append(
            Lot(lot_id=fill.fill_id, fill_id=fill.fill_id, qty=fill.qty, price=fill.price, ts=fill.ts)
        )
        return current
