"""
Position Gate - 双层持仓检查

第一层: 本地状态检查
第二层: 交易所状态检查
"""

import threading
from typing import Dict, Optional, Tuple
import ccxt.async_support as ccxt


class PositionGate:
    """双层 Position Gate"""
    
    MAX_POSITION_ETH = 0.13  # 常量提取
    
    def __init__(self, exchange, symbol: str):
        self.exchange = exchange
        self.symbol = symbol
        self._position: Optional[Dict] = None
        self._lock = threading.Lock()
    
    def has_local_position(self) -> bool:
        """第一层: 本地状态检查"""
        with self._lock:
            if not self._position:
                return False
            return self._position.get('size', 0) > 0
    
    async def get_exchange_position(self) -> Tuple[bool, float]:
        """第二层: 交易所状态检查"""
        try:
            inst_id = self._format_symbol(self.symbol)
            result = await self.exchange.private_get_account_positions({
                'instId': inst_id
            })
            
            if result.get('code') != '0':
                return False, 0.0
                
            data = result.get('data', [])
            for pos in data:
                amt = float(pos.get('pos', 0) or pos.get('positionAmt', 0))
                if abs(amt) > 0.001:
                    return True, abs(amt)
            return False, 0.0
            
        except Exception as e:
            print(f"⚠️ Position Gate 错误: {e}")
            return False, 0.0
    
    async def can_open(self) -> Tuple[bool, str]:
        """双层检查: 是否可以开仓"""
        if self.has_local_position():
            return False, "本地已有持仓"
        
        has_pos, size = await self.get_exchange_position()
        if has_pos:
            return False, f"交易所已有持仓: {size:.4f} ETH"
        
        return True, "可以开仓"
    
    async def set_position(self, position: Dict):
        """设置本地仓位"""
        with self._lock:
            self._position = position
    
    async def clear_position(self):
        """清除本地仓位"""
        with self._lock:
            self._position = None
    
    @staticmethod
    def _format_symbol(symbol: str) -> str:
        """格式化交易对为 OKX instId"""
        return symbol.replace("/", "-").replace(":USDT", "-SWAP")