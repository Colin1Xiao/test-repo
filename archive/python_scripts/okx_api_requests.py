#!/usr/bin/env python3
"""
OKX API Client - 纯 requests 实现
绕过 ccxt 的代理问题
"""

import json
import os
import hmac
import hashlib
import base64
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

# 强制禁用代理
for proxy_var in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 
                  'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']:
    os.environ.pop(proxy_var, None)

class OKXAPIClientRequests:
    """OKX API 客户端 - 纯 requests 实现"""
    
    BASE_URL = 'https://www.okx.com'
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.api_key = self.config.get('api_key', '')
        self.secret_key = self.config.get('secret_key', '')
        self.passphrase = self.config.get('passphrase', '')
        self.is_testnet = self.config.get('testnet', True)
        
        print("="*70)
        print("🔐 OKX API 客户端 - 纯 requests 实现")
        print("="*70)
        print(f"模式：{'✅ 测试网' if self.is_testnet else '⚠️  实盘'}")
        print(f"API Key: {self.api_key[:10]}...")
        print("="*70)
    
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置"""
        if config_path is None:
            config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return config.get('okx', {})
    
    def _get_timestamp(self) -> str:
        """获取 ISO 格式时间戳"""
        return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    def _sign(self, message: str) -> str:
        """生成签名"""
        mac = hmac.new(
            self.secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        )
        return base64.b64encode(mac.digest()).decode('utf-8')
    
    def _get_headers(self, method: str, path: str, query: str = '', body: str = '') -> Dict:
        """生成请求头"""
        timestamp = self._get_timestamp()
        # OKX 签名格式: timestamp + method + path + query + body
        message = timestamp + method + path + query + body
        
        return {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': self._sign(message),
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
            'Content-Type': 'application/json'
        }
    
    def _request(self, method: str, path: str, params: Dict = None, body: Dict = None) -> Optional[Dict]:
        """发送请求"""
        # 构建 query 字符串
        query = ''
        if params:
            query = '?' + '&'.join([f"{k}={v}" for k, v in params.items()])
        
        url = self.BASE_URL + path + query
        body_str = json.dumps(body) if body else ''
        headers = self._get_headers(method, path, query, body_str)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=body, timeout=10)
            else:
                return None
            
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ 请求失败: {e}")
            return None
    
    def fetch_balance(self) -> Optional[Dict]:
        """查询余额"""
        print("\n查询余额...")
        # 手动构造 URL 和签名
        path = '/api/v5/account/balance'
        query = '?ccy=USDT'
        url = self.BASE_URL + path + query
        
        timestamp = self._get_timestamp()
        message = timestamp + 'GET' + path + query
        headers = {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': self._sign(message),
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            if result and result.get('code') == '0':
                data = result.get('data', [{}])[0]
                details = data.get('details', [])
                for item in details:
                    if item.get('ccy') == 'USDT':
                        return {
                            'available': float(item.get('availEq', 0)),
                            'total': float(item.get('eq', 0)),
                            'frozen': float(item.get('frozenBal', 0))
                        }
        except Exception as e:
            print(f"❌ 请求失败: {e}")
        return None
    
    def fetch_positions(self, inst_type: str = 'SWAP') -> list:
        """查询仓位"""
        print("\n查询仓位...")
        # 手动构造 URL 和签名
        path = '/api/v5/account/positions'
        query = f'?instType={inst_type}'
        url = self.BASE_URL + path + query
        
        timestamp = self._get_timestamp()
        message = timestamp + 'GET' + path + query
        headers = {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': self._sign(message),
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            result = response.json()
            if result and result.get('code') == '0':
                return result.get('data', [])
        except Exception as e:
            print(f"❌ 请求失败: {e}")
        return []
    
    def preflight_check(self) -> bool:
        """预检查"""
        print("\n🔍 账户预检查...")
        
        # 测试公共接口
        print("测试公共接口...")
        result = requests.get(f'{self.BASE_URL}/api/v5/public/time', timeout=10)
        print(f"  公共接口: {result.status_code}")
        
        # 测试私有接口
        print("测试私有接口...")
        balance = self.fetch_balance()
        if balance:
            print(f"  ✅ 余额查询成功: {balance}")
            return True
        else:
            print(f"  ❌ 余额查询失败")
            return False

if __name__ == '__main__':
    client = OKXAPIClientRequests()
    client.preflight_check()
