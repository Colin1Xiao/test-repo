#!/usr/bin/env python3
"""
Notion Trading Dashboard - Full Creator
完整的 Notion 交易仪表盘创建脚本
"""

import requests
import json
from datetime import datetime

# Notion API 配置
NOTION_API = "https://api.notion.com/v1"
NOTION_KEY = "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"
PARENT_PAGE_ID = "32071d2818c48035919ffbdd05eea938"

HEADERS = {
    "Authorization": f"Bearer {NOTION_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def create_database(parent_id, title, properties, icon="📊"):
    """创建数据库"""
    url = f"{NOTION_API}/databases"
    data = {
        "parent": {"type": "page_id", "page_id": parent_id},
        "title": [
            {
                "type": "text",
                "text": {
                    "content": title
                }
            }
        ],
        "properties": properties
    }
    
    response = requests.post(url, headers=HEADERS, json=data)
    result = response.json()
    
    if response.status_code == 200:
        return result
    else:
        print(f"❌ 创建失败：{result}")
        return None

def add_blocks(page_id, blocks):
    """添加内容块"""
    url = f"{NOTION_API}/blocks/{page_id}/children"
    response = requests.patch(url, headers=HEADERS, json={"children": blocks})
    return response.json()

print("="*70)
print("📊 Notion 交易仪表盘创建")
print("="*70)
print()

# 验证页面访问
print("📋 验证页面访问...")
page_url = f"{NOTION_API}/pages/{PARENT_PAGE_ID}"
response = requests.get(page_url, headers=HEADERS)
page_data = response.json()

if response.status_code == 200:
    page_title = ""
    if 'properties' in page_data and 'title' in page_data['properties']:
        title_list = page_data['properties']['title'].get('title', [])
        if title_list:
            page_title = title_list[0].get('plain_text', '无标题')
    
    print(f"   ✅ 页面访问成功")
    print(f"   页面标题：{page_title}")
    print(f"   页面 ID: {PARENT_PAGE_ID}")
else:
    print(f"   ❌ 页面访问失败")
    print(f"   错误：{page_data}")
    print()
    print("   请确认:")
    print("   1. 页面 ID 正确")
    print("   2. 页面已分享给 Integration")
    print("   3. 在页面中点击 ··· → Connect to → 选择你的 Integration")
    exit(1)

print()
print("="*70)
print("📊 创建数据库")
print("="*70)
print()

# 数据库 1: 交易记录
print("1️⃣  创建 💰 交易记录数据库...")
trades_db = create_database(
    PARENT_PAGE_ID,
    "💰 交易记录",
    {
        "Name": {"title": {}},
        "标的": {"select": {"options": [
            {"name": "BTC", "color": "orange"},
            {"name": "ETH", "color": "blue"},
            {"name": "SOL", "color": "purple"},
            {"name": "UNI", "color": "pink"},
            {"name": "AVAX", "color": "red"},
            {"name": "INJ", "color": "green"}
        ]}},
        "方向": {"select": {"options": [
            {"name": "Long", "color": "green"},
            {"name": "Short", "color": "red"}
        ]}},
        "入场价格": {"number": {"format": "dollar"}},
        "出场价格": {"number": {"format": "dollar"}},
        "仓位": {"number": {"format": "number"}},
        "杠杆": {"number": {"format": "number"}},
        "盈亏金额": {"number": {"format": "dollar"}},
        "盈亏比例": {"number": {"format": "percent"}},
        "入场时间": {"date": {}},
        "出场时间": {"date": {}},
        "状态": {"select": {"options": [
            {"name": "持仓中", "color": "yellow"},
            {"name": "已平仓", "color": "green"},
            {"name": "已止损", "color": "red"}
        ]}},
        "备注": {"rich_text": {}}
    }
)

if trades_db:
    print(f"   ✅ 交易记录数据库创建成功")
    print(f"   数据库 ID: {trades_db['id']}")
    trades_db_id = trades_db['id']
else:
    trades_db_id = None

print()

# 数据库 2: 信号记录
print("2️⃣  创建 📡 信号记录数据库...")
signals_db = create_database(
    PARENT_PAGE_ID,
    "📡 信号记录",
    {
        "Name": {"title": {}},
        "标的": {"select": {"options": [
            {"name": "BTC", "color": "orange"},
            {"name": "ETH", "color": "blue"},
            {"name": "SOL", "color": "purple"},
            {"name": "UNI", "color": "pink"},
            {"name": "AVAX", "color": "red"},
            {"name": "INJ", "color": "green"}
        ]}},
        "信号类型": {"select": {"options": [
            {"name": "STRONG_BUY", "color": "green"},
            {"name": "BUY", "color": "blue"},
            {"name": "HOLD", "color": "gray"},
            {"name": "SELL", "color": "orange"},
            {"name": "STRONG_SELL", "color": "red"}
        ]}},
        "置信度": {"number": {"format": "percent"}},
        "价格": {"number": {"format": "dollar"}},
        "时间": {"date": {}},
        "原因": {"rich_text": {}},
        "结果": {"select": {"options": [
            {"name": "盈利", "color": "green"},
            {"name": "亏损", "color": "red"},
            {"name": "持仓中", "color": "yellow"}
        ]}}
    }
)

if signals_db:
    print(f"   ✅ 信号记录数据库创建成功")
    print(f"   数据库 ID: {signals_db['id']}")
    signals_db_id = signals_db['id']
else:
    signals_db_id = None

print()

# 数据库 3: 性能统计
print("3️⃣  创建 📈 性能统计数据库...")
performance_db = create_database(
    PARENT_PAGE_ID,
    "📈 性能统计",
    {
        "Name": {"title": {}},
        "日期": {"date": {}},
        "总盈亏": {"number": {"format": "dollar"}},
        "收益率": {"number": {"format": "percent"}},
        "交易次数": {"number": {"format": "number"}},
        "胜率": {"number": {"format": "percent"}},
        "最大回撤": {"number": {"format": "percent"}},
        "夏普比率": {"number": {"format": "number"}},
        "最大单笔盈利": {"number": {"format": "dollar"}},
        "最大单笔亏损": {"number": {"format": "dollar"}}
    }
)

if performance_db:
    print(f"   ✅ 性能统计数据库创建成功")
    print(f"   数据库 ID: {performance_db['id']}")
    performance_db_id = performance_db['id']
else:
    performance_db_id = None

print()
print("="*70)
print("📊 添加页面内容")
print("="*70)
print()

# 添加欢迎内容
print("添加欢迎内容...")

welcome_blocks = [
    {
        "object": "block",
        "type": "heading_1",
        "heading_1": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "🐉 欢迎使用小龙交易仪表盘"},
                "annotations": {"color": "blue"}
            }]
        }
    },
    {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "这是小龙智能交易系统的专业数据展示平台，实时追踪交易记录、信号和性能统计。"}
            }]
        }
    },
    {
        "object": "block",
        "type": "divider"
    },
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "📊 系统状态"}
            }]
        }
    },
    {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "✅ 监控系统运行中 | ✅ 6 个标的监控 | ✅ Telegram 告警已启用 | ✅ 实盘模式"}
            }],
            "icon": {"emoji": "💡"}
        }
    },
    {
        "object": "block",
        "type": "divider"
    },
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "💰 交易记录"}
            }]
        }
    },
    {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "记录所有交易详情，支持多视图查看（表格/看板/日历）"}
            }]
        }
    },
    {
        "object": "block",
        "type": "divider"
    },
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "📡 信号记录"}
            }]
        }
    },
    {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "追踪所有交易信号，自动筛选高置信度信号"}
            }]
        }
    },
    {
        "object": "block",
        "type": "divider"
    },
    {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "📈 性能统计"}
            }]
        }
    },
    {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [{
                "type": "text",
                "text": {"content": "每日/周/月性能统计，收益率曲线追踪"}
            }]
        }
    }
]

add_result = add_blocks(PARENT_PAGE_ID, welcome_blocks)
if add_result:
    print("   ✅ 欢迎内容添加成功")
else:
    print("   ⚠️  欢迎内容添加失败（可手动添加）")

print()
print("="*70)
print("✅ 创建完成！")
print("="*70)
print()

# 保存数据库 ID
db_ids = {
    "parent_page_id": PARENT_PAGE_ID,
    "trades_db_id": trades_db_id,
    "signals_db_id": signals_db_id,
    "performance_db_id": performance_db_id,
    "created_at": datetime.now().isoformat()
}

with open('notion_database_ids.json', 'w', encoding='utf-8') as f:
    json.dump(db_ids, f, indent=2, ensure_ascii=False)

print("📄 数据库 ID 已保存到：notion_database_ids.json")
print()
print("🎉 现在请打开 Notion 查看你的交易仪表盘！")
print()
print("📊 查看链接:")
print(f"   https://www.notion.so/{PARENT_PAGE_ID}")
print()
print("下一步:")
print("1. 打开 Notion 查看仪表盘")
print("2. 自定义视图和筛选")
print("3. 交易系统会自动同步数据")
print()
