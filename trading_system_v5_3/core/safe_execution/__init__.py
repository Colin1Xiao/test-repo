#!/usr/bin/env python3
"""
Safe Execution V5.4 - 重构后的入口模块

使用方式:
    from core.safe_execution import SafeExecutionV54, TradeResult
    from core.safe_execution.position_gate import PositionGate
    from core.safe_execution.stop_loss import StopLossManager
"""

# 类型定义
from .types import TradeResult, PositionData, CapitalDecision

# 子模块
from .position_gate import PositionGate
from .stop_loss import StopLossManager
from .executor import SafeExecutionV54

__all__ = [
    'TradeResult',
    'PositionData', 
    'CapitalDecision',
    'PositionGate',
    'StopLossManager',
    'SafeExecutionV54',
]