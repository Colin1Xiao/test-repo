#!/usr/bin/env python3
"""
Fix OKX API Connection
修复 OKX API 连接问题
"""

import requests
import json
import os
import time
from datetime import datetime

# 加载配置
config_path = os.path.expanduser('~/.openclaw/secrets/okx_api.json')
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

okx_config = config['okx']

# OKX API 配置
API_KEY = okx_config['api_key']
SECRET_KEY = okx_config['secret_key']
PASSPHRASE = okx_config['passphrase']

# OKX API 端点
BASE_URL = "https://www.okx.com"

print("="*70)
print("🔧 修复 OKX API 连接")
print("="*70)
print()

# 步骤 1: 检查代理
print("📋 步骤 1: 检查代理配置...")
proxy = os.getenv('https_proxy', 'http://127.0.0.1:7890')
print(f"   代理：{proxy}")

try:
    test_response = requests.get('https://www.okx.com', 
                                 proxies={'https': proxy},
                                 timeout=10)
    print(f"   ✅ 代理连接成功 (状态码：{test_response.status_code})")
except Exception as e:
    print(f"   ❌ 代理连接失败：{e}")
    print("   请确保 ClashX 正在运行")

print()

# 步骤 2: 测试公共 API（不需要签名）
print("📋 步骤 2: 测试公共 API...")
try:
    url = f"{BASE_URL}/api/v5/public/instruments?instType=SPOT"
    response = requests.get(url, proxies={'https': proxy}, timeout=10)
    data = response.json()
    
    if data.get('code') == '0':
        print(f"   ✅ 公共 API 连接成功")
        print(f"   可交易标的数：{len(data.get('data', []))}")
    else:
        print(f"   ⚠️  公共 API 返回异常：{data}")
except Exception as e:
    print(f"   ❌ 公共 API 连接失败：{e}")

print()

# 步骤 3: 测试私有 API（需要签名）
print("📋 步骤 3: 测试私有 API（账户余额）...")

import hmac
import base64
import hashlib

def generate_signature(timestamp, method, request_path, body='', secret_key=SECRET_KEY):
    """生成 OKX API 签名"""
    if body == {}:
        body = ''
    elif isinstance(body, dict):
        body = json.dumps(body)
    
    message = timestamp + method + request_path + body
    mac = hmac.new(
        bytes(secret_key, encoding='utf8'),
        bytes(message, encoding='utf8'),
        digestmod='sha256'
    )
    d = mac.digest()
    return base64.b64encode(d).decode('utf-8')

# 获取当前时间戳
timestamp = str(int(time.time()))
method = "GET"
request_path = "/api/v5/account/balance"

# 生成签名
signature = generate_signature(timestamp, method, request_path, '', SECRET_KEY)

# 设置请求头
headers = {
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json'
}

try:
    url = f"{BASE_URL}{request_path}"
    response = requests.get(url, headers=headers, proxies={'https': proxy}, timeout=10)
    data = response.json()
    
    print(f"   响应状态码：{response.status_code}")
    print(f"   响应数据：{json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
    
    if data.get('code') == '0':
        print(f"   ✅ 私有 API 连接成功！")
        
        # 提取账户余额
        if 'data' in data and len(data['data']) > 0:
            details = data['data'][0].get('details', [])
            for detail in details:
                if detail.get('ccy') == 'USDT':
                    cash_bal = detail.get('cashBal', '0')
                    print(f"\n   💰 USDT 余额：${cash_bal}")
                    break
    else:
        error_code = data.get('code', 'Unknown')
        error_msg = data.get('msg', 'Unknown error')
        print(f"   ❌ API 返回错误：{error_code} - {error_msg}")
        
        if error_code == '50105':
            print("\n   可能原因：API 密钥无效或已过期")
        elif error_code == '50104':
            print("\n   可能原因：签名验证失败")
        elif error_code == '50103':
            print("\n   可能原因：API 权限不足")
            
except Exception as e:
    print(f"   ❌ 私有 API 连接失败：{e}")
    import traceback
    traceback.print_exc()

print()
print("="*70)
print("🔧 修复建议")
print("="*70)
print()
print("如果 API 连接失败，请检查:")
print("   1. ClashX 是否正常运行")
print("   2. API 密钥是否正确")
print("   3. API 权限是否开启（读取权限）")
print("   4. IP 是否在白名单中（如设置了）")
print()
print("修复步骤:")
print("   1. 打开 ClashX 确保代理运行")
print("   2. 在 OKX 官网验证 API 密钥")
print("   3. 重新运行此脚本测试")
print()
