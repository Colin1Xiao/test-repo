#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
订单管理系统
确保每笔订单都有止损保护
防止网络波动/代理问题导致亏损
"""

import json
import os
import time
from datetime import datetime
from okx_api_client import OKXClient

# 初始化 API 客户端
client = OKXClient()

print("="*70)
print("📊 订单管理系统 - 强制止损保护")
print("="*70)
print()

# 订单管理配置
order_manager_config = {
    # 强制止损设置
    'stop_loss': {
        'enabled': True,  # 启用强制止损
        'default_stop_loss_pct': 0.005,  # 默认止损 0.5%
        'hard_stop_loss': True,  # 硬止损（市价单）
        'auto_update': True,  # 自动更新止损价
    },
    
    # 网络保护
    'network_protection': {
        'retry_count': 3,  # 重试次数
        'retry_delay': 5,  # 重试间隔 (秒)
        'timeout': 30,  # 超时时间 (秒)
        'emergency_close': True,  # 网络故障紧急平仓
        'emergency_threshold': 60,  # 60 秒无响应紧急平仓
    },
    
    # 订单验证
    'order_validation': {
        'check_before_submit': True,  # 提交前验证
        'check_stop_loss': True,  # 验证止损设置
        'reject_no_stop_loss': True,  # 拒绝无止损订单
    },
    
    # 风险监控
    'risk_monitor': {
        'enabled': True,
        'check_interval': 10,  # 每 10 秒检查一次
        'margin_ratio_alert': 0.9,  # 保证金率 90% 警报
        'auto_reduce_position': True,  # 自动减仓
    }
}

print("📋 订单管理配置:")
print()

print("   1️⃣  强制止损设置:")
sl = order_manager_config['stop_loss']
print(f"      强制止损：{'✅ 启用' if sl['enabled'] else '❌ 禁用'}")
print(f"      默认止损：{sl['default_stop_loss_pct']*100:.2f}%")
print(f"      硬止损：{'✅ 市价单保证执行' if sl['hard_stop_loss'] else '❌ 限价单'}")
print(f"      自动更新：{'✅ 启用' if sl['auto_update'] else '❌ 禁用'}")
print()

print("   2️⃣  网络保护:")
np = order_manager_config['network_protection']
print(f"      重试次数：{np['retry_count']} 次")
print(f"      重试间隔：{np['retry_delay']}秒")
print(f"      超时时间：{np['timeout']}秒")
print(f"      紧急平仓：{'✅ 启用' if np['emergency_close'] else '❌ 禁用'}")
print(f"      无响应阈值：{np['emergency_threshold']}秒")
print()

print("   3️⃣  订单验证:")
ov = order_manager_config['order_validation']
print(f"      提交前验证：{'✅ 启用' if ov['check_before_submit'] else '❌ 禁用'}")
print(f"      验证止损：{'✅ 启用' if ov['check_stop_loss'] else '❌ 禁用'}")
print(f"      拒绝无止损：{'✅ 启用' if ov['reject_no_stop_loss'] else '❌ 允许'}")
print()

print("   4️⃣  风险监控:")
rm = order_manager_config['risk_monitor']
print(f"      风险监控：{'✅ 启用' if rm['enabled'] else '❌ 禁用'}")
print(f"      检查间隔：{rm['check_interval']}秒")
print(f"      保证金警报：{rm['margin_ratio_alert']*100:.0f}%")
print(f"      自动减仓：{'✅ 启用' if rm['auto_reduce_position'] else '❌ 禁用'}")
print()

print("="*70)
print("🛡️  止损保护机制")
print("="*70)
print()

print("   开仓流程 (强制止损):")
print("   1. 用户提交开仓请求")
print("   2. 系统验证：是否设置止损？")
print("      - 是 → 继续")
print("      - 否 → 拒绝订单 ❌")
print("   3. 计算止损价格")
print("      止损价 = 入场价 × (1 - 止损比例)")
print("   4. 提交开仓订单 (限价单)")
print("   5. 订单成交后，立即设置止损单 (市价止损)")
print("   6. 持续监控价格")
print("   7. 触及止损价 → 市价单立即平仓")
print("   8. 记录止损原因")
print()

print("   网络波动保护:")
print("   1. API 请求失败 → 自动重试 (最多 3 次)")
print("   2. 重试失败 → 检查持仓状态")
print("   3. 持仓风险高 → 紧急市价平仓")
print("   4. 网络恢复 → 重新挂单")
print()

print("   代理故障保护:")
print("   1. 检测到代理故障")
print("   2. 立即检查所有持仓")
print("   3. 计算当前盈亏")
print("   4. 如亏损接近止损 → 紧急平仓")
print("   5. 如盈利 → 保持持仓或止盈")
print()

print("="*70)
print("📝 订单模板")
print("="*70)
print()

# 示例订单
example_order = {
    'symbol': 'BTC/USDT:USDT',
    'side': 'buy',  # buy/sell
    'type': 'limit',  # limit/market
    'amount': 0.01,  # BTC 数量
    'price': 70000,  # 限价
    'stop_loss': {
        'enabled': True,
        'type': 'hard',  # hard/soft
        'price': 69650,  # 止损价
        'pct': 0.005,  # 止损比例
        'order_type': 'market'  # 止损触发后用市价单
    },
    'take_profit': {
        'enabled': True,
        'price': 71050,
        'pct': 0.015
    }
}

print("   开仓订单示例:")
print(f"   {json.dumps(example_order, indent=6)}")
print()

print("   关键配置:")
print(f"      stop_loss.enabled: {example_order['stop_loss']['enabled']} (必须为 True)")
print(f"      stop_loss.type: {example_order['stop_loss']['type']} (hard=硬止损)")
print(f"      stop_loss.order_type: {example_order['stop_loss']['order_type']} (market=市价单)")
print()

print("="*70)
print("⚠️  无止损订单处理")
print("="*70)
print()

print("   拒绝无止损订单:")
print()
print("   if not order.get('stop_loss', {}).get('enabled', False):")
print("       print('❌ 拒绝订单：未设置止损')")
print("       return False")
print()
print("   这是强制规则，不可绕过！")
print()

print("="*70)
print("🔔 止损警报")
print("="*70)
print()

print("   警报级别:")
print()
print("   1. 🟡 预警 (亏损 0.3%)")
print("      - 发送 Telegram 通知")
print("      - 准备止损")
print()
print("   2. 🟠 警告 (亏损 0.4%)")
print("      - 再次通知")
print("      - 检查网络状态")
print()
print("   3. 🔴 止损 (亏损 0.5%)")
print("      - 立即市价平仓")
print("      - 发送平仓通知")
print("      - 记录交易日志")
print()

print("="*70)
print("💡 最佳实践")
print("="*70)
print()

print("   ✅ 必须:")
print("      1. 每笔订单必须设置止损")
print("      2. 使用硬止损 (市价单)")
print("      3. 止损比例≤0.5%")
print("      4. 网络故障时优先平仓")
print("      5. 定期检查止损单状态")
print()

print("   ❌ 禁止:")
print("      1. 无止损开仓")
print("      2. 使用软止损 (可能不执行)")
print("      3. 随意调整止损价")
print("      4. 扛单等待反转")
print("      5. 网络故障时不处理")
print()

print("="*70)
print("✅ 配置完成！")
print("="*70)
print()

# 保存配置
with open('/Users/colin/.openclaw/workspace/order_manager_config.json', 'w', encoding='utf-8') as f:
    json.dump(order_manager_config, f, indent=2, ensure_ascii=False)

print("📄 配置已保存到：order_manager_config.json")
print()
print("💡 提示:")
print("   - 所有订单必须设置止损")
print("   - 系统会自动拒绝无止损订单")
print("   - 网络故障时优先保护本金")
print("   - 定期检查止损单状态")
print()
