#!/usr/bin/env python3
"""
Unit Tests for Crypto Risk Module
crypto-risk 模块单元测试
"""

import unittest
import sys
from pathlib import Path

# 添加父目录到路径
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))
sys.path.insert(0, str(parent_dir / 'scripts'))

# 直接导入脚本
import importlib.util
spec1 = importlib.util.spec_from_file_location("calculate_position", parent_dir / 'scripts' / 'calculate_position.py')
calculate_position = importlib.util.module_from_spec(spec1)
spec1.loader.exec_module(calculate_position)

spec2 = importlib.util.spec_from_file_location("calculate_stoploss", parent_dir / 'scripts' / 'calculate_stoploss.py')
calculate_stoploss = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(calculate_stoploss)

spec3 = importlib.util.spec_from_file_location("risk_check", parent_dir / 'scripts' / 'risk_check.py')
risk_check = importlib.util.module_from_spec(spec3)
spec3.loader.exec_module(risk_check)

# 获取函数
calculate_position_size = calculate_position.calculate_position_size
calculate_stoploss_func = calculate_stoploss.calculate_stoploss
calculate_trailing_stop = calculate_stoploss.calculate_trailing_stop
assess_risk = risk_check.assess_risk


class TestPositionSize(unittest.TestCase):
    """测试仓位计算器"""
    
    def test_basic_position(self):
        """基础仓位计算"""
        result = calculate_position_size(10000, 2.0, 1.5, 10)
        
        self.assertEqual(result['balance'], 10000)
        self.assertEqual(result['risk_amount'], 200)  # 2% of 10000
        self.assertAlmostEqual(result['position_size'], 13333.33, places=2)
        self.assertAlmostEqual(result['margin'], 1333.33, places=2)
    
    def test_high_leverage(self):
        """高杠杆测试"""
        result = calculate_position_size(10000, 2.0, 1.5, 100)
        
        self.assertEqual(result['leverage'], 100)
        self.assertLess(result['margin'], 200)  # 高杠杆下保证金很低
        self.assertEqual(result['liquidation_pct'], 1.0)  # 1% 爆仓
    
    def test_zero_leverage(self):
        """无杠杆测试"""
        result = calculate_position_size(10000, 2.0, 1.5, 1)
        
        self.assertEqual(result['leverage'], 1)
        self.assertEqual(result['liquidation_pct'], 100)  # 100% 爆仓


class TestStopLoss(unittest.TestCase):
    """测试止损止盈计算器"""
    
    def test_long_stoploss(self):
        """做多止损"""
        result = calculate_stoploss_func(68500, 2.0, 4.0, 'long')
        
        self.assertLess(result['stop_price'], 68500)  # 止损低于入场
        self.assertAlmostEqual(result['stop_price'], 68500 * 0.98, places=2)
        self.assertEqual(result['take_profit_price'], 68500 * 1.04)
    
    def test_short_stoploss(self):
        """做空止损"""
        result = calculate_stoploss_func(68500, 2.0, 4.0, 'short')
        
        self.assertGreater(result['stop_price'], 68500)  # 止损高于入场
        self.assertAlmostEqual(result['stop_price'], 68500 * 1.02, places=2)
        self.assertEqual(result['take_profit_price'], 68500 * 0.96)
    
    def test_trailing_stop(self):
        """追踪止损"""
        result = calculate_trailing_stop(68500, 1.5, 'long')
        
        self.assertEqual(result['trailing_pct'], 1.5)
        self.assertLess(result['initial_stop'], 68500)


class TestRiskAssessment(unittest.TestCase):
    """测试风险评估"""
    
    def test_low_risk(self):
        """低风险仓位"""
        result = assess_risk(10000.0, 10, 10000.0)
        
        self.assertEqual(result['risk_level'], 'MEDIUM')  # 10x 杠杆是中等风险
        # margin = position/leverage = 10000/10 = 1000, margin_pct = 1000/10000*100 = 10%
        self.assertEqual(result['margin_pct'], 10.0)
    
    def test_extreme_risk(self):
        """极高风险"""
        result = assess_risk(100000.0, 100, 10000.0)
        
        self.assertEqual(result['risk_level'], 'EXTREME')
        self.assertEqual(result['liquidation_pct'], 1.0)  # 1% 爆仓
        self.assertIn('建议降低杠杆', result['suggestions'][0])
    
    def test_position_overweight(self):
        """仓位过重"""
        result = assess_risk(50000.0, 50, 10000.0)
        
        # margin = 50000/50 = 1000, margin_pct = 1000/10000*100 = 10%
        self.assertEqual(result['margin_pct'], 10.0)
        self.assertEqual(result['risk_level'], 'VERY_HIGH')  # 50x 杠杆


if __name__ == '__main__':
    unittest.main(verbosity=2)
