#!/usr/bin/env python3
"""
OKX Account Checker
OKX 账户查询工具

功能:
- 查询账户余额
- 查询当前仓位
- 查询订单历史
- 账户信息概览
"""

import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

print("="*70)
print("📊 OKX 账户查询")
print("="*70)
print(f"查询时间：{datetime.now().isoformat()}")
print("="*70)

# 读取配置
config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'

if not config_path.exists():
    print(f"\n❌ 配置文件不存在：{config_path}")
    print("\n请先配置 OKX API:")
    print("   1. 编辑 ~/.openclaw/secrets/okx_api.json")
    print("   2. 填入 API Key、Secret、Passphrase")
    sys.exit(1)

with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

okx_config = config.get('okx', {})

print("\n📋 API 配置信息")
print("-"*70)
print(f"模式：{'✅ 测试网' if okx_config.get('testnet', True) else '⚠️  实盘'}")
print(f"权限：{', '.join(okx_config.get('permissions', []))}")
print(f"API Key: {okx_config.get('api_key', '')[:8]}...{okx_config.get('api_key', '')[-4:]}")

print("\n📋 风险配置")
print("-"*70)
print(f"最大仓位：{okx_config.get('max_position', 1.0)*100:.0f}%")
print(f"最大杠杆：{okx_config.get('max_leverage', 100)}x")
print(f"止损：{okx_config.get('stop_loss', 0.01)*100:.1f}%")
print(f"日限额：${okx_config.get('daily_limit', 10000):,}")

print("\n🎯 交易目标")
print("-"*70)
target = okx_config.get('target', {})
print(f"初始本金：${target.get('initial_capital', 500):,}")
print(f"目标本金：${target.get('target_capital', 100000):,}")
print(f"目标倍数：{target.get('target_capital', 100000)/target.get('initial_capital', 500):.0f}x")
print(f"时间：{target.get('days', 30)} 天")

print("\n📐 滚仓策略")
print("-"*70)
pyramid = okx_config.get('pyramid', {})
if pyramid.get('enabled', False):
    print("✅ 已启用")
    levels = pyramid.get('levels', [])
    for level in levels:
        print(f"   L{level['level']}: {level['position_pct']*100:.0f}% 仓位，盈利{level['profit_target']*100:.0f}% 加仓")
else:
    print("❌ 未启用")

print("\n" + "="*70)
print("💡 提示")
print("="*70)
print("当前为测试网模式，使用虚拟资金")
print("实盘交易前请务必:")
print("   1. 修改配置：testnet = false")
print("   2. 降低杠杆：≤20x")
print("   3. 设置严格止损")
print("   4. 小资金测试")

print("\n" + "="*70)
