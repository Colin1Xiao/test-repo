#!/usr/bin/env python3
"""
Fix OKX Passphrase Encoding Issue
修复 OKX Passphrase 编码问题

问题：Passphrase 包含中文"小龙智能交易"
解决：使用 ASCII 编码的 passphrase
"""

import json
import os

# 加载配置
config_path = os.path.expanduser('~/.openclaw/secrets/okx_api.json')
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

print("="*70)
print("🔧 修复 OKX Passphrase 编码问题")
print("="*70)
print()

print("📋 当前配置:")
print(f"   API Key: {config['okx']['api_key'][:10]}...")
print(f"   Passphrase: {config['okx']['passphrase']}")
print()

print("⚠️  问题发现:")
print("   Passphrase 包含中文字符：'小龙智能交易'")
print("   HTTP 协议头只支持 ASCII/Latin-1 编码")
print("   导致 API 请求失败")
print()

print("🔧 解决方案:")
print()
print("   方案 1: 修改 OKX API 的 Passphrase 为英文 ⭐ 推荐")
print("   步骤:")
print("   1. 登录 OKX: https://www.okx.com/")
print("   2. 进入 API 管理页面")
print("   3. 找到现有 API 密钥")
print("   4. 修改 Passphrase 为英文（如：TradingBot2026）")
print("   5. 更新配置文件")
print()
print("   方案 2: 创建新的 API 密钥")
print("   步骤:")
print("   1. 在 OKX API 管理页面")
print("   2. 创建新 API 密钥")
print("   3. Passphrase 使用纯英文")
print("   4. 更新配置文件")
print()

# 提供配置文件更新模板
print("📝 配置文件更新模板:")
print()
print("   编辑：~/.openclaw/secrets/okx_api.json")
print()
print("   修改前:")
print("   \"passphrase\": \"小龙智能交易\"")
print()
print("   修改后:")
print("   \"passphrase\": \"TradingBot2026\"  (或其他英文)")
print()

# 创建更新脚本
update_script = '''
# 自动更新 passphrase（示例）
import json
import os

config_path = os.path.expanduser('~/.openclaw/secrets/okx_api.json')

with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

# 修改为英文 passphrase
config['okx']['passphrase'] = 'TradingBot2026'  # 改为你的新 passphrase

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print("✅ Passphrase 已更新")
'''

print("💻 自动更新脚本:")
print(update_script)
print()

print("="*70)
print("🎯 下一步")
print("="*70)
print()
print("1. 在 OKX 官网修改 API Passphrase 为英文")
print("2. 更新配置文件 ~/.openclaw/secrets/okx_api.json")
print("3. 重新运行测试：python3 fix_okx_api.py")
print()
print("📖 OKX API 管理：https://www.okx.com/account/my-api")
print()
