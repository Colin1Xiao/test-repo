#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能挂单与撤单管理系统
优化挂单价格、时间、撤单策略
"""

import ccxt
import json
import os
import time
from datetime import datetime, timedelta

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

# 创建交易所实例
exchange = ccxt.okx({
    'apiKey': API_KEY,
    'secret': SECRET_KEY,
    'password': PASSPHRASE,
    'enableRateLimit': True,
    'options': {'defaultType': 'swap'}
})

print("="*70)
print("📊 智能挂单与撤单管理系统")
print("="*70)
print()

# 智能挂单配置
smart_order_config = {
    # 挂单价格策略
    'price_strategy': {
        'offset_pct': 0.001,  # 基础偏移 0.1%
        'dynamic_offset': True,  # 启用动态偏移
        'min_offset': 0.0005,  # 最小偏移 0.05%
        'max_offset': 0.003,  # 最大偏移 0.3%
    },
    
    # 挂单时间策略
    'time_strategy': {
        'max_wait_time': 300,  # 最长等待 5 分钟
        'reprice_interval': 60,  # 每 60 秒重新定价
        'cancel_threshold': 180,  # 3 分钟未成交撤单
    },
    
    # 分批挂单
    'batch_orders': {
        'enabled': True,  # 启用分批挂单
        'levels': 3,  # 分 3 批
        'price_spacing': 0.002,  # 每批间隔 0.2%
        'size_distribution': [0.5, 0.3, 0.2],  # 资金分配 50%/30%/20%
    },
    
    # 撤单策略
    'cancel_strategy': {
        'auto_cancel': True,  # 自动撤单
        'signal_invalid': True,  # 信号失效撤单
        'market_change': True,  # 市场大幅变化撤单
        'change_threshold': 0.01,  # 变化超过 1% 撤单
    },
    
    # 成交策略
    'fill_strategy': {
        'partial_fill': True,  # 允许部分成交
        'remain_cancel': False,  # 部分成交后是否取消剩余
        'chase_price': False,  # 是否追价（不推荐）
    }
}

print("📋 智能挂单配置:")
print()

print("   1️⃣  价格策略:")
ps = smart_order_config['price_strategy']
print(f"      基础偏移：{ps['offset_pct']*100:.2f}%")
print(f"      动态偏移：{'✅ 启用' if ps['dynamic_offset'] else '❌ 禁用'}")
print(f"      偏移范围：{ps['min_offset']*100:.2f}% - {ps['max_offset']*100:.2f}%")
print()

print("   2️⃣  时间策略:")
ts = smart_order_config['time_strategy']
print(f"      最长等待：{ts['max_wait_time']}秒 ({ts['max_wait_time']//60}分钟)")
print(f"      重新定价：每{ts['reprice_interval']}秒")
print(f"      撤单阈值：{ts['cancel_threshold']}秒 ({ts['cancel_threshold']//60}分钟)")
print()

print("   3️⃣  分批挂单:")
bo = smart_order_config['batch_orders']
print(f"      启用：{'✅ 是' if bo['enabled'] else '❌ 否'}")
if bo['enabled']:
    print(f"      分批数：{bo['levels']} 批")
    print(f"      价格间隔：{bo['price_spacing']*100:.2f}%")
    print(f"      资金分配：{[f'{x*100:.0f}%' for x in bo['size_distribution']]}")
print()

print("   4️⃣  撤单策略:")
cs = smart_order_config['cancel_strategy']
print(f"      自动撤单：{'✅ 启用' if cs['auto_cancel'] else '❌ 禁用'}")
print(f"      信号失效：{'✅ 撤单' if cs['signal_invalid'] else '❌ 保持'}")
print(f"      市场变化：{'✅ 撤单' if cs['market_change'] else '❌ 保持'}")
print(f"      变化阈值：{cs['change_threshold']*100:.1f}%")
print()

print("   5️⃣  成交策略:")
fs = smart_order_config['fill_strategy']
print(f"      部分成交：{'✅ 允许' if fs['partial_fill'] else '❌ 不允许'}")
print(f"      剩余撤单：{'✅ 取消' if fs['remain_cancel'] else '❌ 继续等待'}")
print(f"      追价：{'⚠️ 启用 (不推荐)' if fs['chase_price'] else '❌ 禁用'}")
print()

print("="*70)
print("📝 挂单优化策略")
print("="*70)
print()

# 示例：BTC 挂单
btc_price = 70000  # 假设当前价格

print("BTC/USDT 智能挂单示例 (当前价 $70,000):")
print()

# 做多挂单
print("   做多挂单 (分批):")
total_size = 1000  # 总资金$1000
for i in range(smart_order_config['batch_orders']['levels']):
    offset = ps['offset_pct'] + (i * bo['price_spacing'])
    price = btc_price * (1 - offset)
    size = total_size * bo['size_distribution'][i]
    print(f"      第{i+1}批：${price:.1f} (-{offset*100:.2f}%) | 资金：${size:.0f} ({bo['size_distribution'][i]*100:.0f}%)")

print()
print("   优势:")
print("      ✅ 分批入场，降低风险")
print("      ✅ 获得更好均价")
print("      ✅ 避免一次性高位入场")
print()

# 做空挂单
print("   做空挂单 (分批):")
for i in range(smart_order_config['batch_orders']['levels']):
    offset = ps['offset_pct'] + (i * bo['price_spacing'])
    price = btc_price * (1 + offset)
    size = total_size * bo['size_distribution'][i]
    print(f"      第{i+1}批：${price:.1f} (+{offset*100:.2f}%) | 资金：${size:.0f} ({bo['size_distribution'][i]*100:.0f}%)")
print()

print("="*70)
print("⚠️  智能撤单策略")
print("="*70)
print()

print("   自动撤单条件:")
print()
print("   1️⃣  超时撤单")
print(f"      挂单超过{smart_order_config['time_strategy']['cancel_threshold']}秒未成交")
print("      → 自动撤单，重新挂单")
print()

print("   2️⃣  信号失效撤单")
print("      原交易信号失效 (如技术指标反转)")
print("      → 立即撤单，避免错误入场")
print()

print("   3️⃣  市场大幅变化撤单")
print(f"      市场价格变化超过{smart_order_config['cancel_strategy']['change_threshold']*100:.1f}%")
print("      → 撤单，重新评估")
print()

print("   4️⃣  紧急撤单")
print("      黑天鹅警报 / 止损触发 / 爆仓风险")
print("      → 立即撤单 + 市价平仓")
print()

print("="*70)
print("🎯 实战流程")
print("="*70)
print()

print("   开仓流程:")
print("   1. 监控系统发现 STRONG_BUY 信号")
print("   2. 计算最优挂单价格 (当前价 -0.1%)")
print("   3. 分 3 批挂限价单 (50%/30%/20%)")
print("   4. 监控订单状态")
print("   5. 第 1 批成交 → 设置止损")
print("   6. 第 2 批成交 → 调整止损到成本")
print("   7. 第 3 批成交 → 设置止盈")
print("   8. 3 分钟未完全成交 → 撤单剩余订单")
print()

print("   撤单流程:")
print("   1. 检测到撤单条件触发")
print("   2. 取消所有未成交订单")
print("   3. 如已部分成交 → 保持持仓")
print("   4. 记录撤单原因")
print("   5. 重新评估是否重新挂单")
print()

print("="*70)
print("💡 挂单技巧")
print("="*70)
print()

print("   ✅ 推荐:")
print("      1. 分批挂单，降低风险")
print("      2. 动态调整挂单价格")
print("      3. 设置合理撤单时间")
print("      4. 信号失效立即撤单")
print("      5. 部分成交后保护利润")
print()

print("   ❌ 避免:")
print("      1. 一次性全仓挂单")
print("      2. 挂单价格过于激进")
print("      3. 长时间不撤单")
print("      4. 信号失效还保持挂单")
print("      5. 追价挂单 (容易高位接盘)")
print()

print("="*70)
print("📊 手续费对比")
print("="*70)
print()

print("   限价单 (Maker): 0.02%")
print("   市价单 (Taker): 0.05%")
print()
print("   示例：$1000 交易，分 3 批挂单")
print("   限价单手续费：$1000 × 0.02% = $0.20")
print("   市价单手续费：$1000 × 0.05% = $0.50")
print("   节省：$0.30 (60%)")
print()
print("   如果每天交易 10 次:")
print("   限价单：$2.00/天 = $60/月")
print("   市价单：$5.00/天 = $150/月")
print("   每月节省：$90")
print()

print("="*70)
print("✅ 配置完成！")
print("="*70)
print()

# 保存配置
with open('/Users/colin/.openclaw/workspace/smart_order_config.json', 'w', encoding='utf-8') as f:
    json.dump(smart_order_config, f, indent=2, ensure_ascii=False)

print("📄 配置已保存到：smart_order_config.json")
print()
print("💡 提示:")
print("   - 挂单可能不完全成交，需要耐心")
print("   - 急涨急跌时改用市价单")
print("   - 定期查看未成交订单")
print("   - 根据市场波动调整挂单偏移")
print()
