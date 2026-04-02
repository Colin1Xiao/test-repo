#!/usr/bin/env python3
"""
Tests for calculate_position.py
仓位计算模块测试
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from calculate_position import calculate_position_size


class TestCalculatePositionSize(unittest.TestCase):
    """测试仓位大小计算"""
    
    def test_basic_calculation(self):
        """测试基本仓位计算"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=1.5,
            leverage=1
        )
        
        # 验证结果包含所有必需字段
        self.assertIn('balance', result)
        self.assertIn('risk_amount', result)
        self.assertIn('position_size', result)
        self.assertIn('margin', result)
        self.assertIn('leverage', result)
    
    def test_risk_amount_calculation(self):
        """测试风险金额计算"""
        balance = 10000
        risk_pct = 2
        
        result = calculate_position_size(
            balance=balance,
            risk_pct=risk_pct,
            stop_loss_pct=1.5,
            leverage=1
        )
        
        # 风险金额 = 余额 * 风险%
        expected_risk = balance * (risk_pct / 100)
        self.assertEqual(result['risk_amount'], expected_risk)
        self.assertEqual(result['risk_amount'], 200)
    
    def test_position_size_calculation(self):
        """测试仓位大小计算"""
        balance = 10000
        risk_pct = 2
        stop_loss_pct = 1.5
        
        result = calculate_position_size(
            balance=balance,
            risk_pct=risk_pct,
            stop_loss_pct=stop_loss_pct,
            leverage=1
        )
        
        # 仓位 = 风险金额 / 止损%
        expected_position = (balance * risk_pct / 100) / (stop_loss_pct / 100)
        self.assertEqual(result['position_size'], expected_position)
        self.assertEqual(result['position_size'], 13333.333333333334)
    
    def test_margin_calculation(self):
        """测试保证金计算"""
        balance = 10000
        risk_pct = 2
        stop_loss_pct = 1.5
        leverage = 10
        
        result = calculate_position_size(
            balance=balance,
            risk_pct=risk_pct,
            stop_loss_pct=stop_loss_pct,
            leverage=leverage
        )
        
        # 保证金 = 仓位 / 杠杆
        expected_margin = result['position_size'] / leverage
        self.assertEqual(result['margin'], expected_margin)
    
    def test_margin_percentage(self):
        """测试保证金占比"""
        balance = 10000
        
        result = calculate_position_size(
            balance=balance,
            risk_pct=2,
            stop_loss_pct=1.5,
            leverage=10
        )
        
        # 保证金占比 = 保证金 / 余额 * 100
        expected_margin_pct = (result['margin'] / balance) * 100
        self.assertEqual(result['margin_pct'], expected_margin_pct)
    
    def test_liquidation_percentage(self):
        """测试爆仓幅度计算"""
        # 测试不同杠杆下的爆仓幅度
        test_cases = [
            (1, 100),    # 1倍杠杆，爆仓幅度100%
            (2, 50),     # 2倍杠杆，爆仓幅度50%
            (5, 20),     # 5倍杠杆，爆仓幅度20%
            (10, 10),    # 10倍杠杆，爆仓幅度10%
            (20, 5),     # 20倍杠杆，爆仓幅度5%
            (50, 2),     # 50倍杠杆，爆仓幅度2%
            (100, 1),    # 100倍杠杆，爆仓幅度1%
        ]
        
        for leverage, expected_liq_pct in test_cases:
            result = calculate_position_size(
                balance=10000,
                risk_pct=2,
                stop_loss_pct=1.5,
                leverage=leverage
            )
            
            self.assertEqual(result['liquidation_pct'], expected_liq_pct,
                           f"杠杆 {leverage}x 的爆仓幅度应为 {expected_liq_pct}%")
    
    def test_zero_stop_loss(self):
        """测试零止损情况"""
        with self.assertRaises(ZeroDivisionError):
            calculate_position_size(
                balance=10000,
                risk_pct=2,
                stop_loss_pct=0,
                leverage=1
            )
    
    def test_high_risk_warning(self):
        """测试高风险仓位警告"""
        # 使用高杠杆
        result = calculate_position_size(
            balance=10000,
            risk_pct=5,
            stop_loss_pct=1,
            leverage=50
        )
        
        # 高杠杆下保证金占比应该很高
        self.assertGreaterEqual(result['margin_pct'], 10)
        
        # 爆仓幅度应该很小
        self.assertEqual(result['liquidation_pct'], 2)
    
    def test_conservative_position(self):
        """测试保守仓位"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=1,      # 低风险
            stop_loss_pct=2, # 较宽止损
            leverage=5       # 中等杠杆
        )
        
        # 验证计算
        self.assertEqual(result['risk_amount'], 100)  # 10000 * 1%
        self.assertEqual(result['position_size'], 5000)  # 100 / 2%
        self.assertEqual(result['margin'], 1000)  # 5000 / 5
        self.assertEqual(result['margin_pct'], 10)  # 1000 / 10000 * 100
    
    def test_aggressive_position(self):
        """测试激进仓位"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=3,       # 较高风险
            stop_loss_pct=1,  # 较紧止损
            leverage=20       # 高杠杆
        )
        
        # 验证计算
        self.assertEqual(result['risk_amount'], 300)  # 10000 * 3%
        self.assertEqual(result['position_size'], 30000)  # 300 / 1%
        self.assertEqual(result['margin'], 1500)  # 30000 / 20
        self.assertEqual(result['liquidation_pct'], 5)  # 100 / 20
    
    def test_small_balance(self):
        """测试小资金账户"""
        result = calculate_position_size(
            balance=100,
            risk_pct=2,
            stop_loss_pct=1.5,
            leverage=10
        )
        
        # 风险金额应该很小
        self.assertEqual(result['risk_amount'], 2)  # 100 * 2%
        self.assertAlmostEqual(result['position_size'], 133.33, places=2)
    
    def test_large_balance(self):
        """测试大资金账户"""
        result = calculate_position_size(
            balance=1000000,
            risk_pct=1,
            stop_loss_pct=2,
            leverage=5
        )
        
        # 风险金额应该很大
        self.assertEqual(result['risk_amount'], 10000)  # 1,000,000 * 1%
        self.assertEqual(result['position_size'], 500000)  # 10000 / 2%
    
    def test_leverage_one(self):
        """测试无杠杆（1倍）"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=2,
            leverage=1
        )
        
        # 无杠杆时，保证金 = 仓位
        self.assertEqual(result['margin'], result['position_size'])
        self.assertEqual(result['margin_pct'], 100)  # 使用全部资金
        self.assertEqual(result['liquidation_pct'], 100)  # 几乎不会爆仓


class TestPositionEdgeCases(unittest.TestCase):
    """测试边界情况"""
    
    def test_very_small_risk(self):
        """测试极小风险比例"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=0.1,    # 0.1% 风险
            stop_loss_pct=1,
            leverage=10
        )
        
        self.assertEqual(result['risk_amount'], 10)  # 10000 * 0.1%
        self.assertEqual(result['position_size'], 1000)
    
    def test_very_tight_stop(self):
        """测试极紧止损"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=0.1,  # 0.1% 止损
            leverage=10
        )
        
        # 仓位应该很大
        expected_position = (10000 * 0.02) / 0.001
        self.assertEqual(result['position_size'], expected_position)
    
    def test_very_wide_stop(self):
        """测试极宽止损"""
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=10,  # 10% 止损
            leverage=10
        )
        
        # 仓位应该很小
        expected_position = (10000 * 0.02) / 0.10
        self.assertEqual(result['position_size'], expected_position)


class TestRiskManagementRules(unittest.TestCase):
    """测试风险管理规则"""
    
    def test_single_risk_limit(self):
        """测试单笔风险限制"""
        # 单笔风险不应超过 3%
        max_risk = 3
        
        result = calculate_position_size(
            balance=10000,
            risk_pct=max_risk,
            stop_loss_pct=1.5,
            leverage=10
        )
        
        self.assertLessEqual(result['risk_pct'], max_risk)
    
    def test_total_exposure_limit(self):
        """测试总敞口限制"""
        # 建议总仓位不超过 30%
        max_margin_pct = 30
        
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=1.5,
            leverage=10
        )
        
        # 如果超过限制，应该给出警告
        if result['margin_pct'] > max_margin_pct:
            self.assertGreater(result['margin_pct'], max_margin_pct)
    
    def test_leverage_limit(self):
        """测试杠杆限制"""
        # 建议杠杆不超过 10 倍（日内可 20-50 倍）
        recommended_max_leverage = 10
        day_trading_max_leverage = 50
        
        result = calculate_position_size(
            balance=10000,
            risk_pct=2,
            stop_loss_pct=1.5,
            leverage=50
        )
        
        self.assertEqual(result['leverage'], 50)
        self.assertEqual(result['liquidation_pct'], 2)  # 高风险
    
    def test_risk_reward_ratio(self):
        """测试盈亏比"""
        # 建议盈亏比至少 2:1
        
        entry_price = 68500
        stop_loss_pct = 1.5
        take_profit_pct = 3.0  # 2:1 盈亏比
        
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        take_profit_price = entry_price * (1 + take_profit_pct / 100)
        
        risk = entry_price - stop_price
        reward = take_profit_price - entry_price
        
        risk_reward_ratio = reward / risk
        
        self.assertGreaterEqual(risk_reward_ratio, 2.0)


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestCalculatePositionSize))
    suite.addTests(loader.loadTestsFromTestCase(TestPositionEdgeCases))
    suite.addTests(loader.loadTestsFromTestCase(TestRiskManagementRules))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
