#!/usr/bin/env python3
"""
AI Risk Engine - 预测性风险引擎

核心能力：
1. 预测执行风险（滑点/延迟）
2. 预测市场状态恶化
3. 动态调整风险等级

关键原则：
- AI 不决定方向，只决定"能不能做"
- AI 只能更保守，不能更激进
- 最终决策 = min(AI决策, SafetyOrchestrator决策)
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum
import json
import math


class RiskLevel(Enum):
    """风险等级"""
    LOW = "LOW"           # 低风险：正常执行
    MEDIUM = "MEDIUM"     # 中风险：仓位减半
    HIGH = "HIGH"         # 高风险：禁止交易
    CRITICAL = "CRITICAL" # 极高风险：系统保护


@dataclass
class MarketState:
    """市场状态"""
    spread: float = 0.0              # 价差（小数形式）
    depth_ratio: float = 0.0         # 深度比率
    volume_ratio: float = 0.0        # 成交量比率
    volatility: float = 0.0          # 波动率
    price_velocity: float = 0.0      # 价格速度
    order_imbalance: float = 0.0     # 订单不平衡


@dataclass
class RiskAssessment:
    """风险评估结果"""
    risk_score: float
    risk_level: RiskLevel
    execute: bool
    size_multiplier: float
    reasons: List[str] = field(default_factory=list)
    
    # 风险因子详情
    spread_risk: float = 0.0
    depth_risk: float = 0.0
    volume_risk: float = 0.0
    volatility_risk: float = 0.0
    velocity_risk: float = 0.0


class AIRiskEngine:
    """
    AI 风险引擎
    
    预测执行风险，在风险发生前降低风险
    
    输入：市场状态（spread, depth, volume, volatility）
    输出：风险评估（risk_score, risk_level, execute, size_multiplier）
    
    原则：
    - AI 只能更保守，不能更激进
    - AI 不决定方向，只决定"能不能做"
    """
    
    # 风险阈值配置
    SPREAD_LOW = 0.0003       # 0.03%
    SPREAD_MEDIUM = 0.0005    # 0.05%
    SPREAD_HIGH = 0.001       # 0.1%
    
    DEPTH_LOW = 10
    DEPTH_MEDIUM = 5
    DEPTH_HIGH = 2
    
    VOLUME_LOW = 1.0
    VOLUME_MEDIUM = 0.7
    VOLUME_HIGH = 0.5
    
    VOLATILITY_LOW = 0.001
    VOLATILITY_MEDIUM = 0.002
    VOLATILITY_HIGH = 0.005
    
    def __init__(self):
        # 历史评估记录
        self.assessments: List[RiskAssessment] = []
        
        # 风险因子权重
        self.weights = {
            "spread": 0.25,
            "depth": 0.25,
            "volume": 0.20,
            "volatility": 0.20,
            "velocity": 0.10
        }
        
        print("🧠 AI Risk Engine 初始化完成")
        print(f"   权重: spread={self.weights['spread']}, depth={self.weights['depth']}, "
              f"volume={self.weights['volume']}, volatility={self.weights['volatility']}")
    
    def evaluate(
        self,
        spread: float,
        depth_ratio: float,
        volume_ratio: float,
        volatility: float,
        price_velocity: float = 0.0,
        order_imbalance: float = 0.0
    ) -> RiskAssessment:
        """
        评估执行风险
        
        Args:
            spread: 价差（小数形式，如 0.0003 = 0.03%）
            depth_ratio: 深度比率（订单簿深度 / 订单大小）
            volume_ratio: 成交量比率（当前成交量 / 平均成交量）
            volatility: 波动率（近期价格波动）
            price_velocity: 价格速度（价格变化速度）
            order_imbalance: 订单不平衡（买单/卖单比率）
        
        Returns:
            RiskAssessment
        """
        reasons = []
        
        # ============================================================
        # 1. 价差风险（Spread Risk）
        # ============================================================
        spread_risk = self._evaluate_spread(spread, reasons)
        
        # ============================================================
        # 2. 深度风险（Depth Risk）
        # ============================================================
        depth_risk = self._evaluate_depth(depth_ratio, reasons)
        
        # ============================================================
        # 3. 成交量风险（Volume Risk）
        # ============================================================
        volume_risk = self._evaluate_volume(volume_ratio, reasons)
        
        # ============================================================
        # 4. 波动率风险（Volatility Risk）
        # ============================================================
        volatility_risk = self._evaluate_volatility(volatility, reasons)
        
        # ============================================================
        # 5. 价格速度风险（Velocity Risk）
        # ============================================================
        velocity_risk = self._evaluate_velocity(price_velocity, reasons)
        
        # ============================================================
        # 综合风险评分（加权平均）
        # ============================================================
        risk_score = (
            spread_risk * self.weights["spread"] +
            depth_risk * self.weights["depth"] +
            volume_risk * self.weights["volume"] +
            volatility_risk * self.weights["volatility"] +
            velocity_risk * self.weights["velocity"]
        )
        
        # 归一化到 0-1
        risk_score = min(risk_score, 1.0)
        
        # ============================================================
        # 风险等级判定
        # ============================================================
        risk_level = self._classify_risk(risk_score)
        
        # ============================================================
        # 决策输出
        # ============================================================
        if risk_level == RiskLevel.LOW:
            execute = True
            size_multiplier = 1.0
        elif risk_level == RiskLevel.MEDIUM:
            execute = True
            size_multiplier = 0.5
            reasons.append("风险中等，仓位减半")
        elif risk_level == RiskLevel.HIGH:
            execute = False
            size_multiplier = 0.0
            reasons.append("风险过高，禁止交易")
        else:  # CRITICAL
            execute = False
            size_multiplier = 0.0
            reasons.append("极高风险，系统保护")
        
        # 构建评估结果
        assessment = RiskAssessment(
            risk_score=risk_score,
            risk_level=risk_level,
            execute=execute,
            size_multiplier=size_multiplier,
            reasons=reasons,
            spread_risk=spread_risk,
            depth_risk=depth_risk,
            volume_risk=volume_risk,
            volatility_risk=volatility_risk,
            velocity_risk=velocity_risk
        )
        
        # 记录历史
        self.assessments.append(assessment)
        if len(self.assessments) > 100:
            self.assessments = self.assessments[-100:]
        
        return assessment
    
    def _evaluate_spread(self, spread: float, reasons: List[str]) -> float:
        """评估价差风险"""
        if spread > self.SPREAD_HIGH:
            reasons.append(f"价差过高: {spread*100:.3f}% > {self.SPREAD_HIGH*100:.1f}%")
            return 1.0
        elif spread > self.SPREAD_MEDIUM:
            reasons.append(f"价差偏高: {spread*100:.3f}% > {self.SPREAD_MEDIUM*100:.2f}%")
            return 0.6
        elif spread > self.SPREAD_LOW:
            reasons.append(f"价差上升: {spread*100:.3f}%")
            return 0.3
        return 0.0
    
    def _evaluate_depth(self, depth_ratio: float, reasons: List[str]) -> float:
        """评估深度风险"""
        if depth_ratio < self.DEPTH_HIGH:
            reasons.append(f"深度严重不足: {depth_ratio:.1f} < {self.DEPTH_HIGH}")
            return 1.0
        elif depth_ratio < self.DEPTH_MEDIUM:
            reasons.append(f"深度不足: {depth_ratio:.1f} < {self.DEPTH_MEDIUM}")
            return 0.6
        elif depth_ratio < self.DEPTH_LOW:
            reasons.append(f"深度偏低: {depth_ratio:.1f}")
            return 0.3
        return 0.0
    
    def _evaluate_volume(self, volume_ratio: float, reasons: List[str]) -> float:
        """评估成交量风险"""
        if volume_ratio < self.VOLUME_HIGH:
            reasons.append(f"成交量极低: {volume_ratio:.2f}x < {self.VOLUME_HIGH}x")
            return 1.0
        elif volume_ratio < self.VOLUME_MEDIUM:
            reasons.append(f"成交量偏低: {volume_ratio:.2f}x < {self.VOLUME_MEDIUM}x")
            return 0.5
        elif volume_ratio < self.VOLUME_LOW:
            reasons.append(f"成交量下降: {volume_ratio:.2f}x")
            return 0.2
        return 0.0
    
    def _evaluate_volatility(self, volatility: float, reasons: List[str]) -> float:
        """评估波动率风险"""
        if volatility > self.VOLATILITY_HIGH:
            reasons.append(f"波动剧烈: {volatility*100:.2f}% > {self.VOLATILITY_HIGH*100:.1f}%")
            return 1.0
        elif volatility > self.VOLATILITY_MEDIUM:
            reasons.append(f"波动偏高: {volatility*100:.2f}%")
            return 0.5
        elif volatility > self.VOLATILITY_LOW:
            reasons.append(f"波动上升: {volatility*100:.2f}%")
            return 0.2
        return 0.0
    
    def _evaluate_velocity(self, velocity: float, reasons: List[str]) -> float:
        """评估价格速度风险"""
        abs_velocity = abs(velocity)
        if abs_velocity > 0.005:  # 0.5%/s
            reasons.append(f"价格剧烈变动: {abs_velocity*100:.2f}%/s")
            return 1.0
        elif abs_velocity > 0.002:  # 0.2%/s
            reasons.append(f"价格快速变动: {abs_velocity*100:.2f}%/s")
            return 0.5
        elif abs_velocity > 0.001:  # 0.1%/s
            return 0.2
        return 0.0
    
    def _classify_risk(self, risk_score: float) -> RiskLevel:
        """风险等级分类"""
        if risk_score < 0.3:
            return RiskLevel.LOW
        elif risk_score < 0.6:
            return RiskLevel.MEDIUM
        elif risk_score < 0.8:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL
    
    def get_recent_stats(self, n: int = 10) -> Dict:
        """获取最近 N 次评估统计"""
        if not self.assessments:
            return {}
        
        recent = self.assessments[-n:]
        
        avg_risk = sum(a.risk_score for a in recent) / len(recent)
        high_risk_count = sum(1 for a in recent if a.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL])
        
        return {
            "count": len(recent),
            "avg_risk_score": avg_risk,
            "high_risk_count": high_risk_count,
            "last_level": recent[-1].risk_level.value if recent else None
        }


class RiskDecision:
    """
    风险决策层
    
    整合 AI Risk Engine + SafetyOrchestrator
    最终决策 = min(AI决策, SafetyOrchestrator决策)
    """
    
    @staticmethod
    def decide(
        ai_assessment: RiskAssessment,
        safety_state: str,
        safety_position_multiplier: float
    ) -> Dict:
        """
        最终风险决策
        
        原则：AI 只能更保守，不能更激进
        """
        # 基础决策来自 AI
        execute = ai_assessment.execute
        size_multiplier = ai_assessment.size_multiplier
        
        # Safety 状态覆盖
        if safety_state == "FROZEN":
            execute = False
            size_multiplier = 0.0
        elif safety_state == "PAUSED":
            execute = False
            size_multiplier = 0.0
        elif safety_state == "DEGRADED":
            # 取更保守的
            size_multiplier = min(size_multiplier, safety_position_multiplier)
        
        return {
            "execute": execute,
            "size_multiplier": size_multiplier,
            "risk_level": ai_assessment.risk_level.value,
            "safety_state": safety_state,
            "reasons": ai_assessment.reasons
        }


# ============================================================
# 便捷函数
# ============================================================
def evaluate_risk(
    spread: float,
    depth_ratio: float,
    volume_ratio: float,
    volatility: float
) -> RiskAssessment:
    """便捷函数：评估风险"""
    engine = AIRiskEngine()
    return engine.evaluate(spread, depth_ratio, volume_ratio, volatility)


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== AI Risk Engine 测试 ===\n")
    
    engine = AIRiskEngine()
    
    # 测试低风险
    print("1. 低风险市场:")
    result = engine.evaluate(
        spread=0.0002,
        depth_ratio=15,
        volume_ratio=1.5,
        volatility=0.0008
    )
    print(f"   风险分数: {result.risk_score:.2f}")
    print(f"   风险等级: {result.risk_level.value}")
    print(f"   执行: {result.execute}")
    print(f"   仓位乘数: {result.size_multiplier}")
    
    # 测试中风险
    print("\n2. 中风险市场:")
    result = engine.evaluate(
        spread=0.0004,
        depth_ratio=6,
        volume_ratio=0.8,
        volatility=0.002
    )
    print(f"   风险分数: {result.risk_score:.2f}")
    print(f"   风险等级: {result.risk_level.value}")
    print(f"   执行: {result.execute}")
    print(f"   仓位乘数: {result.size_multiplier}")
    print(f"   原因: {result.reasons}")
    
    # 测试高风险
    print("\n3. 高风险市场:")
    result = engine.evaluate(
        spread=0.0012,
        depth_ratio=1.5,
        volume_ratio=0.4,
        volatility=0.006
    )
    print(f"   风险分数: {result.risk_score:.2f}")
    print(f"   风险等级: {result.risk_level.value}")
    print(f"   执行: {result.execute}")
    print(f"   仓位乘数: {result.size_multiplier}")
    print(f"   原因: {result.reasons}")
    
    print("\n=== 风险因子分布 ===")
    print(f"   spread_risk: {result.spread_risk:.2f}")
    print(f"   depth_risk: {result.depth_risk:.2f}")
    print(f"   volume_risk: {result.volume_risk:.2f}")
    print(f"   volatility_risk: {result.volatility_risk:.2f}")