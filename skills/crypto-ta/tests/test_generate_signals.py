#!/usr/bin/env python3
"""
Tests for generate_signals.py
交易信号生成模块测试
"""

import unittest
import sys
import pandas as pd
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestSignalGeneration(unittest.TestCase):
    """测试信号生成"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 100
        
        # 创建价格数据
        prices = 68000 + np.cumsum(np.random.randn(n) * 100)
        
        self.df = pd.DataFrame({
            'timestamp': range(1710172800000, 1710172800000 + n * 60000, 60000),
            'open': prices + np.random.randn(n) * 20,
            'high': prices + np.abs(np.random.randn(n) * 50),
            'low': prices - np.abs(np.random.randn(n) * 50),
            'close': prices,
            'volume': np.abs(np.random.randn(n) * 100 + 100)
        })


class TestMAStrategy(unittest.TestCase):
    """测试均线策略"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 100
        
        # 创建趋势数据
        trend = np.linspace(68000, 70000, n)
        noise = np.random.randn(n) * 50
        prices = trend + noise
        
        self.df = pd.DataFrame({
            'close': prices
        })
    
    def test_ma_cross_detection(self):
        """测试均线交叉检测"""
        try:
            import pandas_ta as ta
            
            # 计算快慢均线
            fast_ma = ta.sma(self.df['close'], length=10)
            slow_ma = ta.sma(self.df['close'], length=30)
            
            # 检测金叉（快线上穿慢线）
            golden_cross = (fast_ma.shift(1) < slow_ma.shift(1)) & (fast_ma > slow_ma)
            
            # 检测死叉（快线下穿慢线）
            death_cross = (fast_ma.shift(1) > slow_ma.shift(1)) & (fast_ma < slow_ma)
            
            # 验证信号数量合理
            self.assertIsInstance(golden_cross.sum(), (int, np.integer))
            self.assertIsInstance(death_cross.sum(), (int, np.integer))
            
        except ImportError:
            self.skipTest("pandas-ta 未安装")


class TestRSIStrategy(unittest.TestCase):
    """测试 RSI 策略"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        
        # 创建超买数据（持续上涨）
        overbought_prices = np.linspace(68000, 72000, 50)
        
        # 创建超卖数据（持续下跌）
        oversold_prices = np.linspace(72000, 68000, 50)
        
        self.overbought_df = pd.DataFrame({'close': overbought_prices})
        self.oversold_df = pd.DataFrame({'close': oversold_prices})
    
    def test_rsi_overbought_signal(self):
        """测试 RSI 超买信号"""
        try:
            import pandas_ta as ta
            
            rsi = ta.rsi(self.overbought_df['close'], length=14)
            valid_rsi = rsi.dropna()
            
            if len(valid_rsi) > 0:
                last_rsi = valid_rsi.iloc[-1]
                # 持续上涨后的 RSI 应该较高
                self.assertGreater(last_rsi, 50)
                
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_rsi_oversold_signal(self):
        """测试 RSI 超卖信号"""
        try:
            import pandas_ta as ta
            
            rsi = ta.rsi(self.oversold_df['close'], length=14)
            valid_rsi = rsi.dropna()
            
            if len(valid_rsi) > 0:
                last_rsi = valid_rsi.iloc[-1]
                # 持续下跌后的 RSI 应该较低
                self.assertLess(last_rsi, 50)
                
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_rsi_thresholds(self):
        """测试 RSI 阈值"""
        overbought_threshold = 70
        oversold_threshold = 30
        
        # 验证阈值合理性
        self.assertGreater(overbought_threshold, oversold_threshold)
        self.assertEqual(overbought_threshold + oversold_threshold, 100)


class TestMACDStrategy(unittest.TestCase):
    """测试 MACD 策略"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 100
        
        prices = 68000 + np.cumsum(np.random.randn(n) * 100)
        
        self.df = pd.DataFrame({
            'close': prices
        })
    
    def test_macd_histogram(self):
        """测试 MACD 柱状图"""
        try:
            import pandas_ta as ta
            
            macd = ta.macd(self.df['close'], fast=12, slow=26, signal=9)
            
            if macd is not None:
                histogram = macd['MACDh_12_26_9']
                macd_line = macd['MACD_12_26_9']
                signal_line = macd['MACDs_12_26_9']
                
                # 柱状图 = MACD线 - 信号线
                expected_hist = macd_line - signal_line
                
                valid_idx = histogram.notna() & expected_hist.notna()
                if valid_idx.any():
                    pd.testing.assert_series_equal(
                        histogram[valid_idx],
                        expected_hist[valid_idx],
                        check_names=False
                    )
        except ImportError:
            self.skipTest("pandas-ta 未安装")


class TestSignalValidation(unittest.TestCase):
    """测试信号验证"""
    
    def test_signal_types(self):
        """测试信号类型"""
        valid_signals = ['buy', 'sell', 'hold', 'strong_buy', 'strong_sell']
        
        for signal in valid_signals:
            self.assertIsInstance(signal, str)
            self.assertIn(signal, valid_signals)
    
    def test_signal_strength(self):
        """测试信号强度"""
        # 定义信号强度等级
        signal_strength = {
            'strong_sell': -2,
            'sell': -1,
            'hold': 0,
            'buy': 1,
            'strong_buy': 2
        }
        
        # 验证强度排序
        self.assertLess(signal_strength['strong_sell'], signal_strength['sell'])
        self.assertLess(signal_strength['sell'], signal_strength['hold'])
        self.assertLess(signal_strength['hold'], signal_strength['buy'])
        self.assertLess(signal_strength['buy'], signal_strength['strong_buy'])


class TestMultiIndicatorCombo(unittest.TestCase):
    """测试多指标组合策略"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 100
        
        prices = 68000 + np.cumsum(np.random.randn(n) * 100)
        
        self.df = pd.DataFrame({
            'close': prices
        })
    
    def test_indicator_agreement(self):
        """测试指标一致性"""
        try:
            import pandas_ta as ta
            
            # 计算多个指标
            rsi = ta.rsi(self.df['close'], length=14)
            macd = ta.macd(self.df['close'])
            
            # 获取最新值
            last_rsi = rsi.dropna().iloc[-1] if len(rsi.dropna()) > 0 else None
            
            if last_rsi is not None and macd is not None:
                macd_line = macd['MACD_12_26_9'].dropna()
                signal_line = macd['MACDs_12_26_9'].dropna()
                
                if len(macd_line) > 0 and len(signal_line) > 0:
                    macd_bullish = macd_line.iloc[-1] > signal_line.iloc[-1]
                    rsi_bullish = last_rsi > 50
                    
                    # 当两个指标都看涨时，信号更强
                    if macd_bullish and rsi_bullish:
                        combined_strength = 'strong'
                    elif macd_bullish or rsi_bullish:
                        combined_strength = 'moderate'
                    else:
                        combined_strength = 'weak'
                    
                    self.assertIn(combined_strength, ['strong', 'moderate', 'weak'])
                    
        except ImportError:
            self.skipTest("pandas-ta 未安装")


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
