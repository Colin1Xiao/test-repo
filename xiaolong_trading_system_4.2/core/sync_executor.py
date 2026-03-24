#!/usr/bin/env python3
"""
同步执行器 - 用于事件循环冲突场景
"""

import ccxt
import json
import os
from typing import Dict, Optional
from datetime import datetime

class SyncExecutor:
    """同步执行器 - 用于订单提交"""
    
    def __init__(self, api_key: str, api_secret: str, passphrase: str, testnet: bool = True):
        proxy = os.environ.get('https_proxy', 'http://127.0.0.1:7890')
        
        self.exchange = ccxt.okx({
            'apiKey': api_key,
            'secret': api_secret,
            'password': passphrase,
            'enableRateLimit': True,
            'timeout': 10000,
            'options': {'defaultType': 'swap'},
            'proxies': {'http': proxy, 'https': proxy}
        })
        
        if testnet:
            self.exchange.set_sandbox_mode(True)
    
    def create_market_order(self, symbol: str, side: str, amount: float, leverage: int = 100) -> Optional[Dict]:
        """创建市价单"""
        try:
            order = self.exchange.create_order(
                symbol=symbol,
                type='market',
                side=side,
                amount=amount,
                params={
                    'tdMode': 'cross',
                    'lever': leverage
                }
            )
            return order
        except Exception as e:
            print(f"❌ 同步下单失败: {e}")
            return None
    
    def fetch_order(self, order_id: str, symbol: str) -> Optional[Dict]:
        """查询订单"""
        try:
            return self.exchange.fetch_order(order_id, symbol)
        except Exception as e:
            print(f"❌ 查询订单失败: {e}")
            return None
    
    def fetch_positions(self, symbol: str) -> list:
        """查询持仓"""
        try:
            return self.exchange.fetch_positions([symbol])
        except Exception as e:
            print(f"❌ 查询持仓失败: {e}")
            return []
    
    def close_position(self, symbol: str, amount: float) -> Optional[Dict]:
        """平仓"""
        try:
            return self.exchange.create_order(
                symbol=symbol,
                type='market',
                side='sell',
                amount=amount,
                params={'tdMode': 'cross', 'reduceOnly': True}
            )
        except Exception as e:
            print(f"❌ 平仓失败: {e}")
            return None
