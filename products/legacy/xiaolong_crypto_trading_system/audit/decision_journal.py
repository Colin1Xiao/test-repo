"""
模块职责：
- 记录策略决策、风控判断、执行结果之间的决策日志
- 第一轮先做文件型 journaling
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class DecisionJournal:
    def __init__(self, file_path: str | Path) -> None:
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record: dict[str, Any]) -> None:
        """
        以 JSON Lines 形式追加记录。
        """
        with self.file_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
