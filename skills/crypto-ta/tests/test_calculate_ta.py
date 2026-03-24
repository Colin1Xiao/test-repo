#!/usr/bin/env python3
"""
Tests for calculate_ta.py
技术指标计算模块测试
"""

import unittest
import sys
import pandas as pd
import numpy as np
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestLoadData(unittest.TestCase):
    """测试数据加载"""
    
    def setUp(self):
        """创建测试数据"""
        self.sample_data = pd.DataFrame({
            'timestamp': [1710172800000, 1710172860000, 1710172920000],
            'open': [68500.0, 68520.0, 68560.0],
            'high': [68550.0, 68580.0, 68600.0],
            'low': [68480.0, 68510.0, 68540.0],
            'close': [68520.0, 68560.0, 68590.0],
            'volume': [125.5, 98.3, 150.2]
        })
    
    def test_dataframe_structure(self):
        """测试 DataFrame 结构"""
        required_columns = ['open', 'high', 'low', 'close', 'volume']
        for col in required_columns:
            self.assertIn(col, self.sample_data.columns)
    
    def test_ohlcv_values(self):
        """测试 OHLCV 值的有效性"""
        # 验证 high >= low
        self.assertTrue(all(self.sample_data['high'] >= self.sample_data['low']))
        
        # 验证 high >= open, close
        self.assertTrue(all(self.sample_data['high'] >= self.sample_data['open']))
        self.assertTrue(all(self.sample_data['high'] >= self.sample_data['close']))
        
        # 验证 low <= open, close
        self.assertTrue(all(self.sample_data['low'] <= self.sample_data['open']))
        self.assertTrue(all(self.sample_data['low'] <= self.sample_data['close']))
        
        # 验证 volume > 0
        self.assertTrue(all(self.sample_data['volume'] > 0))


class TestIndicators(unittest.TestCase):
    """测试技术指标计算"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 100
        base_price = 68500
        
        # 生成随机价格数据
        closes = base_price + np.cumsum(np.random.randn(n) * 100)
        highs = closes + np.abs(np.random.randn(n) * 50)
        lows = closes - np.abs(np.random.randn(n) * 50)
        opens = closes + np.random.randn(n) * 30
        volumes = np.abs(np.random.randn(n) * 100 + 100)
        
        self.df = pd.DataFrame({
            'timestamp': range(1710172800000, 1710172800000 + n * 60000, 60000),
            'open': opens,
            'high': highs,
            'low': lows,
            'close': closes,
            'volume': volumes
        })
    
    def test_sma_calculation(self):
        """测试 SMA 计算"""
        try:
            import pandas_ta as ta
            length = 20
            sma = ta.sma(self.df['close'], length=length)
            
            self.assertIsNotNone(sma)
            self.assertEqual(len(sma), len(self.df))
            
            # 前 (length-1) 个值应为 NaN
            self.assertTrue(sma.iloc[:length-1].isna().all())
            
            # 后面的值应为数值
            self.assertTrue(sma.iloc[length:].notna().all())
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_ema_calculation(self):
        """测试 EMA 计算"""
        try:
            import pandas_ta as ta
            length = 20
            ema = ta.ema(self.df['close'], length=length)
            
            self.assertIsNotNone(ema)
            self.assertEqual(len(ema), len(self.df))
            
            # EMA 应该比 SMA 更快响应价格变化
            sma = ta.sma(self.df['close'], length=length)
            if ema.iloc[-1] is not None and sma.iloc[-1] is not None:
                # EMA 和 SMA 应该接近但不完全相同
                self.assertAlmostEqual(ema.iloc[-1], sma.iloc[-1], delta=500)
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_rsi_calculation(self):
        """测试 RSI 计算"""
        try:
            import pandas_ta as ta
            length = 14
            rsi = ta.rsi(self.df['close'], length=length)
            
            self.assertIsNotNone(rsi)
            
            # RSI 应在 0-100 范围内
            valid_rsi = rsi.dropna()
            self.assertTrue(all(valid_rsi >= 0))
            self.assertTrue(all(valid_rsi <= 100))
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_macd_calculation(self):
        """测试 MACD 计算"""
        try:
            import pandas_ta as ta
            macd = ta.macd(self.df['close'], fast=12, slow=26, signal=9)
            
            self.assertIsNotNone(macd)
            self.assertIn('MACD_12_26_9', macd.columns)
            self.assertIn('MACDh_12_26_9', macd.columns)
            self.assertIn('MACDs_12_26_9', macd.columns)
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_bbands_calculation(self):
        """测试布林带计算"""
        try:
            import pandas_ta as ta
            bbands = ta.bbands(self.df['close'], length=20, std=2)
            
            self.assertIsNotNone(bbands)
            
            # 上轨应 >= 中轨 >= 下轨
            upper = bbands['BBU_20_2.0']
            middle = bbands['BBM_20_2.0']
            lower = bbands['BBL_20_2.0']
            
            valid_idx = upper.notna() & middle.notna() & lower.notna()
            self.assertTrue(all(upper[valid_idx] >= middle[valid_idx]))
            self.assertTrue(all(middle[valid_idx] >= lower[valid_idx]))
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_atr_calculation(self):
        """测试 ATR 计算"""
        try:
            import pandas_ta as ta
            atr = ta.atr(self.df['high'], self.df['low'], self.df['close'], length=14)
            
            self.assertIsNotNone(atr)
            
            # ATR 应为正数
            valid_atr = atr.dropna()
            self.assertTrue(all(valid_atr > 0))
        except ImportError:
            self.skipTest("pandas-ta 未安装")


class TestIndicatorSignals(unittest.TestCase):
    """测试指标信号生成"""
    
    def setUp(self):
        """创建测试数据"""
        np.random.seed(42)
        n = 50
        
        # 创建趋势性数据
        trend = np.linspace(68000, 69000, n)
        noise = np.random.randn(n) * 50
        
        self.df = pd.DataFrame({
            'timestamp': range(1710172800000, 1710172800000 + n * 60000, 60000),
            'open': trend + noise,
            'high': trend + noise + 50,
            'low': trend + noise - 50,
            'close': trend + noise,
            'volume': np.abs(np.random.randn(n) * 100 + 100)
        })
    
    def test_rsi_overbought_oversold(self):
        """测试 RSI 超买超卖判断"""
        try:
            import pandas_ta as ta
            
            # 创建超买数据（持续上涨）
            overbought_data = pd.DataFrame({
                'close': np.linspace(68000, 72000, 50)  # 持续上涨
            })
            rsi = ta.rsi(overbought_data['close'], length=14)
            
            # 最后几个 RSI 值应该较高（可能超买）
            last_rsi = rsi.dropna().iloc[-5:]
            if len(last_rsi) > 0:
                avg_rsi = last_rsi.mean()
                # 强趋势下 RSI 应该偏高
                self.assertGreater(avg_rsi, 30)  # 不应太低
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_macd_crossover(self):
        """测试 MACD 交叉检测"""
        try:
            import pandas_ta as ta
            
            macd = ta.macd(self.df['close'], fast=12, slow=26, signal=9)
            
            if macd is not None and len(macd) > 0:
                macd_line = macd['MACD_12_26_9']
                signal_line = macd['MACDs_12_26_9']
                
                # 计算差值
                diff = macd_line - signal_line
                
                # 检测交叉点（差值变号）
                crossings = ((diff.shift(1) > 0) & (diff < 0)) | ((diff.shift(1) < 0) & (diff > 0))
                
                # 记录交叉次数
                cross_count = crossings.sum()
                self.assertIsInstance(cross_count, (int, np.integer))
        except ImportError:
            self.skipTest("pandas-ta 未安装")


class TestEdgeCases(unittest.TestCase):
    """测试边界情况"""
    
    def test_insufficient_data(self):
        """测试数据不足的情况"""
        try:
            import pandas_ta as ta
            
            # 创建少量数据
            small_df = pd.DataFrame({
                'close': [68000, 68100, 68200]
            })
            
            # 尝试计算需要更多数据的指标
            rsi = ta.rsi(small_df['close'], length=14)
            
            # 所有值应为 NaN（数据不足）
            self.assertTrue(rsi.isna().all())
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_constant_prices(self):
        """测试价格不变的情况"""
        try:
            import pandas_ta as ta
            
            # 创建价格不变的数据
            flat_df = pd.DataFrame({
                'close': [68000.0] * 50
            })
            
            rsi = ta.rsi(flat_df['close'], length=14)
            
            # RSI 应为 NaN 或 50（无变化）
            valid_rsi = rsi.dropna()
            if len(valid_rsi) > 0:
                # 价格不变时，RSI 理论上应为 50
                self.assertAlmostEqual(valid_rsi.iloc[-1], 50, delta=1)
        except ImportError:
            self.skipTest("pandas-ta 未安装")
    
    def test_nan_handling(self):
        """测试 NaN 值处理"""
        try:
            import pandas_ta as ta
            
            # 创建包含 NaN 的数据
            nan_df = pd.DataFrame({
                'close': [68000.0, 68100.0, np.nan, 68300.0, 68400.0] * 10
            })
            
            rsi = ta.rsi(nan_df['close'], length=14)
            
            # RSI 应该能够处理 NaN
            self.assertIsNotNone(rsi)
            self.assertEqual(len(rsi), len(nan_df))
        except ImportError:
            self.skipTest("pandas-ta 未安装")


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestLoadData))
    suite.addTests(loader.loadTestsFromTestCase(TestIndicators))
    suite.addTests(loader.loadTestsFromTestCase(TestIndicatorSignals))
    suite.addTests(loader.loadTestsFromTestCase(TestEdgeCases))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
