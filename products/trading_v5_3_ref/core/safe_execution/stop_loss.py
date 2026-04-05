"""
Stop Loss Manager - 止损管理器

核心功能:
1. 提交止损单到交易所
2. 验证止损单是否存在
"""

import json
import hmac
import base64
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional
import requests
import ccxt.async_support as ccxt


class StopLossManager:
    """止损管理器"""
    
    DEFAULT_STOP_PCT = 0.005  # -0.5%
    CT_VAL = 0.1  # ETH-USDT-SWAP 合约面值
    
    def __init__(self, exchange, symbol: str, stop_pct: float = DEFAULT_STOP_PCT):
        self.exchange = exchange
        self.symbol = symbol
        self.stop_pct = stop_pct
        self._load_api_config()
    
    def _load_api_config(self):
        """加载 API 配置"""
        secrets_path = Path.home() / '.openclaw' / 'secrets' / 'multi_exchange_config.json'
        with open(secrets_path) as f:
            secrets = json.load(f)
        okx = secrets.get('okx', {})
        self.api_key = okx.get('api_key', '')
        self.api_secret = okx.get('secret_key', '')
        self.passphrase = okx.get('passphrase', '')
    
    def _format_symbol(self) -> str:
        """格式化交易对"""
        return self.symbol.replace("/", "-").replace(":USDT", "-SWAP")
    
    def _calc_contracts(self, position_size: float) -> float:
        """计算合约张数"""
        contracts = round(position_size / self.CT_VAL, 2)
        return max(0.01, contracts)
    
    def _calc_stop_price(self, entry_price: float, side: str) -> float:
        """计算止损价格"""
        multiplier = 1 - self.stop_pct if side == 'long' else 1 + self.stop_pct
        return entry_price * multiplier
    
    def _generate_signature(self, timestamp: str, method: str, path: str, body: str) -> str:
        """生成 OKX API 签名"""
        message = timestamp + method + path + body
        return base64.b64encode(
            hmac.new(
                self.api_secret.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).digest()
        ).decode()
    
    async def place_stop_loss(self, entry_price: float, position_size: float, side: str = 'long') -> Tuple[bool, Optional[str]]:
        """提交止损单"""
        try:
            stop_price = self._calc_stop_price(entry_price, side)
            stop_side = 'sell' if side == 'long' else 'buy'
            
            print(f"🔴 提交止损单: stop_price={stop_price:.2f}, size={position_size:.6f}")
            
            inst_id = self._format_symbol()
            contracts = self._calc_contracts(position_size)
            
            params = {
                'instId': inst_id,
                'tdMode': 'cross',
                'side': stop_side,
                'posSide': 'net',
                'ordType': 'conditional',
                'sz': str(contracts),
                'slTriggerPx': str(round(stop_price, 2)),
                'slOrdPx': '-1',
                'slTriggerPxType': 'last',
            }
            
            return await self._submit_order(params)
            
        except Exception as e:
            print(f"❌ 止损单提交失败: {e}")
            return False, None
    
    async def _submit_order(self, params: dict) -> Tuple[bool, Optional[str]]:
        """提交订单到 OKX"""
        api_path = "/api/v5/trade/order-algo"
        body = json.dumps(params, separators=(',', ':'))
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        
        signature = self._generate_signature(timestamp, "POST", api_path, body)
        
        headers = {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
            'Content-Type': 'application/json',
        }
        
        resp = requests.post(f"https://www.okx.com{api_path}", headers=headers, data=body)
        data = resp.json()
        
        if data.get('code') == '0':
            algo_id = data.get('data', [{}])[0].get('algoId')
            print(f"✅ 止损单提交成功: algoId={algo_id}")
            return True, algo_id
        else:
            print(f"❌ 止损单提交失败: {data.get('msg')}")
            return False, None
    
    async def verify_stop_loss(self, order_id: str) -> bool:
        """验证止损单是否存在"""
        try:
            result = await self.exchange.fetch_open_orders(self.symbol)
            for order in result:
                if order.get('id') == order_id or order.get('algoId') == order_id:
                    return True
            return False
        except Exception as e:
            print(f"⚠️ 止损单验证失败: {e}")
            return False