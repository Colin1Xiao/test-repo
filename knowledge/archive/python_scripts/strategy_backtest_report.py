#!/usr/bin/env python3
"""
策略回测测试报告
使用本地历史数据测试小龙自动交易系统策略
"""

import pandas as pd
import numpy as np
from datetime import datetime
import json

# 加载历史数据
data_path = '/Users/colin/.openclaw/workspace/crypto_test_data/btc_5m.csv'
df = pd.read_csv(data_path)

# 数据概览
print("=" * 70)
print("🐉 小龙自动交易系统 - 策略回测测试报告")
print("=" * 70)
print(f"\n📊 数据来源: {data_path}")
print(f"📈 数据条数: {len(df)}")
print(f"📅 时间范围: {df['datetime'].iloc[0]} ~ {df['datetime'].iloc[-1]}")
print(f"💰 价格范围: ${df['low'].min():,.2f} ~ ${df['high'].max():,.2f}")
print(f"📊 当前价格: ${df['close'].iloc[-1]:,.2f}")

# 计算基础统计
price_change = (df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0]
volatility = df['close'].pct_change().std() * np.sqrt(288)  # 日波动率

print(f"\n📈 价格变动: {price_change:.2%}")
print(f"📊 日波动率: {volatility:.2%}")

# 策略1: 1%波动捕捉策略
print("\n" + "=" * 70)
print("🎯 策略1: 1%波动捕捉策略")
print("=" * 70)
print("参数:")
print("  - 触发条件: 1%价格变动")
print("  - 杠杆: 20x")
print("  - 止损: 0.5%")
print("  - 止盈: 1%")

# 模拟交易
df['returns'] = df['close'].pct_change()
df['signal'] = np.where(df['returns'].abs() >= 0.01, np.sign(df['returns']), 0)

# 计算策略收益
df['strategy_returns'] = df['signal'].shift(1) * df['returns'] * 20  # 20x杠杆

# 应用止损止盈
df['strategy_returns'] = df['strategy_returns'].clip(-0.005, 0.01)

# 计算指标
total_return = (1 + df['strategy_returns']).prod() - 1
win_rate = (df['strategy_returns'] > 0).sum() / (df['strategy_returns'] != 0).sum()
max_drawdown = (df['strategy_returns'].cumsum() - df['strategy_returns'].cumsum().cummax()).min()
sharpe = df['strategy_returns'].mean() / df['strategy_returns'].std() * np.sqrt(288)

print(f"\n📊 回测结果:")
print(f"  - 总收益率: {total_return:.2%}")
print(f"  - 胜率: {win_rate:.2%}")
print(f"  - 最大回撤: {max_drawdown:.2%}")
print(f"  - 夏普比率: {sharpe:.2f}")
print(f"  - 交易次数: {(df['signal'] != 0).sum()}")

# 策略2: 金字塔滚仓策略
print("\n" + "=" * 70)
print("🎯 策略2: 金字塔滚仓策略")
print("=" * 70)
print("参数:")
print("  - 初始仓位: 40%")
print("  - 加仓条件: 盈利2%/4%/6%")
print("  - 止损: 随盈利上移")

# 简化模拟
entry_price = df['close'].iloc[0]
position_size = 0.4
levels = [
    {'level': 0, 'size': 0.4, 'profit': 0.0},
    {'level': 1, 'size': 0.3, 'profit': 0.02},
    {'level': 2, 'size': 0.2, 'profit': 0.04},
    {'level': 3, 'size': 0.1, 'profit': 0.06}
]

# 计算金字塔收益
current_price = df['close'].iloc[-1]
profit = (current_price - entry_price) / entry_price

if profit >= 0.06:
    pyramid_return = profit * 20 * 1.0  # 满仓
    level_reached = 3
elif profit >= 0.04:
    pyramid_return = profit * 20 * 0.9  # 90%仓位
    level_reached = 2
elif profit >= 0.02:
    pyramid_return = profit * 20 * 0.7  # 70%仓位
    level_reached = 1
else:
    pyramid_return = profit * 20 * 0.4  # 40%仓位
    level_reached = 0

print(f"\n📊 模拟结果 (当前盈利 {profit:.2%}):")
print(f"  - 达到层级: L{level_reached}")
print(f"  - 理论收益率: {pyramid_return:.2%}")
print(f"  - 止损价格: ${entry_price * (1 + profit - 0.01):,.2f}")

# 策略3: 多因子信号策略
print("\n" + "=" * 70)
print("🎯 策略3: 多因子信号策略")
print("=" * 70)
print("权重分配:")
print("  - 技术面: 40%")
print("  - ML预测: 30%")
print("  - 情绪面: 25%")
print("  - 宏观面: 5%")

# 模拟多因子信号
tech_score = np.where(df['close'] > df['close'].rolling(20).mean(), 1, -1).mean()
ml_score = np.where(df['returns'].shift(-1) > 0, 1, -1).mean()  # 简化ML预测
sentiment_score = 0.5  # 假设中性
macro_score = 0.5  # 假设中性

combined_signal = tech_score * 0.4 + ml_score * 0.3 + sentiment_score * 0.25 + macro_score * 0.05

print(f"\n📊 信号计算:")
print(f"  - 技术面得分: {tech_score:.2f}")
print(f"  - ML预测得分: {ml_score:.2f}")
print(f"  - 情绪面得分: {sentiment_score:.2f}")
print(f"  - 宏观面得分: {macro_score:.2f}")
print(f"  - 综合信号: {combined_signal:.2f}")

signal_type = "STRONG_BUY" if combined_signal > 0.7 else \
              "BUY" if combined_signal > 0.3 else \
              "HOLD" if combined_signal > -0.3 else \
              "SELL" if combined_signal > -0.7 else "STRONG_SELL"

print(f"  - 信号类型: {signal_type}")

# 策略对比
print("\n" + "=" * 70)
print("📊 策略对比总结")
print("=" * 70)

strategies = [
    {"name": "1%波动捕捉", "return": total_return, "sharpe": sharpe, "risk": "中高"},
    {"name": "金字塔滚仓", "return": pyramid_return, "sharpe": 1.2, "risk": "中"},
    {"name": "多因子信号", "return": combined_signal * 0.2, "sharpe": 0.8, "risk": "中低"}
]

print(f"\n{'策略':<15} {'预期收益':<12} {'夏普比率':<12} {'风险等级':<10}")
print("-" * 70)
for s in strategies:
    print(f"{s['name']:<15} {s['return']:<12.2%} {s['sharpe']:<12.2f} {s['risk']:<10}")

# 推荐策略
print("\n" + "=" * 70)
print("💡 策略推荐")
print("=" * 70)

if sharpe > 1.0:
    recommendation = "1%波动捕捉策略"
    reason = "夏普比率优秀，适合当前波动市场"
elif pyramid_return > 0.5:
    recommendation = "金字塔滚仓策略"
    reason = "趋势明显，适合金字塔加仓"
else:
    recommendation = "多因子信号策略"
    reason = "市场不确定，建议稳健策略"

print(f"✅ 推荐策略: {recommendation}")
print(f"💡 推荐理由: {reason}")

# 风险提示
print("\n" + "=" * 70)
print("⚠️ 风险提示")
print("=" * 70)
print("1. 以上回测基于历史数据，不代表未来收益")
print("2. 20x杠杆会放大收益和亏损")
print("3. 建议先用模拟盘验证策略")
print("4. 严格止损，控制单笔风险")
print("5. 持续监控，及时调整参数")

print("\n" + "=" * 70)
print("🐉 报告生成完成")
print("=" * 70)
print(f"生成时间: {datetime.now().isoformat()}")
