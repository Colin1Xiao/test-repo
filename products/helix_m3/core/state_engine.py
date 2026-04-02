"""
State Engine — 状态引擎

实现事件驱动的状态推进：
- Reducer 模式：Event → State
- Projector 模式：Event → Read Model
- Snapshot：定期保存状态快照
- Restore：从快照 + 事件流恢复

当前阶段：
- 实现内存状态引擎
- 支持 reducer/projector 注册
"""

from __future__ import annotations

from typing import Callable, Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from schemas.events import EventEnvelope, EventType


# 状态类型别名
State = Dict[str, Any]


# Reducer：Event + State → State
Reducer = Callable[[EventEnvelope, State], State]

# Projector：Event → Read Model Update
Projector = Callable[[EventEnvelope], None]


@dataclass
class Snapshot:
    """状态快照"""
    snapshot_id: str
    created_at: datetime
    state: State
    event_count: int
    last_event_id: Optional[str] = None


class InMemoryStateEngine:
    """内存状态引擎"""
    
    def __init__(self):
        self._state: State = {}
        self._reducers: Dict[EventType, List[Reducer]] = {}
        self._projectors: Dict[EventType, List[Projector]] = {}
        self._event_count = 0
        self._last_event_id: Optional[str] = None
        self._snapshots: List[Snapshot] = []
    
    def register_reducer(
        self,
        event_type: EventType,
        reducer: Reducer
    ) -> None:
        """注册 Reducer"""
        if event_type not in self._reducers:
            self._reducers[event_type] = []
        self._reducers[event_type].append(reducer)
    
    def register_projector(
        self,
        event_type: EventType,
        projector: Projector
    ) -> None:
        """注册 Projector"""
        if event_type not in self._projectors:
            self._projectors[event_type] = []
        self._projectors[event_type].append(projector)
    
    def apply(self, envelope: EventEnvelope) -> State:
        """应用事件到状态"""
        self._event_count += 1
        self._last_event_id = envelope.event_id
        
        # 应用 Reducers
        reducers = self._reducers.get(envelope.event_type, [])
        for reducer in reducers:
            try:
                self._state = reducer(envelope, self._state)
            except Exception as e:
                print(f"[StateEngine] Reducer 异常：{e}")
        
        # 应用 Projectors
        projectors = self._projectors.get(envelope.event_type, [])
        for projector in projectors:
            try:
                projector(envelope)
            except Exception as e:
                print(f"[StateEngine] Projector 异常：{e}")
        
        return self._state
    
    def get_state(self) -> State:
        """获取当前状态"""
        return self._state.copy()
    
    def get_value(self, key: str, default: Any = None) -> Any:
        """获取状态值"""
        return self._state.get(key, default)
    
    def set_value(self, key: str, value: Any) -> None:
        """设置状态值"""
        self._state[key] = value
    
    def create_snapshot(self, snapshot_id: Optional[str] = None) -> Snapshot:
        """创建快照"""
        if snapshot_id is None:
            snapshot_id = f"snapshot_{self._event_count}"
        
        snapshot = Snapshot(
            snapshot_id=snapshot_id,
            created_at=datetime.utcnow(),
            state=self._state.copy(),
            event_count=self._event_count,
            last_event_id=self._last_event_id,
        )
        
        self._snapshots.append(snapshot)
        return snapshot
    
    def restore_from_snapshot(self, snapshot: Snapshot) -> None:
        """从快照恢复"""
        self._state = snapshot.state.copy()
        self._event_count = snapshot.event_count
        self._last_event_id = snapshot.last_event_id
    
    def get_latest_snapshot(self) -> Optional[Snapshot]:
        """获取最新快照"""
        return self._snapshots[-1] if self._snapshots else None
    
    def clear(self) -> None:
        """清空状态"""
        self._state.clear()
        self._event_count = 0
        self._last_event_id = None
        self._snapshots.clear()
    
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "event_count": self._event_count,
            "last_event_id": self._last_event_id,
            "snapshot_count": len(self._snapshots),
            "state_keys": list(self._state.keys()),
        }


# 示例 Reducer
def position_reducer(event: EventEnvelope, state: State) -> State:
    """仓位状态 Reducer"""
    from schemas.events import EventType
    
    if event.event_type == EventType.ORDER_FILLED:
        payload = event.payload
        symbol = payload.get("symbol", "UNKNOWN")
        quantity = payload.get("fill_quantity", 0.0)
        side = payload.get("side", "buy")
        
        # 更新仓位
        current = state.get(f"position.{symbol}", 0.0)
        if side == "buy":
            state[f"position.{symbol}"] = current + quantity
        else:
            state[f"position.{symbol}"] = current - quantity
    
    return state


# 使用示例
if __name__ == "__main__":
    engine = InMemoryStateEngine()
    
    # 注册 Reducer
    engine.register_reducer(EventType.ORDER_FILLED, position_reducer)
    
    # 应用事件
    event1 = EventEnvelope(
        event_type=EventType.ORDER_FILLED,
        source="execution_engine",
        payload={
            "symbol": "ETH/USDT",
            "fill_quantity": 0.1,
            "side": "buy",
        },
    )
    
    engine.apply(event1)
    
    print(f"状态：{engine.get_state()}")
    print(f"统计：{engine.stats()}")
    
    # 创建快照
    snapshot = engine.create_snapshot()
    print(f"快照：{snapshot.snapshot_id}, 事件数：{snapshot.event_count}")
