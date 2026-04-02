#!/usr/bin/env python3
"""
Position Lifecycle Engine - 持仓生命周期引擎

核心功能：
1. 止盈止损
2. 时间退出
3. 爆仓保护
4. 异常退出

这是交易系统最关键的模块 - 只要有持仓就必须有退出机制
"""

import time
import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, Optional, List, Callable
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class ExitReason(Enum):
    """退出原因"""
    TAKE_PROFIT = "TAKE_PROFIT"       # 止盈
    STOP_LOSS = "STOP_LOSS"           # 止损
    LIQUIDATION_PROTECT = "LIQUIDATION_PROTECT"  # 爆仓保护
    TIME_EXIT = "TIME_EXIT"           # 时间退出
    FORCE_EXIT = "FORCE_EXIT"         # 强制退出
    ERROR_EXIT = "ERROR_EXIT"         # 异常退出


@dataclass
class PositionState:
    """持仓状态"""
    symbol: str
    side: str              # 'long' or 'short'
    size: float
    entry_price: float
    entry_time: float      # 时间戳
    
    # 当前状态
    current_price: float = 0.0
    unrealized_pnl_pct: float = 0.0
    hold_time_seconds: float = 0.0
    
    # 退出参数
    take_profit_pct: float = 0.002    # 0.2%
    stop_loss_pct: float = -0.005     # -0.5%
    liquidation_pct: float = -0.004   # -0.4% (爆仓前退出)
    max_hold_seconds: float = 30.0    # 30秒
    
    # 退出决策
    should_exit: bool = False
    exit_reason: Optional[ExitReason] = None
    exit_message: str = ""


class PositionLifecycleEngine:
    """
    持仓生命周期引擎
    
    核心原则：
    1. 只要有持仓，就必须检查退出条件
    2. 退出检查优先级高于开仓检查
    3. 任何异常都应该触发退出
    """
    
    # 默认参数
    DEFAULT_TAKE_PROFIT = 0.002    # 0.2%
    DEFAULT_STOP_LOSS = -0.005     # -0.5%
    DEFAULT_LIQUIDATION = -0.004   # -0.4%
    DEFAULT_MAX_HOLD = 30.0        # 30秒
    
    def __init__(self):
        self.positions: Dict[str, PositionState] = {}
        self.exit_callback: Optional[Callable] = None
        
        print("🛡️ Position Lifecycle Engine 初始化")
        print(f"   止盈: {self.DEFAULT_TAKE_PROFIT*100}%")
        print(f"   止损: {self.DEFAULT_STOP_LOSS*100}%")
        print(f"   爆仓保护: {self.DEFAULT_LIQUIDATION*100}%")
        print(f"   最大持仓: {self.DEFAULT_MAX_HOLD}s")
    
    def register(
        self,
        symbol: str,
        side: str,
        size: float,
        entry_price: float,
        config: Dict = None
    ):
        """
        注册持仓
        
        Args:
            symbol: 交易对
            side: 方向 ('long' or 'short')
            size: 数量
            entry_price: 入场价
            config: Regime配置（止盈止损参数）
        """
        cfg = config or {}
        
        self.positions[symbol] = PositionState(
            symbol=symbol,
            side=side,
            size=size,
            entry_price=entry_price,
            entry_time=time.time(),
            take_profit_pct=cfg.get('take_profit', self.DEFAULT_TAKE_PROFIT),
            stop_loss_pct=cfg.get('stop_loss', self.DEFAULT_STOP_LOSS),
            max_hold_seconds=cfg.get('max_hold', self.DEFAULT_MAX_HOLD)
        )
        
        logger.info({
            "event": "position_registered",
            "symbol": symbol,
            "side": side,
            "size": size,
            "entry_price": entry_price,
            "take_profit": self.positions[symbol].take_profit_pct,
            "stop_loss": self.positions[symbol].stop_loss_pct,
            "max_hold": self.positions[symbol].max_hold_seconds
        })
        
        print(f"📍 注册持仓: {symbol} {side} {size} @ {entry_price:.2f}")
    
    def remove(self, symbol: str):
        """移除持仓"""
        if symbol in self.positions:
            del self.positions[symbol]
            logger.info({"event": "position_removed", "symbol": symbol})
    
    def check_exit(
        self,
        symbol: str,
        current_price: float
    ) -> Optional[PositionState]:
        """
        检查退出条件
        
        Args:
            symbol: 交易对
            current_price: 当前价格
        
        Returns:
            PositionState (如果需要退出) 或 None
        """
        if symbol not in self.positions:
            return None
        
        pos = self.positions[symbol]
        pos.current_price = current_price
        current_time = time.time()
        
        # 计算盈亏比例
        if pos.side == 'long':
            pos.unrealized_pnl_pct = (current_price - pos.entry_price) / pos.entry_price
        else:
            pos.unrealized_pnl_pct = (pos.entry_price - current_price) / pos.entry_price
        
        # 计算持仓时间
        pos.hold_time_seconds = current_time - pos.entry_time
        
        # ========== 退出检查（按优先级）==========
        
        # 1. 爆仓保护（最高优先级）
        if pos.unrealized_pnl_pct <= pos.liquidation_pct:
            pos.should_exit = True
            pos.exit_reason = ExitReason.LIQUIDATION_PROTECT
            pos.exit_message = f"🚨 爆仓风险！亏损 {pos.unrealized_pnl_pct*100:.2f}% <= {pos.liquidation_pct*100}%"
            return pos
        
        # 2. 止损
        if pos.unrealized_pnl_pct <= pos.stop_loss_pct:
            pos.should_exit = True
            pos.exit_reason = ExitReason.STOP_LOSS
            pos.exit_message = f"止损触发: {pos.unrealized_pnl_pct*100:.2f}% <= {pos.stop_loss_pct*100}%"
            return pos
        
        # 3. 止盈
        if pos.unrealized_pnl_pct >= pos.take_profit_pct:
            pos.should_exit = True
            pos.exit_reason = ExitReason.TAKE_PROFIT
            pos.exit_message = f"止盈触发: {pos.unrealized_pnl_pct*100:.2f}% >= {pos.take_profit_pct*100}%"
            return pos
        
        # 4. 时间退出
        if pos.hold_time_seconds >= pos.max_hold_seconds:
            pos.should_exit = True
            pos.exit_reason = ExitReason.TIME_EXIT
            pos.exit_message = f"超时退出: {pos.hold_time_seconds:.0f}s >= {pos.max_hold_seconds}s"
            return pos
        
        # 不需要退出
        pos.should_exit = False
        return pos
    
    def has_position(self, symbol: str) -> bool:
        """是否有持仓"""
        return symbol in self.positions
    
    def get_position(self, symbol: str) -> Optional[PositionState]:
        """获取持仓"""
        return self.positions.get(symbol)
    
    def get_all_positions(self) -> List[str]:
        """获取所有持仓交易对"""
        return list(self.positions.keys())
    
    def force_exit_all(self, reason: str = "FORCE_EXIT"):
        """
        强制退出所有持仓
        
        用于系统异常时紧急清仓
        """
        for symbol in list(self.positions.keys()):
            pos = self.positions[symbol]
            pos.should_exit = True
            pos.exit_reason = ExitReason.FORCE_EXIT
            pos.exit_message = f"强制退出: {reason}"
        
        logger.warning({
            "event": "force_exit_all",
            "positions": list(self.positions.keys()),
            "reason": reason
        })
    
    def get_status_report(self, symbol: str, current_price: float = 0) -> str:
        """获取状态报告"""
        pos = self.check_exit(symbol, current_price) if current_price else self.positions.get(symbol)
        
        if not pos:
            return f"📊 {symbol}: 无持仓"
        
        return f"""📊 {symbol} 持仓状态:
   方向: {pos.side}
   数量: {pos.size}
   入场: {pos.entry_price:.2f}
   当前: {pos.current_price:.2f}
   盈亏: {pos.unrealized_pnl_pct*100:+.2f}%
   持仓: {pos.hold_time_seconds:.0f}s / {pos.max_hold_seconds}s
   状态: {'🔴 需退出' if pos.should_exit else '🟢 持有'}"""


# 全局实例
_lifecycle_engine = None

def get_lifecycle_engine() -> PositionLifecycleEngine:
    """获取全局引擎实例"""
    global _lifecycle_engine
    if _lifecycle_engine is None:
        _lifecycle_engine = PositionLifecycleEngine()
    return _lifecycle_engine