#!/usr/bin/env python3
"""
Regime类型定义
市场状态枚举
"""

from enum import Enum


class MarketRegime(Enum):
    """
    市场状态类型
    
    RANGE: 震荡行情 - 高成交量要求，短持仓
    TREND: 趋势行情 - 中等成交量要求，较长持仓
    BREAKOUT: 爆发行情 - 低成交量要求，长持仓
    """
    RANGE = "range"
    TREND = "trend"
    BREAKOUT = "breakout"
    
    def __str__(self):
        return self.value
    
    def emoji(self):
        """返回对应emoji"""
        return {
            MarketRegime.RANGE: "🟡",
            MarketRegime.TREND: "🔵",
            MarketRegime.BREAKOUT: "🔴"
        }[self]


class RegimeTransition:
    """
    状态转换记录
    用于追踪市场状态变化
    """
    def __init__(self, from_regime: MarketRegime, to_regime: MarketRegime, 
                 timestamp: str, trigger_reason: str):
        self.from_regime = from_regime
        self.to_regime = to_regime
        self.timestamp = timestamp
        self.trigger_reason = trigger_reason
    
    def __repr__(self):
        return f"RegimeTransition({self.from_regime} → {self.to_regime} @ {self.timestamp})"