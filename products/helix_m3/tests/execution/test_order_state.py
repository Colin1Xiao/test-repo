"""
Order State Tests — 订单状态机测试

测试订单状态机的核心功能：
- 状态转换
- 执行统计
- 事件发布
- 边界情况
"""

import unittest
from datetime import datetime
from pathlib import Path
from typing import List
from unittest.mock import Mock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from decimal import Decimal
from schemas.order import Order
from schemas.enums import Side as OrderSide, OrderType, OrderStatus
from schemas.events import EventEnvelope, EventType
from execution.order_state import OrderStateMachine, OrderStateManager, OrderEvent


class TestOrderStateMachine(unittest.TestCase):
    """测试订单状态机"""
    
    def setUp(self):
        """设置测试环境"""
        self.order = Order(
            order_id="ORD-TEST-001",
            venue="okx",
            venue="okx", symbol="ETH/USDT",
            side=OrderSide.BUY,
            order_order_type=OrderType.LIMIT,
            qty=Decimal("0.1"),
            price=Decimal("2000.0"),
        )
        self.fsm = OrderStateMachine(self.order)
    
    def test_initial_state(self):
        """测试初始状态"""
        self.assertEqual(self.fsm.state.current_status, OrderStatus.PENDING)
        self.assertEqual(self.fsm.state.filled_quantity, 0.0)
        self.assertEqual(self.fsm.state.remaining_quantity, 0.1)
        self.assertFalse(self.fsm.is_terminal())
    
    def test_submit(self):
        """测试提交订单"""
        result = self.fsm.submit()
        
        self.assertTrue(result)
        self.assertEqual(len(self.fsm.state.events), 1)
        self.assertEqual(self.fsm.state.events[0]["event"], "submitted")
    
    def test_submit_twice(self):
        """测试重复提交"""
        self.fsm.submit()
        result = self.fsm.submit()
        
        self.assertFalse(result)  # 不应允许重复提交
    
    def test_accept(self):
        """测试接受订单"""
        self.fsm.submit()
        result = self.fsm.accept("VENUE-123")
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.ACCEPTED)
        self.assertEqual(self.fsm.state.venue_order_id, "VENUE-123")
    
    def test_accept_without_submit(self):
        """测试未提交直接接受"""
        result = self.fsm.accept("VENUE-123")
        
        self.assertTrue(result)  # 允许跳过 submit
        self.assertEqual(self.fsm.state.current_status, OrderStatus.ACCEPTED)
    
    def test_reject(self):
        """测试拒绝订单"""
        self.fsm.submit()
        result = self.fsm.reject("insufficient_margin")
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.REJECTED)
        self.assertEqual(self.fsm.state.reject_reason, "insufficient_margin")
        self.assertTrue(self.fsm.is_terminal())
    
    def test_partial_fill(self):
        """测试部分成交"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        
        result = self.fsm.partial_fill(0.05, 2000.5, 0.01)
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.PARTIALLY_FILLED)
        self.assertEqual(self.fsm.state.filled_quantity, 0.05)
        self.assertEqual(self.fsm.state.remaining_quantity, 0.05)
        self.assertEqual(self.fsm.state.average_fill_price, 2000.5)
        self.assertEqual(self.fsm.state.total_fees, 0.01)
    
    def test_multiple_partial_fills(self):
        """测试多次部分成交"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        
        # 第一次部分成交
        self.fsm.partial_fill(Decimal("0.03"), Decimal("2000.0"), Decimal("0.006"))
        self.assertEqual(self.fsm.state.filled_quantity, 0.03)
        self.assertEqual(self.fsm.state.average_fill_price, 2000.0)
        
        # 第二次部分成交
        self.fsm.partial_fill(Decimal("0.02"), Decimal("2001.0"), Decimal("0.004"))
        self.assertEqual(self.fsm.state.filled_quantity, 0.05)
        # 平均价 = (0.03*2000 + 0.02*2001) / 0.05 = 2000.4
        self.assertAlmostEqual(self.fsm.state.average_fill_price, 2000.4, places=2)
        self.assertEqual(self.fsm.state.total_fees, 0.01)
    
    def test_fill(self):
        """测试完全成交"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        
        result = self.fsm.fill(0.1, 2000.5, 0.02)
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.FILLED)
        self.assertEqual(self.fsm.state.filled_quantity, 0.1)
        self.assertEqual(self.fsm.state.remaining_quantity, 0.0)
        self.assertTrue(self.fsm.is_terminal())
    
    def test_fill_after_partial(self):
        """测试部分成交后完全成交"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.partial_fill(Decimal("0.05"), Decimal("2000.0"), Decimal("0.01"))
        
        result = self.fsm.fill(0.05, 2000.5, 0.01)
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.FILLED)
        self.assertEqual(self.fsm.state.filled_quantity, 0.1)
    
    def test_cancel(self):
        """测试取消订单"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        
        result = self.fsm.cancel("user_requested")
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.CANCELLED)
        self.assertEqual(self.fsm.state.cancel_reason, "user_requested")
        self.assertTrue(self.fsm.is_terminal())
    
    def test_cancel_after_partial_fill(self):
        """测试部分成交后取消"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.partial_fill(Decimal("0.05"), Decimal("2000.0"), Decimal("0.01"))
        
        result = self.fsm.cancel("user_requested")
        
        self.assertTrue(result)
        self.assertEqual(self.fsm.state.current_status, OrderStatus.CANCELLED)
        self.assertEqual(self.fsm.state.filled_quantity, 0.05)
    
    def test_cannot_fill_after_cancel(self):
        """测试取消后不能成交"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.cancel("user_requested")
        
        result = self.fsm.fill(Decimal("0.1"), Decimal("2000.0"), Decimal("0.02"))
        
        self.assertFalse(result)
    
    def test_cannot_cancel_after_fill(self):
        """测试成交后不能取消"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.fill(Decimal("0.1"), Decimal("2000.0"), Decimal("0.02"))
        
        result = self.fsm.cancel("user_requested")
        
        self.assertFalse(result)
    
    def test_event_callback(self):
        """测试事件回调"""
        events = []
        
        def callback(envelope: EventEnvelope):
            events.append(envelope)
        
        self.fsm.set_event_callback(callback)
        
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.partial_fill(Decimal("0.05"), Decimal("2000.0"), Decimal("0.01"))
        self.fsm.fill(0.05, 2000.5, 0.01)
        
        self.assertEqual(len(events), 4)
        self.assertEqual(events[0].event_type, EventType.ORDER_SUBMITTED)
        self.assertEqual(events[1].event_type, EventType.ORDER_ACCEPTED)
        self.assertEqual(events[2].event_type, EventType.ORDER_FILLED)
        self.assertEqual(events[3].event_type, EventType.ORDER_FILLED)
    
    def test_to_dict(self):
        """测试序列化"""
        self.fsm.submit()
        self.fsm.accept("VENUE-123")
        self.fsm.partial_fill(Decimal("0.05"), Decimal("2000.0"), Decimal("0.01"))
        
        data = self.fsm.state.to_dict()
        
        self.assertIn("order_id", data)
        self.assertIn("current_status", data)
        self.assertEqual(data["current_status"], "accepted")  # PARTIALLY_FILLED 也是 accepted 的子状态
        self.assertEqual(data["filled_quantity"], 0.05)
        self.assertEqual(data["event_count"], 3)


class TestOrderStateManager(unittest.TestCase):
    """测试订单状态管理器"""
    
    def setUp(self):
        """设置测试环境"""
        self.manager = OrderStateManager()
    
    def test_create_order(self):
        """测试创建订单"""
        order = Order(
            order_id="ORD-001",
            venue="okx", symbol="ETH/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            qty=Decimal("0.1"),
            price=Decimal("2000.0"),
        )
        
        fsm = self.manager.create_order(order)
        
        self.assertIsNotNone(fsm)
        self.assertEqual(fsm.state.order.order_id, "ORD-001")
    
    def test_create_duplicate_order(self):
        """测试创建重复订单"""
        order = Order(
            order_id="ORD-001",
            venue="okx", symbol="ETH/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            qty=Decimal("0.1"),
            price=Decimal("2000.0"),
        )
        
        self.manager.create_order(order)
        
        with self.assertRaises(ValueError):
            self.manager.create_order(order)
    
    def test_get_order(self):
        """测试获取订单"""
        order = Order(
            order_id="ORD-001",
            venue="okx", symbol="ETH/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            qty=Decimal("0.1"),
            price=Decimal("2000.0"),
        )
        
        self.manager.create_order(order)
        
        fsm = self.manager.get_order("ORD-001")
        
        self.assertIsNotNone(fsm)
        self.assertEqual(fsm.state.order.order_id, "ORD-001")
    
    def test_get_nonexistent_order(self):
        """测试获取不存在的订单"""
        fsm = self.manager.get_order("ORD-NONEXISTENT")
        
        self.assertIsNone(fsm)
    
    def test_get_active_orders(self):
        """测试获取活跃订单"""
        order1 = Order(order_id="ORD-001", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
        order2 = Order(order_id="ORD-002", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
        order3 = Order(order_id="ORD-003", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
        
        fsm1 = self.manager.create_order(order1)
        fsm2 = self.manager.create_order(order2)
        fsm3 = self.manager.create_order(order3)
        
        # ORD-001 成交
        fsm1.accept("V-001")
        fsm1.fill(0.1, 2000.0, 0.02)
        
        # ORD-002 取消
        fsm2.accept("V-002")
        fsm2.cancel("user_requested")
        
        # ORD-003 仍活跃
        fsm3.accept("V-003")
        
        active = self.manager.get_active_orders()
        
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].state.order.order_id, "ORD-003")
    
    def test_get_terminal_orders(self):
        """测试获取终态订单"""
        order1 = Order(order_id="ORD-001", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
        order2 = Order(order_id="ORD-002", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
        
        fsm1 = self.manager.create_order(order1)
        fsm2 = self.manager.create_order(order2)
        
        fsm1.fill(0.1, 2000.0, 0.02)
        fsm2.reject("insufficient_margin")
        
        terminal = self.manager.get_terminal_orders()
        
        self.assertEqual(len(terminal), 2)
    
    def test_summary(self):
        """测试汇总统计"""
        for i in range(5):
            order = Order(order_id=f"ORD-{i:03d}", venue="okx", symbol="ETH/USDT", side=OrderSide.BUY, order_type=OrderType.LIMIT, qty=Decimal("0.1"), price=Decimal("2000.0"))
            fsm = self.manager.create_order(order)
            
            if i < 2:
                fsm.fill(Decimal("0.1"), Decimal("2000.0"), Decimal("0.02"))
            elif i < 4:
                fsm.accept(f"V-{i}")
                fsm.cancel("user_requested")
            else:
                fsm.reject("insufficient_margin")
        
        summary = self.manager.summary()
        
        self.assertEqual(summary["total_orders"], 5)
        self.assertEqual(summary["active_orders"], 2)  # ORD-002 和 ORD-003 仍活跃
        self.assertEqual(summary["terminal_orders"], 3)
        self.assertEqual(summary["filled"], 2)
        self.assertEqual(summary["cancelled"], 2)
        self.assertEqual(summary["rejected"], 1)


if __name__ == "__main__":
    unittest.main()
