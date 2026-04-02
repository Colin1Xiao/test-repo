#!/usr/bin/env python3
"""
Strategy Selector - 根据市场状态选择策略配置

核心桥梁：Regime → 策略参数
"""

from typing import Dict, Any
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from regime.regime_types import MarketRegime
from regime.regime_config import REGIME_CONFIG, get_regime_config, get_regime_weights


class StrategySelector:
    """
    策略选择器
    
    根据 Regime 选择：
    - 评分阈值
    - 成交量阈值
    - 评分权重
    - 止盈止损参数
    - 持仓时间
    """
    
    def __init__(self):
        self.config = REGIME_CONFIG
        self.current_regime = MarketRegime.RANGE
        self.current_config = get_regime_config("range")
        
        print("📊 Strategy Selector 初始化完成")
        print(f"   当前状态: {self.current_regime.emoji()} {self.current_regime.value}")
    
    def select(self, regime: MarketRegime) -> Dict[str, Any]:
        """
        根据状态选择策略配置
        
        Args:
            regime: MarketRegime枚举
        
        Returns:
            策略配置字典
        """
        self.current_regime = regime
        self.current_config = get_regime_config(regime.value)
        
        return self.current_config
    
    def get_min_score(self) -> int:
        """获取当前状态的评分阈值"""
        return self.current_config.get("min_score", 80)
    
    def get_min_volume(self) -> float:
        """获取当前状态的成交量阈值"""
        return self.current_config.get("min_volume", 1.2)
    
    def get_weights(self) -> Dict[str, float]:
        """获取当前状态的评分权重"""
        return self.current_config.get("weights", {})
    
    def get_take_profit(self) -> float:
        """获取止盈目标"""
        return self.current_config.get("take_profit", 0.002)
    
    def get_stop_loss(self) -> float:
        """获取止损阈值"""
        return self.current_config.get("stop_loss", 0.005)
    
    def get_max_hold(self) -> int:
        """获取最大持仓时间（秒）"""
        return self.current_config.get("max_hold", 30)
    
    def get_summary(self) -> str:
        """获取当前配置摘要"""
        return f"""
{self.current_regime.emoji()} {self.current_regime.value.upper()} 模式
├─ 评分阈值: {self.get_min_score()}分
├─ 成交量阈值: {self.get_min_volume()}x
├─ 止盈目标: {self.get_take_profit()*100}%
├─ 止损阈值: {self.get_stop_loss()*100}%
└─ 最大持仓: {self.get_max_hold()}秒
"""
    
    def should_trade(self, score: int, volume_ratio: float) -> tuple:
        """
        判断是否满足交易条件
        
        Returns:
            (should_trade: bool, reason: str)
        """
        min_score = self.get_min_score()
        min_volume = self.get_min_volume()
        
        if score < min_score:
            return False, f"评分不足 ({score} < {min_score})"
        
        if volume_ratio < min_volume:
            return False, f"成交量不足 ({volume_ratio:.2f}x < {min_volume}x)"
        
        return True, "满足条件"


# 创建全局实例
_selector = None

def get_selector() -> StrategySelector:
    """获取全局选择器实例"""
    global _selector
    if _selector is None:
        _selector = StrategySelector()
    return _selector