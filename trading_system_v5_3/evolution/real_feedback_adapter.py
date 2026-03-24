#!/usr/bin/env python3
"""
evolution/real_feedback_adapter.py

从真实交易记录中提取绩效反馈
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class TradeRecord:
    entry_price: float
    exit_price: float
    pnl: float
    exit_source: str
    position_size: float
    timestamp: float


@dataclass
class RealFeedback:
    trade_count: int
    win_count: int
    loss_count: int
    breakeven_count: int
    win_rate: float
    avg_win: float
    avg_loss: float
    max_win: float
    max_loss: float
    profit_factor: float
    expectancy: float
    total_pnl: float
    max_drawdown: float
    exit_distribution: Dict[str, int]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RealFeedbackAdapter:
    """
    从真实交易记录中提取绩效反馈
    """

    def __init__(self, min_trade_count: int = 10) -> None:
        self.min_trade_count = min_trade_count

    def load_from_jsonl(self, filepath: str) -> List[TradeRecord]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"JSONL file not found: {filepath}")

        trades: List[TradeRecord] = []
        with open(filepath, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue

                try:
                    item = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON at line {line_no}: {e}") from e

                # 只吃真实平仓事件
                if item.get("event") != "exit":
                    continue

                trade = self._parse_trade(item, source=f"{filepath}:{line_no}")
                if trade:
                    trades.append(trade)

        return trades

    def compute_feedback(self, trades: List[TradeRecord]) -> RealFeedback:
        if not trades:
            raise ValueError("No trades available for feedback computation")

        pnls = [t.pnl for t in trades]
        wins = [x for x in pnls if x > 0]
        losses = [x for x in pnls if x < 0]
        breakevens = [x for x in pnls if x == 0]

        trade_count = len(trades)
        win_count = len(wins)
        loss_count = len(losses)
        breakeven_count = len(breakevens)

        win_rate = win_count / trade_count if trade_count else 0.0
        avg_win = sum(wins) / len(wins) if wins else 0.0
        avg_loss = abs(sum(losses) / len(losses)) if losses else 0.0
        max_win = max(wins) if wins else 0.0
        max_loss = abs(min(losses)) if losses else 0.0

        gross_profit = sum(wins) if wins else 0.0
        gross_loss = abs(sum(losses)) if losses else 0.0

        if gross_loss == 0:
            profit_factor = math.inf if gross_profit > 0 else 0.0
        else:
            profit_factor = gross_profit / gross_loss

        expectancy = sum(pnls) / trade_count if trade_count else 0.0
        total_pnl = sum(pnls)

        exit_distribution: Dict[str, int] = {}
        for t in trades:
            exit_distribution[t.exit_source] = exit_distribution.get(t.exit_source, 0) + 1

        max_drawdown = self._compute_max_drawdown(pnls)

        return RealFeedback(
            trade_count=trade_count,
            win_count=win_count,
            loss_count=loss_count,
            breakeven_count=breakeven_count,
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            max_win=max_win,
            max_loss=max_loss,
            profit_factor=profit_factor,
            expectancy=expectancy,
            total_pnl=total_pnl,
            max_drawdown=max_drawdown,
            exit_distribution=exit_distribution,
        )

    def compute_from_jsonl(self, filepath: str) -> RealFeedback:
        trades = self.load_from_jsonl(filepath)
        return self.compute_feedback(trades)

    def _parse_trade(self, item: Dict[str, Any], source: str) -> Optional[TradeRecord]:
        required = ["entry_price", "exit_price", "pnl", "exit_source", "position_size"]
        missing = [k for k in required if k not in item]
        if missing:
            raise ValueError(f"Missing fields in trade record at {source}: {missing}")

        try:
            entry_price = float(item["entry_price"])
            exit_price = float(item["exit_price"])
            pnl = float(item["pnl"])
            exit_source = str(item["exit_source"])
            position_size = float(item["position_size"])
            ts = item.get("timestamp", 0.0)
            if isinstance(ts, str):
                from datetime import datetime
                timestamp = datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp()
            else:
                timestamp = float(ts)
        except (TypeError, ValueError) as e:
            raise ValueError(f"Invalid field types in trade record at {source}: {e}") from e

        return TradeRecord(
            entry_price=entry_price,
            exit_price=exit_price,
            pnl=pnl,
            exit_source=exit_source,
            position_size=position_size,
            timestamp=timestamp,
        )

    def _compute_max_drawdown(self, pnls: List[float]) -> float:
        equity = 0.0
        peak = 0.0
        max_dd = 0.0

        for p in pnls:
            equity += p
            if equity > peak:
                peak = equity
            drawdown = peak - equity
            if drawdown > max_dd:
                max_dd = drawdown

        return max_dd


if __name__ == "__main__":
    adapter = RealFeedbackAdapter()
    path = "logs/system_state.jsonl"
    feedback = adapter.compute_from_jsonl(path)
    print(json.dumps(feedback.to_dict(), indent=2, ensure_ascii=False))