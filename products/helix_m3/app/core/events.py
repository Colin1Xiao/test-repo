"""
事件总线模块

提供事件发布-订阅机制，支持实时事件推送
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Union

from app.core.config import Settings

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """事件类型枚举"""
    SYSTEM_STARTUP = "system_startup"
    SYSTEM_SHUTDOWN = "system_shutdown"
    SYSTEM_ERROR = "system_error"
    
    MARKET_TICK = "market_tick"
    MARKET_OHLCV = "market_ohlcv"
    MARKET_DEPTH = "market_depth"
    
    ORDER_CREATED = "order_created"
    ORDER_UPDATED = "order_updated"
    ORDER_FILLED = "order_filled"
    ORDER_CANCELLED = "order_cancelled"
    
    POSITION_OPENED = "position_opened"
    POSITION_UPDATED = "position_updated"
    POSITION_CLOSED = "position_closed"
    
    STRATEGY_STARTED = "strategy_started"
    STRATEGY_STOPPED = "strategy_stopped"
    STRATEGY_SIGNAL = "strategy_signal"
    
    ACCOUNT_BALANCE = "account_balance"
    ACCOUNT_TRANSACTION = "account_transaction"


@dataclass
class Event:
    """事件数据结构"""
    event_type: EventType
    source: str
    data: Dict[str, Any]
    timestamp: datetime
    metadata: Dict[str, Any]
    
    def __init__(
        self,
        event_type: EventType,
        source: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
    ):
        self.event_type = event_type
        self.source = source
        self.data = data
        self.metadata = metadata or {}
        self.timestamp = timestamp or datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "event_type": self.event_type.value,
            "source": self.source,
            "data": self.data,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Event":
        """从字典创建事件"""
        return cls(
            event_type=EventType(data["event_type"]),
            source=data["source"],
            data=data["data"],
            metadata=data.get("metadata", {}),
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


class EventBus:
    """事件总线"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.subscribers: Dict[EventType, Set[Callable[[Event], None]]] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.is_running: bool = False
        self.worker_tasks: List[asyncio.Task] = []
        
        logger.debug("事件总线初始化完成")
    
    async def start(self):
        """启动事件总线"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # 启动事件处理工作者
        for i in range(self.settings.event_bus_workers):
            task = asyncio.create_task(self._event_worker(i), name=f"event_worker_{i}")
            self.worker_tasks.append(task)
        
        logger.info(f"事件总线启动，工作者数量：{self.settings.event_bus_workers}")
    
    async def stop(self):
        """停止事件总线"""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # 等待事件处理完成
        await self.queue.join()
        
        # 取消所有工作者任务
        for task in self.worker_tasks:
            task.cancel()
        
        # 等待所有工作者退出
        await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        
        logger.info("事件总线已停止")
    
    def subscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """订阅事件"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = set()
        
        self.subscribers[event_type].add(callback)
        logger.debug(f"事件订阅：{event_type.value} -> {callback.__name__}")
    
    def unsubscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """取消订阅"""
        if event_type in self.subscribers:
            self.subscribers[event_type].discard(callback)
            
            if not self.subscribers[event_type]:
                del self.subscribers[event_type]
        
        logger.debug(f"事件取消订阅：{event_type.value} -> {callback.__name__}")
    
    async def publish(self, event: Event):
        """发布事件"""
        if not self.is_running:
            logger.warning("事件总线未运行，事件被丢弃：{event.event_type.value}")
            return
        
        await self.queue.put(event)
        logger.debug(f"事件发布：{event.event_type.value} -> {event.source}")
    
    async def _event_worker(self, worker_id: int):
        """事件处理工作者"""
        logger.debug(f"事件工作者 {worker_id} 启动")
        
        try:
            while self.is_running:
                try:
                    # 获取事件
                    event = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                    
                    # 通知订阅者
                    callbacks = self.subscribers.get(event.event_type, set()).copy()
                    if callbacks:
                        tasks = []
                        for callback in callbacks:
                            try:
                                if asyncio.iscoroutinefunction(callback):
                                    tasks.append(callback(event))
                                else:
                                    callback(event)
                            except Exception as e:
                                logger.error(
                                    f"事件处理失败，工作者 {worker_id}，事件 {event.event_type.value}：{e}",
                                    exc_info=True,
                                )
                        
                        if tasks:
                            await asyncio.gather(*tasks)
                    
                    # 标记任务完成
                    self.queue.task_done()
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"事件工作者 {worker_id} 错误：{e}", exc_info=True)
        
        except asyncio.CancelledError:
            logger.debug(f"事件工作者 {workerid_id} 取消")
        except Exception as e:
            logger.error(f"事件工作者 {worker_id} 异常：{e}", exc_info=True)
        finally:
            logger.debug(f"事件工作者 {worker_id} 退出")


# 全局事件总线实例
event_bus: Optional[EventBus] = None


async def get_event_bus() -> EventBus:
    """获取事件总线实例（依赖注入）"""
    global event_bus
    
    if event_bus is None:
        settings = Settings()
        event_bus = EventBus(settings)
        await event_bus.start()
    
    return event_bus
