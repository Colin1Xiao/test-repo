#!/usr/bin/env python3
"""
Notion Trading Dashboard
Notion 交易仪表盘创建脚本

功能:
- 创建交易仪表盘主页
- 创建交易记录数据库
- 创建信号记录数据库
- 创建性能统计数据库
- 美观专业的展示
"""

import requests
import json
import os
from datetime import datetime
from pathlib import Path

# Notion 配置
NOTION_API = "https://api.notion.com/v1"

# 读取 API 密钥
def get_notion_key():
    """获取 Notion API 密钥"""
    # 尝试多个位置
    paths = [
        Path.home() / '.config' / 'notion' / 'api_key',
        Path(__file__).parent / 'notion_api_key.txt',
        Path.home() / '.openclaw' / 'secrets' / 'notion_api_key.txt',
    ]
    
    for path in paths:
        if path.exists():
            with open(path, 'r') as f:
                return f.read().strip()
    
    # 尝试环境变量
    return os.getenv('NOTION_API_KEY', '')

NOTION_KEY = get_notion_key()

HEADERS = {
    "Authorization": f"Bearer {NOTION_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def create_page(parent_id, title, icon=None, cover=None):
    """创建页面"""
    url = f"{NOTION_API}/pages"
    
    data = {
        "parent": {"database_id": parent_id} if parent_id.startswith("database") else {"page_id": parent_id},
        "properties": {
            "Name": {
                "title": [
                    {
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

def create_database(parent_id, title, properties):
    """创建数据库"""
    url = f"{NOTION_API}/databases"
    
    data = {
        "parent": {"page_id": parent_id},
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

def add_block(page_id, block_type, content):
    """添加内容块"""
    url = f"{NOTION_API}/blocks/{page_id}/children"
    
    blocks = []
    
    if block_type == "heading_1":
        blocks.append({
            "object": "block",
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"type": "text", "text": {"content": content}}]
            }
        })
    elif block_type == "heading_2":
        blocks.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": content}}]
            }
        })
    elif block_type == "paragraph":
        blocks.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": content}}]
            }
        })
    elif block_type == "callout":
        blocks.append({
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": content}}],
                "icon": {"emoji": "💡"}
            }
        })
    elif block_type == "divider":
        blocks.append({
            "object": "block",
            "type": "divider"
        })
    
    response = requests.patch(url, headers=HEADERS, json={"children": blocks})
    return response.json()

print("="*70)
print("📝 Notion 交易仪表盘创建")
print("="*70)
print()

# 检查 API 密钥
if not NOTION_KEY:
    print("❌ 未找到 Notion API 密钥")
    print()
    print("配置步骤:")
    print("1. 访问 https://notion.so/my-integrations")
    print("2. 创建新的 Integration")
    print("3. 复制 Internal Integration Secret")
    print("4. 保存到 ~/.config/notion/api_key")
    exit(1)

print(f"✅ API 密钥已找到：{NOTION_KEY[:10]}...")
print()

# 搜索现有页面
print("📋 搜索 Notion 页面...")
search_url = f"{NOTION_API}/search"
search_data = {
    "query": "交易",
    "filter": {"value": "page", "property": "object"}
}

response = requests.post(search_url, headers=HEADERS, json=search_data)
results = response.json()

print(f"   找到 {results.get('total', 0)} 个相关页面")

# 创建仪表盘说明
print()
print("="*70)
print("📊 创建交易仪表盘")
print("="*70)
print()

print("由于需要 Parent Page ID，请按以下步骤操作:")
print()
print("1️⃣  在 Notion 中创建一个新页面")
print("   - 页面名称：小龙交易仪表盘")
print("   - 页面位置：你的工作区")
print()
print("2️⃣  获取页面 ID")
print("   - 打开刚创建的页面")
print("   - 点击页面右上角 ···")
print("   - 选择 Copy link")
print("   - 页面 ID 是链接中 - 后面的一串字符")
print()
print("3️⃣  分享页面给 Integration")
print("   - 在页面中点击右上角 ···")
print("   - 选择 Connect to")
print("   - 选择你创建的 Integration")
print()
print("4️⃣  将页面 ID 保存到文件")
print("   echo 'YOUR_PAGE_ID' > notion_dashboard_page_id.txt")
print()
print("="*70)
print()

# 创建配置模板
config_template = {
    "notion_api_key": "YOUR_API_KEY",
    "dashboard_page_id": "YOUR_PAGE_ID",
    "trading_database_id": "",
    "signals_database_id": "",
    "performance_database_id": ""
}

config_path = Path(__file__).parent / 'notion_config.json'
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config_template, f, indent=2, ensure_ascii=False)

print(f"📄 配置文件已创建：{config_path.name}")
print()

# 创建数据库结构说明
print("📋 将创建的数据库结构:")
print()
print("1. 交易记录数据库")
print("   - 标的 (Select)")
print("   - 方向 (Select: Long/Short)")
print("   - 入场价格 (Number)")
print("   - 出场价格 (Number)")
print("   - 仓位大小 (Number)")
print("   - 杠杆 (Number)")
print("   - 盈亏金额 (Number)")
print("   - 盈亏比例 (Number)")
print("   - 入场时间 (Date)")
print("   - 出场时间 (Date)")
print("   - 状态 (Select: 持仓中/已平仓)")
print("   - 备注 (Text)")
print()
print("2. 信号记录数据库")
print("   - 标的 (Select)")
print("   - 信号类型 (Select: BUY/SELL/STRONG_BUY/STRONG_SELL)")
print("   - 置信度 (Number)")
print("   - 价格 (Number)")
print("   - 时间 (Date)")
print("   - 原因 (Text)")
print("   - 结果 (Select: 盈利/亏损/持仓)")
print()
print("3. 性能统计数据库")
print("   - 日期 (Date)")
print("   - 总盈亏 (Number)")
print("   - 收益率 (Number)")
print("   - 交易次数 (Number)")
print("   - 胜率 (Number)")
print("   - 最大回撤 (Number)")
print("   - 夏普比率 (Number)")
print()

print("="*70)
print("✅ 准备完成！")
print("="*70)
print()
print("下一步:")
print("1. 在 Notion 创建页面")
print("2. 获取页面 ID")
print("3. 更新 notion_config.json")
print("4. 重新运行此脚本创建数据库")
print()
