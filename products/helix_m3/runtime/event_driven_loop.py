"""
Event-Driven Loop — 事件驱动主循环

这是系统的总装配入口，将前面所有模块串联起来：
- Market Data → Event
- Signal → Risk → Order
- Fill → Position Update
- Breaker/Incident → Cockpit
- Event Store Append + State Engine Apply

运行模式：
- LIVE: 实盘模式
- PAPER: 模拟模式
- SHADOW: 影子模式（信号不执行）
- REPLAY: 回放模式
"""

import asyncio
import time
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import TradingMode
from core.bus import InMemoryEventBus
from core.state_engine import InMemoryStateEngine
from core.event_store import JsonlEventStore


class LoopState(Enum):
    """循环状态"""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    SHUTTING_DOWN = "shutting_down"


class EventDrivenLoop:
    """事件驱动主循环"""
    
    def __init__(
        self,
        mode: TradingMode = TradingMode.SHADOW,
        workspace_path: Optional[Path] = None
    ):
        self.mode = mode
        self.workspace_path = workspace_path or Path(__file__).parent.parent
        self.state = LoopState.STOPPED
        
        # 核心组件
        self.event_bus = InMemoryEventBus()
        self.state_engine = InMemoryStateEngine()
        self.event_store: Optional[JsonlEventStore] = None
        
        # 模块引用（由外部注入）
        self.market_data_engine: Optional[Any] = None
        self.strategy_engine: Optional[Any] = None
        self.risk_engine: Optional[Any] = None
        self.execution_engine: Optional[Any] = None
        self.cockpit_api: Optional[Any] = None
        
        # 事件处理器
        self._handlers: Dict[EventType, Callable] = {}
        
        # 统计
        self._events_processed = 0
        self._started_at: Optional[datetime] = None
        self._last_event_at: Optional[datetime] = None
        
        # 异步任务
        self._tasks: List[asyncio.Task] = []
    
    def initialize(self) -> None:
        """初始化"""
        # 初始化事件存储
        if self.workspace_path:
            storage_path = self.workspace_path / "storage"
            storage_path.mkdir(exist_ok=True)
            self.event_store = JsonlEventStore(storage_path / "events.jsonl")
        
        # 注册内部事件处理器
        self._register_internal_handlers()
        
        print(f"[Loop] 初始化完成，模式：{self.mode.value}")
    
    def _register_internal_handlers(self) -> None:
        """注册内部事件处理器"""
        
        # 所有事件都写入 event store
        def store_event(envelope: EventEnvelope):
            if self.event_store:
                self.event_store.append(envelope)
        
        self.event_bus.subscribe(EventType.ALL, store_event)
        
        # 所有事件都应用到 state engine
        def apply_event(envelope: EventEnvelope):
            self.state_engine.apply(envelope)
        
        self.event_bus.subscribe(EventType.ALL, apply_event)
        
        # 特定事件处理
        self.event_bus.subscribe(EventType.TRADING_SIGNAL, self._handle_signal)
        self.event_bus.subscribe(EventType.ORDER_FILLED, self._handle_fill)
        self.event_bus.subscribe(EventType.BREAKER_TRIPPED, self._handle_breaker)
    
    def _handle_signal(self, envelope: EventEnvelope) -> None:
        """处理交易信号"""
        if self.mode == TradingMode.SHADOW:
            print(f"[Loop] SHADOW 模式：信号已记录，不执行")
            return
        
        if self.mode == TradingMode.PAPER:
            print(f"[Loop] PAPER 模式：信号发送到模拟执行")
        
        # 发送到风险检查
        if self.risk_engine:
            decision = self.risk_engine.check_order(envelope.payload)
            
            if not decision.approved:
                print(f"[Loop] 风险拒绝：{decision.reason}")
                return
        
        # 发送到执行引擎
        if self.execution_engine:
            self.execution_engine.handle_signal(envelope)
    
    def _handle_fill(self, envelope: EventEnvelope) -> None:
        """处理成交事件"""
        print(f"[Loop] 成交：{envelope.payload}")
        
        # 更新仓位
        # 更新 PnL
        # 发送通知到 Cockpit
    
    def _handle_breaker(self, envelope: EventEnvelope) -> None:
        """处理熔断事件"""
        print(f"[Loop] 熔断器触发：{envelope.payload}")
        
        # 通知 Cockpit
        # 暂停交易
    
    def set_mode(self, mode: TradingMode) -> None:
        """切换模式"""
        old_mode = self.mode
        self.mode = mode
        
        print(f"[Loop] 模式切换：{old_mode.value} → {mode.value}")
        
        # 发布模式切换事件
        self.event_bus.publish(EventEnvelope(
            event_type=EventType.TRADING_MODE_CHANGED,
            source=EventSource.SYSTEM,
            payload={
                "old_mode": old_mode.value,
                "new_mode": mode.value,
            }
        ))
    
    async def start(self) -> None:
        """启动循环"""
        if self.state == LoopState.RUNNING:
            return
        
        self.state = LoopState.RUNNING
        self._started_at = datetime.utcnow()
        
        print(f"[Loop] 启动于 {self._started_at.isoformat()}")
        
        # 启动市场数据循环
        if self.market_data_engine:
            task = asyncio.create_task(self._market_data_loop())
            self._tasks.append(task)
        
        # 启动策略循环
        if self.strategy_engine:
            task = asyncio.create_task(self._strategy_loop())
            self._tasks.append(task)
        
        # 等待任务完成
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
    
    async def stop(self) -> None:
        """停止循环"""
        self.state = LoopState.SHUTTING_DOWN
        
        print(f"[Loop] 停止中...")
        
        # 取消所有任务
        for task in self._tasks:
            task.cancel()
        
        # 等待任务完成
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        # 关闭事件存储
        if self.event_store:
            self.event_store.close()
        
        self.state = LoopState.STOPPED
        print(f"[Loop] 已停止")
    
    async def pause(self) -> None:
        """暂停循环"""
        self.state = LoopState.PAUSED
        print(f"[Loop] 已暂停")
    
    async def resume(self) -> None:
        """恢复循环"""
        if self.state == LoopState.PAUSED:
            self.state = LoopState.RUNNING
            print(f"[Loop] 已恢复")
    
    async def _market_data_loop(self) -> None:
        """市场数据循环"""
        while self.state == LoopState.RUNNING:
            try:
                if self.market_data_engine:
                    # 获取最新行情
                    tick = await self.market_data_engine.get_latest_tick()
                    
                    if tick:
                        # 发布行情事件
                        event = EventEnvelope(
                            event_type=EventType.MARKET_DATA,
                            source=EventSource.MARKET_DATA_ENGINE,
                            payload=tick,
                        )
                        self.event_bus.publish(event)
                        self._events_processed += 1
                        self._last_event_at = datetime.utcnow()
                
                await asyncio.sleep(0.1)  # 100ms
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Loop] 市场数据循环错误：{e}")
                await asyncio.sleep(1.0)
    
    async def _strategy_loop(self) -> None:
        """策略循环"""
        while self.state == LoopState.RUNNING:
            try:
                if self.strategy_engine:
                    # 获取最新信号
                    signal = await self.strategy_engine.generate_signal()
                    
                    if signal:
                        # 发布信号事件
                        event = EventEnvelope(
                            event_type=EventType.TRADING_SIGNAL,
                            source=EventSource.STRATEGY_ENGINE,
                            payload=signal,
                        )
                        self.event_bus.publish(event)
                        self._events_processed += 1
                        self._last_event_at = datetime.utcnow()
                
                await asyncio.sleep(1.0)  # 1s
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Loop] 策略循环错误：{e}")
                await asyncio.sleep(1.0)
    
    def publish(self, envelope: EventEnvelope) -> None:
        """发布事件"""
        self.event_bus.publish(envelope)
        self._events_processed += 1
        self._last_event_at = datetime.utcnow()
    
    def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None]
    ) -> None:
        """订阅事件"""
        self.event_bus.subscribe(event_type, handler)
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        uptime = None
        if self._started_at:
            end_time = datetime.utcnow() if self.state != LoopState.STOPPED else self._started_at
            uptime = (end_time - self._started_at).total_seconds()
        
        return {
            "state": self.state.value,
            "mode": self.mode.value,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "uptime_seconds": uptime,
            "events_processed": self._events_processed,
            "last_event_at": self._last_event_at.isoformat() if self._last_event_at else None,
            "active_tasks": len(self._tasks),
        }
    
    def summary(self) -> str:
        """获取摘要"""
        status = self.status()
        lines = [
            f"事件驱动循环状态：{status['state']}",
            f"模式：{status['mode']}",
            f"运行时长：{status['uptime_seconds']:.1f}s" if status['uptime_seconds'] else "未启动",
            f"处理事件：{status['events_processed']}",
            f"最后事件：{status['last_event_at']}" if status['last_event_at'] else "无事件",
        ]
        return "\n".join(lines)


# 使用示例
async def main():
    """示例：启动事件驱动循环"""
    loop = EventDrivenLoop(mode=TradingMode.PAPER)
    loop.initialize()
    
    print("=== 初始状态 ===")
    print(loop.summary())
    
    # 模拟发布事件
    loop.publish(EventEnvelope(
        event_type=EventType.MARKET_DATA,
        source=EventSource.MARKET_DATA_ENGINE,
        payload={"symbol": "ETH/USDT", "price": 2000.0},
    ))
    
    loop.publish(EventEnvelope(
        event_type=EventType.TRADING_SIGNAL,
        source=EventSource.STRATEGY_ENGINE,
        payload={"side": "buy", "size": 0.1},
    ))
    
    print("\n=== 发布事件后 ===")
    print(loop.summary())
    
    # 启动循环（模拟 5 秒）
    print("\n=== 启动循环 ===")
    
    async def run_for_5_seconds():
        await asyncio.sleep(5.0)
        await loop.stop()
    
    # 并行运行
    await asyncio.gather(
        loop.start(),
        run_for_5_seconds(),
    )
    
    print("\n=== 停止后 ===")
    print(loop.summary())


if __name__ == "__main__":
    asyncio.run(main())
