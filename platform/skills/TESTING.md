# Crypto Skills Testing Framework
加密货币技能测试框架

## 概述

本测试框架为 crypto-data、crypto-ta 和 crypto-risk 三个核心技能提供自动化测试支持。

## 测试结构

```
skills/
├── crypto-data/
│   └── tests/
│       ├── __init__.py
│       ├── test_fetch_ohlcv.py      # K线数据获取测试
│       ├── test_fetch_orderbook.py  # 订单簿测试
│       └── run_tests.py             # 测试运行器
├── crypto-ta/
│   └── tests/
│       ├── __init__.py
│       ├── test_calculate_ta.py     # 指标计算测试
│       ├── test_generate_signals.py # 信号生成测试
│       └── run_tests.py
├── crypto-risk/
│   └── tests/
│       ├── __init__.py
│       ├── test_calculate_position.py  # 仓位计算测试
│       ├── test_calculate_stoploss.py  # 止损计算测试
│       └── run_tests.py
├── run_all_tests.py                 # 统一测试运行器
└── TESTING.md                       # 本文档
```

## 快速开始

### 运行所有测试

```bash
cd /Users/colin/.openclaw/workspace/skills
python3 run_all_tests.py
```

### 运行单个技能测试

```bash
# Crypto Data 测试
python3 crypto-data/tests/run_tests.py

# Crypto TA 测试
python3 crypto-ta/tests/run_tests.py

# Crypto Risk 测试
python3 crypto-risk/tests/run_tests.py
```

### 详细输出

```bash
python3 run_all_tests.py --verbose
```

### 生成覆盖率报告

```bash
python3 run_all_tests.py --coverage
```

覆盖率报告将生成在 `tests/htmlcov/index.html`

## 测试类型

### 1. 单元测试 (Unit Tests)

测试单个函数或方法的正确性。

```python
def test_basic_calculation(self):
    result = calculate_position_size(
        balance=10000,
        risk_pct=2,
        stop_loss_pct=1.5,
        leverage=1
    )
    self.assertIn('balance', result)
    self.assertIn('position_size', result)
```

### 2. 集成测试 (Integration Tests)

测试多个组件的协同工作。

```python
def test_full_workflow(self):
    config = load_config()
    exchange = init_exchange(config)
    data = fetch_ohlcv('BTC/USDT', '1m', 100, exchange)
    self.assertIsNotNone(data)
```

### 3. 边界测试 (Edge Case Tests)

测试异常情况的处理。

```python
def test_insufficient_data(self):
    small_df = pd.DataFrame({'close': [68000, 68100, 68200]})
    rsi = ta.rsi(small_df['close'], length=14)
    self.assertTrue(rsi.isna().all())
```

## 测试覆盖范围

### Crypto Data 测试

- ✅ 配置加载 (`test_fetch_ohlcv.py::TestLoadConfig`)
- ✅ 交易所初始化 (`test_fetch_ohlcv.py::TestInitExchange`)
- ✅ K线数据获取 (`test_fetch_ohlcv.py::TestFetchOHLCV`)
- ✅ 错误重试机制 (`test_fetch_ohlcv.py::TestFetchOHLCV::test_fetch_ohlcv_retry_on_rate_limit`)
- ✅ CSV 导出功能 (`test_fetch_ohlcv.py::TestSaveToCSV`)
- ✅ 订单簿结构 (`test_fetch_orderbook.py::TestFetchOrderbook`)
- ✅ 深度计算 (`test_fetch_orderbook.py::TestOrderbookMetrics`)

### Crypto TA 测试

- ✅ 数据加载 (`test_calculate_ta.py::TestLoadData`)
- ✅ SMA 计算 (`test_calculate_ta.py::TestIndicators::test_sma_calculation`)
- ✅ EMA 计算 (`test_calculate_ta.py::TestIndicators::test_ema_calculation`)
- ✅ RSI 计算 (`test_calculate_ta.py::TestIndicators::test_rsi_calculation`)
- ✅ MACD 计算 (`test_calculate_ta.py::TestIndicators::test_macd_calculation`)
- ✅ 布林带计算 (`test_calculate_ta.py::TestIndicators::test_bbands_calculation`)
- ✅ ATR 计算 (`test_calculate_ta.py::TestIndicators::test_atr_calculation`)
- ✅ 信号生成 (`test_generate_signals.py::TestSignalGeneration`)
- ✅ 均线策略 (`test_generate_signals.py::TestMAStrategy`)
- ✅ RSI 策略 (`test_generate_signals.py::TestRSIStrategy`)
- ✅ 边界情况 (`test_calculate_ta.py::TestEdgeCases`)

### Crypto Risk 测试

- ✅ 仓位大小计算 (`test_calculate_position.py::TestCalculatePositionSize`)
- ✅ 风险金额计算 (`test_calculate_position.py::test_risk_amount_calculation`)
- ✅ 保证金计算 (`test_calculate_position.py::test_margin_calculation`)
- ✅ 爆仓幅度计算 (`test_calculate_position.py::test_liquidation_percentage`)
- ✅ 止损计算 (`test_calculate_stoploss.py::TestStopLossCalculation`)
- ✅ 止盈计算 (`test_calculate_stoploss.py::test_take_profit_calculation`)
- ✅ 盈亏比计算 (`test_calculate_stoploss.py::test_risk_reward_ratio`)
- ✅ 追踪止损 (`test_calculate_stoploss.py::test_trailing_stop`)
- ✅ 风险管理规则 (`test_calculate_position.py::TestRiskManagementRules`)

## 添加新测试

### 1. 创建测试文件

在对应技能的 `tests/` 目录下创建 `test_*.py` 文件：

```python
#!/usr/bin/env python3
"""Tests for new_module.py"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestNewFeature(unittest.TestCase):
    def test_something(self):
        self.assertTrue(True)


def run_tests():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestNewFeature))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
```

### 2. 运行新测试

```bash
python3 crypto-data/tests/test_new_module.py
```

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Crypto Skills Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install pandas pandas-ta numpy ccxt coverage
      
      - name: Run tests
        run: |
          cd skills
          python3 run_all_tests.py --ci
      
      - name: Generate coverage report
        run: |
          cd skills
          python3 run_all_tests.py --coverage
```

## 最佳实践

1. **每个功能一个测试类**
   ```python
   class TestCalculatePositionSize(unittest.TestCase):
       """测试仓位大小计算"""
   ```

2. **使用描述性测试方法名**
   ```python
   def test_risk_amount_calculation(self):
       """测试风险金额计算"""
   ```

3. **测试边界情况**
   ```python
   def test_zero_stop_loss(self):
       with self.assertRaises(ZeroDivisionError):
           calculate_position_size(balance=10000, risk_pct=2, stop_loss_pct=0)
   ```

4. **使用 setUp 创建测试数据**
   ```python
   def setUp(self):
       self.sample_data = pd.DataFrame({...})
   ```

5. **清理测试资源**
   ```python
   def tearDown(self):
       # 清理临时文件等
       pass
   ```

## 故障排除

### 导入错误

确保在测试文件顶部添加：
```python
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
```

### 依赖缺失

安装必需的包：
```bash
pip3 install pandas pandas-ta numpy ccxt coverage
```

### 测试发现失败

确保测试文件以 `test_` 开头，测试类继承 `unittest.TestCase`。

## 更新日志

- 2024-03-14: 初始测试框架创建
  - crypto-data: 2 个测试文件，20+ 测试用例
  - crypto-ta: 2 个测试文件，25+ 测试用例
  - crypto-risk: 2 个测试文件，30+ 测试用例
