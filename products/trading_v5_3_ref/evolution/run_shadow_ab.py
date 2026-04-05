#!/usr/bin/env python3
"""
evolution/run_shadow_ab.py

运行 Shadow A/B 对比
"""

from __future__ import annotations

import json

from evolution.real_feedback_adapter import RealFeedbackAdapter
from evolution.shadow_ab_runner import ShadowABRunner


def main() -> None:
    adapter = RealFeedbackAdapter()
    runner = ShadowABRunner()

    baseline_feedback = adapter.compute_from_jsonl("logs/system_state.jsonl")
    candidate_feedback = adapter.compute_from_jsonl("logs/system_state.jsonl")  # 占位

    result = runner.run_with_feedback(
        baseline_feedback=baseline_feedback,
        candidate_feedback=candidate_feedback,
        decision_diff_rate=0.10,
        over_aggressive=0,
        over_conservative=2,
    )

    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
