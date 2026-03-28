#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新 Notion 仪表盘，将当前余额设为新的初始本金
"""

import json
import requests
from datetime import datetime

# 读取数据库 ID
with open('notion_database_ids.json', 'r') as f:
    db_ids = json.load(f)

# Notion 配置
NOTION_TOKEN = "secret_0hNkVQwKlJcGzqXfLmDpEjRtYvBnMkOp"
PARENT_PAGE_ID = "32071d2818c48035919ffbdd05eea938"

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def update_dashboard_with_new_base():
    """更新仪表盘使用新的初始本金"""
    
    # 新的初始本金
    new_initial_capital = 14.44
    
    # 构建更新内容
    blocks = [
        {
            "object": "block",
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"type": "text", "text": {"content": "🐉 小龙交易仪表盘"}}]
            }
        },
        {
            "object": "block", 
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": "💡 小龙智能交易系统 | 实盘模式"}}]
            }
        },
        {
            "object": "block",
            "type": "divider"
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "💰 初始本金：$14.44 | 当前本金：$14.44"}}],
                "icon": {"type": "emoji", "emoji": "💰"},
                "color": "green_background"
            }
        },
        {
            "object": "block",
            "type": "callout", 
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "📈 总盈亏：$0 (0.00%)"}}],
                "icon": {"type": "emoji", "emoji": "📈"},
                "color": "gray_background"
            }
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "⚙️ 配置：实盘 | 杠杆 20x | 仓位 30% | 止损 1%"}}],
                "icon": {"type": "emoji", "emoji": "⚙️"},
                "color": "blue_background"
            }
        },
        {
            "object": "block",
            "type": "divider"
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 交易目标"}}],
                "icon": {"type": "emoji", "emoji": "🎯"},
                "color": "purple_background"
            }
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 目标：$14.44 → $100,000 (6929x) | 📅 时间：30 天 | 📊 日目标：22.5%"}}],
                "icon": {"type": "emoji", "emoji": "🎯"},
                "color": "pink_background"
            }
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "📊 进度：[░░░░░░░░░░] 0.00% ($0/$99,985.56)"}}],
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "orange_background"
            }
        },
        {
            "object": "block",
            "type": "divider"
        }
    ]
    
    # 更新页面内容
    url = f"https://api.notion.com/v1/blocks/{PARENT_PAGE_ID}/children"
    
    # 先删除所有子块
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        children = response.json().get('results', [])
        for child in children:
            delete_url = f"https://api.notion.com/v1/blocks/{child['id']}"
            requests.delete(delete_url, headers=headers)
    
    # 添加新内容
    data = {"children": blocks}
    response = requests.patch(url, headers=headers, json=data)
    
    if response.status_code == 200:
        print("✅ Notion 仪表盘已更新！新的初始本金：$14.44")
        return True
    else:
        print(f"❌ 更新失败: {response.text}")
        return False

if __name__ == "__main__":
    update_dashboard_with_new_base()