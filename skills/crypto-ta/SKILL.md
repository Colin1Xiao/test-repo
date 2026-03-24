---
name: crypto-ta
description: 加密货币技术指标计算 - MA、EMA、RSI、MACD、布林带、KDJ 等。支持批量计算和实时信号生成。基于 pandas-ta 库。
metadata:
  openclaw:
    emoji: 📈
    version: 1.0.0
    requires:
      bins:
        - python3
        - pip3
      pip:
        - pandas
        - pandas-ta
        - numpy
---

# Crypto TA - 技术指标计算

计算加密货币交易的技术指标，支持日内高频交易所需的快速计算。

## 依赖安装

```bash
pip3 install pandas pandas-ta numpy
```

## 快速开始

### 计算单个指标

```bash
# 计算 RSI
python3 scripts/calculate_ta.py --input data/btc_1m.csv --indicators rsi --rsi-length 14

# 计算 MACD
python3 scripts/calculate_ta.py --input data/btc_1m.csv --indicators macd

# 计算布林带
python3 scripts/calculate_ta.py --input data/btc_1m.csv --indicators bbands
```

### 计算多个指标

```bash
# 计算所有常用指标
python3 scripts/calculate_ta.py --input data/btc_1m.csv --indicators all

# 自定义组合
python3 scripts/calculate_ta.py --input data/btc_1m.csv --indicators ema,rsi,macd,bbands
```

### 生成交易信号

```bash
# 基于指标生成买卖信号
python3 scripts/generate_signals.py --input data/btc_1m.csv --strategy ma_cross

# RSI 超买超卖信号
python3 scripts/generate_signals.py --input data/btc_1m.csv --strategy rsi
```

## 支持的指标

| 指标 | 参数 | 说明 |
|------|------|------|
| **MA/SMA** | length | 简单移动平均 |
| **EMA** | length | 指数移动平均 |
| **RSI** | length | 相对强弱指标 (14) |
| **MACD** | fast, slow, signal | 移动平均收敛发散 (12,26,9) |
| **BBANDS** | length, std | 布林带 (20,2) |
| **KDJ** | length | 随机指标 |
| **ATR** | length | 平均真实波幅 |
| **STOCH** | k, d | 随机振荡器 |
| **CCI** | length | 商品通道指标 |
| **ADX** | length | 平均趋向指标 |

## 输出格式

```json
{
  "timestamp": 1710172800000,
  "close": 68500,
  "rsi_14": 45.2,
  "macd": 120.5,
  "macd_signal": 115.3,
  "bb_upper": 69000,
  "bb_middle": 68500,
  "bb_lower": 68000
}
```

## 交易信号

内置策略信号生成：

- **ma_cross** - 均线交叉（金叉/死叉）
- **rsi** - RSI 超买超卖
- **macd** - MACD 交叉
- **bbands** - 布林带突破
- **combo** - 多指标组合

## 相关文件

- `scripts/calculate_ta.py` - 指标计算
- `scripts/generate_signals.py` - 信号生成
- `references/indicator_guide.md` - 指标使用指南
