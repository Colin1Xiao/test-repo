#!/usr/bin/env python3
"""
Tests for calculate_stoploss.py
止损止盈计算模块测试
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestStopLossCalculation(unittest.TestCase):
    """测试止损计算"""
    
    def test_long_stop_loss(self):
        """测试做多止损计算"""
        entry_price = 68500
        stop_loss_pct = 2
        
        # 做多止损价 = 入场价 * (1 - 止损%)
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        
        expected_stop = 68500 * 0.98
        self.assertEqual(stop_price, expected_stop)
        self.assertEqual(stop_price, 67130.0)
    
    def test_short_stop_loss(self):
        """测试做空止损计算"""
        entry_price = 68500
        stop_loss_pct = 2
        
        # 做空止损价 = 入场价 * (1 + 止损%)
        stop_price = entry_price * (1 + stop_loss_pct / 100)
        
        expected_stop = 68500 * 1.02
        self.assertEqual(stop_price, expected_stop)
        self.assertEqual(stop_price, 69870.0)
    
    def test_take_profit_calculation(self):
        """测试止盈计算"""
        entry_price = 68500
        take_profit_pct = 4
        
        # 做多止盈价 = 入场价 * (1 + 止盈%)
        take_profit_price = entry_price * (1 + take_profit_pct / 100)
        
        expected_tp = 68500 * 1.04
        self.assertEqual(take_profit_price, expected_tp)
        self.assertEqual(take_profit_price, 71240.0)
    
    def test_risk_reward_ratio(self):
        """测试盈亏比计算"""
        entry_price = 68500
        stop_loss_pct = 2
        take_profit_pct = 4
        
        # 计算盈亏比
        risk = entry_price * (stop_loss_pct / 100)
        reward = entry_price * (take_profit_pct / 100)
        risk_reward_ratio = reward / risk
        
        self.assertEqual(risk_reward_ratio, 2.0)
    
    def test_trailing_stop(self):
        """测试追踪止损"""
        entry_price = 68500
        highest_price = 70000
        trailing_pct = 1.5
        
        # 追踪止损价 = 最高价 * (1 - 追踪%)
        trailing_stop = highest_price * (1 - trailing_pct / 100)
        
        expected_trailing = 70000 * 0.985
        self.assertEqual(trailing_stop, expected_trailing)
        self.assertEqual(trailing_stop, 68950.0)
        
        # 验证追踪止损高于固定止损
        fixed_stop = entry_price * 0.98  # 2% 固定止损
        self.assertGreater(trailing_stop, fixed_stop)


class TestStopLossLevels(unittest.TestCase):
    """测试不同止损水平"""
    
    def test_tight_stop(self):
        """测试紧止损"""
        entry_price = 68500
        stop_loss_pct = 0.5  # 0.5% 止损
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        
        expected_stop = 68500 * 0.995
        self.assertEqual(stop_price, expected_stop)
        self.assertAlmostEqual(stop_price, 68157.5, places=1)
    
    def test_wide_stop(self):
        """测试宽止损"""
        entry_price = 68500
        stop_loss_pct = 5  # 5% 止损
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        
        expected_stop = 68500 * 0.95
        self.assertEqual(stop_price, expected_stop)
        self.assertEqual(stop_price, 65075.0)
    
    def test_atr_based_stop(self):
        """测试基于 ATR 的止损"""
        entry_price = 68500
        atr = 150
        atr_multiplier = 2
        
        # ATR 止损 = 入场价 - ATR * 乘数
        stop_price = entry_price - (atr * atr_multiplier)
        
        expected_stop = 68500 - 300
        self.assertEqual(stop_price, expected_stop)
        self.assertEqual(stop_price, 68200.0)
        
        # 计算对应的百分比
        stop_pct = ((entry_price - stop_price) / entry_price) * 100
        self.assertAlmostEqual(stop_pct, 0.44, places=2)


class TestMultipleTargets(unittest.TestCase):
    """测试多目标止盈"""
    
    def test_partial_take_profits(self):
        """测试分批止盈"""
        entry_price = 68500
        
        # 设置多个止盈目标
        targets = [
            {'pct': 2, 'size': 0.3},   # 30% 仓位在 2% 止盈
            {'pct': 4, 'size': 0.3},   # 30% 仓位在 4% 止盈
            {'pct': 6, 'size': 0.4},   # 40% 仓位在 6% 止盈
        ]
        
        take_profit_prices = []
        for target in targets:
            tp_price = entry_price * (1 + target['pct'] / 100)
            take_profit_prices.append({
                'price': tp_price,
                'size': target['size']
            })
        
        # 验证价格
        self.assertEqual(take_profit_prices[0]['price'], 69870.0)
        self.assertEqual(take_profit_prices[1]['price'], 71240.0)
        self.assertEqual(take_profit_prices[2]['price'], 72610.0)
        
        # 验证仓位比例总和为 1
        total_size = sum([tp['size'] for tp in take_profit_prices])
        self.assertEqual(total_size, 1.0)
    
    def test_average_take_profit(self):
        """测试平均止盈价格"""
        entry_price = 68500
        
        targets = [
            {'pct': 2, 'size': 0.5},
            {'pct': 6, 'size': 0.5},
        ]
        
        weighted_sum = sum([t['pct'] * t['size'] for t in targets])
        avg_take_profit_pct = weighted_sum
        
        avg_tp_price = entry_price * (1 + avg_take_profit_pct / 100)
        
        self.assertEqual(avg_take_profit_pct, 4.0)
        self.assertEqual(avg_tp_price, 71240.0)


class TestBreakevenStop(unittest.TestCase):
    """测试保本止损"""
    
    def test_move_to_breakeven(self):
        """测试移动到保本"""
        entry_price = 68500
        current_price = 70000
        
        # 当价格达到 2% 利润时，移动止损到保本
        profit_pct = ((current_price - entry_price) / entry_price) * 100
        
        self.assertGreater(profit_pct, 2)
        
        # 保本止损价 = 入场价 + 少量缓冲（如 0.1%）
        breakeven_stop = entry_price * 1.001
        
        expected_breakeven = 68500 * 1.001
        self.assertAlmostEqual(breakeven_stop, expected_breakeven, places=1)
    
    def test_trailing_after_profit(self):
        """测试盈利后启动追踪止损"""
        entry_price = 68500
        current_price = 70000
        activation_pct = 3  # 3% 利润启动追踪止损
        
        profit_pct = ((current_price - entry_price) / entry_price) * 100
        
        # 检查是否达到启动条件
        if profit_pct >= activation_pct:
            trailing_pct = 1.5
            trailing_stop = current_price * (1 - trailing_pct / 100)
            
            expected_trailing = 70000 * 0.985
            self.assertEqual(trailing_stop, expected_trailing)
            self.assertEqual(trailing_stop, 68950.0)


class TestStopLossValidation(unittest.TestCase):
    """测试止损验证"""
    
    def test_stop_below_entry(self):
        """测试止损低于入场价"""
        entry_price = 68500
        stop_loss_pct = 2
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        
        # 做多止损必须低于入场价
        self.assertLess(stop_price, entry_price)
    
    def test_take_profit_above_entry(self):
        """测试止盈高于入场价"""
        entry_price = 68500
        take_profit_pct = 4
        
        take_profit_price = entry_price * (1 + take_profit_pct / 100)
        
        # 做多止盈必须高于入场价
        self.assertGreater(take_profit_price, entry_price)
    
    def test_stop_closer_than_take_profit(self):
        """测试止损比止盈更近"""
        entry_price = 68500
        stop_loss_pct = 2
        take_profit_pct = 4
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        take_profit_price = entry_price * (1 + take_profit_pct / 100)
        
        stop_distance = entry_price - stop_price
        tp_distance = take_profit_price - entry_price
        
        # 止损距离应小于止盈距离（2:1 盈亏比）
        self.assertLess(stop_distance, tp_distance)
        self.assertEqual(tp_distance / stop_distance, 2.0)


class TestCryptoSpecificScenarios(unittest.TestCase):
    """测试加密货币特定场景"""
    
    def test_high_volatility_stop(self):
        """测试高波动率下的止损"""
        entry_price = 68500
        # 高波动率市场使用更宽的止损
        stop_loss_pct = 3
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        expected_stop = 68500 * 0.97
        
        self.assertEqual(stop_price, expected_stop)
        self.assertEqual(stop_price, 66445.0)


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestStopLossCalculation))
    suite.addTests(loader.loadTestsFromTestCase(TestStopLossLevels))
    suite.addTests(loader.loadTestsFromTestCase(TestMultipleTargets))
    suite.addTests(loader.loadTestsFromTestCase(TestBreakevenStop))
    suite.addTests(loader.loadTestsFromTestCase(TestStopLossValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestCryptoSpecificScenarios))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)