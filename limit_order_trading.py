#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
限价单挂单交易系统
日常使用限价单，紧急情况使用市价单
"""

import ccxt
import os
import json
from datetime import datetime

# OKX API 配置
config_path = os.path.expanduser('~/.openclaw/secrets/okx_api.json')
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

API_KEY = config['okx']['api_key']
SECRET_KEY = config['okx']['secret_key']
PASSPHRASE = config['okx']['passphrase']

# 设置代理
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

# 创建交易所实例（只使用合约）
exchange = ccxt.okx({
    'apiKey': API_KEY,
    'secret': SECRET_KEY,
    'password': PASSPHRASE,
    'enableRateLimit': True,
    'options': {'defaultType': 'swap'}  # 只使用合约
})

print("="*70)
print("📊 限价单挂单交易系统")
print("="*70)
print()

# 交易配置
trading_config = {
    'default_order_type': 'limit',  # 默认限价单
    'emergency_order_type': 'market',  # 紧急情况市价单
    'price_offset_pct': 0.001,  # 挂单价格偏移 0.1%
    'emergency_scenarios': [
        'stop_loss',  # 止损
        'liquidation_risk',  # 爆仓风险
        'black_swan',  # 黑天鹅
        'immediate_exit'  # 立即离场
    ]
}

print("📋 交易配置:")
print(f"   默认订单类型：{trading_config['default_order_type']} (限价单)")
print(f"   紧急订单类型：{trading_config['emergency_order_type']} (市价单)")
print(f"   挂单价格偏移：{trading_config['price_offset_pct']*100:.2f}%")
print()

print("📊 使用场景:")
print()
print("   ✅ 限价单（日常）:")
print("      - 正常开仓")
print("      - 正常平仓")
print("      - 止盈出场")
print("      - 挂单等待成交")
print()
print("   ⚠️  市价单（紧急）:")
print("      - 触发止损")
print("      - 爆仓风险")
print("      - 黑天鹅事件")
print("      - 需要立即离场")
print()

print("="*70)
print("💡 限价单优势")
print("="*70)
print()
print("   1. 手续费更低")
print("      - Maker: 0.02%")
print("      - Taker: 0.05%")
print("      - 节省 60% 手续费")
print()
print("   2. 价格更优")
print("      - 可以挂更好的价格")
print("      - 避免滑点")
print()
print("   3. 控制节奏")
print("      - 不追涨杀跌")
print("      - 等待最佳入场点")
print()

print("="*70)
print("📝 挂单策略示例")
print("="*70)
print()

# 示例：BTC 挂单策略
btc_price = 70000  # 假设当前价格

print("BTC/USDT 挂单示例 (当前价 $70,000):")
print()

# 做多挂单
long_entry = btc_price * (1 - trading_config['price_offset_pct'])
print(f"   做多挂单:")
print(f"      入场价：${long_entry:.1f} (-0.1%)")
print(f"      止损价：${btc_price * 0.995:.1f} (-0.5%)")
print(f"      止盈价：${btc_price * 1.015:.1f} (+1.5%)")
print()

# 做空挂单
short_entry = btc_price * (1 + trading_config['price_offset_pct'])
print(f"   做空挂单:")
print(f"      入场价：${short_entry:.1f} (+0.1%)")
print(f"      止损价：${btc_price * 1.005:.1f} (+0.5%)")
print(f"      止盈价：${btc_price * 0.985:.1f} (-1.5%)")
print()

print("="*70)
print("⚠️  紧急情况处理")
print("="*70)
print()
print("   触发条件:")
print("      1. 触及止损价 → 市价单立即平仓")
print("      2. 保证金率 < 10% → 市价单减仓")
print("      3. 黑天鹅警报 → 市价单清仓")
print("      4. 价格快速反向 → 市价单离场")
print()

print("="*70)
print("🎯 实战流程")
print("="*70)
print()
print("   1. 监控系统发现信号")
print("   2. 计算理想入场价（±0.1%）")
print("   3. 发送限价单挂单")
print("   4. 等待成交（最多 5 分钟）")
print("   5. 如未成交，撤单重新挂单或改用市价单")
print("   6. 成交后设置止损止盈")
print("   7. 触及止损 → 市价单平仓")
print("   8. 触及止盈 → 限价单平仓")
print()

print("="*70)
print("✅ 配置完成！")
print("="*70)
print()
print("💡 提示:")
print("   - 限价单可能不成交，需要耐心")
print("   - 急涨急跌时改用市价单")
print("   - 止损必须用市价单保证执行")
print()

# 保存配置
with open('/Users/colin/.openclaw/workspace/trading_config.json', 'w', encoding='utf-8') as f:
    json.dump(trading_config, f, indent=2, ensure_ascii=False)

print("📄 配置已保存到：trading_config.json")
print()
