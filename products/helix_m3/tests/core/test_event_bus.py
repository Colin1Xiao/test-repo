"""
Event Bus Tests — 事件总线测试

测试事件总线的核心功能：
- 发布/订阅
- 事件路由
- 处理器注册
- 异步处理
- 错误处理
"""

import unittest
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from unittest.mock import Mock, MagicMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from core.bus import EventBus, InMemoryEventBus, EventHandler


class TestEventEnvelope(unittest.TestCase):
    """测试事件信封"""
    
    def test_create_envelope(self):
        """创建事件信封"""
        envelope = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={"side": "buy", "size": 0.1},
        )
        
        self.assertEqual(envelope.event_type, EventType.TRADING_SIGNAL)
        self.assertEqual(envelope.source, EventSource.STRATEGY_ENGINE)
        self.assertIsNotNone(envelope.event_id)
        self.assertIsNotNone(envelope.timestamp)
    
    def test_correlation_id(self):
        """测试关联 ID"""
        envelope1 = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
            correlation_id="CORR-123",
        )
        
        envelope2 = EventEnvelope(
            event_type=EventType.ORDER_SUBMITTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={},
            correlation_id="CORR-123",
        )
        
        self.assertEqual(envelope1.correlation_id, envelope2.correlation_id)
    
    def test_causation_id(self):
        """测试因果 ID"""
        parent = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
        )
        
        child = EventEnvelope(
            event_type=EventType.ORDER_SUBMITTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={},
            causation_id=parent.event_id,
        )
        
        self.assertEqual(child.causation_id, parent.event_id)
    
    def test_to_dict(self):
        """测试序列化"""
        envelope = EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={"price": 2000.0},
        )
        
        data = envelope.to_dict()
        
        self.assertIn("event_id", data)
        self.assertIn("event_type", data)
        self.assertIn("source", data)
        self.assertIn("timestamp", data)
        self.assertIn("payload", data)
        self.assertEqual(data["payload"]["price"], 2000.0)
    
    def test_from_dict(self):
        """测试反序列化"""
        data = {
            "event_id": "EVT-123",
            "event_type": "market_data",
            "source": "market_data_engine",
            "timestamp": datetime.utcnow().isoformat(),
            "payload": {"price": 2000.0},
        }
        
        envelope = EventEnvelope.from_dict(data)
        
        self.assertEqual(envelope.event_id, "EVT-123")
        self.assertEqual(envelope.event_type, EventType.MARKET_DATA)
        self.assertEqual(envelope.source, EventSource.MARKET_DATA_ENGINE)
        self.assertEqual(envelope.payload["price"], 2000.0)


class TestInMemoryEventBus(unittest.TestCase):
    """测试内存事件总线"""
    
    def setUp(self):
        """设置测试环境"""
        self.bus = InMemoryEventBus()
    
    def test_publish_subscribe(self):
        """测试发布/订阅"""
        received = []
        
        def handler(envelope: EventEnvelope):
            received.append(envelope)
        
        self.bus.subscribe(EventType.MARKET_DATA, handler)
        
        envelope = EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={"price": 2000.0},
        )
        
        self.bus.publish(envelope)
        
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0].event_type, EventType.MARKET_DATA)
        self.assertEqual(received[0].payload["price"], 2000.0)
    
    def test_subscribe_multiple_handlers(self):
        """测试多个处理器"""
        received1 = []
        received2 = []
        
        def handler1(envelope: EventEnvelope):
            received1.append(envelope)
        
        def handler2(envelope: EventEnvelope):
            received2.append(envelope)
        
        self.bus.subscribe(EventType.TRADING_SIGNAL, handler1)
        self.bus.subscribe(EventType.TRADING_SIGNAL, handler2)
        
        envelope = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
        )
        
        self.bus.publish(envelope)
        
        self.assertEqual(len(received1), 1)
        self.assertEqual(len(received2), 1)
    
    def test_subscribe_wildcard(self):
        """测试通配符订阅"""
        received = []
        
        def handler(envelope: EventEnvelope):
            received.append(envelope)
        
        self.bus.subscribe(EventType.ALL, handler)
        
        self.bus.publish(EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={},
        ))
        
        self.bus.publish(EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
        ))
        
        self.assertEqual(len(received), 2)
    
    def test_unsubscribe(self):
        """测试取消订阅"""
        received = []
        
        def handler(envelope: EventEnvelope):
            received.append(envelope)
        
        self.bus.subscribe(EventType.MARKET_DATA, handler)
        self.bus.unsubscribe(EventType.MARKET_DATA, handler)
        
        envelope = EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={},
        )
        
        self.bus.publish(envelope)
        
        self.assertEqual(len(received), 0)
    
    def test_handler_error(self):
        """测试处理器错误处理"""
        def bad_handler(envelope: EventEnvelope):
            raise ValueError("Test error")
        
        def good_handler(envelope: EventEnvelope):
            pass
        
        self.bus.subscribe(EventType.MARKET_DATA, bad_handler)
        self.bus.subscribe(EventType.MARKET_DATA, good_handler)
        
        envelope = EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={},
        )
        
        # 不应抛出异常
        try:
            self.bus.publish(envelope)
        except Exception:
            self.fail("publish() raised exception unexpectedly")
    
    def test_publish_history(self):
        """测试发布历史"""
        self.bus.publish(EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={"price": 2000.0},
        ))
        
        self.bus.publish(EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
        ))
        
        history = self.bus.get_history(limit=10)
        
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].event_type, EventType.MARKET_DATA)
        self.assertEqual(history[1].event_type, EventType.TRADING_SIGNAL)
    
    def test_get_history_by_type(self):
        """测试按类型获取历史"""
        self.bus.publish(EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={},
        ))
        
        self.bus.publish(EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
        ))
        
        self.bus.publish(EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={},
        ))
        
        history = self.bus.get_history(event_type=EventType.MARKET_DATA)
        
        self.assertEqual(len(history), 2)
        for envelope in history:
            self.assertEqual(envelope.event_type, EventType.MARKET_DATA)
    
    def test_correlation_chain(self):
        """测试关联链"""
        parent = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={},
            correlation_id="CORR-123",
        )
        
        child1 = EventEnvelope(
            event_type=EventType.ORDER_SUBMITTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={},
            correlation_id="CORR-123",
            causation_id=parent.event_id,
        )
        
        child2 = EventEnvelope(
            event_type=EventType.ORDER_ACCEPTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={},
            correlation_id="CORR-123",
            causation_id=child1.event_id,
        )
        
        self.bus.publish(parent)
        self.bus.publish(child1)
        self.bus.publish(child2)
        
        chain = self.bus.get_correlation_chain("CORR-123")
        
        self.assertEqual(len(chain), 3)
    
    def test_handler_metadata(self):
        """测试处理器元数据"""
        def handler(envelope: EventEnvelope):
            pass
        
        self.bus.subscribe(EventType.MARKET_DATA, handler, handler_id="test-handler")
        
        handlers = self.bus.get_handlers(EventType.MARKET_DATA)
        
        self.assertEqual(len(handlers), 1)
        self.assertEqual(handlers[0]["handler_id"], "test-handler")
        self.assertEqual(handlers[0]["event_type"], EventType.MARKET_DATA.value)


class TestEventHandler(unittest.TestCase):
    """测试事件处理器"""
    
    def test_handler_decorator(self):
        """测试处理器装饰器"""
        @EventHandler(EventType.MARKET_DATA)
        def my_handler(envelope: EventEnvelope):
            return envelope.payload
        
        self.assertEqual(my_handler._event_type, EventType.MARKET_DATA)
    
    def test_handler_registration(self):
        """测试处理器注册"""
        bus = InMemoryEventBus()
        
        @EventHandler(EventType.TRADING_SIGNAL)
        def signal_handler(envelope: EventEnvelope):
            pass
        
        bus.register_handler(signal_handler)
        
        handlers = bus.get_handlers(EventType.TRADING_SIGNAL)
        self.assertEqual(len(handlers), 1)


class TestEventBusIntegration(unittest.TestCase):
    """集成测试"""
    
    def test_full_lifecycle(self):
        """测试完整生命周期"""
        bus = InMemoryEventBus()
        
        # 订阅
        events = []
        bus.subscribe(EventType.ALL, lambda e: events.append(e))
        
        # 发布信号
        signal = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={"side": "buy", "size": 0.1},
            correlation_id="TRADE-001",
        )
        bus.publish(signal)
        
        # 发布订单提交
        order = EventEnvelope(
            event_type=EventType.ORDER_SUBMITTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={"order_id": "ORD-001"},
            correlation_id="TRADE-001",
            causation_id=signal.event_id,
        )
        bus.publish(order)
        
        # 发布订单接受
        accepted = EventEnvelope(
            event_type=EventType.ORDER_ACCEPTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={"order_id": "ORD-001", "venue_id": "V-123"},
            correlation_id="TRADE-001",
            causation_id=order.event_id,
        )
        bus.publish(accepted)
        
        # 验证
        self.assertEqual(len(events), 3)
        
        chain = bus.get_correlation_chain("TRADE-001")
        self.assertEqual(len(chain), 3)
        
        history = bus.get_history(limit=10)
        self.assertEqual(len(history), 3)


if __name__ == "__main__":
    unittest.main()
