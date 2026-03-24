#!/usr/bin/env python3
"""
V3.5 Volatility Filter - 波动率过滤核心模块

核心功能：
1. 计算短期波动率
2. 分级波动率（LOW/MID/HIGH）
3. 动态 TP/SL 参数

关键设计：
- LOW 波动 → 不交易（过滤噪音）
- MID 波动 → 正常交易
- HIGH 波动 → 扩大止盈，让利润跑
"""

import numpy as np
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class VolatilityClass(Enum):
    """波动率分级"""
    LOW = "LOW"    # 死水，不交易
    MID = "MID"    # 正常
    HIGH = "HIGH"  # 强机会


@dataclass
class VolatilityParams:
    """波动率参数包"""
    volatility_class: VolatilityClass
    volatility_value: float
    take_profit: float      # 止盈比例
    stop_loss: float        # 止损比例（正数）
    max_hold_sec: int       # 最大持仓时间
    
    def is_tradable(self) -> bool:
        """是否可交易"""
        return self.volatility_class != VolatilityClass.LOW


class VolatilityFilter:
    """
    V3.5 波动率过滤器
    
    核心逻辑：
    1. 计算最近10根K线的平均波动
    2. 分级：LOW/MID/HIGH
    3. 返回对应的交易参数
    """
    
    # 阈值常量
    LOW_THRESHOLD = 0.0008    # < 0.08% → LOW
    HIGH_THRESHOLD = 0.002    # > 0.2% → HIGH
    
    # 动态参数
    PARAMS = {
        VolatilityClass.LOW: {
            "take_profit": 0.0,
            "stop_loss": 0.0,
            "max_hold": 0
        },
        VolatilityClass.MID: {
            "take_profit": 0.0020,   # 0.20%
            "stop_loss": 0.0006,     # 0.06%
            "max_hold": 60           # 60s
        },
        VolatilityClass.HIGH: {
            "take_profit": 0.0035,   # 0.35%
            "stop_loss": 0.0010,     # 0.10%
            "max_hold": 90           # 90s
        }
    }
    
    def __init__(self):
        """初始化"""
        self.history = []
        print("📊 Volatility Filter V3.5 初始化完成")
        print(f"   LOW阈值: <{self.LOW_THRESHOLD*100:.2f}%")
        print(f"   HIGH阈值: >{self.HIGH_THRESHOLD*100:.2f}%")
    
    def calculate_volatility(self, candles: list) -> float:
        """
        计算短期波动率
        
        Args:
            candles: 最近10-20根K线 [{"close": price}, ...]
        
        Returns:
            平均波动率（绝对收益率均值）
        """
        if not candles or len(candles) < 2:
            return 0.0
        
        # 取最近10根
        recent = candles[-10:] if len(candles) >= 10 else candles
        prices = [c.get("close", c.get("c", 0)) for c in recent]
        
        # 计算绝对收益率
        returns = []
        for i in range(1, len(prices)):
            if prices[i-1] > 0:
                r = abs(prices[i] - prices[i-1]) / prices[i-1]
                returns.append(r)
        
        if not returns:
            return 0.0
        
        return sum(returns) / len(returns)
    
    def classify_volatility(self, volatility: float) -> VolatilityClass:
        """
        波动率分级
        
        Args:
            volatility: 波动率值
        
        Returns:
            VolatilityClass枚举
        """
        if volatility < self.LOW_THRESHOLD:
            return VolatilityClass.LOW
        elif volatility > self.HIGH_THRESHOLD:
            return VolatilityClass.HIGH
        else:
            return VolatilityClass.MID
    
    def get_params(self, volatility_class: VolatilityClass) -> Dict:
        """
        获取交易参数
        
        Args:
            volatility_class: 波动率等级
        
        Returns:
            参数字典
        """
        return self.PARAMS.get(volatility_class, self.PARAMS[VolatilityClass.MID])
    
    def analyze(self, candles: list) -> VolatilityParams:
        """
        完整分析：计算 → 分级 → 返回参数
        
        Args:
            candles: K线数据
        
        Returns:
            VolatilityParams数据包
        """
        # 计算波动率
        vol = self.calculate_volatility(candles)
        
        # 分级
        vol_class = self.classify_volatility(vol)
        
        # 获取参数
        params = self.get_params(vol_class)
        
        # 记录历史
        self.history.append({
            "volatility": vol,
            "class": vol_class.value,
            "tradable": vol_class != VolatilityClass.LOW
        })
        
        # 保留最近100条
        if len(self.history) > 100:
            self.history = self.history[-100:]
        
        return VolatilityParams(
            volatility_class=vol_class,
            volatility_value=vol,
            take_profit=params["take_profit"],
            stop_loss=params["stop_loss"],
            max_hold_sec=params["max_hold"]
        )
    
    def should_trade(self, candles: list) -> Tuple[bool, VolatilityParams]:
        """
        判断是否应该交易
        
        Args:
            candles: K线数据
        
        Returns:
            (是否交易, 参数包)
        """
        params = self.analyze(candles)
        return params.is_tradable(), params
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        if not self.history:
            return {"total": 0}
        
        low_count = sum(1 for h in self.history if h["class"] == "LOW")
        mid_count = sum(1 for h in self.history if h["class"] == "MID")
        high_count = sum(1 for h in self.history if h["class"] == "HIGH")
        
        avg_vol = sum(h["volatility"] for h in self.history) / len(self.history)
        
        return {
            "total": len(self.history),
            "LOW": low_count,
            "MID": mid_count,
            "HIGH": high_count,
            "avg_volatility": avg_vol,
            "tradable_pct": (mid_count + high_count) / len(self.history) * 100
        }


# 单例
_volatility_filter = None

def get_volatility_filter() -> VolatilityFilter:
    """获取全局实例"""
    global _volatility_filter
    if _volatility_filter is None:
        _volatility_filter = VolatilityFilter()
    return _volatility_filter