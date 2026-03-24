#!/usr/bin/env python3
"""
Market Structure Engine - 市场结构识别引擎

核心认知：
交易不是预测方向，是选择"在哪种市场下参与"

同样的信号，在不同结构下 → 完全不同结果：
- 趋势下做突破 → 爆赚
- 震荡下做突破 → 被反杀
- 低流动性追单 → 滑点爆炸

结构分类：
1. RANGE（震荡）- 均值回归
2. TREND（趋势）- 趋势跟随
3. BREAKOUT（突破）- 动量
4. CHAOTIC（混乱）- 禁止交易

逻辑顺序：
结构 > 风控 > 执行
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum
import json
import math


class MarketStructure(Enum):
    """市场结构类型"""
    RANGE = "RANGE"           # 震荡 - 均值回归
    TREND = "TREND"           # 趋势 - 趋势跟随
    BREAKOUT = "BREAKOUT"     # 突破 - 动量
    CHAOTIC = "CHAOTIC"       # 混乱 - 禁止交易


class TradingMode(Enum):
    """交易模式"""
    MEAN_REVERSION = "MEAN_REVERSION"  # 均值回归
    TREND_FOLLOW = "TREND_FOLLOW"      # 趋势跟随
    MOMENTUM = "MOMENTUM"              # 动量
    NO_TRADE = "NO_TRADE"              # 禁止交易


@dataclass
class StructureFeatures:
    """结构特征"""
    price_change: float = 0.0       # 价格变化率
    volatility: float = 0.0         # 波动率
    volume_ratio: float = 1.0       # 成交量比率
    trend_strength: float = 0.0     # 趋势强度
    spread: float = 0.0             # 价差
    depth_ratio: float = 1.0        # 深度比率
    momentum: float = 0.0           # 动量
    range_ratio: float = 0.0        # 震荡比率


@dataclass
class StructureDecision:
    """结构决策"""
    structure: MarketStructure
    mode: TradingMode
    confidence: float
    score_threshold: float
    volume_threshold: float
    execute: bool
    reasons: List[str] = field(default_factory=list)
    features: StructureFeatures = None


class MarketStructureEngine:
    """
    市场结构识别引擎
    
    核心职责：
    1. 识别当前市场结构
    2. 决定是否交易
    3. 调整策略参数
    
    优先级：
    CHAOTIC > BREAKOUT > TREND > RANGE
    """
    
    # 结构阈值
    CHAOTIC_VOLATILITY = 0.003       # 0.3% 波动
    CHAOTIC_VOLUME = 0.7             # 成交量过低
    BREAKOUT_CHANGE = 0.002          # 0.2% 价格变化
    BREAKOUT_VOLUME = 1.5            # 成交量激增
    TREND_STRENGTH = 0.6             # 趋势强度
    TREND_VOLATILITY = 0.002         # 趋势下波动
    RANGE_VOLATILITY = 0.001         # 震荡波动
    
    # 结构跳变保护
    STRUCTURE_CHANGE_SKIP_CYCLES = 2  # 结构变化后跳过周期数
    
    def __init__(self):
        self.history: List[MarketStructure] = []
        self.structure_change_time: Optional[datetime] = None
        self.last_structure: Optional[MarketStructure] = None
        self.consecutive_chaotic = 0
        
        print("🏗️ Market Structure Engine 初始化完成")
        print(f"   CHAOTIC阈值: 波动>{self.CHAOTIC_VOLATILITY*100:.1f}% 且 成交量<{self.CHAOTIC_VOLUME}x")
        print(f"   BREAKOUT阈值: 变化>{self.BREAKOUT_CHANGE*100:.1f}% 且 成交量>{self.BREAKOUT_VOLUME}x")
        print(f"   TREND阈值: 强度>{self.TREND_STRENGTH} 且 波动<{self.TREND_VOLATILITY*100:.1f}%")
    
    def detect(
        self,
        price_change: float,
        volatility: float,
        volume_ratio: float,
        trend_strength: float,
        spread: float = 0.0,
        depth_ratio: float = 1.0,
        momentum: float = 0.0
    ) -> Tuple[MarketStructure, float, List[str]]:
        """
        检测市场结构
        
        Args:
            price_change: 价格变化率 (abs(close-open)/open)
            volatility: 波动率 (std/close)
            volume_ratio: 成交量比率 (volume/avg_volume)
            trend_strength: 趋势强度 (abs(ma_fast-ma_slow)/ma_slow)
            spread: 价差 (小数)
            depth_ratio: 深度比率 (depth/order_size)
            momentum: 动量 (rsi_diff/100)
        
        Returns:
            (structure, confidence, reasons)
        """
        reasons = []
        features = StructureFeatures(
            price_change=price_change,
            volatility=volatility,
            volume_ratio=volume_ratio,
            trend_strength=trend_strength,
            spread=spread,
            depth_ratio=depth_ratio,
            momentum=momentum
        )
        
        # ============================================================
        # 1️⃣ CHAOTIC（最高优先级 - 禁止交易）
        # ============================================================
        chaotic_score = 0
        
        if volatility > self.CHAOTIC_VOLATILITY:
            chaotic_score += 0.5
            reasons.append(f"高波动: {volatility*100:.2f}% > {self.CHAOTIC_VOLATILITY*100:.1f}%")
        
        if volume_ratio < self.CHAOTIC_VOLUME:
            chaotic_score += 0.3
            reasons.append(f"低流动性: {volume_ratio:.2f}x < {self.CHAOTIC_VOLUME}x")
        
        if spread > 0.001:  # 0.1%
            chaotic_score += 0.2
            reasons.append(f"高价差: {spread*100:.2f}%")
        
        if depth_ratio < 2:
            chaotic_score += 0.2
            reasons.append(f"深度不足: {depth_ratio:.1f}x < 2x")
        
        # CHAOTIC 判定
        if chaotic_score >= 0.5:
            self._update_history(MarketStructure.CHAOTIC)
            return MarketStructure.CHAOTIC, chaotic_score, reasons
        
        # ============================================================
        # 2️⃣ BREAKOUT（突破）
        # ============================================================
        breakout_score = 0
        
        if price_change > self.BREAKOUT_CHANGE:
            breakout_score += 0.4
            reasons.append(f"价格突破: {price_change*100:.2f}% > {self.BREAKOUT_CHANGE*100:.1f}%")
        
        if volume_ratio > self.BREAKOUT_VOLUME:
            breakout_score += 0.3
            reasons.append(f"成交量激增: {volume_ratio:.2f}x > {self.BREAKOUT_VOLUME}x")
        
        if momentum > 0.6:
            breakout_score += 0.2
            reasons.append(f"动量强: {momentum:.2f}")
        
        # BREAKOUT 判定
        if breakout_score >= 0.5:
            self._update_history(MarketStructure.BREAKOUT)
            return MarketStructure.BREAKOUT, breakout_score, reasons
        
        # ============================================================
        # 3️⃣ TREND（趋势）
        # ============================================================
        trend_score = 0
        
        if trend_strength > self.TREND_STRENGTH:
            trend_score += 0.4
            reasons.append(f"趋势强度: {trend_strength:.2f} > {self.TREND_STRENGTH}")
        
        if volatility < self.TREND_VOLATILITY:
            trend_score += 0.2
            reasons.append(f"稳定波动: {volatility*100:.2f}% < {self.TREND_VOLATILITY*100:.1f}%")
        
        if volume_ratio > 1.0:
            trend_score += 0.2
            reasons.append(f"成交量正常: {volume_ratio:.2f}x")
        
        # TREND 判定
        if trend_score >= 0.5:
            self._update_history(MarketStructure.TREND)
            return MarketStructure.TREND, trend_score, reasons
        
        # ============================================================
        # 4️⃣ RANGE（震荡 - 默认）
        # ============================================================
        range_score = 0.5
        reasons.append(f"震荡市场")
        
        if volatility < self.RANGE_VOLATILITY:
            range_score += 0.2
            reasons.append(f"低波动: {volatility*100:.2f}%")
        
        if trend_strength < 0.3:
            range_score += 0.2
            reasons.append(f"无趋势: {trend_strength:.2f}")
        
        self._update_history(MarketStructure.RANGE)
        return MarketStructure.RANGE, range_score, reasons
    
    def decide(
        self,
        structure: MarketStructure,
        confidence: float = 0.5
    ) -> StructureDecision:
        """
        根据结构做出决策
        
        Args:
            structure: 市场结构
            confidence: 置信度
        
        Returns:
            StructureDecision
        """
        reasons = []
        
        # ============================================================
        # CHAOTIC - 禁止交易
        # ============================================================
        if structure == MarketStructure.CHAOTIC:
            reasons.append("市场混乱，禁止交易")
            return StructureDecision(
                structure=structure,
                mode=TradingMode.NO_TRADE,
                confidence=confidence,
                score_threshold=0,
                volume_threshold=0,
                execute=False,
                reasons=reasons
            )
        
        # ============================================================
        # RANGE - 均值回归
        # ============================================================
        if structure == MarketStructure.RANGE:
            return StructureDecision(
                structure=structure,
                mode=TradingMode.MEAN_REVERSION,
                confidence=confidence,
                score_threshold=80,
                volume_threshold=1.2,
                execute=True,
                reasons=["震荡市场 → 均值回归策略"]
            )
        
        # ============================================================
        # TREND - 趋势跟随
        # ============================================================
        if structure == MarketStructure.TREND:
            return StructureDecision(
                structure=structure,
                mode=TradingMode.TREND_FOLLOW,
                confidence=confidence,
                score_threshold=65,      # 降低阈值
                volume_threshold=0.6,    # 降低成交量要求
                execute=True,
                reasons=["趋势市场 → 趋势跟随策略"]
            )
        
        # ============================================================
        # BREAKOUT - 动量
        # ============================================================
        if structure == MarketStructure.BREAKOUT:
            return StructureDecision(
                structure=structure,
                mode=TradingMode.MOMENTUM,
                confidence=confidence,
                score_threshold=60,      # 更低阈值
                volume_threshold=0.5,    # 更低成交量
                execute=True,
                reasons=["突破市场 → 动量策略"]
            )
        
        # 默认禁止
        return StructureDecision(
            structure=structure,
            mode=TradingMode.NO_TRADE,
            confidence=0,
            score_threshold=0,
            volume_threshold=0,
            execute=False,
            reasons=["未知结构"]
        )
    
    def _update_history(self, structure: MarketStructure):
        """更新结构历史"""
        # 检测结构跳变
        if self.last_structure and self.last_structure != structure:
            self.structure_change_time = datetime.now()
        
        self.last_structure = structure
        self.history.append(structure)
        
        # 保持历史长度
        if len(self.history) > 100:
            self.history = self.history[-100:]
        
        # 更新连续 CHAOTIC 计数
        if structure == MarketStructure.CHAOTIC:
            self.consecutive_chaotic += 1
        else:
            self.consecutive_chaotic = 0
    
    def should_skip_after_change(self) -> bool:
        """
        检查是否应该跳过交易（结构跳变保护）
        
        在结构变化后跳过 N 个周期
        """
        if not self.structure_change_time:
            return False
        
        elapsed = (datetime.now() - self.structure_change_time).total_seconds()
        skip_seconds = self.STRUCTURE_CHANGE_SKIP_CYCLES * 10  # 假设 10s 周期
        
        return elapsed < skip_seconds
    
    def get_structure_stability(self) -> float:
        """
        获取结构稳定性
        
        Returns:
            0-1，越高越稳定
        """
        if len(self.history) < 5:
            return 0.5
        
        recent = self.history[-5:]
        
        # 计算相同结构的比例
        counts = {}
        for s in recent:
            counts[s] = counts.get(s, 0) + 1
        
        max_count = max(counts.values())
        stability = max_count / len(recent)
        
        return stability
    
    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "last_structure": self.last_structure.value if self.last_structure else None,
            "consecutive_chaotic": self.consecutive_chaotic,
            "stability": self.get_structure_stability(),
            "history_count": len(self.history)
        }


# ============================================================
# 便捷函数
# ============================================================
def detect_structure(
    price_change: float,
    volatility: float,
    volume_ratio: float,
    trend_strength: float
) -> Dict:
    """
    便捷函数：检测市场结构
    
    Returns:
        {
            "structure": str,
            "confidence": float,
            "reasons": list
        }
    """
    engine = MarketStructureEngine()
    structure, confidence, reasons = engine.detect(
        price_change=price_change,
        volatility=volatility,
        volume_ratio=volume_ratio,
        trend_strength=trend_strength
    )
    
    return {
        "structure": structure.value,
        "confidence": confidence,
        "reasons": reasons
    }


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Market Structure Engine 测试 ===\n")
    
    engine = MarketStructureEngine()
    
    # 测试 CHAOTIC
    print("1. 测试 CHAOTIC:")
    structure, conf, reasons = engine.detect(
        price_change=0.003,
        volatility=0.005,      # 高波动
        volume_ratio=0.5,      # 低成交量
        trend_strength=0.3
    )
    print(f"   结构: {structure.value}")
    print(f"   置信度: {conf:.2f}")
    print(f"   原因: {reasons}")
    
    # 测试 BREAKOUT
    print("\n2. 测试 BREAKOUT:")
    structure, conf, reasons = engine.detect(
        price_change=0.005,    # 价格突破
        volatility=0.002,
        volume_ratio=2.0,      # 成交量激增
        trend_strength=0.4
    )
    print(f"   结构: {structure.value}")
    print(f"   置信度: {conf:.2f}")
    print(f"   原因: {reasons}")
    
    # 测试 TREND
    print("\n3. 测试 TREND:")
    structure, conf, reasons = engine.detect(
        price_change=0.001,
        volatility=0.001,      # 稳定波动
        volume_ratio=1.2,
        trend_strength=0.7     # 强趋势
    )
    print(f"   结构: {structure.value}")
    print(f"   置信度: {conf:.2f}")
    print(f"   原因: {reasons}")
    
    # 测试 RANGE
    print("\n4. 测试 RANGE:")
    structure, conf, reasons = engine.detect(
        price_change=0.0005,
        volatility=0.0005,     # 低波动
        volume_ratio=0.9,
        trend_strength=0.2     # 无趋势
    )
    print(f"   结构: {structure.value}")
    print(f"   置信度: {conf:.2f}")
    print(f"   原因: {reasons}")
    
    # 测试决策
    print("\n5. 测试决策:")
    decision = engine.decide(structure)
    print(f"   模式: {decision.mode.value}")
    print(f"   执行: {decision.execute}")
    print(f"   评分阈值: {decision.score_threshold}")
    print(f"   成交量阈值: {decision.volume_threshold}x")