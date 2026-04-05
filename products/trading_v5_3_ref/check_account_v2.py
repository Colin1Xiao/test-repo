#!/usr/bin/env python3
"""直接用 OKX 私有 API 查询余额"""

import sys
import json
import hmac
import base64
import hashlib
import requests
from datetime import datetime
from pathlib import Path

def main():
    # 加载 API 配置
    secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
    
    with open(secrets_path) as f:
        config = json.load(f)
    
    okx = config.get('okx', {})
    api_key = okx.get('api_key')
    api_secret = okx.get('secret_key')
    passphrase = okx.get('passphrase')
    
    # 生成签名
    timestamp = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    method = 'GET'
    request_path = '/api/v5/account/balance'
    
    message = timestamp + method + request_path
    mac = hmac.new(
        bytes(api_secret, encoding='utf8'),
        bytes(message, encoding='utf8'),
        digestmod=hashlib.sha256
    )
    signature = base64.b64encode(mac.digest()).decode()
    
    headers = {
        'OK-ACCESS-KEY': api_key,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
    }
    
    proxy = {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
    
    try:
        resp = requests.get(
            'https://www.okx.com' + request_path,
            headers=headers,
            proxies=proxy,
            timeout=10
        )
        
        data = resp.json()
        
        if data.get('code') != '0':
            print(f"❌ API 错误: {data.get('msg')}")
            return
        
        balances = data.get('data', [{}])[0].get('details', [])
        
        usdt = next((b for b in balances if b.get('ccy') == 'USDT'), {})
        
        total = float(usdt.get('cashBal', 0))
        eq = float(usdt.get('eq', 0))
        
        print(f"\n💰 账户余额 (Mainnet):")
        print(f"   总权益: ${eq:.2f} USDT")
        print(f"   可用: ${total:.2f} USDT")
        
        # 计算
        max_margin = min(3, total)
        print(f"\n🎯 可开仓 (100x):")
        print(f"   最大保证金: ${max_margin:.2f}")
        print(f"   名义价值: ${max_margin * 100:.2f}")
        
        if eq > 5:
            print(f"\n✅ 账户就绪，可启动 Edge 验证")
        else:
            print(f"\n⚠️ 余额不足，建议充值")
            
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    main()