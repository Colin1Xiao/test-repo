"""
模块职责：
- 提供最小事件总线接口
- 支撑同步发布与订阅
- 后续可替换为异步总线、中间件总线或持久化事件流

当前阶段：
- 第一轮仅实现内存型同步事件总线
"""

from __future__ import annotations

from collections import defaultdict
from typing import Callable, DefaultDict, List

from schemas.events import Event


EventHandler = Callable[[Event], None]


class EventBus:
    """
    最小同步事件总线。
    """

    def __init__(self) -> None:
        self._handlers: DefaultDict[str, List[EventHandler]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        """
        注册事件处理器。
        """
        self._handlers[event_name].append(handler)

    def publish(self, event: Event) -> None:
        """
        发布事件并同步调用订阅处理器。
        """
        for handler in self._handlers.get(event.event_name, []):
            handler(event)

    def clear(self) -> None:
        """
        清理所有订阅器。
        """
        self._handlers.clear()
