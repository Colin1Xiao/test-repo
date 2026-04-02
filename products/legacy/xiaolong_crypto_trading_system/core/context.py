"""
模块职责：
- 定义系统运行时上下文
- 保存运行模式、基础依赖引用、非业务真相的进程级上下文

注意：
- 不在这里保存订单真相、仓位真相、风控真相
- 真相应放在 storage / portfolio / execution 等域中
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

from schemas.enums import SystemMode


@dataclass
class AppContext:
    mode: SystemMode
    venue: str
    symbols: list[str] = field(default_factory=list)
    components: Dict[str, Any] = field(default_factory=dict)

    def register(self, name: str, component: Any) -> None:
        self.components[name] = component

    def get(self, name: str) -> Any:
        return self.components[name]
