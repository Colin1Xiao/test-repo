#!/usr/bin/env python3
"""
Scoring Engine V4.2.2 - 第二轮调参
核心修正：
1. 阈值 80 → 85
2. 趋势一致性：分段打分 (5/10/15/20)
3. 回撤后突破：分段打分 (5/10/15)
4. 成交量：中间最优 (1.05-1.2x 得最高分)
"""

import pandas as pd
import numpy as np
from typing import Dict
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ScoreBreakdown:
    """评分明细 V4.2.2"""
    trend_consistency: int = 0   # 趋势一致性 (0-20) 分段
    pullback_breakout: int = 0   # 回撤后突破 (0-15) 分段
    volume_confirm: int = 0      # 成交量确认 (0-20) 中间最优
    spread_quality: int = 0      # 点差质量 (0-15)
    volatility_range: int = 0    # 波动率适中 (0-15)
    rl_filter: int = 0           # RL过滤意见 (0-15)
    total_score: int = 0         # 总分 (0-100)
    is_qualified: bool = False   # 是否达标 (>=85)


class ScoringEngineV422:
    """入场评分引擎 V4.2.2"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        
        # V4.2.2 权重
        self.weights = {
            'trend_consistency': 20,
            'pullback_breakout': 15,
            'volume_confirm': 20,
            'spread_quality': 15,
            'volatility_range': 15,
            'rl_filter': 15
        }
        
        # V4.2.2: 阈值 85
        self.entry_threshold = 85
        
        self.ema_fast_period = 9
        self.ema_slow_period = 21
        
        logger.info(f"✅ 评分引擎 V4.2.2 初始化完成，入场阈值: {self.entry_threshold}")
    
    def calculate_score(self, ohlcv_df, current_price=None, spread_bps=None, rl_decision=None):
        """计算入场评分"""
        if ohlcv_df is None or len(ohlcv_df) < self.ema_slow_period:
            return ScoreBreakdown()
        
        if 'close' not in ohlcv_df.columns:
            return ScoreBreakdown()
        
        if current_price is None:
            current_price = ohlcv_df['close'].iloc[-1]
        
        breakdown = ScoreBreakdown()
        
        # V4.2.2: 分段打分
        breakdown.trend_consistency = self._calc_trend_consistency_v422(ohlcv_df)
        breakdown.pullback_breakout = self._calc_pullback_breakout_v422(ohlcv_df, current_price)
        breakdown.volume_confirm = self._calc_volume_confirm_v422(ohlcv_df)
        breakdown.spread_quality = self._calc_spread_quality(spread_bps)
        breakdown.volatility_range = self._calc_volatility_range(ohlcv_df)
        breakdown.rl_filter = self._calc_rl_filter(rl_decision)
        
        breakdown.total_score = (
            breakdown.trend_consistency +
            breakdown.pullback_breakout +
            breakdown.volume_confirm +
            breakdown.spread_quality +
            breakdown.volatility_range +
            breakdown.rl_filter
        )
        
        breakdown.is_qualified = breakdown.total_score >= self.entry_threshold
        
        logger.info(
            f"📊 V4.2.2 评分: {breakdown.total_score}/100 "
            f"{'✅ 达标' if breakdown.is_qualified else '❌ 未达标'}"
        )
        
        return breakdown
    
    def _calc_trend_consistency_v422(self, df: pd.DataFrame) -> int:
        """
        V4.2.2: 趋势一致性分段打分 (5/10/15/20)
        
        按 EMA 距离和趋势强度分段：
        - 弱趋势: 5
        - 中等趋势: 10  
        - 较强趋势: 15
        - 极强趋势: 20
        """
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            ema_slow = df['close'].ewm(span=self.ema_slow_period, adjust=False).mean()
            
            current_fast = ema_fast.iloc[-1]
            current_slow = ema_slow.iloc[-1]
            
            # 计算 EMA 距离百分比
            distance_pct = abs(current_fast - current_slow) / current_slow
            
            # V4.2.2 分段打分
            if distance_pct < 0.0001:  # < 0.01%
                return 0  # 粘合，无趋势
            elif distance_pct < 0.0003:  # 0.01% - 0.03%
                return 5   # 弱趋势
            elif distance_pct < 0.0008:  # 0.03% - 0.08%
                return 10  # 中等趋势
            elif distance_pct < 0.0015:  # 0.08% - 0.15%
                return 15  # 较强趋势
            else:  # > 0.15%
                return 20  # 极强趋势
                
        except Exception as e:
            logger.error(f"趋势一致性计算失败: {e}")
            return 0
    
    def _calc_pullback_breakout_v422(self, df: pd.DataFrame, current_price: float) -> int:
        """
        V4.2.2: 回撤后突破分段打分 (5/10/15)
        
        按突破质量分层：
        - 只是触线回收：5
        - 明确站回但力度一般：10
        - 站回且伴随价格确认：15
        """
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            
            recent_prices = df['close'].tail(10).values
            recent_ema = ema_fast.tail(10).values
            
            # 检查回踩
            pullback_occurred = False
            pullback_idx = -1
            
            for i in range(-5, 0):
                price = recent_prices[i]
                ema = recent_ema[i]
                if abs(price - ema) / ema < 0.002:
                    pullback_occurred = True
                    pullback_idx = i
                    break
            
            if not pullback_occurred:
                return 0
            
            current_ema = ema_fast.iloc[-1]
            
            # 判断是否突破
            is_breakout = False
            breakout_strength = 0
            
            if current_price > current_ema:  # 做多突破
                is_breakout = True
                breakout_strength = (current_price - current_ema) / current_ema
            elif current_price < current_ema:  # 做空突破
                is_breakout = True
                breakout_strength = (current_ema - current_price) / current_ema
            
            if not is_breakout:
                return 0
            
            # V4.2.2 分段打分
            if breakout_strength < 0.0005:  # < 0.05%
                return 5   # 只是触线回收
            elif breakout_strength < 0.0015:  # 0.05% - 0.15%
                return 10  # 明确站回但力度一般
            else:  # > 0.15%
                return 15  # 站回且伴随价格确认
                
        except Exception as e:
            logger.error(f"回撤后突破计算失败: {e}")
            return 0
    
    def _calc_volume_confirm_v422(self, df: pd.DataFrame) -> int:
        """
        V4.2.2: 成交量中间最优分段打分
        
        发现 1.05-1.2x 表现最好，过度放量反而差：
        - < 0.9x: 0 分
        - 0.9-1.05x: 5 分
        - 1.05-1.2x: 15 分 (最优)
        - 1.2-1.5x: 8 分
        - > 1.5x: 3 分
        """
        try:
            volume = df['volume']
            volume_ma = volume.rolling(window=20).mean()
            
            current_volume = volume.iloc[-1]
            current_ma = volume_ma.iloc[-1]
            
            volume_ratio = current_volume / current_ma if current_ma > 0 else 0
            
            # V4.2.2 中间最优分段
            if volume_ratio < 0.9:
                return 0
            elif volume_ratio < 1.05:
                return 5
            elif volume_ratio < 1.2:
                return 15  # 最优区间
            elif volume_ratio < 1.5:
                return 8
            else:
                return 3  # 过度放量降分
                
        except Exception as e:
            logger.error(f"成交量确认计算失败: {e}")
            return 0
    
    def _calc_spread_quality(self, spread_bps: float) -> int:
        """点差质量 (15分) - 保持不变"""
        if spread_bps is None:
            return 0
        
        try:
            if spread_bps <= 2.5:
                return 15
            elif spread_bps <= 5:
                return 10
            elif spread_bps <= 7.5:
                return 5
            else:
                return 0
        except:
            return 0
    
    def _calc_volatility_range(self, df: pd.DataFrame) -> int:
        """波动率适中 (15分) - 保持不变"""
        try:
            high = df['high']
            low = df['low']
            close = df['close']
            
            tr1 = high - low
            tr2 = abs(high - close.shift(1))
            tr3 = abs(low - close.shift(1))
            
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            avg_tr_pct = (true_range.tail(20).mean() / close.iloc[-1])
            
            if 0.0005 <= avg_tr_pct <= 0.02:
                return 15
            elif avg_tr_pct < 0.0005:
                return 5
            else:
                return 0
        except:
            return 0
    
    def _calc_rl_filter(self, rl_decision: str) -> int:
        """RL 过滤意见 (15分) - 保持不变"""
        if rl_decision is None:
            return 15
        
        rl_decision = rl_decision.upper()
        
        if rl_decision == 'ALLOW':
            return 15
        elif rl_decision == 'REDUCE':
            return 8
        else:
            return 0


if __name__ == "__main__":
    engine = ScoringEngineV422()
    print("✅ ScoringEngineV422 加载成功")
    print(f"达标阈值: {engine.entry_threshold}")
