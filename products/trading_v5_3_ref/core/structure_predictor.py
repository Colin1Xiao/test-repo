#!/usr/bin/env python3
"""
Structure Predictor - 结构预测引擎

核心认知：
市场不是随机跳的，而是"结构演化"
结构演化链：RANGE → BREAKOUT → TREND → EXHAUSTION → RANGE

预测的不是价格，而是"结构转变概率"

正确问题：
现在是 RANGE → 有没有可能进入 BREAKOUT？

关键特征：
1. 波动收缩（即将爆发）
2. 成交量开始放大
3. 区间压缩
4. 假突破次数（越多越可能真突破）

策略：
- 提前模式（进攻）：预测突破 → 提前进场（小仓位）
- 确认模式（保守）：等突破发生 → 再进场
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum
import json
import math


class Structure(Enum):
    RANGE = "RANGE"
    TREND = "TREND"
    BREAKOUT = "BREAKOUT"
    CHAOTIC = "CHAOTIC"
    EXHAUSTION = "EXHAUSTION"


class PredictionMode(Enum):
    EARLY_ENTRY = "EARLY_ENTRY"       # 提前模式（进攻）
    CONFIRMATION = "CONFIRMATION"     # 确认模式（保守）


@dataclass
class StructureFeatures:
    """结构特征"""
    structure: Structure
    volatility: float
    volume_ratio: float
    price_change: float
    range_width: float          # 区间宽度
    momentum: float
    timestamp: str = ""


@dataclass
class PredictionResult:
    """预测结果"""
    current_structure: Structure
    predicted_structure: Structure
    confidence: float
    mode: PredictionMode
    signals: Dict[str, str]
    breakout_score: float
    trend_score: float
    exhaustion_score: float
    reasons: List[str] = field(default_factory=list)


class StructurePredictor:
    """
    结构预测引擎
    
    核心职责：
    1. 预测下一阶段市场结构
    2. 计算转变概率
    3. 决定交易模式（提前/确认）
    
    结构演化链：
    RANGE → BREAKOUT → TREND → EXHAUSTION → RANGE
    
    关键特征：
    - 波动收缩（即将爆发）
    - 成交量变化（资金进场）
    - 区间压缩（蓄力）
    - 假突破次数（真突破前兆）
    """
    
    # 预测阈值
    HIGH_CONFIDENCE = 0.7           # 高置信度阈值
    EARLY_ENTRY_SIZE_MULTIPLIER = 0.3  # 提前模式仓位乘数
    
    # 结构演化链
    EVOLUTION_CHAIN = {
        Structure.RANGE: [Structure.BREAKOUT, Structure.TREND],
        Structure.BREAKOUT: [Structure.TREND, Structure.EXHAUSTION],
        Structure.TREND: [Structure.EXHAUSTION, Structure.RANGE],
        Structure.EXHAUSTION: [Structure.RANGE, Structure.CHAOTIC],
        Structure.CHAOTIC: [Structure.RANGE]  # 混乱后回到震荡
    }
    
    def __init__(self, history_size: int = 20):
        """
        Args:
            history_size: 历史窗口大小
        """
        self.history_size = history_size
        self.history: List[StructureFeatures] = []
        
        # 预测统计
        self.predictions_made = 0
        self.predictions_correct = 0
        self.predictions_wrong = 0
        
        # 错误保护
        self.consecutive_wrong = 0
        self.prediction_enabled = True
        
        print("🔮 Structure Predictor 初始化完成")
        print(f"   历史窗口: {history_size} 周期")
        print(f"   高置信度阈值: {self.HIGH_CONFIDENCE}")
    
    def add_observation(self, features: StructureFeatures):
        """添加观察数据"""
        if not features.timestamp:
            features.timestamp = datetime.now().isoformat()
        
        self.history.append(features)
        
        # 保持历史长度
        if len(self.history) > self.history_size * 2:
            self.history = self.history[-self.history_size * 2:]
    
    def predict(self) -> PredictionResult:
        """
        预测下一阶段结构
        
        Returns:
            PredictionResult
        """
        if not self.prediction_enabled:
            return self._disabled_prediction()
        
        if len(self.history) < 5:
            return self._insufficient_data_prediction()
        
        self.predictions_made += 1
        
        # 获取最近数据
        recent = self.history[-self.history_size:]
        current = recent[-1].structure
        
        # ============================================================
        # 计算趋势特征
        # ============================================================
        volatility_trend = self._calc_volatility_trend(recent)
        volume_trend = self._calc_volume_trend(recent)
        range_compression = self._calc_range_compression(recent)
        fake_breakouts = self._calc_fake_breakouts(recent)
        momentum_trend = self._calc_momentum_trend(recent)
        
        # ============================================================
        # 计算各结构分数
        # ============================================================
        breakout_score = self._calc_breakout_score(
            volatility_trend, volume_trend, range_compression, fake_breakouts
        )
        
        trend_score = self._calc_trend_score(
            momentum_trend, volume_trend, recent
        )
        
        exhaustion_score = self._calc_exhaustion_score(
            momentum_trend, volume_trend, recent
        )
        
        # ============================================================
        # 确定预测结构
        # ============================================================
        predicted, confidence, reasons = self._determine_prediction(
            current, breakout_score, trend_score, exhaustion_score
        )
        
        # ============================================================
        # 确定交易模式
        # ============================================================
        mode = PredictionMode.EARLY_ENTRY if confidence > self.HIGH_CONFIDENCE else PredictionMode.CONFIRMATION
        
        # ============================================================
        # 构建信号字典
        # ============================================================
        signals = {
            "volatility": volatility_trend,
            "volume": volume_trend,
            "range": "compressing" if range_compression > 0.7 else "normal",
            "fake_breakouts": str(fake_breakouts)
        }
        
        return PredictionResult(
            current_structure=current,
            predicted_structure=predicted,
            confidence=confidence,
            mode=mode,
            signals=signals,
            breakout_score=breakout_score,
            trend_score=trend_score,
            exhaustion_score=exhaustion_score,
            reasons=reasons
        )
    
    def _calc_volatility_trend(self, recent: List[StructureFeatures]) -> str:
        """计算波动趋势"""
        if len(recent) < 5:
            return "stable"
        
        volatilities = [f.volatility for f in recent[-10:]]
        
        if len(volatilities) < 3:
            return "stable"
        
        # 比较前后两段
        early = sum(volatilities[:len(volatilities)//2])
        late = sum(volatilities[len(volatilities)//2:])
        
        if late < early * 0.7:
            return "compressing"    # 波动收缩
        elif late > early * 1.3:
            return "expanding"      # 波动扩张
        else:
            return "stable"
    
    def _calc_volume_trend(self, recent: List[StructureFeatures]) -> str:
        """计算成交量趋势"""
        if len(recent) < 5:
            return "stable"
        
        volumes = [f.volume_ratio for f in recent[-10:]]
        
        if len(volumes) < 3:
            return "stable"
        
        early = sum(volumes[:len(volumes)//2])
        late = sum(volumes[len(volumes)//2:])
        
        if late > early * 1.2:
            return "increasing"
        elif late < early * 0.8:
            return "decreasing"
        else:
            return "stable"
    
    def _calc_range_compression(self, recent: List[StructureFeatures]) -> float:
        """
        计算区间压缩度
        
        Returns:
            0-1，越高越压缩
        """
        if len(recent) < 10:
            return 0.5
        
        # 使用区间宽度变化
        widths = [f.range_width for f in recent[-10:] if f.range_width > 0]
        
        if len(widths) < 3:
            return 0.5
        
        early_width = sum(widths[:len(widths)//2]) / (len(widths)//2)
        late_width = sum(widths[len(widths)//2:]) / (len(widths) - len(widths)//2)
        
        if early_width > 0:
            compression = 1 - (late_width / early_width)
            return max(0, min(1, compression))
        
        return 0.5
    
    def _calc_fake_breakouts(self, recent: List[StructureFeatures]) -> int:
        """
        计算假突破次数
        
        假突破定义：结构短暂变为 BREAKOUT 后又回到 RANGE
        """
        fake_count = 0
        
        for i in range(1, len(recent) - 1):
            if (recent[i-1].structure == Structure.RANGE and
                recent[i].structure == Structure.BREAKOUT and
                recent[i+1].structure == Structure.RANGE):
                fake_count += 1
        
        return fake_count
    
    def _calc_momentum_trend(self, recent: List[StructureFeatures]) -> str:
        """计算动量趋势"""
        if len(recent) < 5:
            return "neutral"
        
        momentums = [f.momentum for f in recent[-10:]]
        
        if len(momentums) < 3:
            return "neutral"
        
        early = sum(momentums[:len(momentums)//2])
        late = sum(momentums[len(momentums)//2:])
        
        if late > early * 1.2:
            return "strengthening"
        elif late < early * 0.8:
            return "weakening"
        else:
            return "neutral"
    
    def _calc_breakout_score(
        self,
        volatility_trend: str,
        volume_trend: str,
        range_compression: float,
        fake_breakouts: int
    ) -> float:
        """
        计算突破概率分数
        
        返回 0-1
        """
        score = 0.0
        
        # 波动收缩（即将爆发）
        if volatility_trend == "compressing":
            score += 0.3
        
        # 成交量放大（资金进场）
        if volume_trend == "increasing":
            score += 0.3
        
        # 区间压缩（蓄力）
        if range_compression > 0.7:
            score += 0.2
        elif range_compression > 0.5:
            score += 0.1
        
        # 假突破（越多越可能真突破）
        if fake_breakouts >= 2:
            score += 0.2
        elif fake_breakouts >= 1:
            score += 0.1
        
        return min(1.0, score)
    
    def _calc_trend_score(
        self,
        momentum_trend: str,
        volume_trend: str,
        recent: List[StructureFeatures]
    ) -> float:
        """计算趋势延续分数"""
        score = 0.0
        
        # 动量增强
        if momentum_trend == "strengthening":
            score += 0.3
        elif momentum_trend == "stable":
            score += 0.1
        
        # 成交量支持
        if volume_trend == "increasing":
            score += 0.2
        elif volume_trend == "stable":
            score += 0.1
        
        # 当前已经在趋势中
        if recent[-1].structure == Structure.TREND:
            score += 0.3
        elif recent[-1].structure == Structure.BREAKOUT:
            score += 0.2
        
        return min(1.0, score)
    
    def _calc_exhaustion_score(
        self,
        momentum_trend: str,
        volume_trend: str,
        recent: List[StructureFeatures]
    ) -> float:
        """计算趋势耗竭分数"""
        score = 0.0
        
        # 动量减弱
        if momentum_trend == "weakening":
            score += 0.4
        
        # 成交量下降
        if volume_trend == "decreasing":
            score += 0.3
        
        # 已经在趋势中较长时间
        trend_count = sum(1 for f in recent[-10:] if f.structure == Structure.TREND)
        if trend_count >= 5:
            score += 0.3
        elif trend_count >= 3:
            score += 0.1
        
        return min(1.0, score)
    
    def _determine_prediction(
        self,
        current: Structure,
        breakout_score: float,
        trend_score: float,
        exhaustion_score: float
    ) -> Tuple[Structure, float, List[str]]:
        """
        确定预测结构
        
        Returns:
            (predicted_structure, confidence, reasons)
        """
        reasons = []
        
        # ============================================================
        # 基于当前结构的演化链
        # ============================================================
        if current == Structure.CHAOTIC:
            # 混乱后回到震荡
            reasons.append("混乱后回归震荡")
            return Structure.RANGE, 0.6, reasons
        
        if current == Structure.RANGE:
            # 震荡 → 可能突破
            if breakout_score > 0.5:
                reasons.append(f"突破概率高 ({breakout_score:.0%})")
                if breakout_score > 0.7:
                    reasons.append("波动收缩 + 成交量放大")
                return Structure.BREAKOUT, breakout_score, reasons
            else:
                reasons.append("维持震荡")
                return Structure.RANGE, 1 - breakout_score, reasons
        
        if current == Structure.BREAKOUT:
            # 突破 → 可能形成趋势
            if trend_score > 0.5:
                reasons.append(f"趋势形成概率高 ({trend_score:.0%})")
                return Structure.TREND, trend_score, reasons
            else:
                reasons.append("假突破，回到震荡")
                return Structure.RANGE, 0.5, reasons
        
        if current == Structure.TREND:
            # 趋势 → 可能耗竭
            if exhaustion_score > 0.6:
                reasons.append(f"趋势耗竭 ({exhaustion_score:.0%})")
                return Structure.EXHAUSTION, exhaustion_score, reasons
            elif trend_score > 0.5:
                reasons.append(f"趋势延续 ({trend_score:.0%})")
                return Structure.TREND, trend_score, reasons
            else:
                reasons.append("趋势不确定")
                return Structure.RANGE, 0.4, reasons
        
        if current == Structure.EXHAUSTION:
            # 耗竭 → 回到震荡
            reasons.append("趋势结束，回归震荡")
            return Structure.RANGE, 0.7, reasons
        
        # 默认
        return current, 0.5, ["维持当前结构"]
    
    def record_outcome(self, actual_structure: Structure):
        """
        记录实际结果（用于统计准确率）
        
        Args:
            actual_structure: 实际发生的结构
        """
        if not self.history:
            return
        
        predicted = self.history[-1].structure if self.history else None
        
        if predicted == actual_structure:
            self.predictions_correct += 1
            self.consecutive_wrong = 0
        else:
            self.predictions_wrong += 1
            self.consecutive_wrong += 1
            
            # 连续错误保护
            if self.consecutive_wrong >= 3:
                self.prediction_enabled = False
                print(f"⚠️ 预测连续错误 {self.consecutive_wrong} 次，已禁用预测模块")
    
    def _disabled_prediction(self) -> PredictionResult:
        """禁用状态的预测"""
        return PredictionResult(
            current_structure=Structure.RANGE,
            predicted_structure=Structure.RANGE,
            confidence=0.0,
            mode=PredictionMode.CONFIRMATION,
            signals={"status": "disabled"},
            breakout_score=0.0,
            trend_score=0.0,
            exhaustion_score=0.0,
            reasons=["预测模块已禁用（连续错误过多）"]
        )
    
    def _insufficient_data_prediction(self) -> PredictionResult:
        """数据不足的预测"""
        current = self.history[-1].structure if self.history else Structure.RANGE
        return PredictionResult(
            current_structure=current,
            predicted_structure=current,
            confidence=0.3,
            mode=PredictionMode.CONFIRMATION,
            signals={"status": "insufficient_data"},
            breakout_score=0.0,
            trend_score=0.0,
            exhaustion_score=0.0,
            reasons=["历史数据不足，无法预测"]
        )
    
    def get_accuracy(self) -> float:
        """获取预测准确率"""
        total = self.predictions_correct + self.predictions_wrong
        return self.predictions_correct / max(1, total)
    
    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "enabled": self.prediction_enabled,
            "predictions_made": self.predictions_made,
            "predictions_correct": self.predictions_correct,
            "predictions_wrong": self.predictions_wrong,
            "accuracy": self.get_accuracy(),
            "consecutive_wrong": self.consecutive_wrong,
            "history_size": len(self.history)
        }
    
    def enable(self):
        """重新启用预测"""
        self.prediction_enabled = True
        self.consecutive_wrong = 0
        print("✅ 预测模块已重新启用")


# ============================================================
# 便捷函数
# ============================================================
def create_predictor() -> StructurePredictor:
    """创建预测器"""
    return StructurePredictor()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Structure Predictor 测试 ===\n")
    
    predictor = StructurePredictor()
    
    # 模拟历史数据（震荡 → 突破）
    from core.market_structure import MarketStructure
    
    # 添加震荡期数据
    for i in range(10):
        predictor.add_observation(StructureFeatures(
            structure=Structure.RANGE,
            volatility=0.0005 - i * 0.00003,  # 波动收缩
            volume_ratio=0.8 + i * 0.05,     # 成交量增加
            price_change=0.0002,
            range_width=0.01 - i * 0.0005,   # 区间压缩
            momentum=0.3
        ))
    
    # 预测
    result = predictor.predict()
    
    print(f"当前结构: {result.current_structure.value}")
    print(f"预测结构: {result.predicted_structure.value}")
    print(f"置信度: {result.confidence:.0%}")
    print(f"模式: {result.mode.value}")
    print(f"突破分数: {result.breakout_score:.0%}")
    print(f"信号: {result.signals}")
    print(f"原因: {result.reasons}")