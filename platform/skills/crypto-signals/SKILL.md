---
name: crypto-signals
description: 加密货币实时交易信号生成 - 监控多币种、多时间框架，自动生成买卖信号。支持自定义策略和警报推送。
metadata:
  openclaw:
    emoji: 🚨
    version: 1.0.0
    requires:
      bins:
        - python3
      pip:
        - ccxt
        - pandas
        - pandas-ta
---

# Crypto Signals - 实时交易信号

实时监控加密货币市场，自动生成交易信号。

## 快速开始

### 监控单个币种

```bash
# 监控 BTC 1 分钟信号
python3 scripts/monitor.py --symbol BTC/USDT --timeframe 1m --strategy combo

# 监控 ETH 5 分钟信号
python3 scripts/monitor.py --symbol ETH/USDT --timeframe 5m --strategy ma_cross
```

### 监控多个币种

```bash
# 批量监控
python3 scripts/monitor.py --symbols BTC/USDT,ETH/USDT,SOL/USDT --timeframe 5m
```

### 持续监控模式

```bash
# 持续监控，每 30 秒检查一次
python3 scripts/monitor.py --symbol BTC/USDT --interval 30 --continuous
```

## 内置策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **ma_cross** | 均线交叉 | 趋势行情 |
| **rsi** | RSI 超买超卖 | 震荡行情 |
| **macd** | MACD 交叉 | 趋势反转 |
| **combo** | 多指标组合 | 通用（推荐） |
| **scalp** | 超短线剥头皮 | 1 分钟高频 |

## 信号强度

- **STRONG_BUY** - 强烈买入（多指标共振）
- **BUY** - 买入
- **HOLD** - 持有/观望
- **SELL** - 卖出
- **STRONG_SELL** - 强烈卖出

## 输出格式

```json
{
  "timestamp": 1710172800000,
  "symbol": "BTC/USDT",
  "signal": "BUY",
  "price": 68500,
  "reason": "多指标共振买入",
  "confidence": 0.85
}
```

## 相关文件

- `scripts/monitor.py` - 实时监控
- `scripts/backtest.py` - 策略回测
- `references/strategies.md` - 策略说明
