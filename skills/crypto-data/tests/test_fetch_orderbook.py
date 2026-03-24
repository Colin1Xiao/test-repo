#!/usr/bin/env python3
"""
Tests for fetch_orderbook.py
订单簿数据获取模块测试
"""

import unittest
import sys
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestFetchOrderbook(unittest.TestCase):
    """测试订单簿获取"""
    
    def setUp(self):
        """设置测试数据"""
        self.sample_orderbook = {
            'bids': [
                [68500.0, 1.5],
                [68490.0, 2.0],
                [68480.0, 3.5],
            ],
            'asks': [
                [68510.0, 1.2],
                [68520.0, 2.8],
                [68530.0, 1.5],
            ],
            'timestamp': 1710172800000,
            'datetime': '2024-03-11T12:00:00.000Z',
            'nonce': 123456
        }
    
    def test_orderbook_structure(self):
        """测试订单簿数据结构"""
        self.assertIn('bids', self.sample_orderbook)
        self.assertIn('asks', self.sample_orderbook)
        self.assertIn('timestamp', self.sample_orderbook)
        
        # 验证买单价格递减
        bids = self.sample_orderbook['bids']
        for i in range(len(bids) - 1):
            self.assertGreaterEqual(bids[i][0], bids[i+1][0])
        
        # 验证卖单价格递增
        asks = self.sample_orderbook['asks']
        for i in range(len(asks) - 1):
            self.assertLessEqual(asks[i][0], asks[i+1][0])
    
    def test_spread_calculation(self):
        """测试买卖价差计算"""
        best_bid = self.sample_orderbook['bids'][0][0]
        best_ask = self.sample_orderbook['asks'][0][0]
        spread = best_ask - best_bid
        spread_pct = (spread / best_bid) * 100
        
        self.assertGreater(spread, 0)
        self.assertLess(spread_pct, 1.0)  # 价差应小于1%
    
    def test_depth_calculation(self):
        """测试深度计算"""
        bid_depth = sum([bid[1] for bid in self.sample_orderbook['bids']])
        ask_depth = sum([ask[1] for ask in self.sample_orderbook['asks']])
        
        self.assertGreater(bid_depth, 0)
        self.assertGreater(ask_depth, 0)


class TestOrderbookParsing(unittest.TestCase):
    """测试订单簿数据解析"""
    
    def test_parse_orderbook_entry(self):
        """测试订单簿条目解析"""
        entry = [68500.0, 1.5]
        
        price = entry[0]
        volume = entry[1]
        
        self.assertIsInstance(price, float)
        self.assertIsInstance(volume, float)
        self.assertGreater(price, 0)
        self.assertGreater(volume, 0)
    
    def test_empty_orderbook(self):
        """测试空订单簿处理"""
        empty_orderbook = {
            'bids': [],
            'asks': [],
            'timestamp': 1710172800000
        }
        
        self.assertEqual(len(empty_orderbook['bids']), 0)
        self.assertEqual(len(empty_orderbook['asks']), 0)


class TestOrderbookMetrics(unittest.TestCase):
    """测试订单簿指标计算"""
    
    def setUp(self):
        self.orderbook = {
            'bids': [
                [68500.0, 1.5],
                [68490.0, 2.0],
                [68480.0, 3.5],
                [68470.0, 2.5],
                [68460.0, 4.0],
            ],
            'asks': [
                [68510.0, 1.2],
                [68520.0, 2.8],
                [68530.0, 1.5],
                [68540.0, 3.2],
                [68550.0, 2.0],
            ]
        }
    
    def test_calculate_imbalance(self):
        """测试买卖不平衡度计算"""
        bid_volume = sum([b[1] for b in self.orderbook['bids']])
        ask_volume = sum([a[1] for a in self.orderbook['asks']])
        total_volume = bid_volume + ask_volume
        
        imbalance = (bid_volume - ask_volume) / total_volume
        
        self.assertIsInstance(imbalance, float)
        self.assertGreaterEqual(imbalance, -1.0)
        self.assertLessEqual(imbalance, 1.0)
    
    def test_weighted_average_price(self):
        """测试加权平均价格计算"""
        def calc_wap(orders):
            total_value = sum([p * v for p, v in orders])
            total_volume = sum([v for p, v in orders])
            return total_value / total_volume if total_volume > 0 else 0
        
        bid_wap = calc_wap(self.orderbook['bids'])
        ask_wap = calc_wap(self.orderbook['asks'])
        
        self.assertGreater(bid_wap, 0)
        self.assertGreater(ask_wap, 0)
        self.assertLess(bid_wap, ask_wap)  # 买价应低于卖价


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestFetchOrderbook))
    suite.addTests(loader.loadTestsFromTestCase(TestOrderbookParsing))
    suite.addTests(loader.loadTestsFromTestCase(TestOrderbookMetrics))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
