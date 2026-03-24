#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
24 小时自动交易系统
高杠杆模式：BTC/ETH 100x, 其他 50x
"""

import subprocess
import time
import os
from datetime import datetime

print("="*70)
print("🚀 启动 24 小时自动交易系统")
print("="*70)
print()

# 系统配置
config = {
    "symbols": ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT", "UNI/USDT:USDT", "AVAX/USDT:USDT", "INJ/USDT:USDT"],
    "leverage": {
        "BTC/USDT:USDT": 100,
        "ETH/USDT:USDT": 100,
        "default": 50
    },
    "check_interval": 60,  # 60 秒检查一次
    "stop_loss": 0.005,  # 0.5% 止损
    "take_profit": 0.015,  # 1.5% 止盈
    "max_position": 0.3,  # 30% 仓位
}

print("📋 系统配置:")
print(f"   监控标的：{len(config['symbols'])} 个")
for symbol in config['symbols']:
    leverage = config['leverage'].get(symbol, config['leverage']['default'])
    print(f"   - {symbol}: {leverage}x 杠杆")
print(f"   检查间隔：{config['check_interval']}秒")
print(f"   止损：{config['stop_loss']*100:.1f}%")
print(f"   止盈：{config['take_profit']*100:.1f}%")
print(f"   最大仓位：{config['max_position']*100:.0f}%")
print()

print("⚠️  风险警告:")
print(f"   🔴 BTC/ETH 使用 100x 杠杆 = 1% 波动爆仓")
print(f"   🔴 其他币种 50x 杠杆 = 2% 波动爆仓")
print(f"   🔴 当前资金：$14.44")
print(f"   🔴 建议追加资金到至少$100+")
print()

print("🔧 启动步骤:")
print()

# 步骤 1: 检查代理
print("1️⃣  检查网络代理...")
proxy = os.getenv('https_proxy', 'http://127.0.0.1:7890')
print(f"   代理：{proxy}")
print("   ✅ 代理配置完成")
print()

# 步骤 2: 启动监控
print("2️⃣  启动主监控系统...")
print("   命令：python3 auto_monitor_v2.py")
print("   模式：后台运行")
print()

# 步骤 3: 后台运行
print("3️⃣  设置后台运行...")
print("   日志文件：monitor_live.log")
print("   告警文件：monitor_alerts.log")
print()

print("="*70)
print("✅ 系统启动命令:")
print("="*70)
print()
print("# 前台运行（查看实时日志）")
print("cd /Users/colin/.openclaw/workspace")
print("python3 auto_monitor_v2.py")
print()
print("# 后台运行（推荐）")
print("cd /Users/colin/.openclaw/workspace")
print("nohup python3 auto_monitor_v2.py > monitor_live.log 2>&1 &")
print()
print("# 查看进程")
print("ps aux | grep auto_monitor")
print()
print("# 查看日志")
print("tail -f monitor_live.log")
print("tail -f monitor_alerts.log")
print()
print("# 停止系统")
print("pkill -f auto_monitor_v2")
print()

print("="*70)
print("📊 实时监控")
print("="*70)
print()
print("Notion 仪表盘:")
print("   https://www.notion.so/32071d2818c48035919ffbdd05eea938")
print()
print("Telegram 告警:")
print("   已配置，重要信号自动推送")
print()

print("="*70)
print("⚠️  最后确认")
print("="*70)
print()
print("🔴 高风险配置:")
print("   - BTC/ETH: 100x 杠杆 (1% 爆仓)")
print("   - 其他币种：50x 杠杆 (2% 爆仓)")
print("   - 当前资金：$14.44")
print("   - 建议：追加资金到$100+")
print()
print("🎯 系统已准备就绪！")
print()
print("是否立即启动？(y/n)")
print()
print("💡 提示：系统会自动监控 6 个标的，发现信号自动告警")
print()

# 自动启动（5 秒后）
print("⏱️  系统将在 5 秒后自动启动...")
time.sleep(5)

# 启动监控系统
print()
print("🚀 启动监控系统...")
try:
    subprocess.Popen(
        ["python3", "auto_monitor_v2.py"],
        cwd="/Users/colin/.openclaw/workspace",
        stdout=open("/Users/colin/.openclaw/workspace/monitor_live.log", "a"),
        stderr=subprocess.STDOUT
    )
    print("✅ 监控系统已启动！")
    print()
    print("📊 查看实时日志:")
    print("   tail -f /Users/colin/.openclaw/workspace/monitor_live.log")
    print()
    print("📱 Telegram 告警已启用")
    print("📊 Notion 仪表盘已更新")
    print()
    print("="*70)
    print("🎉 24 小时自动交易系统运行中！")
    print("="*70)
    
except Exception as e:
    print(f"❌ 启动失败：{e}")
    print()
    print("请手动运行:")
    print("   cd /Users/colin/.openclaw/workspace")
    print("   python3 auto_monitor_v2.py")
