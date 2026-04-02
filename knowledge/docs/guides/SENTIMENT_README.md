# 市场情绪分析系统 - 使用指南

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements_sentiment.txt
```

### 2. 配置 API 密钥

```bash
# Twitter API (可选，用于采集 Twitter 数据)
export TWITTER_API_KEY="your_api_key"
export TWITTER_API_SECRET="your_api_secret"
export TWITTER_BEARER_TOKEN="your_bearer_token"
```

### 3. 运行流程

#### 步骤 1: 数据采集
```bash
python data_collector.py
```
- 采集社交媒体、新闻、交易数据
- 数据保存到 `./collected_data/` 目录

#### 步骤 2: 情感分析
```bash
python sentiment_analyzer.py
```
- 使用 FinBERT 模型分析情感
- 结果保存到 `./sentiment_results/` 目录

#### 步骤 3: 指标计算与信号生成
```bash
python sentiment_indicators.py
```
- 计算综合情绪指数 (CSI)
- 生成交易信号
- 仪表盘数据保存到 `./dashboard/` 目录

---

## 模块说明

### data_collector.py - 数据采集

**功能**:
- Twitter 数据采集 (需要 API 密钥)
- Reddit 数据采集 (公开 API)
- 新闻 RSS 采集
- 交易所交易数据采集

**输出格式** (JSONL):
```json
{
  "source": "twitter",
  "content": "Bitcoin is breaking out!",
  "author": "user123",
  "timestamp": "2025-03-11T12:00:00",
  "likes": 1500,
  "shares": 300
}
```

### sentiment_analyzer.py - 情感分析

**功能**:
- 使用 FinBERT 进行情感分类
- 支持批量处理
- 计算情感指标

**情感分类**:
- very_negative (极负面): -1.0
- negative (负面): -0.5
- neutral (中性): 0.0
- positive (正面): +0.5
- very_positive (极正面): +1.0

### sentiment_indicators.py - 指标计算

**综合情绪指数 (CSI)**:
```
CSI = 0.3×社交媒体 + 0.3×新闻媒体 + 0.2×搜索趋势 + 0.2×交易数据
```

**情绪等级**:
| CSI 范围 | 等级 | 含义 |
|---------|------|------|
| < 20 | 极度恐惧 | 可能见底 |
| 20-40 | 恐惧 | 偏空 |
| 40-60 | 中性 | 震荡 |
| 60-80 | 贪婪 | 偏多 |
| > 80 | 极度贪婪 | 可能见顶 |

**交易信号**:
- 极度恐惧 + 支撑 → 买入
- 极度贪婪 + 阻力 → 卖出
- 情绪背离 → 反转信号

---

## 编程接口

### 情感分析
```python
from sentiment_analyzer import SentimentAnalyzer

analyzer = SentimentAnalyzer(model_name="ProsusAI/finbert")
result = analyzer.analyze("Bitcoin is going to the moon!")

print(f"情感：{result.label}")
print(f"极性：{result.polarity}")
print(f"置信度：{result.confidence}")
```

### 指标计算
```python
from sentiment_indicators import SentimentIndicatorCalculator

calculator = SentimentIndicatorCalculator()

csi = calculator.calculate_csi(
    social_media_score=75,
    news_score=80,
    search_trend_score=65,
    trading_data_score=70
)

print(f"CSI: {csi.csi}")
print(f"情绪等级：{csi.sentiment_level}")
```

### 信号生成
```python
from sentiment_indicators import SentimentDashboard

dashboard = SentimentDashboard()

state = dashboard.update(
    social_score=25,
    news_score=30,
    search_score=35,
    trading_score=20
)

print(f"当前 CSI: {state['csi']}")
print(f"信号数量：{state['signals_count']}")
```

---

## 实时运行

### 完整管道 (24 小时)
```python
import asyncio
from data_collector import DataPipeline, TwitterCollector, RedditCollector, NewsCollector, TradingDataCollector

async def run_pipeline():
    pipeline = DataPipeline(output_dir="./collected_data")
    
    # 添加采集器
    pipeline.add_collector(RedditCollector())
    pipeline.add_collector(NewsCollector())
    pipeline.add_collector(TradingDataCollector())
    
    # 运行 24 小时
    await pipeline.run(duration_hours=24)

asyncio.run(run_pipeline())
```

### 定时任务 (cron)
```bash
# 每小时采集数据
0 * * * * cd /path/to/workspace && python data_collector.py

# 每 15 分钟分析情感
*/15 * * * * cd /path/to/workspace && python sentiment_analyzer.py

# 每 5 分钟计算指标
*/5 * * * * cd /path/to/workspace && python sentiment_indicators.py
```

---

## 输出目录结构

```
workspace/
├── collected_data/          # 采集的原始数据
│   └── data_20250311.jsonl
├── sentiment_results/       # 情感分析结果
│   ├── results_20250311_120000.jsonl
│   └── metrics_20250311_120000.json
├── dashboard/               # 仪表盘数据
│   ├── csi_history.jsonl
│   └── signals_20250311_120000.json
├── data_collector.py        # 数据采集脚本
├── sentiment_analyzer.py    # 情感分析脚本
├── sentiment_indicators.py  # 指标计算脚本
├── sentiment_analysis.md    # 研究报告
└── requirements_sentiment.txt
```

---

## 注意事项

1. **API 限流**: Twitter、Google Trends 等有严格限流，请合理设置采集频率
2. **模型大小**: FinBERT 模型约 400MB，首次运行需要下载
3. **GPU 加速**: 情感分析支持 CUDA，可显著提升速度
4. **数据存储**: 长期运行建议使用数据库 (InfluxDB/PostgreSQL)
5. **实盘风险**: 信号仅供参考，实盘交易需谨慎

---

## 扩展开发

### 添加新数据源
```python
from data_collector import DataCollector

class MyCustomCollector(DataCollector):
    async def collect(self):
        # 实现数据采集逻辑
        yield SocialPost(...)
```

### 自定义情感模型
```python
from sentiment_analyzer import SentimentAnalyzer

# 使用其他模型
analyzer = SentimentAnalyzer(model_name="cardiffnlp/twitter-roberta-base-sentiment")
```

### 自定义信号策略
```python
from sentiment_indicators import SignalGenerator

class MySignalGenerator(SignalGenerator):
    def _check_buy_signals(self, ...):
        # 实现自定义买入逻辑
        pass
```

---

## 技术支持

- 研究报告：`sentiment_analysis.md`
- 问题反馈：查看日志输出
- 性能优化：使用 GPU、批量处理、数据缓存

---

*版本：v1.0 | 更新时间：2025-03-11*
