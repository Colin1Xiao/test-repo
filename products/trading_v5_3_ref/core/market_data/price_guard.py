#!/usr/bin/env python3
"""
Price Guard - 价格保护模块

核心功能：
1. 数据新鲜度保护
2. 价格偏差保护
3. 场景限制保护
"""

import time
from typing import Dict, Optional, Tuple
from dataclasses import dataclass


@dataclass
class PriceCheckResult:
    """价格检查结果"""
    is_valid: bool
    reason: str
    price: Optional[float] = None
    age_ms: float = 0.0
    deviation: float = 0.0


class PriceGuard:
    """
    价格保护器
    
    保护机制：
    1. 数据新鲜度：超过1秒拒绝
    2. 价格偏差：>0.05%拒绝
    3. 场景限制：BREAKOUT/高动量拒绝
    """
    
    def __init__(
        self,
        max_age_seconds: float = 1.0,
        max_deviation_pct: float = 0.0005,  # 0.05%
        allowed_regimes: list = None
    ):
        """
        初始化
        
        Args:
            max_age_seconds: 最大数据年龄（秒）
            max_deviation_pct: 最大价格偏差（比例）
            allowed_regimes: 允许的行情类型
        """
        self.max_age = max_age_seconds
        self.max_deviation = max_deviation_pct
        self.allowed_regimes = allowed_regimes or ['RANGE', 'range']
        
        # 统计
        self.stats = {
            'checks': 0,
            'passed': 0,
            'rejected_stale': 0,
            'rejected_deviation': 0,
            'rejected_regime': 0
        }
    
    def check_freshness(self, cache_data: Dict) -> PriceCheckResult:
        """
        检查数据新鲜度
        
        Args:
            cache_data: 缓存数据 {'ts': timestamp, 'bid': float, 'ask': float, ...}
            
        Returns:
            PriceCheckResult
        """
        if not cache_data:
            return PriceCheckResult(False, "无缓存数据")
        
        age = time.time() - cache_data.get('ts', 0)
        age_ms = age * 1000
        
        if age > self.max_age:
            return PriceCheckResult(
                False,
                f"数据过期: {age_ms:.0f}ms > {self.max_age*1000:.0f}ms",
                age_ms=age_ms
            )
        
        return PriceCheckResult(
            True,
            "新鲜度OK",
            age_ms=age_ms
        )
    
    def check_deviation(
        self,
        cache_price: float,
        orderbook_price: float
    ) -> PriceCheckResult:
        """
        检查价格偏差
        
        Args:
            cache_price: 缓存价格
            orderbook_price: 盘口价格
            
        Returns:
            PriceCheckResult
        """
        if not cache_price or not orderbook_price:
            return PriceCheckResult(False, "价格缺失")
        
        deviation = abs(cache_price - orderbook_price) / orderbook_price
        
        if deviation > self.max_deviation:
            return PriceCheckResult(
                False,
                f"价格偏差过大: {deviation*100:.3f}% > {self.max_deviation*100:.3f}%",
                deviation=deviation
            )
        
        return PriceCheckResult(
            True,
            "偏差OK",
            deviation=deviation
        )
    
    def check_regime(self, regime: str) -> bool:
        """
        检查行情类型是否允许交易
        
        Args:
            regime: 行情类型（RANGE/TREND/BREAKOUT）
            
        Returns:
            是否允许
        """
        return regime.upper() in [r.upper() for r in self.allowed_regimes]
    
    def full_check(
        self,
        cache_data: Dict,
        orderbook_mid: float,
        regime: str
    ) -> PriceCheckResult:
        """
        完整检查
        
        Args:
            cache_data: 缓存数据
            orderbook_mid: 盘口中间价
            regime: 行情类型
            
        Returns:
            PriceCheckResult
        """
        self.stats['checks'] += 1
        
        # 1. 检查行情类型
        if not self.check_regime(regime):
            self.stats['rejected_regime'] += 1
            return PriceCheckResult(
                False,
                f"行情类型不允许: {regime} (仅允许: {self.allowed_regimes})"
            )
        
        # 2. 检查新鲜度
        freshness = self.check_freshness(cache_data)
        if not freshness.is_valid:
            self.stats['rejected_stale'] += 1
            return freshness
        
        # 3. 检查价格偏差
        cache_mid = cache_data.get('mid', 0)
        deviation = self.check_deviation(cache_mid, orderbook_mid)
        if not deviation.is_valid:
            self.stats['rejected_deviation'] += 1
            return deviation
        
        self.stats['passed'] += 1
        return PriceCheckResult(
            True,
            "价格检查通过",
            price=cache_mid,
            age_ms=freshness.age_ms,
            deviation=deviation.deviation
        )
    
    def get_stats(self) -> Dict:
        """获取统计"""
        total = self.stats['checks']
        pass_rate = self.stats['passed'] / total * 100 if total > 0 else 0
        
        return {
            **self.stats,
            'pass_rate': pass_rate
        }


# 全局实例
_price_guard: Optional[PriceGuard] = None


def get_price_guard() -> PriceGuard:
    """获取全局价格保护器"""
    global _price_guard
    if _price_guard is None:
        _price_guard = PriceGuard()
    return _price_guard
