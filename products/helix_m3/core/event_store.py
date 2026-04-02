"""
Event Store — 事件存储

实现事件的持久化存储：
- Append-only 日志
- JSONL 格式（便于人类阅读和流式处理）
- 支持按 correlation_id 查询
- 支持事件回放

当前阶段：
- 实现 JSONL 文件存储
- 支持追加和读取
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import List, Optional, Iterator, Dict, Any
from datetime import datetime

from schemas.events import EventEnvelope, EventType


class JsonlEventStore:
    """JSONL 事件存储"""
    
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self._lock = threading.Lock()
        
        # 确保目录存在
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
    
    def append(self, envelope: EventEnvelope) -> None:
        """追加事件"""
        with self._lock:
            with open(self.file_path, 'a', encoding='utf-8') as f:
                data = envelope.to_dict()
                line = json.dumps(data, ensure_ascii=False, default=str)
                f.write(line + '\n')
    
    def append_batch(self, envelopes: List[EventEnvelope]) -> None:
        """批量追加事件"""
        with self._lock:
            with open(self.file_path, 'a', encoding='utf-8') as f:
                for envelope in envelopes:
                    data = envelope.to_dict()
                    line = json.dumps(data, ensure_ascii=False, default=str)
                    f.write(line + '\n')
    
    def iter_events(self) -> Iterator[EventEnvelope]:
        """迭代所有事件"""
        if not self.file_path.exists():
            return
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                
                try:
                    data = json.loads(line)
                    yield EventEnvelope.from_dict(data)
                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"[EventStore] 跳过损坏的事件：{e}")
                    continue
    
    def iter_events_by_type(self, event_type: EventType) -> Iterator[EventEnvelope]:
        """按类型迭代事件"""
        for envelope in self.iter_events():
            if envelope.event_type == event_type:
                yield envelope
    
    def iter_events_by_correlation(self, correlation_id: str) -> Iterator[EventEnvelope]:
        """按关联 ID 迭代事件"""
        for envelope in self.iter_events():
            if envelope.correlation_id == correlation_id:
                yield envelope
    
    def get_events(
        self,
        limit: int = 100,
        offset: int = 0
    ) -> List[EventEnvelope]:
        """获取事件列表"""
        events = []
        for i, envelope in enumerate(self.iter_events()):
            if i < offset:
                continue
            if len(events) >= limit:
                break
            events.append(envelope)
        return events
    
    def get_events_by_type(
        self,
        event_type: EventType,
        limit: int = 100
    ) -> List[EventEnvelope]:
        """按类型获取事件"""
        events = []
        for envelope in self.iter_events_by_type(event_type):
            if len(events) >= limit:
                break
            events.append(envelope)
        return events
    
    def get_events_by_correlation(
        self,
        correlation_id: str,
        limit: int = 100
    ) -> List[EventEnvelope]:
        """按关联 ID 获取事件"""
        events = []
        for envelope in self.iter_events_by_correlation(correlation_id):
            if len(events) >= limit:
                break
            events.append(envelope)
        return events
    
    def count(self) -> int:
        """统计事件数"""
        count = 0
        for _ in self.iter_events():
            count += 1
        return count
    
    def get_last_event(self) -> Optional[EventEnvelope]:
        """获取最后一个事件"""
        last = None
        for envelope in self.iter_events():
            last = envelope
        return last
    
    def truncate(self, max_events: int) -> int:
        """截断日志，保留最后 N 个事件"""
        events = self.get_events(limit=max_events * 2)
        
        if len(events) <= max_events:
            return 0
        
        # 保留最后 max_events 个
        to_keep = events[-max_events:]
        
        with self._lock:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                for envelope in to_keep:
                    data = envelope.to_dict()
                    line = json.dumps(data, ensure_ascii=False, default=str)
                    f.write(line + '\n')
        
        return len(events) - max_events
    
    def clear(self) -> None:
        """清空存储"""
        with self._lock:
            if self.file_path.exists():
                self.file_path.unlink()
    
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        last_event = self.get_last_event()
        return {
            "event_count": self.count(),
            "file_path": str(self.file_path),
            "file_size_bytes": self.file_path.stat().st_size if self.file_path.exists() else 0,
            "last_event_id": last_event.event_id if last_event else None,
            "last_event_type": last_event.event_type.value if last_event else None,
            "last_event_time": last_event.timestamp.isoformat() if last_event else None,
        }
    
    def close(self) -> None:
        """关闭存储（清理资源）"""
        pass  # JSONL 文件不需要特殊关闭


# 使用示例
if __name__ == "__main__":
    store = JsonlEventStore(Path("/tmp/test_events.jsonl"))
    
    # 追加事件
    event1 = EventEnvelope(
        event_type=EventType.MARKET_DATA,
        source="market_data_engine",
        payload={"price": 2000.0},
        correlation_id="CORR-001",
    )
    
    event2 = EventEnvelope(
        event_type=EventType.TRADING_SIGNAL,
        source="strategy_engine",
        payload={"side": "buy"},
        correlation_id="CORR-001",
        causation_id=event1.event_id,
    )
    
    store.append(event1)
    store.append(event2)
    
    # 读取事件
    print(f"事件总数：{store.count()}")
    
    # 按关联 ID 读取
    chain = store.get_events_by_correlation("CORR-001")
    print(f"关联链：{len(chain)} 个事件")
    
    # 统计
    print(f"统计：{store.stats()}")
    
    # 清理
    store.clear()
