"""
模块职责：
- 保存与加载系统快照
- 第一轮使用 JSON 文件型状态快照
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, file_path: str | Path) -> None:
        self.file_path = Path(file_path)

    def save(self, payload: dict[str, Any]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def load(self) -> dict[str, Any]:
        if not self.file_path.exists():
            return {}
        return json.loads(self.file_path.read_text(encoding="utf-8"))
