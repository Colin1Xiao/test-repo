#!/usr/bin/env python3
"""
evolution/param_validator.py

对演化候选参数做边界、安全和可用性校验
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List


@dataclass
class ValidationResult:
    is_valid: bool
    reasons: List[str]
    normalized_params: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ParamValidator:
    """
    对演化候选参数做边界、安全和可用性校验
    """

    def __init__(self) -> None:
        self.bounds = {
            "score_threshold": (60, 90),
            "volume_threshold": (0.8, 1.5),
            "min_price_change": (0.0005, 0.0035),  # 0.05% ~ 0.35%
            "stop_loss_pct": (-0.0020, -0.0003),  # -0.20% ~ -0.03%
            "time_exit_sec": (20, 180),
            "take_profit_pct": (0.0005, 0.01),  # 0.05% ~ 1.0%
            "entry_score_min": (1, 10),
        }

    def validate(self, params: Dict[str, Any]) -> ValidationResult:
        reasons: List[str] = []
        normalized = dict(params)

        for key, (low, high) in self.bounds.items():
            if key not in normalized:
                continue

            try:
                value = float(normalized[key])
            except (TypeError, ValueError):
                reasons.append(f"{key}: not numeric")
                continue

            if value < low or value > high:
                reasons.append(f"{key}: out of bounds [{low}, {high}] -> {value}")
            else:
                normalized[key] = value

        # 逻辑约束 1：止盈必须大于绝对止损
        tp = normalized.get("take_profit_pct")
        sl = normalized.get("stop_loss_pct")
        if tp is not None and sl is not None:
            if tp <= abs(sl):
                reasons.append(f"take_profit_pct must be > abs(stop_loss_pct), got tp={tp}, sl={sl}")

        # 逻辑约束 2：time_exit 太短会导致全部 TIME_EXIT
        tx = normalized.get("time_exit_sec")
        if tx is not None and tx < 25:
            reasons.append(f"time_exit_sec too short for realistic trend development: {tx}")

        # 逻辑约束 3：阈值不能太松
        st = normalized.get("score_threshold")
        vt = normalized.get("volume_threshold")
        if st is not None and vt is not None:
            if st < 62 and vt < 0.95:
                reasons.append("score_threshold and volume_threshold are both too loose; risk of over-trading")

        return ValidationResult(
            is_valid=(len(reasons) == 0),
            reasons=reasons,
            normalized_params=normalized,
        )


if __name__ == "__main__":
    validator = ParamValidator()
    sample = {
        "score_threshold": 68,
        "volume_threshold": 1.1,
        "min_price_change": 0.001,
        "take_profit_pct": 0.0025,
        "stop_loss_pct": -0.0007,
        "time_exit_sec": 90,
    }
    print(validator.validate(sample).to_dict())
