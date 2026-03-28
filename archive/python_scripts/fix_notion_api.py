#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 Notion API 配置
"""

import requests
import json
import os

print("="*70)
print("🔧 Notion API 修复工具")
print("="*70)
print()

# 当前配置
config_file = os.path.expanduser('~/.openclaw/workspace/notion_config.json')
current_token = "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"
current_page_id = "32071d2818c48035919ffbdd05eea938"

print("📋 当前配置:")
print(f"   API Token: {current_token[:15]}...{current_token[-5:]}")
print(f"   Page ID: {current_page_id}")
print()

print("⚠️  问题:")
print("   API Token 格式无效")
print()

print("🔧 解决步骤:")
print()
print("   1️⃣  获取新的 Notion API Token")
print("      访问：https://www.notion.so/my-integrations")
print("      创建新的 Integration 或查看现有 Integration")
print("      复制 'Internal Integration Secret'")
print()
print("   2️⃣  确认页面共享")
print("      打开 Notion 页面:")
print(f"      {current_page_id}")
print("      点击右上角 ···")
print("      选择 'Connect to'")
print("      选择你的 Integration")
print()
print("   3️⃣  更新配置")
print("      编辑：notion_config.json")
print("      填入新的 API Token")
print()

print("="*70)
print("📝 配置模板")
print("="*70)
print()

new_config = {
    "notion_api_key": "secret_your_new_token_here",
    "parent_page_id": "32071d2818c48035919ffbdd05eea938",
    "dashboard_title": "🐉 小龙交易仪表盘"
}

print("   notion_config.json:")
print(f"   {json.dumps(new_config, indent=6, ensure_ascii=False)}")
print()

print("="*70)
print("💡 注意事项")
print("="*70)
print()
print("   ✅ API Token 格式:")
print("      - 旧格式：ntn_xxxxxxxxxxxxxxxxxxxxx (已废弃)")
print("      - 新格式：secret_xxxxxxxxxxxxxxxxxxxx (正确)")
print()
print("   ✅ 如果看到 'ntn_' 开头:")
print("      - 需要创建新的 Integration")
print("      - 旧格式 token 已不再支持")
print()
print("   ✅ 页面必须共享给 Integration:")
print("      - 否则无法访问页面")
print("      - 会返回 'Page not found' 错误")
print()

print("="*70)
print("🔍 测试新 Token")
print("="*70)
print()
print("   获取新 Token 后运行:")
print("   python3 test_notion_api.py")
print()
