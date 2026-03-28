#!/usr/bin/env python3
"""
Update Notion Dashboard Capital
更新 Notion 仪表盘本金信息
"""

import requests
import json
from datetime import datetime

# Notion API 配置
NOTION_API = "https://api.notion.com/v1"
NOTION_KEY = "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"
PAGE_ID = "32071d2818c48035919ffbdd05eea938"

HEADERS = {
    "Authorization": f"Bearer {NOTION_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def add_blocks(page_id, blocks):
    """添加内容块"""
    url = f"{NOTION_API}/blocks/{page_id}/children"
    response = requests.patch(url, headers=HEADERS, json={"children": blocks})
    return response.json()

print("="*70)
print("💰 更新 Notion 仪表盘本金信息")
print("="*70)
print()

# OKX 账户信息
okx_info = {
    "initial_capital": 500,
    "current_capital": 500,
    "pnl": 0,
    "pnl_pct": 0,
    "mode": "实盘",
    "leverage": "20x",
    "position": "30%",
    "stop_loss": "1%"
}

print(f"📊 OKX 账户信息:")
print(f"   初始本金：${okx_info['initial_capital']}")
print(f"   当前本金：${okx_info['current_capital']}")
print(f"   总盈亏：${okx_info['pnl']} ({okx_info['pnl_pct']:.2f}%)")
print(f"   模式：{okx_info['mode']}")
print(f"   杠杆：{okx_info['leverage']}")
print(f"   仓位：{okx_info['position']}")
print(f"   止损：{okx_info['stop_loss']}")
print()

# 更新内容块
update_blocks = [
    # 分隔线
    {"object": "block", "type": "divider"},
    
    # OKX 账户区域
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "💼 OKX 账户信息"},
                "annotations": {"color": "blue"}
            }]
        }
    },
    
    # 账户信息卡片 1 - 本金
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": f"💰 初始本金：${okx_info['initial_capital']} | 当前本金：${okx_info['current_capital']}"}
            }],
            "icon": {"emoji": "💰"},
            "color": "green_background"
        }
    },
    
    # 账户信息卡片 2 - 盈亏
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": f"📈 总盈亏：${okx_info['pnl']} ({okx_info['pnl_pct']:+.2f}%)"}
            }],
            "icon": {"emoji": "📈"},
            "color": "gray_background"
        }
    },
    
    # 账户信息卡片 3 - 配置
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": f"⚙️ 配置：{okx_info['mode']} | 杠杆{okx_info['leverage']} | 仓位{okx_info['position']} | 止损{okx_info['stop_loss']}"}
            }],
            "icon": {"emoji": "⚙️"},
            "color": "blue_background"
        }
    },
    
    # 分隔线
    {"object": "block", "type": "divider"},
    
    # 目标进度
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "🎯 交易目标"},
                "annotations": {"color": "purple"}
            }]
        }
    },
    
    # 目标进度卡片
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "🎯 目标：$500 → $100,000 (200x) | 📅 时间：30 天 | 📊 日目标：18%"}
            }],
            "icon": {"emoji": "🎯"},
            "color": "purple_background"
        }
    },
    
    # 进度条提示
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "📊 进度：[░░░░░░░░░░] 0.00% ($0/$99,500)"}
            }],
            "icon": {"emoji": "📊"},
            "color": "gray_background"
        }
    },
    
    # 分隔线
    {"object": "block", "type": "divider"}
]

print("🎨 添加更新内容...")
result = add_blocks(PAGE_ID, update_blocks)

if result:
    print("   ✅ OKX 账户信息更新成功")
    print("   💰 已添加:")
    print("      - 本金信息卡片")
    print("      - 盈亏信息卡片")
    print("      - 配置信息卡片")
    print("      - 目标进度卡片")
else:
    print("   ⚠️  更新失败")

print()
print("="*70)
print("✅ 更新完成！")
print("="*70)
print()
print("🎯 查看更新效果:")
print("   https://www.notion.so/32071d2818c48035919ffbdd05eea938")
print()
print("💡 提示:")
print("   - 盈亏数据会随交易自动更新")
print("   - 可以在 Notion 中手动调整最新数据")
print("   - 支持添加更多自定义字段")
print()

# 保存更新记录
update_record = {
    "timestamp": datetime.now().isoformat(),
    "initial_capital": okx_info['initial_capital'],
    "current_capital": okx_info['current_capital'],
    "pnl": okx_info['pnl'],
    "pnl_pct": okx_info['pnl_pct'],
    "mode": okx_info['mode'],
    "leverage": okx_info['leverage'],
    "position": okx_info['position'],
    "stop_loss": okx_info['stop_loss'],
    "target": 100000,
    "target_days": 30
}

with open('okx_account_info.json', 'w', encoding='utf-8') as f:
    json.dump(update_record, f, indent=2, ensure_ascii=False)

print("📄 OKX 账户信息已保存到：okx_account_info.json")
print()
