# 宏观经济事件对加密货币影响研究

> 🐉 小龙出品 | 版本 1.0 | 2026-03-11

## 📁 项目结构

```
macro-research/
├── README.md                    # 本文件
├── macro_event_impact.md        # 研究报告 (核心文档)
├── event_driven_strategy.py     # 交易策略脚本
├── data_sources.py              # 数据源整合模块
├── event_database_sample.json   # 示例事件数据库
└── requirements.txt             # Python 依赖
```

## 📚 交付物说明

### 1. 研究报告 `macro_event_impact.md`

完整的研究报告，包含：
- 重要经济数据发布影响分析
- 国际重大事件影响分析
- 加密货币特有事件分析
- 事件影响量化模型
- 预测性交易策略
- 风险控制规则
- 实盘执行流程

### 2. 策略脚本 `event_driven_strategy.py`

核心交易策略实现：
- `EconomicEvent` - 经济事件数据类
- `ImpactScore` - 影响分数计算
- `EventDrivenStrategy` - 策略主类
- `BacktestEngine` - 回测引擎

**使用方法**:
```bash
# 运行演示
python event_driven_strategy.py

# 运行回测
python event_driven_strategy.py --backtest
```

### 3. 数据源整合 `data_sources.py`

统一数据获取接口：
- `ForexFactoryCalendar` - 财经日历
- `FREDEconomicData` - 美国经济数据
- `BinancePriceAPI` - BTC 价格数据
- `AlternativeMeSentiment` - 恐惧贪婪指数
- `GlassnodeAPI` - 链上数据
- `CryptoPanicAPI` - 新闻情感
- `DataAggregator` - 统一聚合器

**使用方法**:
```python
from data_sources import DataAggregator

async def main():
    aggregator = DataAggregator({
        'fred_api_key': 'YOUR_KEY',
        'glassnode_api_key': 'YOUR_KEY'
    })
    
    # 获取完整市场环境
    context = await aggregator.get_full_market_context()
    
    await aggregator.close_all()
```

## 🔧 安装依赖

```bash
pip install aiohttp pandas
```

## 📊 事件影响评分模型

```
影响分数 = 事件类型权重 × 影响范围 × 市场情绪 × 预期差系数
```

### 事件类型权重
| 事件 | 权重 |
|------|------|
| 美联储利率 | 5.0 |
| CPI 数据 | 4.0 |
| 非农就业 | 3.5 |
| 地缘政治 | 3.0-5.0 |
| 监管政策 | 2.0-4.0 |

### 风险等级
| 分数 | 等级 | 最大仓位 | 最大杠杆 |
|------|------|---------|---------|
| 0-3 | 绿色 | 100% | 10x |
| 3-7 | 黄色 | 70% | 5x |
| 7-12 | 橙色 | 40% | 3x |
| 12+ | 红色 | 20% | 2x |

## 🎯 核心策略

### 事件前 (T-24h)
- 降低杠杆至目标水平
- 设置价格警报
- 准备对冲工具

### 事件后 (T+0 至 T+5min)
- 记录实际值
- 计算预期差
- **不立即操作** (等待 2-3 分钟)

### 趋势确认 (T+15min 至 T+1h)
- 评估趋势方向
- 检查成交量确认
- 决定是否入场

## 📈 回测框架

```python
from event_driven_strategy import EventDrivenStrategy, BacktestEngine

# 创建策略
strategy = EventDrivenStrategy()

# 创建回测引擎
backtest = BacktestEngine(strategy, initial_capital=100000)

# 加载历史事件
backtest.load_events(events)

# 运行回测
results = backtest.run(sentiment_history, price_history)

# 查看结果
print(f"总收益率：{results['total_pnl_pct']:.2f}%")
print(f"胜率：{results['win_rate']:.2f}%")
print(f"最大回撤：{results['max_drawdown_pct']:.2f}%")
```

## 🔑 API 密钥配置

创建 `config.json`:
```json
{
  "fred_api_key": "your_fred_key",
  "glassnode_api_key": "your_glassnode_key",
  "cryptopanic_api_key": "your_cryptopanic_key"
}
```

获取密钥:
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- Glassnode: https://glassnode.com
- CryptoPanic: https://cryptopanic.com/developers/api/

## ⚠️ 风险提示

1. 本策略仅供学习研究，不构成投资建议
2. 加密货币市场波动极大，请谨慎交易
3. 历史表现不代表未来结果
4. 请根据自身风险承受能力调整参数

## 📝 更新日志

- **v1.0 (2026-03-11)**: 初始版本
  - 完成研究报告
  - 实现策略脚本
  - 整合数据源模块

---

*有问题？找小龙 🐉*
