#!/usr/bin/env python3
"""
止损管理器 - 5种止损策略
Stop Loss Manager - 5 Types of Stop Loss Strategies
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class StopLossType(Enum):
    """止损类型"""
    FIXED = "fixed"           # 固定止损
    TRAILING = "trailing"     # 追踪止损
    ATR = "atr"              # ATR波动止损
    TIME = "time"            # 时间止损
    BREAKEVEN = "breakeven"  # 保本止损


@dataclass
class StopLossConfig:
    """止损配置"""
    type: StopLossType
    percentage: float = 0.01        # 止损百分比
    trailing_pct: float = 0.015     # 追踪止损回调比例
    atr_multiplier: float = 2.0     # ATR倍数
    max_time_hours: int = 24        # 最大持仓时间
    breakeven_trigger: float = 0.02  # 保本触发盈利比例


@dataclass
class Position:
    """持仓信息"""
    symbol: str
    side: str           # 'long' or 'short'
    entry_price: float
    current_price: float
    size: float
    entry_time: datetime
    highest_price: float = 0.0
    lowest_price: float = float('inf')
    stop_loss_price: float = 0.0
    take_profit_price: float = 0.0
    is_breakeven: bool = False


class StopLossManager:
    """止损管理器"""
    
    def __init__(self, config: Optional[StopLossConfig] = None):
        self.config = config or StopLossConfig(type=StopLossType.FIXED)
        self.positions: Dict[str, Position] = {}
        self.stop_history: List[Dict] = []
    
    def add_position(self, symbol: str, side: str, entry_price: float, 
                     size: float, stop_loss_pct: float = None) -> Position:
        """添加持仓"""
        pct = stop_loss_pct or self.config.percentage
        
        if side == 'long':
            stop_price = entry_price * (1 - pct)
        else:
            stop_price = entry_price * (1 + pct)
        
        position = Position(
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            current_price=entry_price,
            size=size,
            entry_time=datetime.now(),
            highest_price=entry_price,
            lowest_price=entry_price,
            stop_loss_price=stop_price
        )
        
        self.positions[symbol] = position
        return position
    
    def update_price(self, symbol: str, current_price: float) -> Optional[Dict]:
        """更新价格并检查止损"""
        if symbol not in self.positions:
            return None
        
        position = self.positions[symbol]
        position.current_price = current_price
        
        # 更新最高/最低价
        if current_price > position.highest_price:
            position.highest_price = current_price
        if current_price < position.lowest_price:
            position.lowest_price = current_price
        
        # 检查是否需要止损
        stop_signal = self._check_stop_loss(position)
        
        # 检查保本移动
        self._check_breakeven(position)
        
        return stop_signal
    
    def _check_stop_loss(self, position: Position) -> Optional[Dict]:
        """检查止损条件"""
        symbol = position.symbol
        
        # 1. 固定止损
        if self.config.type == StopLossType.FIXED:
            if position.side == 'long' and position.current_price <= position.stop_loss_price:
                return self._trigger_stop(symbol, "fixed_stop_loss")
            if position.side == 'short' and position.current_price >= position.stop_loss_price:
                return self._trigger_stop(symbol, "fixed_stop_loss")
        
        # 2. 追踪止损
        if self.config.type == StopLossType.TRAILING:
            trailing_stop = self._calculate_trailing_stop(position)
            if trailing_stop and position.current_price <= trailing_stop:
                return self._trigger_stop(symbol, "trailing_stop")
        
        # 3. 时间止损
        if self.config.type == StopLossType.TIME:
            hours_held = (datetime.now() - position.entry_time).total_seconds() / 3600
            if hours_held >= self.config.max_time_hours:
                return self._trigger_stop(symbol, "time_stop")
        
        # 4. 保本止损
        if self.config.type == StopLossType.BREAKEVEN and position.is_breakeven:
            if position.side == 'long' and position.current_price <= position.entry_price:
                return self._trigger_stop(symbol, "breakeven_stop")
            if position.side == 'short' and position.current_price >= position.entry_price:
                return self._trigger_stop(symbol, "breakeven_stop")
        
        return None
    
    def _calculate_trailing_stop(self, position: Position) -> Optional[float]:
        """计算追踪止损价格"""
        if position.side == 'long':
            # 最高价回调一定比例
            return position.highest_price * (1 - self.config.trailing_pct)
        else:
            # 最低价回调一定比例
            return position.lowest_price * (1 + self.config.trailing_pct)
    
    def _check_breakeven(self, position: Position):
        """检查是否触发保本"""
        if position.is_breakeven:
            return
        
        profit_pct = 0
        if position.side == 'long':
            profit_pct = (position.current_price - position.entry_price) / position.entry_price
        else:
            profit_pct = (position.entry_price - position.current_price) / position.entry_price
        
        if profit_pct >= self.config.breakeven_trigger:
            position.is_breakeven = True
            position.stop_loss_price = position.entry_price
    
    def _trigger_stop(self, symbol: str, reason: str) -> Dict:
        """触发止损"""
        position = self.positions.pop(symbol, None)
        
        stop_record = {
            'symbol': symbol,
            'reason': reason,
            'timestamp': datetime.now().isoformat(),
            'entry_price': position.entry_price if position else 0,
            'exit_price': position.current_price if position else 0,
            'side': position.side if position else 'unknown',
            'pnl': self._calculate_pnl(position) if position else 0
        }
        
        self.stop_history.append(stop_record)
        return stop_record
    
    def _calculate_pnl(self, position: Position) -> float:
        """计算盈亏"""
        if position.side == 'long':
            return (position.current_price - position.entry_price) * position.size
        else:
            return (position.entry_price - position.current_price) * position.size
    
    def get_position(self, symbol: str) -> Optional[Position]:
        """获取持仓信息"""
        return self.positions.get(symbol)
    
    def get_all_positions(self) -> Dict[str, Position]:
        """获取所有持仓"""
        return self.positions.copy()
    
    def remove_position(self, symbol: str) -> bool:
        """移除持仓"""
        if symbol in self.positions:
            del self.positions[symbol]
            return True
        return False
    
    def get_stop_history(self) -> List[Dict]:
        """获取止损历史"""
        return self.stop_history.copy()
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        if not self.stop_history:
            return {'total_stops': 0, 'win_rate': 0, 'avg_pnl': 0}
        
        total = len(self.stop_history)
        profitable = sum(1 for h in self.stop_history if h['pnl'] > 0)
        total_pnl = sum(h['pnl'] for h in self.stop_history)
        
        return {
            'total_stops': total,
            'win_rate': profitable / total if total > 0 else 0,
            'avg_pnl': total_pnl / total if total > 0 else 0,
            'total_pnl': total_pnl
        }


# 便捷函数
def create_fixed_stop_loss(percentage: float = 0.01) -> StopLossManager:
    """创建固定止损管理器"""
    config = StopLossConfig(type=StopLossType.FIXED, percentage=percentage)
    return StopLossManager