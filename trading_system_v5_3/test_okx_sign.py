#!/usr/bin/env python3
"""测试 OKX API 签名"""

import json
import hmac
import base64
import hashlib
import requests
from datetime import datetime
from pathlib import Path

# 读取密钥
secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
with open(secrets_path) as f:
    secrets = json.load(f)
okx_config = secrets.get('okx', {})
api_key = okx_config.get('api_key', '')
api_secret = okx_config.get('secret_key', '')
passphrase = okx_config.get('passphrase', '')

print(f"API Key: {api_key[:10]}...")
print(f"Secret: {api_secret[:10]}...")
print(f"Passphrase: {passphrase}")

# 测试参数
params = {
    'instId': 'ETH-USDT-SWAP',
    'tdMode': 'cross',
    'side': 'buy',
    'ordType': 'market',
    'sz': '1',
    'lever': '100',
}

# 签名
body = json.dumps(params, separators=(',', ':'))
timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
api_path = "/api/v5/trade/order"
method = "POST"
message = timestamp + method + api_path + body

print(f"\nTimestamp: {timestamp}")
print(f"Method: {method}")
print(f"Path: {api_path}")
print(f"Body: {body}")
print(f"\nMessage: {message}")

signature = base64.b64encode(hmac.new(
    api_secret.encode('utf-8'),
    message.encode('utf-8'),
    hashlib.sha256
).digest()).decode()

print(f"\nSignature: {signature}")

# 发送请求
headers = {
    'OK-ACCESS-KEY': api_key,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
}

print(f"\nHeaders: {headers}")

url = f"https://www.okx.com{api_path}"
print(f"\nURL: {url}")

try:
    resp = requests.post(url, headers=headers, data=body, timeout=10)  # 使用 data=body
    result = resp.json()
    print(f"\nResponse: {json.dumps(result, indent=2)}")
except Exception as e:
    print(f"\nError: {e}")

# 测试一个简单的 GET 请求（账户余额）
print("\n" + "="*60)
print("测试 GET /api/v5/account/balance")
print("="*60)

api_path_get = "/api/v5/account/balance"
timestamp_get = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
message_get = timestamp_get + "GET" + api_path_get + ""

signature_get = base64.b64encode(hmac.new(
    api_secret.encode('utf-8'),
    message_get.encode('utf-8'),
    hashlib.sha256
).digest()).decode()

headers_get = {
    'OK-ACCESS-KEY': api_key,
    'OK-ACCESS-SIGN': signature_get,
    'OK-ACCESS-TIMESTAMP': timestamp_get,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
}

try:
    resp_get = requests.get(f"https://www.okx.com{api_path_get}", headers=headers_get, timeout=10)
    result_get = resp_get.json()
    print(f"\nResponse: {json.dumps(result_get, indent=2)[:500]}...")
except Exception as e:
    print(f"\nError: {e}")