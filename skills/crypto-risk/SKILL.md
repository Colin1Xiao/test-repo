---
name: crypto-risk
description: 加密货币交易风险管理 - 仓位计算、止损止盈、杠杆管理、风险控制。支持高杠杆日内交易的风险计算。
metadata:
  openclaw:
    emoji: 🛡️
    version: 1.0.0
    requires:
      bins:
        - python3
---

# Crypto Risk - 风险管理

高杠杆交易的风险管理工具，确保资金安全。

## 快速开始

### 仓位计算

```bash
# 计算仓位大小
python3 scripts/calculate_position.py --balance 10000 --risk 2 --stop-loss 1.5

# 计算可开仓位（100 倍杠杆）
python3 scripts/calculate_position.py --balance 10000 --leverage 100 --risk 2
```

### 止损止盈

```bash
# 计算止损止盈价格
python3 scripts/calculate_stoploss.py --entry 68500 --stop-loss 2 --take-profit 4

# 追踪止损
python3 scripts/calculate_stoploss.py --entry 68500 --trailing 1.5
```

### 风险评估

```bash
# 评估当前仓位风险
python3 scripts/risk_check.py --position 100000 --leverage 50 --balance 10000
```

## 核心公式

**仓位大小** = (账户余额 × 风险%) ÷ 止损%

**示例**：
- 账户：10,000 USDT
- 风险：2% (200 USDT)
- 止损：1.5%
- 仓位 = 200 ÷ 0.015 = 13,333 USDT

**爆仓价格** = 入场价 × (1 - 1/杠杆) [做多]

## 风控规则

| 规则 | 建议值 | 说明 |
|------|--------|------|
| 单笔风险 | 1-3% | 每笔最多亏损 |
| 总仓位 | ≤30% | 总资金占用 |
| 杠杆 | ≤10 倍 | 日内可 20-50 倍 |
| 止损 | 必设 | 2-3% 硬止损 |
| 止盈 | 2:1 | 盈亏比至少 2:1 |

## 相关文件

- `scripts/calculate_position.py` - 仓位计算
- `scripts/calculate_stoploss.py` - 止损止盈
- `scripts/risk_check.py` - 风险评估
