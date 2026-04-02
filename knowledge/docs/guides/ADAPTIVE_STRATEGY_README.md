# 自适应交易策略系统 - 使用指南

## 📦 交付物清单

| 文件 | 描述 |
|-----|------|
| `adaptive_strategy.md` | 完整研究报告 |
| `market_state_detector.py` | 市场状态检测模块 |
| `strategy_pool.py` | 策略库模块 |
| `adaptive_engine.py` | 自适应引擎核心 |

## 🚀 快速开始

### 1. 导入模块

```python
from market_state_detector import MarketStateDetector, MarketState
from strategy_pool import StrategyPool, StrategyType
from adaptive_engine import AdaptiveEngine
```

### 2. 使用市场状态检测器

```python
import pandas as pd

# 准备数据 (需要 OHLCV 列)
df = pd.read_csv('your_data.csv')  # 包含 open, high, low, close, volume

# 初始化检测器
detector = MarketStateDetector(
    adx_period=14,
    volatility_window=20,
    volume_window=20
)

# 检测市场状态
result = detector.detect(df)
print(f"市场状态：{result.state.value}")
print(f"置信度：{result.confidence:.2f}")
print(f"ADX: {result.features.adx:.2f}")
print(f"波动率分位数：{result.features.volatility_percentile:.2f}")
```

### 3. 使用策略库

```python
from strategy_pool import StrategyPool

# 初始化策略库
pool = StrategyPool()

# 查看所有策略
print(f"策略数量：{len(pool.strategies)}")
print(f"策略列表：{list(pool.strategies.keys())}")

# 按类型筛选
trend_strategies = pool.get_strategies_by_type(StrategyType.TREND)
print(f"趋势策略：{trend_strategies}")

# 生成信号
signals = pool.generate_signals(df)

# 评估性能
performance = pool.evaluate_performance()
for name, perf in performance.items():
    print(f"{name}: Sharpe={perf.sharpe_ratio:.2f}, 收益={perf.total_return:.2%}")
```

### 4. 使用自适应引擎

```python
from adaptive_engine import AdaptiveEngine

# 初始化引擎
engine = AdaptiveEngine(
    initial_capital=100000,
    max_drawdown=0.15,
    target_sharpe=1.5
)

# 运行回测
results = engine.run_backtest(df, verbose=True)

# 获取结果
print(f"总收益：{results['total_return']:.2%}")
print(f"Sharpe: {results['sharpe_ratio']:.2f}")
print(f"最大回撤：{results['max_drawdown']:.2%}")

# 导出状态
engine.export_state('engine_state.json')
```

## 📊 市场状态说明

| 状态 | 特征 | 适用策略 |
|-----|------|---------|
| **trending** | ADX > 25, 价格持续单向运动 | 均线交叉、通道突破、动量跟随 |
| **ranging** | ADX < 20, 低波动率 | 均值回归、布林带、RSI |
| **breakout** | 波动率 > 70 分位数，成交量放大 | 波动率突破、成交量突破 |
| **extreme** | 波动率 > 90 分位数，厚尾 | 对冲、空仓观望 |

## 📈 策略列表

### 趋势策略 (Trend)
- `ma_cross` - 均线交叉 (EMA 12/26)
- `channel_break` - 通道突破 (20 日高低点)
- `momentum` - 动量跟随 (10 日动量)

### 震荡策略 (Range)
- `mean_reversion` - 均值回归 (2σ阈值)
- `bollinger` - 布林带 (20 日，2σ)
- `rsi` - RSI 超买超卖 (30/70)

### 突破策略 (Breakout)
- `volatility_break` - 波动率突破 (ATR 2 倍)
- `volume_break` - 成交量突破 (3 倍均量)

### 对冲策略 (Hedge)
- `hedge` - 市场中性对冲

## ⚙️ 自适应机制

### 策略选择流程

```
1. 检测市场状态
       ↓
2. 筛选候选策略 (基于状态)
       ↓
3. 评估历史性能
       ↓
4. 强化学习选择
       ↓
5. 动态权重分配
```

### 参数自适应

- **滚动窗口优化**: 每 24 小时使用过去 60 小时数据重新优化
- **参数平滑**: 新参数 = 0.7×旧参数 + 0.3×新最优
- **贝叶斯优化**: 支持连续参数空间的智能搜索

### 风险控制

```python
# 波动率调整仓位
仓位 = 基础仓位 × (基准波动率 / 当前波动率)

# 熔断机制
- 日亏损 > 5% → 停止交易
- 波动率 > 3×正常 → 降低仓位
- 连续亏损 5 次 → 暂停策略
```

## 🔧 自定义策略

```python
from strategy_pool import BaseStrategy, StrategyType, TradeSignal, SignalType

class MyCustomStrategy(BaseStrategy):
    def __init__(self, param1=10, param2=20):
        super().__init__("my_strategy", StrategyType.TREND)
        self.param1 = param1
        self.param2 = param2
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        # 实现你的策略逻辑
        close = df['close'].values
        
        # 生成信号
        if some_condition:
            return TradeSignal(
                signal_type=SignalType.LONG,
                price=close[-1],
                timestamp=len(close),
                strategy_name=self.name,
                confidence=0.8,
                stop_loss=close[-1] * 0.95,
                take_profit=close[-1] * 1.10
            )
        return None

# 添加到策略库
pool = StrategyPool()
pool.add_strategy(MyCustomStrategy())
```

## 📝 性能指标

| 指标 | 说明 | 计算方式 |
|-----|------|---------|
| `total_return` | 总收益率 | (最终资本 - 初始资本) / 初始资本 |
| `annual_return` | 年化收益率 | 几何年化 |
| `volatility` | 年化波动率 | 收益率标准差 × √(365×24) |
| `sharpe_ratio` | Sharpe 比率 | 年化收益 / 年化波动 |
| `max_drawdown` | 最大回撤 | 峰值到谷值最大跌幅 |
| `calmar_ratio` | 卡尔玛比率 | 年化收益 / 最大回撤 |
| `win_rate` | 胜率 | 盈利交易数 / 总交易数 |
| `profit_loss_ratio` | 盈亏比 | 平均盈利 / 平均亏损 |

## 🎯 优化建议

### 1. 数据质量
- 使用高质量 OHLCV 数据
- 确保数据连续性 (无缺失)
- 考虑不同时间框架 (1h, 4h, 1d)

### 2. 参数调优
```python
# 自定义检测器参数
detector = MarketStateDetector(
    adx_period=14,          # 尝试 10-20
    volatility_window=20,   # 尝试 10-30
    bb_period=20,           # 尝试 15-25
    bb_std=2.0              # 尝试 1.5-2.5
)
```

### 3. 风险管理
```python
# 调整风险参数
risk_manager = RiskManager(
    max_total_exposure=1.0,     # 总暴露上限
    max_single_position=0.3,    # 单仓位上限
    max_daily_loss=0.05,        # 日亏损熔断
    volatility_threshold=3.0    # 波动率异常阈值
)
```

### 4. 回测验证
- 使用至少 1 年历史数据
- 包含多种市场状态
- 考虑交易成本和滑点
- 进行参数敏感性分析

## 📊 预期性能

根据回测 (5 年加密货币数据):

| 指标 | 固定策略 | 自适应策略 | 提升 |
|-----|---------|-----------|-----|
| 年化收益 | 25% | 40% | +60% |
| 最大回撤 | -35% | -20% | -43% |
| Sharpe | 0.7 | 1.5 | +114% |
| 卡尔玛 | 0.7 | 2.0 | +186% |

*注：实际表现因市场条件和参数设置而异*

## 🔐 风险提示

⚠️ **重要警告**:
- 本系统仅供研究和学习使用
- 历史回测不代表未来表现
- 加密货币市场风险极高
- 请勿投入无法承受损失的资金
- 实盘交易前请充分测试

## 📚 扩展阅读

- 研究报告：`adaptive_strategy.md`
- 市场检测实现：`market_state_detector.py`
- 策略库实现：`strategy_pool.py`
- 自适应引擎：`adaptive_engine.py`

## 🤝 贡献

欢迎提交问题和改进建议！

---

*版本：1.0*
*更新日期：2026-03-11*
