#!/usr/bin/env python3
"""
High Risk Trading Strategy
高风险交易策略 - 50-100x 杠杆

目标：500 USDT → 100,000 USDT (30 天)
风险：极高（测试网专用）
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

print("="*70)
print("🚀 高风险交易策略配置")
print("="*70)
print(f"配置时间：{datetime.now().isoformat()}")
print("="*70)
print()

# ========== 加载配置 ==========
config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'

with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

okx = config['okx']

print("📋 策略配置")
print("-"*70)
print(f"模式：{'✅ 测试网' if okx['testnet'] else '⚠️  实盘'}")
print(f"风险等级：{okx.get('risk_mode', 'normal')}")
print()

print("💰 资金配置:")
print(f"   初始本金：${okx['target']['initial_capital']}")
print(f"   目标本金：${okx['target']['target_capital']}")
print(f"   目标倍数：{okx['target']['target_capital']/okx['target']['initial_capital']}x")
print(f"   时间：{okx['target']['days']} 天")
print(f"   日目标：{okx['target']['daily_target']*100:.0f}%")
print()

print("⚠️  风险配置:")
print(f"   最大仓位：{okx['max_position']*100:.0f}%")
print(f"   杠杆范围：{okx['min_leverage']}x - {okx['max_leverage']}x")
print(f"   止损：{okx['stop_loss']*100:.1f}%")
print(f"   止盈：{okx['take_profit']*100:.0f}%")
print(f"   日限额：${okx['daily_limit']}")
print(f"   最大日交易：{okx['max_daily_trades']} 次")
print()

# ========== 风险计算 ==========
print("📊 风险计算")
print("-"*70)

# 爆仓阈值
leverage = okx['max_leverage']
liquidation_pct = 100 / leverage
print(f"爆仓阈值（{leverage}x 杠杆）: {liquidation_pct:.2f}%")
print(f"   意味着价格反向波动 {liquidation_pct:.2f}% 就会爆仓")
print()

# 盈亏计算
capital = okx['target']['initial_capital']
position_size = capital * okx['max_position']
effective_position = position_size * leverage

print(f"交易计算（{capital} 本金，{leverage}x 杠杆）:")
print(f"   仓位大小：${position_size}")
print(f"   有效仓位：${effective_position}")
print()

# 1% 波动的盈亏
price_move = 0.01
pnl_1pct = effective_position * price_move
pnl_pct = pnl_1pct / capital * 100

print(f"价格波动 1% 的盈亏:")
print(f"   盈利：+${pnl_1pct:.2f} (+{pnl_pct:.0f}%)")
print(f"   亏损：-${pnl_1pct:.2f} (-{pnl_pct:.0f}%)")
print()

# 达到目标需要的交易次数
target_multiple = okx['target']['target_capital'] / okx['target']['initial_capital']
avg_win_pct = okx['take_profit'] * leverage  # 平均每次盈利

# 复利计算
trades_needed = 0
current = capital
while current < okx['target']['target_capital'] and trades_needed < 1000:
    current *= (1 + avg_win_pct * 0.6)  # 假设 60% 胜率
    trades_needed += 1

print(f"达到目标需要的交易:")
print(f"   目标倍数：{target_multiple}x")
print(f"   预计交易次数：{trades_needed} 次")
print(f"   每天需要：{trades_needed/okx['target']['days']:.1f} 次")
print()

# ========== 风险警告 ==========
print("🚨 风险警告")
print("-"*70)

if leverage >= 100:
    print("🔴 极高风险配置！")
    print(f"   {leverage}x 杠杆 = 价格波动 {100/leverage:.2f}% 爆仓")
    print("   仅限测试网使用！")
elif leverage >= 50:
    print("🟠 高风险配置！")
    print(f"   {leverage}x 杠杆 = 价格波动 {100/leverage:.2f}% 爆仓")
    print("   建议先用测试网验证")

print()
print("⚠️  重要提醒:")
print("   1. 此配置仅限测试网（虚拟资金）")
print("   2. 实盘请使用≤20x 杠杆")
print("   3. 200 倍回报概率极低")
print("   4. 做好本金全部损失准备")
print()

# ========== 交易规则 ==========
print("📋 交易规则")
print("-"*70)

print("""
入场条件:
   ✅ 整合信号评分 > 0.75
   ✅ 置信度 > 0.8
   ✅ 恐惧贪婪指数 < 25 或 > 75
   ✅ 量价关系评分 > 3

仓位管理:
   ✅ 初始仓位：20%
   ✅ 盈利后加仓：每次 10%
   ✅ 最大仓位：100%

止损止盈:
   ✅ 止损：1% (触发立即平仓)
   ✅ 止盈：3% (触发平仓 50%)
   ✅ 追踪止损：盈利 2% 后启动

风险控制:
   ✅ 单日最大亏损：10%
   ✅ 连续亏损 3 次：停止交易 1 小时
   ✅ 连续亏损 5 次：停止交易 24 小时
""")

# ========== 执行计划 ==========
print("📋 30 天执行计划")
print("-"*70)

phases = [
    ("第 1-5 天", "积累期", 500, 2000, "4x", "谨慎交易，积累本金"),
    ("第 6-10 天", "增长期", 2000, 10000, "5x", "适度加仓，抓住趋势"),
    ("第 11-20 天", "加速期", 10000, 50000, "5x", "重仓出击，把握大行情"),
    ("第 21-30 天", "冲刺期", 50000, 100000, "2x", "保守交易，锁定利润"),
]

print(f"{'阶段':<12} {'名称':<10} {'本金':<12} {'目标':<12} {'倍数':<8} {'策略':<20}")
print("-"*70)
for phase in phases:
    print(f"{phase[0]:<12} {phase[1]:<10} ${phase[2]:<11,} ${phase[3]:<11,} {phase[4]:<8} {phase[5]:<20}")

print()

# ========== 确认 ==========
print("="*70)
print("⚠️  最后确认")
print("="*70)

if okx['testnet']:
    print("✅ 测试网模式 - 可以继续使用")
    print("   虚拟资金：100,000 USDT")
    print("   无真实风险")
else:
    print("🚨 实盘模式 - 极度危险！")
    print("   建议立即切换到测试网")
    print("   修改配置：testnet = true")

print()
print("📋 下一步:")
print("   1. 启动监控：python3 auto_monitor_v2.py")
print("   2. 等待高置信度信号")
print("   3. 根据信号执行交易")
print("   4. 严格止损止盈")

print("\n" + "="*70)
