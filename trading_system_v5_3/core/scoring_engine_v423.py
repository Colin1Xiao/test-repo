#!/usr/bin/env python3
"""
Scoring Engine V4.2.3 - 第三轮定向微调
基于118样本统计验证后的调整：
1. 成交量因子重映射 (0.9-1.05x最优，1.2-1.5x降为0)
2. 88-92分层附加过滤 (88-92分+1.2-1.5x成交量→不达标)
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
    """评分明细 V4.2.3"""
    trend_consistency: int = 0   # 趋势一致性 (0-20) 分段
    pullback_breakout: int = 0   # 回撤后突破 (0-15) 分段
    volume_confirm: int = 0      # 成交量确认 (0-20) 重映射
    spread_quality: int = 0      # 点差质量 (0-15)
    volatility_range: int = 0    # 波动率适中 (0-15)
    rl_filter: int = 0           # RL过滤意见 (0-15)
    total_score: int = 0         # 总分 (0-100)
    is_qualified: bool = False   # 是否达标 (>=85，且满足附加过滤)
    filter_reason: str = ""      # 过滤原因 (如果有)


class ScoringEngineV423:
    """
    入场评分引擎 V4.2.3
    
    重要：此版本仅在V4.2影子实验线使用，不接入V4.1执行层
    """
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        
        # V4.2.3 权重
        self.weights = {
            'trend_consistency': 20,
            'pullback_breakout': 15,
            'volume_confirm': 20,
            'spread_quality': 15,
            'volatility_range': 15,
            'rl_filter': 15
        }
        
        # V4.2.3: 阈值保持85
        self.entry_threshold = 85
        
        self.ema_fast_period = 9
        self.ema_slow_period = 21
        
        logger.info(f"✅ 评分引擎 V4.2.3 初始化完成")
        logger.info(f"⚠️  重要：此版本仅在V4.2影子实验线使用，不接入V4.1执行层")
        logger.info(f"📊 达标阈值: {self.entry_threshold}")
        logger.info(f"🔄 成交量重映射: 0.9-1.05x=15分, 1.2-1.5x=0分")
        logger.info(f"🚫 88-92分层附加过滤: 88-92分+1.2-1.5x成交量→不达标")
    
    def calculate_score(self, ohlcv_df, current_price=None, spread_bps=None, rl_decision=None):
        """计算入场评分"""
        if ohlcv_df is None or len(ohlcv_df) < self.ema_slow_period:
            return ScoreBreakdown()
        
        if 'close' not in ohlcv_df.columns:
            return ScoreBreakdown()
        
        if current_price is None:
            current_price = ohlcv_df['close'].iloc[-1]
        
        breakdown = ScoreBreakdown()
        
        # 1. 趋势一致性 (20分) - 保持V4.2.2
        breakdown.trend_consistency = self._calc_trend_consistency(ohlcv_df)
        
        # 2. 回撤后突破 (15分) - 保持V4.2.2
        breakdown.pullback_breakout = self._calc_pullback_breakout(ohlcv_df, current_price)
        
        # 3. 成交量确认 (20分) - V4.2.3 重映射
        breakdown.volume_confirm = self._calc_volume_confirm_v423(ohlcv_df)
        
        # 4. 点差质量 (15分)
        breakdown.spread_quality = self._calc_spread_quality(spread_bps)
        
        # 5. 波动率适中 (15分)
        breakdown.volatility_range = self._calc_volatility_range(ohlcv_df)
        
        # 6. RL 过滤意见 (15分)
        breakdown.rl_filter = self._calc_rl_filter(rl_decision)
        
        # 计算总分
        breakdown.total_score = (
            breakdown.trend_consistency +
            breakdown.pullback_breakout +
            breakdown.volume_confirm +
            breakdown.spread_quality +
            breakdown.volatility_range +
            breakdown.rl_filter
        )
        
        # V4.2.3: 基础达标判断
        base_qualified = breakdown.total_score >= self.entry_threshold
        
        # V4.2.3: 附加过滤条件
        volume_ratio = self._get_volume_ratio(ohlcv_df)
        
        if base_qualified and 88 <= breakdown.total_score <= 92 and 1.2 <= volume_ratio < 1.5:
            # 88-92分层 + 1.2-1.5x成交量 → 不达标
            breakdown.is_qualified = False
            breakdown.filter_reason = f"88-92分层附加过滤: 分数{breakdown.total_score}, 成交量{volume_ratio:.2f}x"
            logger.info(f"🚫 V4.2.3 附加过滤触发: {breakdown.filter_reason}")
        else:
            breakdown.is_qualified = base_qualified
        
        status = '✅ 达标' if breakdown.is_qualified else '❌ 未达标'
        if breakdown.filter_reason:
            status += f" ({breakdown.filter_reason})"
        
        logger.info(f"📊 V4.2.3 评分: {breakdown.total_score}/100 {status}")
        
        return breakdown
    
    def _get_volume_ratio(self, df: pd.DataFrame) -> float:
        """获取成交量比率"""
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return current_vol / avg_vol if avg_vol > 0 else 0
        except:
            return 0
    
    def _calc_trend_consistency(self, df: pd.DataFrame) -> int:
        """趋势一致性 (20分) - 保持V4.2.2"""
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            ema_slow = df['close'].ewm(span=self.ema_slow_period, adjust=False).mean()
            
            current_fast = ema_fast.iloc[-1]
            current_slow = ema_slow.iloc[-1]
            
            distance_pct = abs(current_fast - current_slow) / current_slow
            
            if distance_pct < 0.0001:
                return 0
            elif distance_pct < 0.0003:
                return 5
            elif distance_pct < 0.0008:
                return 10
            elif distance_pct < 0.0015:
                return 15
            else:
                return 20
        except:
            return 0
    
    def _calc_pullback_breakout(self, df: pd.DataFrame, current_price: float) -> int:
        """回撤后突破 (15分) - 保持V4.2.2"""
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            
            recent_prices = df['close'].tail(10).values
            recent_ema = ema_fast.tail(10).values
            
            pullback_occurred = False
            
            for i in range(-5, 0):
                price = recent_prices[i]
                ema = recent_ema[i]
                if abs(price - ema) / ema < 0.002:
                    pullback_occurred = True
                    break
            
            if not pullback_occurred:
                return 0
            
            current_ema = ema_fast.iloc[-1]
            
            is_breakout = False
            breakout_strength = 0
            
            if current_price > current_ema:
                is_breakout = True
                breakout_strength = (current_price - current_ema) / current_ema
            elif current_price < current_ema:
                is_breakout = True
                breakout_strength = (current_ema - current_price) / current_ema
            
            if not is_breakout:
                return 0
            
            if breakout_strength < 0.0005:
                return 5
            elif breakout_strength < 0.0015:
                return 10
            else:
                return 15
        except:
            return 0
    
    def _calc_volume_confirm_v423(self, df: pd.DataFrame) -> int:
        """
        V4.2.3: 成交量重映射
        
        基于118样本统计验证：
        - 0.9-1.05x 表现最好 → 15分
        - 1.05-1.2x 表现一般 → 8分
        - 1.2-1.5x 表现最差 → 0分 (原为8分)
        - >1.5x 过度放量 → 0分
        """
        try:
            volume_ratio = self._get_volume_ratio(df)
            
            if volume_ratio < 0.9:
                return 0
            elif volume_ratio < 1.05:
                return 15  # 最优区间
            elif volume_ratio < 1.2:
                return 8
            elif volume_ratio < 1.5:
                return 0   # 负面区间，降分
            else:
                return 0   # 过度放量
                
        except Exception as e:
            logger.error(f"成交量确认计算失败: {e}")
            return 0
    
    def _calc_spread_quality(self, spread_bps: float) -> int:
        """点差质量 (15分)"""
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
        """波动率适中 (15分)"""
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
        """RL 过滤意见 (15分)"""
        if rl_decision is None:
            return 15
        
        rl_decision = rl_decision.upper()
        
        if rl_decision == 'ALLOW':
            return 15
        elif rl_decision == 'REDUCE':
            return 8
        else:
            return 0
    
    def get_score_report(self, breakdown: ScoreBreakdown) -> str:
        """生成评分报告"""
        report = []
        report.append("=" * 50)
        report.append("📊 入场评分报告 V4.2.3")
        report.append("⚠️  影子实验线专用，不接入V4.1执行层")
        report.append("=" * 50)
        report.append(f"趋势一致性: {breakdown.trend_consistency:>3}/20")
        report.append(f"回撤后突破: {breakdown.pullback_breakout:>3}/15")
        report.append(f"成交量确认: {breakdown.volume_confirm:>3}/20 (V4.2.3重映射)")
        report.append(f"点差质量:   {breakdown.spread_quality:>3}/15")
        report.append(f"波动率适中: {breakdown.volatility_range:>3}/15")
        report.append(f"RL过滤:    {breakdown.rl_filter:>3}/15")
        report.append("-" * 50)
        report.append(f"总分:      {breakdown.total_score:>3}/100")
        
        if breakdown.filter_reason:
            report.append(f"⚠️  附加过滤: {breakdown.filter_reason}")
        
        report.append(f"达标状态:  {'✅ 达标 (>=85)' if breakdown.is_qualified else '❌ 未达标'}")
        report.append("=" * 50)
        
        return "\n".join(report)


if __name__ == "__main__":
    engine = ScoringEngineV423()
    print("✅ ScoringEngineV423 加载成功")
    print(f"⚠️  重要提示: 此版本仅在V4.2影子实验线使用")
    print(f"🚫 不要接入V4.1执行层")

