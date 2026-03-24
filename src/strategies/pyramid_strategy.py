"""
金字塔滚仓策略
"""

import pandas as pd
from datetime import datetime
from typing import Dict, Optional


class PyramidStrategy:
    """金字塔滚仓策略"""
    
    def __init__(self, leverage: float = 20.0, stop_loss_pct: float = 0.01):
        self.leverage = leverage
        self.stop_loss_pct = stop_loss_pct
        self.position_size = 0
        self.entry_price = 0
        self.side = None  # 'long' or 'short'
        
    def generate_signal(self, row: pd.Series) -> Optional[Dict]:
        """生成交易信号"""
        # 简化的移动平均突破策略
        if 'ma_short' not in row or 'ma_long' not in row:
            return None
            
        # 当短期均线上穿长期均线时做多
        if row['ma_short'] > row['ma_long'] and (self.side != 'long'):
            return {
                'symbol': 'BTC/USDT',
                'side': 'buy',
                'size': 0.1 * self.leverage  # 使用杠杆
            }
        # 当短期均线下穿长期均线时做空
        elif row['ma_short'] < row['ma_long'] and (self.side != 'short'):
            return {
                'symbol': 'BTC/USDT',
                'side': 'sell',
                'size': 0.1 * self.leverage  # 使用杠杆
            }
        
        return None


if __name__ == "__main__":
    strategy = PyramidStrategy()
    print("金字塔滚仓策略已加载")