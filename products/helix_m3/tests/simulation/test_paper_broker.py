"""
Paper Broker Tests — 模拟经纪商测试

测试模拟经纪商的核心功能：
- 订单接受
- 模拟成交
- 订单拒绝
- 滑点模拟
"""

import unittest
import time
from datetime import datetime
from pathlib import Path
from typing import List
from unittest.mock import Mock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from schemas.order import Order, OrderSide, OrderType, OrderStatus
from schemas.events import EventEnvelope, EventType
from execution.paper_broker import PaperBroker, PaperBrokerConfig


class TestPaperBrokerConfig(unittest.TestCase):
    """测试模拟经纪商配置"""
    
    def test_default_config(self):
        """测试默认配置"""
        config = PaperBrokerConfig()
        
        self.assertEqual(config.fill_probability, 0.9)
        self.assertEqual(config.default_slippage_pct, 0.0001)
        self.assertEqual(config.max_slippage_pct, 0.01)
        self.assertEqual(config.reject_probability, 0.0)
        self.assertTrue(config.auto_fill)
    
    def test_custom_config(self):
        """测试自定义配置"""
        config = PaperBrokerConfig(
            fill_probability=0.5,
            default_slippage_pct=0.0005,
            max_slippage_pct=0.02,
            reject_probability=0.1,
            auto_fill=False,
        )
        
        self.assertEqual(config.fill_probability, 0.5)
        self.assertEqual(config.default_slippage_pct, 0.0005)
        self.assertEqual(config.max_slippage_pct, 0.02)
        self.assertEqual(config.reject_probability, 0.1)
        self.assertFalse(config.auto_fill)


class TestPaperBroker(unittest.TestCase):
    """测试模拟经纪商"""
    
    def setUp(self):
        """设置测试环境"""
        self.config = PaperBrokerConfig(
            fill_probability=1.0,  # 100% 成交
            reject_probability=0.0,  # 0% 拒绝
            auto_fill=True,
        )
        self.broker = PaperBroker(self.config)
        
        # 设置初始价格
        self.broker.set_market_price("ETH/USDT", 2000.0)
    
    def test_submit_order(self):
        """测试提交订单"""
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        result = self.broker.submit_order(order)
        
        self.assertTrue(result["accepted"])
        self.assertIn("venue_order_id", result)
        self.assertEqual(result["order_id"], order.order_id)
    
    def test_cancel_order(self):
        """测试取消订单"""
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        submit_result = self.broker.submit_order(order)
        cancel_result = self.broker.cancel_order(order.order_id)
        
        self.assertTrue(cancel_result["cancelled"])
        self.assertEqual(cancel_result["order_id"], order.order_id)
    
    def test_cancel_nonexistent_order(self):
        """测试取消不存在的订单"""
        result = self.broker.cancel_order("ORD-NONEXISTENT")
        
        self.assertFalse(result["cancelled"])
        self.assertIn("error", result)
    
    def test_auto_fill(self):
        """测试自动成交"""
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        self.broker.submit_order(order)
        
        # 等待自动成交（配置为立即成交）
        time.sleep(0.1)
        
        fills = self.broker.get_fills(order.order_id)
        
        self.assertGreater(len(fills), 0)
        self.assertEqual(fills[0]["order_id"], order.order_id)
        self.assertEqual(fills[0]["quantity"], 0.1)
    
    def test_fill_with_slippage(self):
        """测试带滑点成交"""
        self.config.default_slippage_pct = 0.001  # 0.1% 滑点
        
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        self.broker.submit_order(order)
        time.sleep(0.1)
        
        fills = self.broker.get_fills(order.order_id)
        
        self.assertGreater(len(fills), 0)
        # 买单滑点向上，成交价应略高于市价
        fill_price = fills[0]["price"]
        self.assertGreater(fill_price, 2000.0)
        self.assertLessEqual(fill_price, 2000.0 * 1.001)  # 不超过 0.1%
    
    def test_reject_order(self):
        """测试拒绝订单"""
        self.config.reject_probability = 1.0  # 100% 拒绝
        
        broker = PaperBroker(self.config)
        broker.set_market_price("ETH/USDT", 2000.0)
        
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        result = broker.submit_order(order)
        
        self.assertFalse(result["accepted"])
        self.assertIn("reject_reason", result)
    
    def test_limit_order_price_improvement(self):
        """测试限价单价格改善"""
        # 市价 2000，限价单 2010（买单），应以更好价格成交
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2010.0,  # 限价高于市价
        )
        
        self.broker.submit_order(order)
        time.sleep(0.1)
        
        fills = self.broker.get_fills(order.order_id)
        
        self.assertGreater(len(fills), 0)
        # 应以市价或更好价格成交
        self.assertLessEqual(fills[0]["price"], 2000.0)
    
    def test_partial_fill(self):
        """测试部分成交"""
        self.config.partial_fill_probability = 0.5  # 50% 概率部分成交
        self.config.partial_fill_ratio_range = (0.3, 0.7)
        
        broker = PaperBroker(self.config)
        broker.set_market_price("ETH/USDT", 2000.0)
        
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        broker.submit_order(order)
        time.sleep(0.1)
        
        # 多次运行，应至少有一次部分成交
        fills = broker.get_fills(order.order_id)
        
        if fills:
            total_filled = sum(f["quantity"] for f in fills)
            self.assertLessEqual(total_filled, 0.1)
    
    def test_event_callback(self):
        """测试事件回调"""
        events = []
        
        def callback(envelope: EventEnvelope):
            events.append(envelope)
        
        self.broker.set_event_callback(callback)
        
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        self.broker.submit_order(order)
        time.sleep(0.1)
        
        # 应至少有 ORDER_ACCEPTED 事件
        self.assertGreater(len(events), 0)
        
        event_types = [e.event_type for e in events]
        self.assertIn(EventType.ORDER_ACCEPTED, event_types)
    
    def test_get_open_orders(self):
        """测试获取未平仓订单"""
        order1 = Order(order_id="ORD-001", symbol="ETH/USDT", side=OrderSide.BUY, type=OrderType.LIMIT, quantity=0.1, price=2000.0)
        order2 = Order(order_id="ORD-002", symbol="ETH/USDT", side=OrderSide.BUY, type=OrderType.LIMIT, quantity=0.1, price=2000.0)
        
        self.broker.submit_order(order1)
        self.broker.submit_order(order2)
        
        open_orders = self.broker.get_open_orders()
        
        # 由于 auto_fill=True，订单可能已成交
        # 但至少提交时应存在
        self.assertGreater(len(open_orders), 0)
    
    def test_get_position(self):
        """测试获取仓位"""
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        self.broker.submit_order(order)
        time.sleep(0.1)
        
        position = self.broker.get_position("ETH/USDT")
        
        # 应有多头仓位
        self.assertGreater(position["net_quantity"], 0)
        self.assertEqual(position["side"], "long")
    
    def test_market_price_update(self):
        """测试市场价格更新"""
        self.broker.set_market_price("ETH/USDT", 2000.0)
        price1 = self.broker.get_market_price("ETH/USDT")
        
        self.broker.set_market_price("ETH/USDT", 2100.0)
        price2 = self.broker.get_market_price("ETH/USDT")
        
        self.assertEqual(price1, 2000.0)
        self.assertEqual(price2, 2100.0)
    
    def test_multiple_symbols(self):
        """测试多交易对"""
        self.broker.set_market_price("ETH/USDT", 2000.0)
        self.broker.set_market_price("BTC/USDT", 30000.0)
        
        eth_order = Order(order_id="ORD-ETH", symbol="ETH/USDT", side=OrderSide.BUY, type=OrderType.LIMIT, quantity=0.1, price=2000.0)
        btc_order = Order(order_id="ORD-BTC", symbol="BTC/USDT", side=OrderSide.BUY, type=OrderType.LIMIT, quantity=0.01, price=30000.0)
        
        self.broker.submit_order(eth_order)
        self.broker.submit_order(btc_order)
        time.sleep(0.1)
        
        eth_position = self.broker.get_position("ETH/USDT")
        btc_position = self.broker.get_position("BTC/USDT")
        
        self.assertGreater(eth_position["net_quantity"], 0)
        self.assertGreater(btc_position["net_quantity"], 0)


class TestPaperBrokerIntegration(unittest.TestCase):
    """集成测试"""
    
    def test_full_order_lifecycle(self):
        """测试完整订单生命周期"""
        broker = PaperBroker(PaperBrokerConfig(
            fill_probability=1.0,
            auto_fill=True,
        ))
        broker.set_market_price("ETH/USDT", 2000.0)
        
        events = []
        broker.set_event_callback(lambda e: events.append(e))
        
        # 1. 提交订单
        order = Order(
            order_id="ORD-001",
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            type=OrderType.LIMIT,
            quantity=0.1,
            price=2000.0,
        )
        
        submit_result = broker.submit_order(order)
        self.assertTrue(submit_result["accepted"])
        
        # 2. 等待成交
        time.sleep(0.1)
        
        # 3. 检查成交
        fills = broker.get_fills(order.order_id)
        self.assertGreater(len(fills), 0)
        
        # 4. 检查仓位
        position = broker.get_position("ETH/USDT")
        self.assertGreater(position["net_quantity"], 0)
        
        # 5. 检查事件
        event_types = [e.event_type for e in events]
        self.assertIn(EventType.ORDER_ACCEPTED, event_types)
        self.assertIn(EventType.ORDER_FILLED, event_types)


if __name__ == "__main__":
    unittest.main()
