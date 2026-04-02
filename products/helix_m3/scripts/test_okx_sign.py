#!/usr/local/bin/python3.14
"""
OKX API 签名测试

验证签名是否正确
"""

import hashlib
import hmac
import base64
import time
from datetime import datetime, timezone


# 实盘 API Key
API_KEY = "8705ea66-bb2a-4eb3-b58a-768346d83657"
SECRET_KEY = "8D2DF7BEA6EA559FE5BD1F36E11C44B1"
PASSPHRASE = "Xzl405026."

def sign_request(method: str, endpoint: str, body: str = ""):
    """生成签名"""
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    message = timestamp + method + endpoint
    if body:
        message += body
    
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    
    return timestamp, signature_b64


if __name__ == "__main__":
    import requests
    
    print("=" * 60)
    print("🔍 OKX API 签名测试 (实盘)")
    print("=" * 60)
    print()
    
    # 测试公共 API (无需签名)
    print("[1] 测试公共 API...")
    response = requests.get("https://www.okx.com/api/v5/public/time")
    print(f"服务器时间：{response.json().get('data', [{}])[0].get('ts')}")
    
    # 测试私有 API (需要签名)
    print("\n[2] 测试私有 API (获取账户信息)...")
    
    method = "GET"
    endpoint = "/api/v5/account/config"
    timestamp, signature = sign_request(method, endpoint)
    
    headers = {
        "OK-ACCESS-KEY": API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": PASSPHRASE,
        "Content-Type": "application/json",
    }
    
    print(f"Timestamp: {timestamp}")
    print(f"Signature: {signature[:30]}...")
    print()
    
    response = requests.get(
        "https://www.okx.com" + endpoint,
        headers=headers,
        timeout=10
    )
    
    print(f"状态码：{response.status_code}")
    print(f"响应：{response.text[:200]}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get("code") == "0":
            print("\n✅ API Key 有效！")
            account = data.get("data", [{}])[0]
            print(f"账户等级：{account.get('acctLv')}")
        else:
            print(f"\n❌ API 错误：{data.get('msg')}")
    elif response.status_code == 401:
        print("\n❌ 401 未授权 - 可能原因:")
        print("   1. API Key 无效")
        print("   2. 签名错误")
        print("   3. IP 白名单限制")
        print("   4. API Key 权限不足")
    else:
        print(f"\n❌ 未知错误：{response.status_code}")
