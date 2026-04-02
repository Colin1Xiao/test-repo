#!/usr/bin/env python3
"""
Adaptive Leverage Engine - 自适应杠杆引擎

核心思想：
真实杠杆锁死 100x（交易所）
通过仓位大小模拟杠杆变化：
- 风险高 → 更小仓位 ≈ 低杠杆
- 风险低 → 更大仓位 ≈ 高杠杆

原则：
- 不是提高收益，而是避免在"错误环境下使用高杠杆"
- 只能更保守，不能更激进
- 硬限制防止爆仓
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
from enum import Enum
from datetime import datetime
import json


class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Regime(Enum):
    RANGE = "RANGE"
    TREND = "TREND"
    BREAKOUT = "BREAKOUT"


class LeverageMode(Enum):
    """杠杆模式"""
    CONSERVATIVE = "CONSERVATIVE"   # 保守 (≤0.5x)
    NORMAL = "NORMAL"               # 正常 (0.5-1.0x)
    AGGRESSIVE = "AGGRESSIVE"       # 激进 (1.0-1.2x)
    LOCKED = "LOCKED"               # 锁定 (0x，禁止交易)


@dataclass
class LeverageDecision:
    """杠杆决策结果"""
    multiplier: float           # 仓位乘数
    effective_leverage: float   # 有效杠杆
    mode: LeverageMode
    reasons: list
    base_margin: float
    effective_margin: float
    notional: float


class AdaptiveLeverage:
    """
    自适应杠杆引擎
    
    通过仓位大小模拟杠杆变化
    
    规则：
    1. 风险控制层：风险等级 → 基础乘数
    2. 市场状态层：Regime → 加成/惩罚
    3. 安全限制层：硬限制防止爆仓
    """
    
    # 基础杠杆（锁死）
    BASE_LEVERAGE = 100
    
    # 硬限制
    MAX_MULTIPLIER = 1.2        # 最大乘数（不允许 1.5）
    MIN_MULTIPLIER = 0.3        # 最小乘数
    CONSECUTIVE_LOSS_PENALTY = 0.5  # 连续亏损惩罚
    LOW_QUALITY_PENALTY = 0.5       # 执行质量差惩罚
    
    def __init__(self, base_margin: float = 3.0):
        """
        Args:
            base_margin: 基础保证金（USD）
        """
        self.base_margin = base_margin
        
        # 状态追踪
        self.consecutive_losses = 0
        self.recent_execution_quality = []
        
        print("⚡ Adaptive Leverage Engine 初始化完成")
        print(f"   基础保证金: {base_margin} USD")
        print(f"   基础杠杆: {self.BASE_LEVERAGE}x (锁死)")
        print(f"   乘数范围: {self.MIN_MULTIPLIER} - {self.MAX_MULTIPLIER}")
    
    def get_effective_multiplier(
        self,
        risk_level: RiskLevel,
        regime: Regime,
        consecutive_losses: int = 0,
        execution_quality: float = 1.0,
        win_rate: float = 0.5
    ) -> Tuple[float, LeverageMode, list]:
        """
        计算有效乘数
        
        Args:
            risk_level: AI 风险等级
            regime: 市场状态
            consecutive_losses: 连续亏损次数
            execution_quality: 执行质量 (0-1)
            win_rate: 胜率 (0-1)
        
        Returns:
            (multiplier, mode, reasons)
        """
        reasons = []
        
        # ============================================================
        # 🚨 Layer 1: 风险控制（最高优先级）
        # ============================================================
        if risk_level == RiskLevel.CRITICAL:
            reasons.append("极高风险，禁止交易")
            return 0.0, LeverageMode.LOCKED, reasons
        
        if risk_level == RiskLevel.HIGH:
            reasons.append("高风险，禁止交易")
            return 0.0, LeverageMode.LOCKED, reasons
        
        # ============================================================
        # 🎯 Layer 2: 基础乘数（基于风险等级）
        # ============================================================
        if risk_level == RiskLevel.MEDIUM:
            base_multiplier = 0.5
            reasons.append("中等风险，乘数 0.5")
        else:  # LOW
            base_multiplier = 1.0
            reasons.append("低风险，基础乘数 1.0")
        
        # ============================================================
        # 🎯 Layer 3: 市场状态加成
        # ============================================================
        regime_bonus = 1.0
        
        if regime == Regime.TREND:
            regime_bonus = 1.1
            reasons.append("趋势市场，加成 1.1x")
        elif regime == Regime.BREAKOUT:
            regime_bonus = 1.2
            reasons.append("突破市场，加成 1.2x")
        elif regime == Regime.RANGE:
            regime_bonus = 0.7
            reasons.append("震荡市场，惩罚 0.7x")
        
        multiplier = base_multiplier * regime_bonus
        
        # ============================================================
        # 🛡️ Layer 4: 安全限制（强制）
        # ============================================================
        
        # 连续亏损惩罚
        if consecutive_losses >= 2:
            penalty = self.CONSECUTIVE_LOSS_PENALTY
            multiplier *= penalty
            reasons.append(f"连续亏损 {consecutive_losses} 笔，惩罚 {penalty}x")
        
        # 执行质量惩罚
        if execution_quality < 0.8:
            penalty = self.LOW_QUALITY_PENALTY
            multiplier = min(multiplier, penalty)
            reasons.append(f"执行质量低 ({execution_quality:.2f})，限制 {penalty}x")
        
        # 胜率惩罚
        if win_rate < 0.4:
            multiplier *= 0.5
            reasons.append(f"胜率低 ({win_rate*100:.0f}%)，惩罚 0.5x")
        
        # ============================================================
        # 📏 Layer 5: 硬限制
        # ============================================================
        multiplier = min(multiplier, self.MAX_MULTIPLIER)
        multiplier = max(multiplier, self.MIN_MULTIPLIER)
        
        # 风险高时强制限制
        if risk_level == RiskLevel.MEDIUM:
            multiplier = min(multiplier, 0.5)
        
        # ============================================================
        # 确定模式
        # ============================================================
        if multiplier == 0:
            mode = LeverageMode.LOCKED
        elif multiplier <= 0.5:
            mode = LeverageMode.CONSERVATIVE
        elif multiplier <= 1.0:
            mode = LeverageMode.NORMAL
        else:
            mode = LeverageMode.AGGRESSIVE
        
        return multiplier, mode, reasons
    
    def decide(
        self,
        risk_level: RiskLevel,
        regime: Regime,
        consecutive_losses: int = 0,
        execution_quality: float = 1.0,
        win_rate: float = 0.5
    ) -> LeverageDecision:
        """
        杠杆决策
        
        Returns:
            LeverageDecision
        """
        multiplier, mode, reasons = self.get_effective_multiplier(
            risk_level,
            regime,
            consecutive_losses,
            execution_quality,
            win_rate
        )
        
        # 计算有效保证金和名义仓位
        effective_margin = self.base_margin * multiplier if multiplier > 0 else 0
        notional = effective_margin * self.BASE_LEVERAGE
        effective_leverage = self.BASE_LEVERAGE * multiplier
        
        return LeverageDecision(
            multiplier=multiplier,
            effective_leverage=effective_leverage,
            mode=mode,
            reasons=reasons,
            base_margin=self.base_margin,
            effective_margin=effective_margin,
            notional=notional
        )
    
    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "base_margin": self.base_margin,
            "base_leverage": self.BASE_LEVERAGE,
            "consecutive_losses": self.consecutive_losses,
            "max_multiplier": self.MAX_MULTIPLIER,
            "min_multiplier": self.MIN_MULTIPLIER
        }


# ============================================================
# 便捷函数
# ============================================================
def calculate_adaptive_leverage(
    risk_level: str,
    regime: str,
    base_margin: float = 3.0,
    consecutive_losses: int = 0,
    execution_quality: float = 1.0,
    win_rate: float = 0.5
) -> Dict:
    """
    便捷函数：计算自适应杠杆
    
    Args:
        risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
        regime: "RANGE" | "TREND" | "BREAKOUT"
        base_margin: 基础保证金
        consecutive_losses: 连续亏损次数
        execution_quality: 执行质量 (0-1)
        win_rate: 胜率 (0-1)
    
    Returns:
        {
            "multiplier": float,
            "effective_leverage": float,
            "mode": str,
            "effective_margin": float,
            "notional": float,
            "reasons": list
        }
    """
    # 转换枚举
    risk = RiskLevel(risk_level.upper())
    reg = Regime(regime.upper())
    
    engine = AdaptiveLeverage(base_margin)
    decision = engine.decide(
        risk_level=risk,
        regime=reg,
        consecutive_losses=consecutive_losses,
        execution_quality=execution_quality,
        win_rate=win_rate
    )
    
    return {
        "multiplier": decision.multiplier,
        "effective_leverage": decision.effective_leverage,
        "mode": decision.mode.value,
        "effective_margin": decision.effective_margin,
        "notional": decision.notional,
        "reasons": decision.reasons
    }


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Adaptive Leverage Engine 测试 ===\n")
    
    engine = AdaptiveLeverage(base_margin=3.0)
    
    # 测试低风险 + 趋势
    print("1. 低风险 + 趋势市场:")
    decision = engine.decide(
        risk_level=RiskLevel.LOW,
        regime=Regime.TREND
    )
    print(f"   乘数: {decision.multiplier:.2f}x")
    print(f"   有效杠杆: {decision.effective_leverage:.0f}x")
    print(f"   模式: {decision.mode.value}")
    print(f"   有效保证金: ${decision.effective_margin:.2f}")
    print(f"   名义仓位: ${decision.notional:.0f}")
    print(f"   原因: {decision.reasons}")
    
    # 测试中等风险
    print("\n2. 中等风险 + 震荡市场:")
    decision = engine.decide(
        risk_level=RiskLevel.MEDIUM,
        regime=Regime.RANGE
    )
    print(f"   乘数: {decision.multiplier:.2f}x")
    print(f"   有效杠杆: {decision.effective_leverage:.0f}x")
    print(f"   模式: {decision.mode.value}")
    print(f"   原因: {decision.reasons}")
    
    # 测试高风险
    print("\n3. 高风险:")
    decision = engine.decide(
        risk_level=RiskLevel.HIGH,
        regime=Regime.TREND
    )
    print(f"   乘数: {decision.multiplier:.2f}x")
    print(f"   模式: {decision.mode.value}")
    print(f"   原因: {decision.reasons}")
    
    # 测试连续亏损
    print("\n4. 低风险 + 连续亏损2笔:")
    decision = engine.decide(
        risk_level=RiskLevel.LOW,
        regime=Regime.TREND,
        consecutive_losses=2
    )
    print(f"   乘数: {decision.multiplier:.2f}x")
    print(f"   有效杠杆: {decision.effective_leverage:.0f}x")
    print(f"   原因: {decision.reasons}")
    
    # 测试执行质量差
    print("\n5. 低风险 + 执行质量差:")
    decision = engine.decide(
        risk_level=RiskLevel.LOW,
        regime=Regime.TREND,
        execution_quality=0.7
    )
    print(f"   乘数: {decision.multiplier:.2f}x")
    print(f"   有效杠杆: {decision.effective_leverage:.0f}x")
    print(f"   原因: {decision.reasons}")