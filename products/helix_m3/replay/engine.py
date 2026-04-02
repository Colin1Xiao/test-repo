"""
Replay Engine — 事件日志回放引擎

从 event log 中读取历史事件，按时间顺序重放，
支持 deterministic replay 用于测试、审计、场景演练。

设计原则：
- 只读：不修改原始 event log
- 可暂停/恢复：支持断点调试
- 可变速：支持加速回放（跳过等待时间）
- 可过滤：支持按 event_type / correlation_id 过滤
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional, Iterator, Any
from dataclasses import dataclass, field

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType


@dataclass
class ReplayConfig:
    """回放配置"""
    speed_multiplier: float = 1.0  # 1.0 = 实时，10.0 = 10 倍速，0 = 最快速度
    filter_types: Optional[List[EventType]] = None  # 按事件类型过滤
    filter_correlation_ids: Optional[List[str]] = None  # 按 correlation_id 过滤
    start_time: Optional[datetime] = None  # 起始时间
    end_time: Optional[datetime] = None  # 结束时间
    pause_on_event: Optional[EventType] = None  # 遇到特定事件类型暂停


@dataclass
class ReplayState:
    """回放状态"""
    is_playing: bool = False
    is_paused: bool = False
    current_index: int = 0
    total_events: int = 0
    events_processed: int = 0
    start_time: Optional[datetime] = None
    last_event_time: Optional[datetime] = None


class JsonlEventLogReader:
    """JSONL 事件日志读取器"""
    
    def __init__(self, log_path: Path):
        self.log_path = log_path
    
    def count_events(self) -> int:
        """统计事件总数"""
        if not self.log_path.exists():
            return 0
        
        count = 0
        with open(self.log_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    count += 1
        return count
    
    def iter_events(self) -> Iterator[EventEnvelope]:
        """迭代所有事件"""
        if not self.log_path.exists():
            return
        
        with open(self.log_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                
                try:
                    data = json.loads(line)
                    yield EventEnvelope.from_dict(data)
                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    # 跳过损坏的事件
                    print(f"[Replay] 跳过损坏的事件：{e}")
                    continue
    
    def iter_events_filtered(
        self,
        config: ReplayConfig
    ) -> Iterator[EventEnvelope]:
        """按配置过滤后迭代事件"""
        for event in self.iter_events():
            # 时间过滤
            if config.start_time and event.timestamp < config.start_time:
                continue
            if config.end_time and event.timestamp > config.end_time:
                continue
            
            # 类型过滤
            if config.filter_types and event.event_type not in config.filter_types:
                continue
            
            # correlation_id 过滤
            if (config.filter_correlation_ids and 
                event.correlation_id not in config.filter_correlation_ids):
                continue
            
            yield event


class ReplayEngine:
    """回放引擎"""
    
    def __init__(
        self,
        event_log_path: Path,
        config: Optional[ReplayConfig] = None
    ):
        self.event_log_path = event_log_path
        self.config = config or ReplayConfig()
        self.reader = JsonlEventLogReader(event_log_path)
        self.state = ReplayState()
        
        # 事件处理器
        self._handlers: Dict[EventType, List[Callable]] = {}
        
        # 暂停回调
        self._on_pause: Optional[Callable] = None
        self._on_resume: Optional[Callable] = None
        self._on_complete: Optional[Callable] = None
    
    def register_handler(
        self,
        event_type: EventType,
        handler: Callable[[EventEnvelope], None]
    ) -> None:
        """注册事件处理器"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def set_pause_callback(self, callback: Callable) -> None:
        """设置暂停回调"""
        self._on_pause = callback
    
    def set_resume_callback(self, callback: Callable) -> None:
        """设置恢复回调"""
        self._on_resume = callback
    
    def set_complete_callback(self, callback: Callable) -> None:
        """设置完成回调"""
        self._on_complete = callback
    
    def play(self) -> ReplayState:
        """开始回放"""
        self.state = ReplayState(
            is_playing=True,
            is_paused=False,
            total_events=self.reader.count_events()
        )
        
        last_event_timestamp: Optional[datetime] = None
        
        for event in self.reader.iter_events_filtered(self.config):
            if not self.state.is_playing:
                break
            
            if self.state.is_paused:
                # 等待恢复
                while self.state.is_paused:
                    time.sleep(0.1)
            
            # 计算延迟（模拟真实时间间隔）
            if last_event_timestamp and self.config.speed_multiplier > 0:
                time_diff = (event.timestamp - last_event_timestamp).total_seconds()
                delay = time_diff / self.config.speed_multiplier
                if delay > 0:
                    time.sleep(delay)
            
            # 处理事件
            self._process_event(event)
            
            # 更新状态
            self.state.events_processed += 1
            self.state.last_event_time = event.timestamp
            last_event_timestamp = event.timestamp
            
            # 检查是否需要暂停
            if self.config.pause_on_event == event.event_type:
                self.pause()
                if self._on_pause:
                    self._on_pause(event)
        
        self.state.is_playing = False
        
        if self._on_complete:
            self._on_complete(self.state)
        
        return self.state
    
    def play_sync(self) -> ReplayState:
        """同步回放（最快速度，无延迟）"""
        self.config.speed_multiplier = 0
        return self.play()
    
    def pause(self) -> None:
        """暂停回放"""
        self.state.is_paused = True
    
    def resume(self) -> None:
        """恢复回放"""
        self.state.is_paused = False
        if self._on_resume:
            self._on_resume()
    
    def stop(self) -> None:
        """停止回放"""
        self.state.is_playing = False
        self.state.is_paused = False
    
    def _process_event(self, event: EventEnvelope) -> None:
        """处理单个事件"""
        handlers = self._handlers.get(event.event_type, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                print(f"[Replay] 事件处理失败：{e}, event={event.event_id}")


class ScenarioReplay:
    """场景回放（用于测试特定场景）"""
    
    def __init__(self, replay_engine: ReplayEngine):
        self.replay = replay_engine
    
    def replay_until_event(
        self,
        event_type: EventType,
        max_events: int = 1000
    ) -> Optional[EventEnvelope]:
        """回放到指定事件类型"""
        target_found = None
        
        def handler(event: EventEnvelope):
            nonlocal target_found
            target_found = event
            self.replay.pause()
        
        self.replay.register_handler(event_type, handler)
        
        self.replay.config.pause_on_event = event_type
        self.replay.play()
        
        return target_found
    
    def replay_correlation_chain(
        self,
        correlation_id: str
    ) -> List[EventEnvelope]:
        """回放整个 correlation chain"""
        self.replay.config.filter_correlation_ids = [correlation_id]
        self.replay.config.speed_multiplier = 0  # 最快速度
        
        events = []
        
        def collect_all(event: EventEnvelope):
            events.append(event)
        
        # 注册所有事件类型的处理器
        for event_type in EventType:
            self.replay.register_handler(event_type, collect_all)
        
        self.replay.play()
        return events


# 使用示例
if __name__ == "__main__":
    # 示例：回放 event log 并统计事件
    log_path = Path(__file__).parent.parent / "storage" / "events.jsonl"
    
    config = ReplayConfig(
        speed_multiplier=10.0,  # 10 倍速
    )
    
    engine = ReplayEngine(log_path, config)
    
    # 统计事件类型
    event_counts: Dict[str, int] = {}
    
    def count_event(event: EventEnvelope):
        key = event.event_type.value
        event_counts[key] = event_counts.get(key, 0) + 1
    
    for event_type in EventType:
        engine.register_handler(event_type, count_event)
    
    print(f"[Replay] 开始回放：{log_path}")
    state = engine.play()
    print(f"[Replay] 完成：处理 {state.events_processed}/{state.total_events} 个事件")
    print(f"[Replay] 事件统计：{event_counts}")
