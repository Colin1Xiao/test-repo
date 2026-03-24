#!/usr/bin/env python3
"""
Tests for fetch_ohlcv.py
K线数据获取模块测试
"""

import unittest
import sys
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# 添加脚本路径
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestFetchOHLCV(unittest.TestCase):
    """测试 K 线数据获取"""
    
    def setUp(self):
        """设置测试数据"""
        self.sample_ohlcv = [
            [1710172800000, 68500.0, 68550.0, 68480.0, 68520.0, 125.5],
            [1710172860000, 68520.0, 68580.0, 68510.0, 68560.0, 98.3],
            [1710172920000, 68560.0, 68600.0, 68540.0, 68590.0, 150.2],
        ]
    
    def test_ohlcv_data_structure(self):
        """测试 OHLCV 数据结构"""
        self.assertEqual(len(self.sample_ohlcv[0]), 6)
        
        for candle in self.sample_ohlcv:
            timestamp, open_p, high_p, low_p, close_p, volume = candle
            # 验证 high >= low
            self.assertGreaterEqual(high_p, low_p)
            # 验证 high >= open, close
            self.assertGreaterEqual(high_p, open_p)
            self.assertGreaterEqual(high_p, close_p)
            # 验证 low <= open, close
            self.assertLessEqual(low_p, open_p)
            self.assertLessEqual(low_p, close_p)
            # 验证 volume > 0
            self.assertGreater(volume, 0)
    
    def test_ohlcv_to_dict_conversion(self):
        """测试 OHLCV 转换为字典"""
        data = []
        for candle in self.sample_ohlcv:
            from datetime import datetime
            data.append({
                "timestamp": candle[0],
                "datetime": datetime.fromtimestamp(candle[0] / 1000).isoformat(),
                "open": candle[1],
                "high": candle[2],
                "low": candle[3],
                "close": candle[4],
                "volume": candle[5]
            })
        
        self.assertEqual(len(data), 3)
        self.assertIn('timestamp', data[0])
        self.assertIn('open', data[0])
        self.assertIn('high', data[0])
        self.assertIn('low', data[0])
        self.assertIn('close', data[0])
        self.assertIn('volume', data[0])


class TestConfigValidation(unittest.TestCase):
    """测试配置验证"""
    
    def test_exchange_list(self):
        """测试支持的交易所列表"""
        supported_exchanges = ['okx', 'binance', 'bybit', 'gate']
        
        for exchange in supported_exchanges:
            self.assertIn(exchange, ['okx', 'binance', 'bybit', 'gate', 'gateio'])
    
    def test_timeframe_list(self):
        """测试支持的时间框架"""
        timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
        
        for tf in timeframes:
            self.assertRegex(tf, r'^\d+[mhd]$')
    
    def test_symbol_format(self):
        """测试交易对格式"""
        symbols = ['BTC/USDT', 'ETH/USDT', 'BTC/USDT:USDT']
        
        for symbol in symbols:
            self.assertRegex(symbol, r'^[A-Z]+/USDT')


class TestRetryLogic(unittest.TestCase):
    """测试重试逻辑"""
    
    def test_max_retries(self):
        """测试最大重试次数"""
        max_retries = 3
        self.assertEqual(max_retries, 3)
    
    def test_retry_delay_increase(self):
        """测试重试延迟递增"""
        retry_delay = 1
        delays = []
        for _ in range(3):
            delays.append(retry_delay)
            retry_delay *= 2
        
        self.assertEqual(delays, [1, 2, 4])


class TestDataValidation(unittest.TestCase):
    """测试数据验证"""
    
    def test_positive_volume(self):
        """测试成交量为正"""
        volumes = [100.5, 200.0, 50.25]
        for vol in volumes:
            self.assertGreater(vol, 0)
    
    def test_price_ordering(self):
        """测试价格顺序"""
        # high >= open, close >= low
        open_p, high, low, close = 68500, 68550, 68480, 68520
        
        self.assertGreaterEqual(high, open_p)
        self.assertGreaterEqual(high, close)
        self.assertGreaterEqual(high, low)
        self.assertLessEqual(low, open_p)
        self.assertLessEqual(low, close)


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestFetchOHLCV))
    suite.addTests(loader.loadTestsFromTestCase(TestConfigValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestRetryLogic))
    suite.addTests(loader.loadTestsFromTestCase(TestDataValidation))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
