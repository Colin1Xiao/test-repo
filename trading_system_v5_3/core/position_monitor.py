#!/usr/bin/env python3
"""
Position Monitor - 持仓监控模块

核心功能：
1. 持仓状态检查
2. 止盈止损触发
3. 超时平仓
4. 爆仓前退出
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Dict, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class PositionStatus:
    """持仓状态"""
    symbol: str
    side: str
    size: float
    entry_price: float
    current_price: float
    unrealized_pnl_pct: float
    hold_time_seconds: float
    max_hold_seconds: float
    
    # 触发条件
    should_close: bool = False
    close_reason: str = ""
    
    def __str__(self) -> str:
        status = "🔴 平仓" if self.should_close else "🟢 持有"
        return f"""
📊 {self.symbol} 持仓状态:
   方向: {self.side}
   数量: {self.size}
   入场: {self.entry_price:.2f}
   当前: {self.current_price:.2f}
   盈亏: {self.unrealized_pnl_pct*100:+.2f}%
   持仓: {self.hold_time_seconds:.0f}s / {self.max_hold_seconds}s
   状态: {status} {self.close_reason}
"""


class PositionMonitor:
    """
    持仓监控器
    
    每 cycle 检查：
    1. 止盈触发
    2. 止损触发
    3. 超时触发
    4. 爆仓风险
    """
    
    # 默认阈值（可被 regime 覆盖）
    DEFAULT_TAKE_PROFIT = 0.002    # 0.2%
    DEFAULT_STOP_LOSS = -0.005     # -0.5%
    DEFAULT_LIQUIDATION = -0.004   # -0.4% (爆仓前退出)
    DEFAULT_MAX_HOLD = 30          # 30秒
    
    def __init__(self):
        self.positions: Dict[str, Dict] = {}
        
        print("📊 Position Monitor 初始化完成")
        print(f"   止盈阈值: {self.DEFAULT_TAKE_PROFIT*100}%")
        print(f"   止损阈值: {self.DEFAULT_STOP_LOSS*100}%")
        print(f"   爆仓前退出: {self.DEFAULT_LIQUIDATION*100}%")
        print(f"   最大持仓: {self.DEFAULT_MAX_HOLD}s")
    
    def register_position(
        self,
        symbol: str,
        side: str,
        size: float,
        entry_price: float,
        entry_time: float,
        regime_config: Dict = None
    ):
        """
        注册新持仓
        
        Args:
            symbol: 交易对
            side: 方向 (buy/sell)
            size: 数量
            entry_price: 入场价
            entry_time: 入场时间戳
            regime_config: Regime 配置（止盈止损参数）
        """
        config = regime_config or {}
        
        self.positions[symbol] = {
            'side': side,
            'size': size,
            'entry_price': entry_price,
            'entry_time': entry_time,
            'take_profit': config.get('take_profit', self.DEFAULT_TAKE_PROFIT),
            'stop_loss': config.get('stop_loss', self.DEFAULT_STOP_LOSS),
            'max_hold': config.get('max_hold', self.DEFAULT_MAX_HOLD)
        }
        
        logger.info({
            "event": "position_opened",
            "symbol": symbol,
            "side": side,
            "size": size,
            "entry_price": entry_price,
            "take_profit": self.positions[symbol]['take_profit'],
            "stop_loss": self.positions[symbol]['stop_loss'],
            "max_hold": self.positions[symbol]['max_hold']
        })
        
        print(f"📍 注册持仓: {symbol} {side} {size} @ {entry_price:.2f}")
    
    def remove_position(self, symbol: str):
        """移除持仓"""
        if symbol in self.positions:
            del self.positions[symbol]
            logger.info({"event": "position_closed", "symbol": symbol})
    
    def check_position(
        self,
        symbol: str,
        current_price: float
    ) -> Optional[PositionStatus]:
        """
        检查持仓状态
        
        Args:
            symbol: 交易对
            current_price: 当前价格
        
        Returns:
            PositionStatus 或 None（无持仓）
        """
        if symbol not in self.positions:
            return None
        
        pos = self.positions[symbol]
        current_time = time.time()
        
        # 计算盈亏比例
        if pos['side'] == 'buy':
            pnl_pct = (current_price - pos['entry_price']) / pos['entry_price']
        else:
            pnl_pct = (pos['entry_price'] - current_price) / pos['entry_price']
        
        # 计算持仓时间
        hold_time = current_time - pos['entry_time']
        
        # 判断是否需要平仓
        should_close = False
        close_reason = ""
        
        # 1. 止盈检查
        if pnl_pct >= pos['take_profit']:
            should_close = True
            close_reason = f"止盈触发 ({pnl_pct*100:+.2f}% >= {pos['take_profit']*100}%)"
        
        # 2. 止损检查
        elif pnl_pct <= pos['stop_loss']:
            should_close = True
            close_reason = f"止损触发 ({pnl_pct*100:+.2f}% <= {pos['stop_loss']*100}%)"
        
        # 3. 爆仓前退出
        elif pnl_pct <= self.DEFAULT_LIQUIDATION:
            should_close = True
            close_reason = f"🚨 爆仓风险 ({pnl_pct*100:+.2f}%)"
        
        # 4. 超时检查
        elif hold_time >= pos['max_hold']:
            should_close = True
            close_reason = f"超时平仓 ({hold_time:.0f}s >= {pos['max_hold']}s)"
        
        return PositionStatus(
            symbol=symbol,
            side=pos['side'],
            size=pos['size'],
            entry_price=pos['entry_price'],
            current_price=current_price,
            unrealized_pnl_pct=pnl_pct,
            hold_time_seconds=hold_time,
            max_hold_seconds=pos['max_hold'],
            should_close=should_close,
            close_reason=close_reason
        )
    
    def get_all_positions(self) -> List[str]:
        """获取所有持仓交易对"""
        return list(self.positions.keys())
    
    def has_position(self, symbol: str) -> bool:
        """是否有持仓"""
        return symbol in self.positions


# 全局实例
_position_monitor = None

def get_position_monitor() -> PositionMonitor:
    """获取全局持仓监控器"""
    global _position_monitor
    if _position_monitor is None:
        _position_monitor = PositionMonitor()
    return _position_monitor