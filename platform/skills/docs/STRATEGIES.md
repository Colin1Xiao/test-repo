# 📈 策略配置指南

> 详解每种交易策略的参数、适用场景和优化建议

---

## 策略总览

### 基础策略

| 策略 | 时间框架 | 难度 | 胜率 | 推荐度 |
|------|----------|------|------|--------|
| **ma_cross** | 5m-15m | ⭐ | 60% | ⭐⭐⭐⭐ |
| **rsi** | 1m-5m | ⭐⭐ | 55% | ⭐⭐⭐ |
| **macd** | 5m-1h | ⭐⭐ | 58% | ⭐⭐⭐⭐ |
| **combo** | 5m-15m | ⭐⭐⭐ | 65% | ⭐⭐⭐⭐⭐ |
| **scalp** | 1m | ⭐⭐⭐⭐ | 50% | ⭐⭐ |

### 高级策略 ⭐ NEW

| 策略 | 功能 | 难度 | 推荐度 |
|------|------|------|--------|
| **blackswan** | 黑天鹅防护 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必配 |
| **pyramid** | 金字塔滚仓 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **stoploss_manager** | 专业止损 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必配 |

---

## 1. 均线交叉策略 (ma_cross)

### 原理
利用短期均线上穿/下穿长期均线产生买卖信号。

### 参数配置

```bash
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy ma_cross \
  --ma-fast 9 \
  --ma-slow 20
```

| 参数 | 默认值 | 说明 | 优化建议 |
|------|--------|------|----------|
| `ma-fast` | 9 | 快速均线周期 | 短线可设为 7-9 |
| `ma-slow` | 20 | 慢速均线周期 | 趋势可设为 20-50 |

### 适用场景
- ✅ 趋势明显的行情
- ✅ 5 分钟以上时间框架
- ❌ 震荡行情（假信号多）

### 信号规则

**买入信号**：
- EMA9 上穿 EMA20（金叉）
- 价格 > EMA9 > EMA20

**卖出信号**：
- EMA9 下穿 EMA20（死叉）
- 价格 < EMA9 < EMA20

### 实盘配置示例

```json
{
  "strategy": "ma_cross",
  "symbol": "BTC/USDT",
  "timeframe": "5m",
  "parameters": {
    "ma_fast": 9,
    "ma_slow": 20
  },
  "risk": {
    "leverage": 10,
    "stop_loss": 2.0,
    "take_profit": 4.0
  }
}
```

---

## 2. RSI 策略 (rsi)

### 原理
利用相对强弱指标判断超买超卖。

### 参数配置

```bash
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy rsi \
  --rsi-length 14 \
  --rsi-oversold 30 \
  --rsi-overbought 70
```

| 参数 | 默认值 | 说明 | 优化建议 |
|------|--------|------|----------|
| `rsi-length` | 14 | RSI 周期 | 短线可用 7-9 |
| `rsi-oversold` | 30 | 超卖阈值 | 激进可设为 25 |
| `rsi-overbought` | 70 | 超买阈值 | 激进可设为 75 |

### 适用场景
- ✅ 震荡行情
- ✅ 1-5 分钟超短线
- ❌ 强趋势行情（RSI 可能钝化）

### 信号规则

**买入信号**：
- RSI < 30（超卖区）
- RSI 从下向上突破 30

**卖出信号**：
- RSI > 70（超买区）
- RSI 从上向下跌破 70

### 实盘配置示例

```json
{
  "strategy": "rsi",
  "symbol": "ETH/USDT",
  "timeframe": "1m",
  "parameters": {
    "rsi_length": 9,
    "rsi_oversold": 25,
    "rsi_overbought": 75
  },
  "risk": {
    "leverage": 20,
    "stop_loss": 1.0,
    "take_profit": 2.0
  }
}
```

---

## 3. MACD 策略 (macd)

### 原理
利用 MACD 线与信号线的交叉判断趋势。

### 参数配置

```bash
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy macd \
  --macd-fast 12 \
  --macd-slow 26 \
  --macd-signal 9
```

| 参数 | 默认值 | 说明 | 优化建议 |
|------|--------|------|----------|
| `macd-fast` | 12 | 快线周期 | 短线可用 8-12 |
| `macd-slow` | 26 | 慢线周期 | 一般保持 26 |
| `macd-signal` | 9 | 信号线周期 | 可调整为 6-9 |

### 适用场景
- ✅ 趋势反转点
- ✅ 5 分钟 -1 小时框架
- ❌ 极短线（1 分钟噪音大）

### 信号规则

**买入信号**：
- MACD 线上穿信号线（金叉）
- MACD 柱状图由负转正

**卖出信号**：
- MACD 线下穿信号线（死叉）
- MACD 柱状图由正转负

### 实盘配置示例

```json
{
  "strategy": "macd",
  "symbol": "BTC/USDT",
  "timeframe": "15m",
  "parameters": {
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9
  },
  "risk": {
    "leverage": 10,
    "stop_loss": 2.5,
    "take_profit": 5.0
  }
}
```

---

## 4. 组合策略 (combo) ⭐ 推荐

### 原理
综合 RSI、MACD、均线多个指标，提高信号准确性。

### 参数配置

```bash
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy combo \
  --combo-strict true
```

| 参数 | 默认值 | 说明 | 优化建议 |
|------|--------|------|----------|
| `combo-strict` | false | 严格模式（需多指标共振） | 实盘建议 true |

### 适用场景
- ✅ 所有行情
- ✅ 实盘交易（推荐）
- ✅ 5-15 分钟框架

### 信号规则

**强烈买入 (STRONG_BUY)**：
- RSI < 40 且 MACD 金叉 且 价格 > EMA9
- 三个指标同时发出买入信号

**买入 (BUY)**：
- 两个指标发出买入信号

**持有 (HOLD)**：
- 信号不明确或指标冲突

**卖出/强烈卖出**：
- 与买入条件相反

### 实盘配置示例（推荐）

```json
{
  "strategy": "combo",
  "symbol": "BTC/USDT",
  "timeframe": "5m",
  "parameters": {
    "combo_strict": true,
    "rsi_length": 14,
    "ma_fast": 9,
    "ma_slow": 20
  },
  "risk": {
    "leverage": 10,
    "stop_loss": 2.0,
    "take_profit": 4.0,
    "trailing_stop": 1.0
  }
}
```

---

## 5. 剥头皮策略 (scalp)

### 原理
超短线快速进出，赚取微小价差。

### 参数配置

```bash
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 1m \
  --strategy scalp \
  --scalp-fast true
```

| 参数 | 默认值 | 说明 | 优化建议 |
|------|--------|------|----------|
| `scalp-fast` | false | 快速模式 | 需要快速执行 |

### 适用场景
- ✅ 1 分钟超短线
- ✅ 高流动性币种（BTC/ETH）
- ❌ 新手（难度高）
- ❌ 低流动性币种

### 信号规则

**买入信号**：
- RSI < 30
- 价格触及布林带下轨

**卖出信号**：
- RSI > 70
- 价格触及布林带上轨

### 实盘配置示例

```json
{
  "strategy": "scalp",
  "symbol": "BTC/USDT",
  "timeframe": "1m",
  "parameters": {
    "rsi_length": 7,
    "rsi_oversold": 30,
    "rsi_overbought": 70
  },
  "risk": {
    "leverage": 30,
    "stop_loss": 0.5,
    "take_profit": 1.0,
    "max_holding_time": 300
  }
}
```

> ⚠️ **警告**：此策略风险极高，仅适合经验丰富的交易者！

---

## 策略优化建议

### 1. 回测验证

```bash
# 回测策略
python3 scripts/backtest.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategy combo \
  --balance 10000 \
  --days 30
```

### 2. 参数调优

- 先用默认参数运行 1 周
- 记录每次交易的盈亏
- 根据结果微调参数
- **避免过度拟合**

### 3. 多策略组合

```bash
# 同时监控多个策略
python3 scripts/monitor.py \
  --symbol BTC/USDT \
  --timeframe 5m \
  --strategies combo,ma_cross,rsi
```

只在多个策略共振时交易，提高胜率。

---

## 时间框架选择

| 交易风格 | 推荐时间框架 | 持仓时间 | 杠杆建议 |
|----------|--------------|----------|----------|
| 超短线剥头皮 | 1m | < 5 分钟 | 20-50x |
| 日内波段 | 5m | 15-60 分钟 | 10-20x |
| 日线趋势 | 15m-1h | 数小时 | 5-10x |

---

## 常见问题

**Q: 哪个策略最好？**
A: 没有最好的策略，只有最适合的。新手推荐 `combo` 策略。

**Q: 参数需要经常调整吗？**
A: 不需要。市场状态变化时才调整，一般 1-2 周检查一次。

**Q: 可以同时运行多个策略吗？**
A: 可以，但建议先用一个策略熟悉流程。

**Q: 回测赚钱，实盘亏钱？**
A: 正常。回测不考虑滑点、手续费、情绪因素。

---

> 💡 **提示**：策略只是工具，风险管理才是核心！详见 [RISK_GUIDE.md](RISK_GUIDE.md)
