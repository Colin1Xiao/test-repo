#!/usr/bin/env python3
"""
evolution/shadow_ab_runner.py

Shadow A/B 对比器：比较当前参数与候选参数
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, List

from evolution.param_validator import ParamValidator
from evolution.real_feedback_adapter import RealFeedbackAdapter, RealFeedback


@dataclass
class ShadowABResult:
    sample_size: int
    decision_diff_rate: float
    over_aggressive: int
    over_conservative: int
    baseline_feedback: Dict[str, Any]
    candidate_feedback: Dict[str, Any]
    recommendation: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ShadowABRunner:
    """
    Shadow A/B 对比器
    """

    def __init__(self) -> None:
        self.validator = ParamValidator()
        self.adapter = RealFeedbackAdapter()

    def run_with_feedback(
        self,
        baseline_feedback: RealFeedback,
        candidate_feedback: RealFeedback,
        decision_diff_rate: float,
        over_aggressive: int,
        over_conservative: int,
    ) -> ShadowABResult:
        recommendation = self._make_recommendation(
            baseline_feedback=baseline_feedback,
            candidate_feedback=candidate_feedback,
            decision_diff_rate=decision_diff_rate,
            over_aggressive=over_aggressive,
            over_conservative=over_conservative,
        )

        return ShadowABResult(
            sample_size=baseline_feedback.trade_count,
            decision_diff_rate=decision_diff_rate,
            over_aggressive=over_aggressive,
            over_conservative=over_conservative,
            baseline_feedback=baseline_feedback.to_dict(),
            candidate_feedback=candidate_feedback.to_dict(),
            recommendation=recommendation,
        )

    def compare_params_on_shadow_decisions(
        self,
        baseline_params: Dict[str, Any],
        candidate_params: Dict[str, Any],
        signal_samples: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        对比两个参数集在信号样本上的决策差异
        """
        base_valid = self.validator.validate(baseline_params)
        cand_valid = self.validator.validate(candidate_params)

        if not base_valid.is_valid:
            raise ValueError(f"baseline params invalid: {base_valid.reasons}")
        if not cand_valid.is_valid:
            raise ValueError(f"candidate params invalid: {cand_valid.reasons}")

        total = len(signal_samples)
        if total == 0:
            raise ValueError("signal_samples is empty")

        baseline_accepts = 0
        candidate_accepts = 0
        diffs = 0
        over_aggressive = 0
        over_conservative = 0

        for s in signal_samples:
            a = self._accept(base_valid.normalized_params, s)
            b = self._accept(cand_valid.normalized_params, s)

            baseline_accepts += int(a)
            candidate_accepts += int(b)

            if a != b:
                diffs += 1
                if b and not a:
                    over_aggressive += 1
                elif a and not b:
                    over_conservative += 1

        return {
            "sample_size": total,
            "decision_diff_rate": diffs / total,
            "baseline_accepts": baseline_accepts,
            "candidate_accepts": candidate_accepts,
            "over_aggressive": over_aggressive,
            "over_conservative": over_conservative,
        }

    def _accept(self, params: Dict[str, Any], signal: Dict[str, Any]) -> bool:
        score = float(signal.get("score", 0))
        volume_ratio = float(signal.get("volume_ratio", 0))
        price_change = float(signal.get("price_change", 0))
        return (
            score >= params.get("score_threshold", 70)
            and volume_ratio >= params.get("volume_threshold", 1.0)
            and price_change >= params.get("min_price_change", 0.001)
        )

    def _make_recommendation(
        self,
        baseline_feedback: RealFeedback,
        candidate_feedback: RealFeedback,
        decision_diff_rate: float,
        over_aggressive: int,
        over_conservative: int,
    ) -> str:
        # 红线：更激进不允许
        if over_aggressive > 0:
            return "BLOCK"

        # 样本不足
        if baseline_feedback.trade_count < 30:
            return "WARN"

        # 候选版本必须至少不差
        better_pf = candidate_feedback.profit_factor > baseline_feedback.profit_factor
        better_exp = candidate_feedback.expectancy > baseline_feedback.expectancy
        not_worse_dd = candidate_feedback.max_drawdown <= baseline_feedback.max_drawdown

        if better_pf and better_exp and not_worse_dd and decision_diff_rate <= 0.30:
            return "PASS"

        return "WARN"


if __name__ == "__main__":
    adapter = RealFeedbackAdapter()
    runner = ShadowABRunner()

    baseline = adapter.compute_from_jsonl("logs/system_state.jsonl")
    candidate = adapter.compute_from_jsonl("logs/system_state.jsonl")  # 占位

    result = runner.run_with_feedback(
        baseline_feedback=baseline,
        candidate_feedback=candidate,
        decision_diff_rate=0.12,
        over_aggressive=0,
        over_conservative=3,
    )
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
