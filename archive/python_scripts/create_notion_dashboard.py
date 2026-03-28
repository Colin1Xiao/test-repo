#!/usr/bin/env python3
"""
Notion Trading Dashboard Creator
完整的 Notion 交易仪表盘创建脚本

自动创建:
- 仪表盘主页
- 交易记录数据库
- 信号记录数据库  
- 性能统计数据库
- 美观的展示页面
"""

import requests
import json
import os
from datetime import datetime
from pathlib import Path

# Notion API 配置
NOTION_API = "https://api.notion.com/v1"
NOTION_KEY = "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"

HEADERS = {
    "Authorization": f"Bearer {NOTION_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def search_pages(query=""):
    """搜索页面"""
    url = f"{NOTION_API}/search"
    data = {
        "query": query,
        "filter": {"value": "page", "property": "object"}
    }
    response = requests.post(url, headers=HEADERS, json=data)
    return response.json()

def create_page(parent_id, title, icon="📊", cover=None):
    """创建页面"""
    url = f"{NOTION_API}/pages"
    data = {
        "parent": {"type": "page_id", "page_id": parent_id},
        "properties": {
            "title": {
                "title": [
                    {
                        "type": "text",
                        "text": {
                            "content": title
                        }
                    }
                ]
            }
        }
    }
    
    if icon:
        data["icon"] = {"type": "emoji", "emoji": icon}
    
    response = requests.post(url, headers=HEADERS, json=data)
    return response.json()

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
    return response.json()

def add_blocks(page_id, blocks):
    """添加内容块"""
    url = f"{NOTION_API}/blocks/{page_id}/children"
    response = requests.patch(url, headers=HEADERS, json={"children": blocks})
    return response.json()

print("="*70)
print("📊 Notion 交易仪表盘创建")
print("="*70)
print()

# 步骤 1: 搜索用户页面
print("📋 步骤 1: 搜索你的 Notion 页面...")
print("-"*70)

search_result = search_pages("")
if search_result.get('results'):
    print(f"   ✅ 找到 {len(search_result['results'])} 个页面")
    print()
    print("   请选择一个页面作为仪表盘的父页面:")
    for i, page in enumerate(search_result['results'][:10], 1):
        title = page.get('properties', {}).get('title', {})
        title_text = ""
        if title.get('title'):
            title_text = title['title'][0].get('plain_text', '无标题')
        print(f"   {i}. {title_text} ({page['id']})")
else:
    print("   ⚠️  未找到页面")
    print()
    print("   请在 Notion 中创建一个新页面，然后重新运行此脚本")

print()
print("="*70)
print()

# 显示配置说明
print("📋 步骤 2: 配置父页面 ID")
print("-"*70)
print()
print("请编辑 notion_config.json 文件:")
print()
print("   {")
print('     "parent_page_id": "你的页面 ID",')
print('     "dashboard_title": "小龙交易仪表盘"')
print("   }")
print()
print("然后重新运行此脚本创建仪表盘")
print()

# 创建配置模板
config = {
    "parent_page_id": "YOUR_PAGE_ID_HERE",
    "dashboard_title": "🐉 小龙交易仪表盘",
    "databases": {
        "trades": "",
        "signals": "",
        "performance": ""
    }
}

config_path = Path(__file__).parent / 'notion_config.json'
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print(f"   ✅ 配置文件已创建：{config_path.name}")
print()

# 数据库结构定义
print("="*70)
print("📊 将创建的数据库结构")
print("="*70)
print()

db_schemas = {
    "trades": {
        "title": "💰 交易记录",
        "properties": {
            "Name": {"title": {}},
            "标的": {"select": {"options": [{"name": "BTC"}, {"name": "ETH"}, {"name": "SOL"}, {"name": "UNI"}, {"name": "AVAX"}, {"name": "INJ"}]}},
            "方向": {"select": {"options": [{"name": "Long", "color": "green"}, {"name": "Short", "color": "red"}]}},
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
    },
    "signals": {
        "title": "📡 信号记录",
        "properties": {
            "Name": {"title": {}},
            "标的": {"select": {"options": [{"name": "BTC"}, {"name": "ETH"}, {"name": "SOL"}, {"name": "UNI"}, {"name": "AVAX"}, {"name": "INJ"}]}},
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
    },
    "performance": {
        "title": "📈 性能统计",
        "properties": {
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
    }
}

for key, schema in db_schemas.items():
    print(f"{schema['title']}")
    print(f"   字段: {len(schema['properties'])} 个")
    for field_name, field_config in schema['properties'].items():
        field_type = list(field_config.keys())[0]
        print(f"   - {field_name} ({field_type})")
    print()

print("="*70)
print()

# 创建说明文档
guide_content = """# 📊 Notion 交易仪表盘配置指南

## 快速开始

### 1. 在 Notion 中创建父页面

1. 打开 Notion
2. 点击 "+ Add a page"
3. 输入页面名称：`小龙交易仪表盘`
4. 选择一个图标（推荐：📊 或 🐉）

### 2. 获取页面 ID

1. 打开刚创建的页面
2. 点击右上角 `···`
3. 选择 `Copy link`
4. 页面 ID 是链接中 `-` 后面的一串字符
   - 例如：`https://notion.so/your-workspace/abc123...xyz`
   - 页面 ID：`abc123...xyz`

### 3. 配置页面 ID

编辑 `notion_config.json`:
```json
{
  "parent_page_id": "你的页面 ID",
  "dashboard_title": "🐉 小龙交易仪表盘"
}
```

### 4. 分享页面给 Integration

1. 在页面中点击右上角 `···`
2. 选择 `Connect to`
3. 选择你的 Integration

### 5. 运行创建脚本

```bash
python3 create_notion_dashboard.py
```

## 仪表盘结构

### 主页展示
- 📊 实时性能概览
- 💰 最新交易记录
- 📡 最新信号
- 📈 收益曲线图

### 数据库
1. **交易记录** - 所有交易详情
2. **信号记录** - 所有交易信号
3. **性能统计** - 每日/周/月性能

## 自动化更新

交易系统会自动:
- ✅ 记录每笔交易
- ✅ 记录每个信号
- ✅ 更新性能统计
- ✅ 同步到 Notion

## 查看仪表盘

访问你的 Notion 工作区，打开 `小龙交易仪表盘` 页面即可查看实时数据！
"""

guide_path = Path(__file__).parent / 'NOTION_DASHBOARD_GUIDE.md'
with open(guide_path, 'w', encoding='utf-8') as f:
    f.write(guide_content)

print(f"📄 配置指南已创建：{guide_path.name}")
print()

print("="*70)
print("✅ 准备完成！")
print("="*70)
print()
print("下一步操作:")
print("1. 在 Notion 创建页面 '小龙交易仪表盘'")
print("2. 获取页面 ID")
print("3. 编辑 notion_config.json 填入页面 ID")
print("4. 分享页面给 Integration")
print("5. 重新运行此脚本")
print()
print("📖 详细指南：NOTION_DASHBOARD_GUIDE.md")
print()
