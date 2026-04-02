"""
Event Bus — 事件总线

提供事件发布/订阅机制：
- 同步发布
- 按类型订阅
- 通配符订阅 (EventType.ALL)
- 事件历史
- 关联链查询

当前阶段：
- 实现内存型同步事件总线
- 支持 EventEnvelope
"""

from __future__ import annotations

from collections import defaultdict
from typing import Callable, DefaultDict, List, Dict, Any, Optional
from dataclasses import dataclass, field

from schemas.events import EventEnvelope, EventType, EventSource


@dataclass
class HandlerRegistration:
    """处理器注册信息"""
    handler: Callable[[EventEnvelope], None]
    handler_id: Optional[str] = None
    event_type: str = ""


class EventBus:
    """事件总线接口"""
    
    def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None],
        handler_id: Optional[str] = None
    ) -> None:
        """订阅事件"""
        raise NotImplementedError
    
    def unsubscribe(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None]
    ) -> None:
        """取消订阅"""
        raise NotImplementedError
    
    def publish(self, envelope: EventEnvelope) -> None:
        """发布事件"""
        raise NotImplementedError
    
    def get_history(
        self,
        event_type: Optional[EventType] = None,
        limit: int = 100
    ) -> List[EventEnvelope]:
        """获取历史事件"""
        raise NotImplementedError
    
    def get_correlation_chain(self, correlation_id: str) -> List[EventEnvelope]:
        """获取关联链"""
        raise NotImplementedError


class InMemoryEventBus(EventBus):
    """内存事件总线实现"""
    
    def __init__(self):
        self._handlers: DefaultDict[str, List[HandlerRegistration]] = defaultdict(list)
        self._history: List[EventEnvelope] = []
        self._max_history = 1000
    
    def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None],
        handler_id: Optional[str] = None
    ) -> None:
        """订阅事件"""
        reg = HandlerRegistration(
            handler=handler,
            handler_id=handler_id,
            event_type=event_type.value,
        )
        self._handlers[event_type.value].append(reg)
        
        # 通配符订阅也注册到 ALL
        if event_type != EventType.ALL:
            self._handlers[EventType.ALL.value].append(reg)
    
    def unsubscribe(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None]
    ) -> None:
        """取消订阅"""
        # 从特定事件类型中移除
        regs = self._handlers.get(event_type.value, [])
        self._handlers[event_type.value] = [
            r for r in regs if r.handler != handler
        ]
        
        # 也从通配符中移除（如果存在）
        if event_type != EventType.ALL:
            all_regs = self._handlers.get(EventType.ALL.value, [])
            self._handlers[EventType.ALL.value] = [
                r for r in all_regs if r.handler != handler
            ]
    
    def publish(self, envelope: EventEnvelope) -> None:
        """发布事件"""
        # 添加到历史
        self._history.append(envelope)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
        
        # 获取处理器
        regs = self._handlers.get(envelope.event_type.value, [])
        all_regs = self._handlers.get(EventType.ALL.value, [])
        
        # 调用所有处理器（包括通配符）
        all_handlers = set(id(r.handler) for r in regs) | set(id(r.handler) for r in all_regs)
        
        for reg in regs + all_regs:
            if id(reg.handler) in all_handlers:
                try:
                    reg.handler(envelope)
                except Exception as e:
                    # 处理器异常不影响其他处理器
                    print(f"[EventBus] 处理器异常：{e}, handler={reg.handler_id}")
                all_handlers.discard(id(reg.handler))
    
    def get_history(
        self,
        event_type: Optional[EventType] = None,
        limit: int = 100
    ) -> List[EventEnvelope]:
        """获取历史事件"""
        if event_type is None:
            return self._history[-limit:]
        
        filtered = [e for e in self._history if e.event_type == event_type]
        return filtered[-limit:]
    
    def get_correlation_chain(self, correlation_id: str) -> List[EventEnvelope]:
        """获取关联链"""
        return [
            e for e in self._history
            if e.correlation_id == correlation_id
        ]
    
    def get_handlers(self, event_type: EventType) -> List[Dict[str, Any]]:
        """获取处理器列表"""
        regs = self._handlers.get(event_type.value, [])
        return [
            {
                "handler_id": r.handler_id,
                "event_type": r.event_type,
            }
            for r in regs
        ]
    
    def clear(self) -> None:
        """清理所有订阅"""
        self._handlers.clear()
        self._history.clear()
    
    def register_handler(self, handler: Callable[[EventEnvelope], None]) -> None:
        """注册装饰器标记的处理器"""
        if hasattr(handler, '_event_type'):
            event_type = getattr(handler, '_event_type')
            self.subscribe(event_type, handler)


def EventHandler(event_type: EventType):
    """事件处理器装饰器"""
    def decorator(func: Callable[[EventEnvelope], None]) -> Callable[[EventEnvelope], None]:
        func._event_type = event_type
        return func
    return decorator
