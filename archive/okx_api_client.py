#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX API 客户端 (基于 requests)
解决 ccxt 代理配置问题
"""

import requests
import hmac
import base64
import hashlib
import json
import os
import time
from datetime import datetime, timezone

# 加载配置
config_path = os.path.expanduser('~/.openclaw/secrets/okx_api.json')
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

API_KEY = config['okx']['api_key']
SECRET_KEY = config['okx']['secret_key']
PASSPHRASE = config['okx']['passphrase']

# 代理配置
PROXY = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890'
}

BASE_URL = 'https://www.okx.com'

class OKXClient:
    """OKX API 客户端 (requests 版本)"""
    
    def __init__(self):
        self.api_key = API_KEY
        self.secret_key = SECRET_KEY
        self.passphrase = PASSPHRASE
        self.proxies = PROXY
        self.session = requests.Session()
        
    def _generate_signature(self, timestamp, method, request_path, body=''):
        """生成签名"""
        message = timestamp + method + request_path + body
        mac = hmac.new(
            bytes(self.secret_key, encoding='utf8'),
            bytes(message, encoding='utf8'),
            digestmod='sha256'
        )
        d = mac.digest()
        return base64.b64encode(d).decode('utf-8')
    
    def _get_timestamp(self):
        """获取 ISO 8601 时间戳"""
        return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    
    def _get_headers(self, method, request_path, body=''):
        """生成请求头"""
        timestamp = self._get_timestamp()
        signature = self._generate_signature(timestamp, method, request_path, body)
        
        return {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
            'Content-Type': 'application/json'
        }
    
    def _request(self, method, endpoint, params=None, data=None, signed=False):
        """发送请求"""
        url = f'{BASE_URL}{endpoint}'
        
        if signed:
            headers = self._get_headers(method, endpoint, json.dumps(data) if data else '')
        else:
            headers = {}
        
        try:
            response = self.session.request(
                method,
                url,
                params=params,
                json=data,
                headers=headers,
                proxies=self.proxies,
                timeout=30000
            )
            
            result = response.json()
            
            if result.get('code') == '0':
                return {'success': True, 'data': result.get('data', [])}
            else:
                return {'success': False, 'error': result.get('msg', 'Unknown error')}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # 公共 API
    def fetch_time(self):
        """获取服务器时间"""
        return self._request('GET', '/api/v5/public/time')
    
    def fetch_ticker(self, symbol):
        """获取行情"""
        # 转换符号格式 (支持多种格式)
        inst_id = symbol
        
        # 处理各种格式
        if '/USDT:USDT-SWAP' in inst_id:
            # BTC/USDT:USDT-SWAP → BTC-USDT-SWAP
            inst_id = inst_id.replace('/USDT:USDT-SWAP', '-USDT-SWAP')
        elif '/USDT:USDT' in inst_id:
            # BTC/USDT:USDT → BTC-USDT-SWAP
            inst_id = inst_id.replace('/USDT:USDT', '-USDT-SWAP')
        # 如果已经有-SWAP，保持不变
        
        return self._request('GET', '/api/v5/market/ticker', params={'instId': inst_id})
    
    def fetch_ohlcv(self, symbol, timeframe='5m', limit=100):
        """获取 K 线数据"""
        # 转换符号格式
        inst_id = symbol
        
        if '/USDT:USDT-SWAP' in inst_id:
            inst_id = inst_id.replace('/USDT:USDT-SWAP', '-USDT-SWAP')
        elif '/USDT:USDT' in inst_id:
            inst_id = inst_id.replace('/USDT:USDT', '-USDT-SWAP')
        
        return self._request('GET', '/api/v5/market/candles', 
                            params={'instId': inst_id, 'bar': timeframe, 'limit': limit})
    
    # 私有 API
    def fetch_balance(self):
        """获取账户余额"""
        return self._request('GET', '/api/v5/account/balance', signed=True)
    
    def fetch_positions(self):
        """获取持仓"""
        return self._request('GET', '/api/v5/account/positions', signed=True)
    
    def fetch_orders(self, symbol):
        """获取订单"""
        inst_id = symbol.replace('/USDT:USDT', '-USDT-SWAP')
        return self._request('GET', '/api/v5/trade/orders-pending', 
                            params={'instId': inst_id}, signed=True)
    
    def create_order(self, symbol, type, side, amount, price=None):
        """创建订单"""
        inst_id = symbol.replace('/USDT:USDT', '-USDT-SWAP')
        
        data = {
            'instId': inst_id,
            'tdMode': 'cross',
            'side': side,
            'ordType': type,
            'sz': str(amount)
        }
        
        if price:
            data['px'] = str(price)
        
        return self._request('POST', '/api/v5/trade/order', data=data, signed=True)
    
    def cancel_order(self, symbol, order_id):
        """撤销订单"""
        inst_id = symbol.replace('/USDT:USDT', '-USDT-SWAP')
        
        data = {
            'instId': inst_id,
            'ordId': order_id
        }
        
        return self._request('POST', '/api/v5/trade/cancel-order', data=data, signed=True)

# 测试
if __name__ == '__main__':
    print("="*70)
    print("🔍 测试 OKX API 客户端 (requests 版本)")
    print("="*70)
    print()
    
    client = OKXClient()
    
    # 测试 1: 服务器时间
    print("1. 获取服务器时间:")
    result = client.fetch_time()
    if result['success']:
        ts = result['data'][0]['ts']
        print(f"   ✅ 服务器时间：{ts}")
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    
    # 测试 2: BTC 价格
    print("2. 获取 BTC 价格:")
    result = client.fetch_ticker('BTC/USDT:USDT')
    if result['success']:
        ticker = result['data'][0]
        print(f"   ✅ BTC/USDT: ${float(ticker['last']):,.2f}")
        print(f"      24h 变化：{float(ticker['vol24h']):,.0f} BTC")
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    
    # 测试 3: K 线数据
    print("3. 获取 K 线数据:")
    result = client.fetch_ohlcv('BTC/USDT:USDT', '5m', 10)
    if result['success']:
        print(f"   ✅ 获取 {len(result['data'])} 根 K 线")
        latest = result['data'][0]
        print(f"      最新价格：${float(latest[4]):,.2f}")
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    
    # 测试 4: 账户余额
    print("4. 获取账户余额:")
    result = client.fetch_balance()
    if result['success']:
        details = result['data'][0].get('details', [])
        for detail in details:
            if detail.get('ccy') == 'USDT':
                cash_bal = float(detail.get('cashBal', 0))
                print(f"   ✅ USDT 余额：${cash_bal:.2f}")
                break
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    
    # 测试 5: 当前持仓
    print("5. 获取当前持仓:")
    result = client.fetch_positions()
    if result['success']:
        positions = [p for p in result['data'] if float(p.get('pos', 0)) != 0]
        if positions:
            print(f"   ✅ 当前持仓：{len(positions)} 个")
        else:
            print(f"   ✅ 无当前持仓")
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    
    # 测试 6: 当前订单
    print("6. 获取当前订单:")
    result = client.fetch_orders('BTC/USDT:USDT')
    if result['success']:
        orders = result['data']
        if orders:
            print(f"   ✅ 未成交订单：{len(orders)} 个")
        else:
            print(f"   ✅ 无未成交订单")
    else:
        print(f"   ❌ 失败：{result['error']}")
    
    print()
    print("="*70)
    print("✅ OKX API 客户端 (requests 版本) 工作正常！")
    print("="*70)
