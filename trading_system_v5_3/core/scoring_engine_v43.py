#!/usr/bin/env python3
"""
V4.3 评分引擎 - 支持动态权重

核心改进：
- 根据 Regime 动态调整评分权重
- TREND模式：提高趋势权重，降低成交量权重
- 解决"错过趋势行情"问题
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Dict, Optional, Any

# 添加路径
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from regime.regime_types import MarketRegime
from regime.regime_config import get_regime_weights, REGIME_CONFIG
import logging

logger = logging.getLogger(__name__)


@dataclass
class ScoreBreakdownV43:
    """
    V4.3评分明细（支持动态权重）
    """
    total_score: int
    trend_score: float
    momentum_score: float
    volume_score: float
    spread_score: float
    volatility_score: float
    rl_score: float
    
    regime: MarketRegime
    weights: Dict[str, float]
    
    is_qualified: bool
    qualification_threshold: int
    
    def __str__(self):
        status = "✅ 达标" if self.is_qualified else "❌ 未达标"
        return f"V4.3评分: {self.total_score}/100 {status} [{self.regime.emoji()} {self.regime.value}]"


class ScoringEngineV43:
    """
    V4.3评分引擎 - 动态权重版本
    
    关键改进：
    1. 根据市场状态调整权重
    2. TREND模式：趋势权重↑ 成交量权重↓
    3. 解决"错过趋势行情"问题
    """
    
    def __init__(self, default_threshold: int = 75):
        """
        初始化评分引擎
        
        Args:
            default_threshold: 默认评分阈值
        """
        self.default_threshold = default_threshold
        self.current_regime = MarketRegime.RANGE
        self.current_weights = get_regime_weights("range")
        
        print("📊 ScoringEngine V4.3 初始化完成")
        print(f"   默认阈值: {default_threshold}")
        print(f"   支持动态权重: ✅")
    
    def set_regime(self, regime: MarketRegime):
        """
        设置当前市场状态（更新权重）
        """
        self.current_regime = regime
        self.current_weights = get_regime_weights(regime.value)
        
        print(f"🔄 权重更新: {regime.emoji()} {regime.value}")
    
    def get_threshold(self, regime: MarketRegime = None) -> int:
        """
        获取动态阈值（从 regime_config）
        
        Args:
            regime: 市场状态（如未提供则使用当前状态）
        
        Returns:
            该状态对应的评分阈值
        """
        target_regime = regime if regime else self.current_regime
        regime_key = target_regime.value if isinstance(target_regime, MarketRegime) else target_regime
        
        config = REGIME_CONFIG.get(regime_key, {})
        threshold = config.get("min_score", self.default_threshold)
        
        return threshold
    
    def calculate_score(
        self,
        ohlcv_df: pd.DataFrame,
        current_price: float,
        spread_bps: float = 2.0,
        rl_decision: str = 'ALLOW',
        regime: MarketRegime = None,
        force_threshold: int = None  # 🔥 Smoke Test 模式：强制覆盖阈值
    ) -> ScoreBreakdownV43:
        """
        计算评分（支持动态权重）
        
        Args:
            ohlcv_df: OHLCV数据
            current_price: 当前价格
            spread_bps: 点差（基点）
            rl_decision: RL决策
            regime: 市场状态（如未提供则使用当前状态）
        
        Returns:
            ScoreBreakdownV43
        """
        # 更新状态
        if regime:
            self.set_regime(regime)
        
        weights = self.current_weights
        
        # ========== 计算各维度分数 ==========
        
        # 趋势分数 (0-1)
        trend_score = self._calc_trend_score(ohlcv_df, current_price)
        
        # 动量分数 (0-1)
        momentum_score = self._calc_momentum_score(ohlcv_df)
        
        # 成交量分数 (0-1)
        volume_score = self._calc_volume_score(ohlcv_df)
        
        # 点差分数 (0-1)
        spread_score = self._calc_spread_score(spread_bps)
        
        # 波动率分数 (0-1)
        volatility_score = self._calc_volatility_score(ohlcv_df)
        
        # RL分数 (0-1)
        rl_score = 1.0 if rl_decision == 'ALLOW' else 0.0
        
        # ========== 加权总分 ==========
        
        total_score = int(
            trend_score * weights.get('trend', 0.2) * 100 +
            momentum_score * weights.get('momentum', 0.2) * 100 +
            volume_score * weights.get('volume', 0.2) * 100 +
            spread_score * weights.get('spread', 0.15) * 100 +
            volatility_score * weights.get('volatility', 0.15) * 100 +
            rl_score * weights.get('rl', 0.1) * 100
        )
        
        # 限制范围
        total_score = max(0, min(100, total_score))
        
        # 获取动态阈值（Smoke Test 模式可强制覆盖）
        if force_threshold is not None:
            threshold = force_threshold
            print(f"🔥 [SMOKE TEST] 评分引擎使用强制阈值: {threshold}")
        else:
            threshold = self.get_threshold(regime if regime else self.current_regime)
        
        # 判断是否达标
        is_qualified = total_score >= threshold
        
        # 强制日志（关键决策点）
        logger.info({
            "event": "score_decision",
            "score": total_score,
            "threshold": threshold,
            "regime": self.current_regime.value,
            "decision": "PASS" if is_qualified else "REJECT",
            "breakdown": {
                "trend": round(trend_score * 100, 1),
                "momentum": round(momentum_score * 100, 1),
                "volume": round(volume_score * 100, 1),
                "spread": round(spread_score * 100, 1),
                "volatility": round(volatility_score * 100, 1)
            }
        })
        
        return ScoreBreakdownV43(
            total_score=total_score,
            trend_score=trend_score * 100,
            momentum_score=momentum_score * 100,
            volume_score=volume_score * 100,
            spread_score=spread_score * 100,
            volatility_score=volatility_score * 100,
            rl_score=rl_score * 100,
            regime=self.current_regime,
            weights=weights,
            is_qualified=is_qualified,
            qualification_threshold=threshold
        )
    
    def _calc_trend_score(self, df: pd.DataFrame, price: float) -> float:
        """计算趋势分数"""
        try:
            ema_9 = df['close'].ewm(span=9).mean().iloc[-1]
            ema_21 = df['close'].ewm(span=21).mean().iloc[-1]
            
            # 趋势方向
            trend_alignment = 1.0 if ema_9 > ema_21 else 0.0
            
            # 趋势强度（EMA间距）
            ema_gap = abs(ema_9 - ema_21) / ema_21
            trend_strength = min(1.0, ema_gap * 50)  # 2%差距 = 满分
            
            return (trend_alignment * 0.7 + trend_strength * 0.3)
        except:
            return 0.5
    
    def _calc_momentum_score(self, df: pd.DataFrame) -> float:
        """计算动量分数"""
        try:
            # RSI
            delta = df['close'].diff()
            gain = delta.where(delta > 0, 0).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            rsi_val = rsi.iloc[-1]
            
            # RSI评分：30-70区间得分高
            if 30 <= rsi_val <= 70:
                rsi_score = 1.0 - abs(rsi_val - 50) / 50
            else:
                rsi_score = 0.3
            
            # 价格动量
            price_change = (df['close'].iloc[-1] - df['close'].iloc[-10]) / df['close'].iloc[-10]
            momentum_strength = min(1.0, abs(price_change) * 50)
            
            return (rsi_score * 0.6 + momentum_strength * 0.4)
        except:
            return 0.5
    
    def _calc_volume_score(self, df: pd.DataFrame) -> float:
        """计算成交量分数"""
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].rolling(20).mean().iloc[-1]
            
            vol_ratio = current_vol / avg_vol if avg_vol > 0 else 0
            
            # V4.3关键改进：成交量评分更宽松
            # 0.6-1.05x区间也给高分（解决TREND模式问题）
            if 0.6 <= vol_ratio <= 1.05:
                return 0.7  # 中等成交量也得分
            elif 1.05 < vol_ratio <= 1.5:
                return 0.9
            elif vol_ratio > 1.5:
                return 1.0
            else:
                return vol_ratio * 0.5  # 低成交量降分但不为零
        except:
            return 0.5
    
    def _calc_spread_score(self, spread_bps: float) -> float:
        """计算点差分数"""
        if spread_bps <= 2:
            return 1.0
        elif spread_bps <= 5:
            return 0.8
        elif spread_bps <= 10:
            return 0.6
        else:
            return 0.4
    
    def _calc_volatility_score(self, df: pd.DataFrame) -> float:
        """计算波动率分数"""
        try:
            returns = df['close'].pct_change()
            volatility = returns.rolling(20).std().iloc[-1]
            
            # 适度波动最好
            if 0.005 <= volatility <= 0.02:
                return 1.0
            elif volatility < 0.005:
                return 0.5  # 波动太小
            elif volatility <= 0.03:
                return 0.7
            else:
                return 0.3  # 波动太大
        except:
            return 0.5
    
    def get_weights_description(self) -> str:
        """获取当前权重描述"""
        lines = [f"📊 当前权重 ({self.current_regime.emoji()} {self.current_regime.value}):"]
        for key, weight in self.current_weights.items():
            bar = "█" * int(weight * 10)
            lines.append(f"   {key:12s}: {weight:.2f} {bar}")
        return "\n".join(lines)


# 创建默认实例
_default_engine = None

def get_engine() -> ScoringEngineV43:
    """获取全局引擎实例"""
    global _default_engine
    if _default_engine is None:
        _default_engine = ScoringEngineV43()
    return _default_engine