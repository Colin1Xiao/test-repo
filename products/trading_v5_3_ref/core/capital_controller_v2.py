#!/usr/bin/env python3
"""
Capital Controller V2 - 动态保证金控制器（支持 MICRO 模式）

设计原则：
1. 保证金随 equity 变化
2. drawdown / edge / risk 会压缩保证金
3. 正常模式受 risk_pct_cap 约束
4. 若资金很小，但仍满足交易所最小可执行规模，则允许进入 MICRO 模式
5. 连交易所最小规模都达不到时，BLOCK
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, Any, Literal


EdgeState = Literal["STRONG", "WEAK", "DEAD"]
RiskState = Literal["NORMAL", "WARNING", "STOP_REQUIRED"]


@dataclass
class CapitalDecision:
    """资金决策结果"""
    # 输入
    equity_usdt: float
    base_risk_fraction: float
    edge_state: EdgeState
    risk_state: RiskState
    drawdown: float

    # 输出
    margin_usdt: float
    leverage: int
    notional_usdt: float
    position_size: float

    # 决策状态
    can_trade: bool
    capital_state: str  # NORMAL / REDUCED / MICRO / BLOCKED
    reason: str

    # 限制
    min_margin_usdt: float
    max_margin_usdt: float
    risk_pct: float
    risk_pct_cap: float
    micro_risk_pct_cap: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CapitalControllerV2:
    """
    动态保证金控制器（支持 MICRO 模式）
    """

    def __init__(
        self,
        *,
        base_risk_fraction: float = 0.02,
        min_margin_usdt: float = 0.05,
        max_margin_usdt: float = 5.0,
        leverage: int = 100,
        risk_pct_cap: float = 0.03,  # 正常模式 3%
        micro_risk_pct_cap: float = 0.05,  # 微型模式 5%
        min_notional_usdt: float = 5.0,  # 交易所最小名义仓位
        min_position_size: float = 0.01,  # 最小持仓数量 (OKX 要求 >= 0.01)
    ) -> None:
        if base_risk_fraction <= 0 or base_risk_fraction > 1:
            raise ValueError("base_risk_fraction must be in (0, 1]")
        if min_margin_usdt <= 0:
            raise ValueError("min_margin_usdt must be > 0")
        if max_margin_usdt < min_margin_usdt:
            raise ValueError("max_margin_usdt must be >= min_margin_usdt")
        if leverage <= 0:
            raise ValueError("leverage must be > 0")
        if risk_pct_cap <= 0:
            raise ValueError("risk_pct_cap must be > 0")
        if micro_risk_pct_cap < risk_pct_cap:
            raise ValueError("micro_risk_pct_cap must be >= risk_pct_cap")
        if min_notional_usdt <= 0:
            raise ValueError("min_notional_usdt must be > 0")
        if min_position_size <= 0:
            raise ValueError("min_position_size must be > 0")

        self.base_risk_fraction = base_risk_fraction
        self.min_margin_usdt = min_margin_usdt
        self.max_margin_usdt = max_margin_usdt
        self.leverage = leverage

        self.risk_pct_cap = risk_pct_cap
        self.micro_risk_pct_cap = micro_risk_pct_cap
        self.min_notional_usdt = min_notional_usdt
        self.min_position_size = min_position_size

    def calculate(
        self,
        *,
        equity_usdt: float,
        entry_price: float,
        drawdown: float,
        edge_state: EdgeState,
        risk_state: RiskState,
    ) -> CapitalDecision:
        """
        计算动态保证金（支持 MICRO 模式）
        """
        if equity_usdt <= 0:
            return self._blocked_decision(
                equity_usdt=equity_usdt,
                entry_price=entry_price,
                drawdown=drawdown,
                edge_state=edge_state,
                risk_state=risk_state,
                reason="EQUITY_NON_POSITIVE",
            )

        if entry_price <= 0:
            raise ValueError("entry_price must be > 0")

        # 1. 基础保证金
        margin = equity_usdt * self.base_risk_fraction
        capital_state = "NORMAL"
        reason_parts = ["BASE"]

        # 2. Drawdown 惩罚
        if drawdown >= 0.10:
            margin *= 0.50
            capital_state = "REDUCED"
            reason_parts.append("DD>=10%")
        elif drawdown >= 0.05:
            margin *= 0.70
            capital_state = "REDUCED"
            reason_parts.append("DD>=5%")

        # 3. Edge 状态联动
        if edge_state == "WEAK":
            margin *= 0.50
            capital_state = "REDUCED"
            reason_parts.append("EDGE_WEAK")
        elif edge_state == "DEAD":
            return self._blocked_decision(
                equity_usdt=equity_usdt,
                entry_price=entry_price,
                drawdown=drawdown,
                edge_state=edge_state,
                risk_state=risk_state,
                reason="EDGE_DEAD",
            )

        # 4. Risk 状态联动
        if risk_state == "WARNING":
            margin *= 0.50
            capital_state = "REDUCED"
            reason_parts.append("RISK_WARNING")
        elif risk_state == "STOP_REQUIRED":
            return self._blocked_decision(
                equity_usdt=equity_usdt,
                entry_price=entry_price,
                drawdown=drawdown,
                edge_state=edge_state,
                risk_state=risk_state,
                reason="RISK_STOP_REQUIRED",
            )

        # 5. Clamp 保证金
        raw_margin = margin
        if margin > 0:
            margin = min(max(margin, self.min_margin_usdt), self.max_margin_usdt)
            if margin != raw_margin:
                reason_parts.append("CLAMPED")

        # 6. 计算名义仓位与持仓数量
        notional_usdt = margin * self.leverage
        position_size = notional_usdt / entry_price

        # 7. 风险比例
        risk_pct = margin / equity_usdt if equity_usdt > 0 else 0.0

        # 8. 风险上限检查（支持 MICRO 模式）
        if risk_pct > self.risk_pct_cap:
            # 如果满足交易所最小可执行规模，则允许进入 MICRO
            if (
                notional_usdt >= self.min_notional_usdt
                and position_size >= self.min_position_size
            ):
                if risk_pct <= self.micro_risk_pct_cap:
                    capital_state = "MICRO"
                    reason_parts.append("MICRO_MODE")
                else:
                    return self._blocked_decision(
                        equity_usdt=equity_usdt,
                        entry_price=entry_price,
                        drawdown=drawdown,
                        edge_state=edge_state,
                        risk_state=risk_state,
                        reason="RISK_PCT_TOO_HIGH",
                    )
            else:
                return self._blocked_decision(
                    equity_usdt=equity_usdt,
                    entry_price=entry_price,
                    drawdown=drawdown,
                    edge_state=edge_state,
                    risk_state=risk_state,
                    reason="BELOW_EXCHANGE_MINIMUM",
                )

        return CapitalDecision(
            equity_usdt=round(equity_usdt, 4),
            base_risk_fraction=self.base_risk_fraction,
            edge_state=edge_state,
            risk_state=risk_state,
            drawdown=round(drawdown, 6),
            margin_usdt=round(margin, 4),
            leverage=self.leverage,
            notional_usdt=round(notional_usdt, 4),
            position_size=round(position_size, 8),
            can_trade=True,
            capital_state=capital_state,
            reason=" | ".join(reason_parts),
            min_margin_usdt=self.min_margin_usdt,
            max_margin_usdt=self.max_margin_usdt,
            risk_pct=round(risk_pct, 6),
            risk_pct_cap=self.risk_pct_cap,
            micro_risk_pct_cap=self.micro_risk_pct_cap,
        )

    def _blocked_decision(
        self,
        *,
        equity_usdt: float,
        entry_price: float,
        drawdown: float,
        edge_state: EdgeState,
        risk_state: RiskState,
        reason: str,
    ) -> CapitalDecision:
        """生成阻止交易的决策"""
        return CapitalDecision(
            equity_usdt=round(max(equity_usdt, 0.0), 4),
            base_risk_fraction=self.base_risk_fraction,
            edge_state=edge_state,
            risk_state=risk_state,
            drawdown=round(drawdown, 6),
            margin_usdt=0.0,
            leverage=self.leverage,
            notional_usdt=0.0,
            position_size=0.0,
            can_trade=False,
            capital_state="BLOCKED",
            reason=reason,
            min_margin_usdt=self.min_margin_usdt,
            max_margin_usdt=self.max_margin_usdt,
            risk_pct=0.0,
            risk_pct_cap=self.risk_pct_cap,
            micro_risk_pct_cap=self.micro_risk_pct_cap,
        )


def format_capital_panel(decision: CapitalDecision) -> Dict[str, str]:
    """格式化资金面板显示"""
    return {
        "账户权益": f"{decision.equity_usdt:.2f} USDT",
        "基础风险比例": f"{decision.base_risk_fraction * 100:.2f}%",
        "当前保证金": f"{decision.margin_usdt:.2f} USDT",
        "风险占权益比例": f"{decision.risk_pct * 100:.2f}%",
        "正常风险上限": f"{decision.risk_pct_cap * 100:.2f}%",
        "微型模式上限": f"{decision.micro_risk_pct_cap * 100:.2f}%",
        "杠杆": f"{decision.leverage}x",
        "名义仓位": f"{decision.notional_usdt:.2f} USDT",
        "持仓数量": f"{decision.position_size:.6f}",
        "资金状态": decision.capital_state,
        "是否可交易": "YES" if decision.can_trade else "NO",
        "原因": decision.reason,
        "回撤": f"{decision.drawdown * 100:.2f}%",
        "Edge": decision.edge_state,
        "Risk": decision.risk_state,
    }


if __name__ == "__main__":
    # 测试四种场景
    controller = CapitalControllerV2(
        base_risk_fraction=0.02,
        min_margin_usdt=0.05,
        max_margin_usdt=5.0,
        leverage=100,
        risk_pct_cap=0.03,
        micro_risk_pct_cap=0.05,
        min_notional_usdt=5.0,
        min_position_size=0.002,
    )

    scenarios = [
        {
            "name": "NORMAL",
            "equity_usdt": 120.0,
            "entry_price": 2300.0,
            "drawdown": 0.0,
            "edge_state": "STRONG",
            "risk_state": "NORMAL",
        },
        {
            "name": "EDGE_WEAK",
            "equity_usdt": 120.0,
            "entry_price": 2300.0,
            "drawdown": 0.0,
            "edge_state": "WEAK",
            "risk_state": "NORMAL",
        },
        {
            "name": "MICRO",
            "equity_usdt": 1.35,
            "entry_price": 2500.0,
            "drawdown": 0.0,
            "edge_state": "STRONG",
            "risk_state": "NORMAL",
        },
        {
            "name": "BLOCK",
            "equity_usdt": 0.50,
            "entry_price": 2500.0,
            "drawdown": 0.0,
            "edge_state": "STRONG",
            "risk_state": "NORMAL",
        },
    ]

    for s in scenarios:
        decision = controller.calculate(
            equity_usdt=s["equity_usdt"],
            entry_price=s["entry_price"],
            drawdown=s["drawdown"],
            edge_state=s["edge_state"],
            risk_state=s["risk_state"],
        )
        print(f"\n=== {s['name']} ===")
        print(f"  Equity: {decision.equity_usdt}")
        print(f"  Margin: {decision.margin_usdt}")
        print(f"  Risk Pct: {decision.risk_pct:.2%}")
        print(f"  Capital State: {decision.capital_state}")
        print(f"  Can Trade: {decision.can_trade}")
        print(f"  Reason: {decision.reason}")