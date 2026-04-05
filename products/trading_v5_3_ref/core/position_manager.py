#!/usr/bin/env python3
"""
Position Manager - 持仓生命周期管理器

核心功能：
1. 持仓状态管理
2. 退出条件检测
3. 强制安全层
4. 完整日志记录

这是交易系统的核心安全模块 - Exit > Entry
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Optional, List
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class ExitReason(Enum):
    """退出原因枚举"""
    TAKE_PROFIT = "TAKE_PROFIT"           # 止盈
    STOP_LOSS = "STOP_LOSS"               # 止损
    LIQUIDATION_EXIT = "LIQUIDATION_EXIT" # 爆仓前退出
    TIME_EXIT = "TIME_EXIT"               # 时间退出
    PROFIT_GIVEBACK = "PROFIT_GIVEBACK"   # 利润回撤
    EMERGENCY_EXIT = "EMERGENCY_EXIT"     # 紧急退出
    FORCE_EXIT = "FORCE_EXIT"             # 强制退出


@dataclass
class Position:
    """
    持仓数据结构
    
    统一的持仓信息载体
    """
    symbol: str
    entry_price: float
    size: float
    side: str  # 'long' or 'short'
    entry_time: float
    
    # 状态追踪
    max_pnl: float = 0.0           # 最大盈利（用于回撤保护）
    current_pnl: float = 0.0       # 当前盈亏
    hold_time: float = 0.0         # 持仓时间
    
    # 退出信息
    exit_reason: Optional[ExitReason] = None
    exit_price: float = 0.0
    
    # 元数据
    regime: str = ""
    score: int = 0
    
    def __post_init__(self):
        """初始化后处理"""
        if isinstance(self.entry_time, str):
            # 如果是 ISO 格式字符串，转换为时间戳
            try:
                dt = datetime.fromisoformat(self.entry_time.replace('Z', '+00:00'))
                self.entry_time = dt.timestamp()
            except:
                self.entry_time = time.time()


class PositionManager:
    """
    持仓生命周期管理器
    
    核心原则：
    1. Exit > Entry 优先级
    2. 安全第一，宁可少赚
    3. 所有退出必须有日志
    """
    
    # 默认参数 - V2 策略
    DEFAULT_MAX_HOLD = 45.0        # V2: 最大持仓时间 30s → 45s
    DEFAULT_STOP_LOSS = -0.0005    # V2: 止损 -0.5% → -0.05%
    DEFAULT_TAKE_PROFIT = 0.0015   # V2: 止盈 0.2% → 0.15%
    DEFAULT_LIQUIDATION = -0.004   # 爆仓前退出 -0.4%（保持不变）
    DEFAULT_EMERGENCY_TIME = 60.0  # 紧急退出时间（秒）
    
    def __init__(
        self,
        max_hold_time: float = None,
        stop_loss: float = None,
        take_profit: float = None,
        liquidation_exit: float = None,
        emergency_time: float = None
    ):
        """
        初始化持仓管理器
        
        Args:
            max_hold_time: 最大持仓时间（秒）
            stop_loss: 止损比例
            take_profit: 止盈比例
            liquidation_exit: 爆仓前退出比例
            emergency_time: 紧急退出时间
        """
        self.max_hold_time = max_hold_time or self.DEFAULT_MAX_HOLD
        self.stop_loss = stop_loss or self.DEFAULT_STOP_LOSS
        self.take_profit = take_profit or self.DEFAULT_TAKE_PROFIT
        self.liquidation_exit = liquidation_exit or self.DEFAULT_LIQUIDATION
        self.emergency_time = emergency_time or self.DEFAULT_EMERGENCY_TIME
        
        # 持仓字典
        self.positions: Dict[str, Position] = {}
        
        print("🛡️ Position Manager 初始化完成")
        print(f"   止盈: {self.take_profit*100}%")
        print(f"   止损: {self.stop_loss*100}%")
        print(f"   爆仓保护: {self.liquidation_exit*100}%")
        print(f"   最大持仓: {self.max_hold_time}s")
        print(f"   紧急退出: {self.emergency_time}s")
    
    # ========== 持仓管理 ==========
    
    def open_position(
        self,
        symbol: str,
        entry_price: float,
        size: float,
        side: str,
        regime: str = "",
        score: int = 0
    ) -> Position:
        """
        开仓
        
        Args:
            symbol: 交易对
            entry_price: 入场价
            size: 数量
            side: 方向 ('long' or 'short')
            regime: 当前市场状态
            score: 信号评分
        
        Returns:
            Position 对象
        """
        position = Position(
            symbol=symbol,
            entry_price=entry_price,
            size=size,
            side=side,
            entry_time=time.time(),
            regime=regime,
            score=score
        )
        
        self.positions[symbol] = position
        
        logger.info({
            "event": "position_opened",
            "symbol": symbol,
            "side": side,
            "size": size,
            "entry_price": entry_price,
            "regime": regime,
            "score": score
        })
        
        print(f"📍 开仓: {symbol} {side} {size} @ {entry_price:.2f}")
        
        return position
    
    def close_position(self, symbol: str) -> Optional[Position]:
        """
        关闭持仓（移除记录）
        
        Args:
            symbol: 交易对
        
        Returns:
            被移除的 Position 或 None
        """
        if symbol in self.positions:
            position = self.positions.pop(symbol)
            logger.info({
                "event": "position_closed",
                "symbol": symbol,
                "exit_reason": position.exit_reason.value if position.exit_reason else None,
                "pnl": position.current_pnl,
                "hold_time": position.hold_time
            })
            return position
        return None
    
    def get_position(self, symbol: str) -> Optional[Position]:
        """获取持仓"""
        return self.positions.get(symbol)
    
    def has_position(self, symbol: str) -> bool:
        """是否有持仓"""
        return symbol in self.positions
    
    def get_all_positions(self) -> List[Position]:
        """获取所有持仓"""
        return list(self.positions.values())
    
    # ========== 盈亏计算 ==========
    
    def update_pnl(self, position: Position, current_price: float) -> float:
        """
        更新持仓盈亏
        
        Args:
            position: 持仓对象
            current_price: 当前价格
        
        Returns:
            当前盈亏比例
        """
        if position.side == "long":
            pnl = (current_price - position.entry_price) / position.entry_price
        else:
            pnl = (position.entry_price - current_price) / position.entry_price
        
        # 更新状态
        position.current_pnl = pnl
        position.max_pnl = max(position.max_pnl, pnl)
        position.hold_time = time.time() - position.entry_time
        
        return pnl
    
    # ========== 退出检测（核心）==========
    
    def check_exit(self, position: Position, current_price: float) -> Optional[ExitReason]:
        """
        检查退出条件
        
        优先级顺序（从高到低）：
        1. 爆仓前退出
        2. 止损
        3. 止盈
        4. 时间退出
        5. 利润回撤
        
        Args:
            position: 持仓对象
            current_price: 当前价格
        
        Returns:
            ExitReason 或 None
        """
        pnl = self.update_pnl(position, current_price)
        hold_time = position.hold_time
        
        # 🟥 1. 爆仓前退出（最高优先级）
        if pnl <= self.liquidation_exit:
            logger.warning({
                "event": "liquidation_exit",
                "symbol": position.symbol,
                "pnl": pnl,
                "threshold": self.liquidation_exit
            })
            return ExitReason.LIQUIDATION_EXIT
        
        # 🟥 2. 止损
        if pnl <= self.stop_loss:
            logger.info({
                "event": "stop_loss",
                "symbol": position.symbol,
                "pnl": pnl,
                "threshold": self.stop_loss
            })
            return ExitReason.STOP_LOSS
        
        # 🟩 3. 止盈
        if pnl >= self.take_profit:
            logger.info({
                "event": "take_profit",
                "symbol": position.symbol,
                "pnl": pnl,
                "threshold": self.take_profit
            })
            return ExitReason.TAKE_PROFIT
        
        # 🟨 4. 时间退出
        if hold_time >= self.max_hold_time:
            logger.info({
                "event": "time_exit",
                "symbol": position.symbol,
                "hold_time": hold_time,
                "threshold": self.max_hold_time
            })
            return ExitReason.TIME_EXIT
        
        # 🟧 5. 利润回撤保护
        if position.max_pnl > 0.001 and pnl < 0:
            logger.info({
                "event": "profit_giveback",
                "symbol": position.symbol,
                "max_pnl": position.max_pnl,
                "current_pnl": pnl
            })
            return ExitReason.PROFIT_GIVEBACK
        
        return None
    
    # ========== 强制安全层 ==========
    
    def check_emergency_exit(self, position: Position) -> bool:
        """
        检查紧急退出条件
        
        用于防止系统死锁或其他异常情况
        
        Args:
            position: 持仓对象
        
        Returns:
            是否需要紧急退出
        """
        hold_time = time.time() - position.entry_time
        
        if hold_time > self.emergency_time:
            logger.warning({
                "event": "emergency_exit_triggered",
                "symbol": position.symbol,
                "hold_time": hold_time,
                "threshold": self.emergency_time
            })
            return True
        
        return False
    
    def force_close_all(self) -> List[Position]:
        """
        强制关闭所有持仓
        
        用于系统异常或用户干预
        
        Returns:
            被关闭的持仓列表
        """
        closed = []
        
        for symbol in list(self.positions.keys()):
            position = self.positions[symbol]
            position.exit_reason = ExitReason.FORCE_EXIT
            
            logger.warning({
                "event": "force_close",
                "symbol": symbol,
                "pnl": position.current_pnl,
                "hold_time": position.hold_time
            })
            
            closed.append(self.close_position(symbol))
        
        return closed
    
    # ========== 状态报告 ==========
    
    def get_status_report(self, symbol: str, current_price: float = 0) -> str:
        """
        获取持仓状态报告
        
        Args:
            symbol: 交易对
            current_price: 当前价格
        
        Returns:
            状态报告字符串
        """
        position = self.positions.get(symbol)
        
        if not position:
            return f"📊 {symbol}: 无持仓"
        
        if current_price > 0:
            self.update_pnl(position, current_price)
        
        pnl_pct = position.current_pnl * 100
        hold_time = position.hold_time
        
        status = "🔴" if position.current_pnl < 0 else "🟢"
        
        return f"""📊 {symbol} 持仓状态:
   方向: {position.side}
   数量: {position.size}
   入场: {position.entry_price:.2f}
   当前: {current_price:.2f if current_price else 'N/A'}
   盈亏: {status} {pnl_pct:+.2f}% (最高: {position.max_pnl*100:+.2f}%)
   持仓: {hold_time:.0f}s / {self.max_hold_time}s
   评分: {position.score} [{position.regime}]"""
    
    def get_summary(self) -> Dict:
        """
        获取持仓汇总
        
        Returns:
            汇总字典
        """
        total_pnl = sum(p.current_pnl for p in self.positions.values())
        positions_data = [
            {
                "symbol": p.symbol,
                "side": p.side,
                "pnl": p.current_pnl,
                "hold_time": p.hold_time
            }
            for p in self.positions.values()
        ]
        
        return {
            "total_positions": len(self.positions),
            "total_pnl": total_pnl,
            "positions": positions_data
        }


# ========== 全局实例 ==========

_position_manager = None

def get_position_manager() -> PositionManager:
    """获取全局持仓管理器实例"""
    global _position_manager
    if _position_manager is None:
        _position_manager = PositionManager()
    return _position_manager