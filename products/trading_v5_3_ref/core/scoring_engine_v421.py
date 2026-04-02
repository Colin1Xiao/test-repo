#!/usr/bin/env python3
"""
Scoring Engine V4.2.1 - 入场评分引擎 (第一轮调参后)
基于 Colin 建议调整：
1. 权重重构: trend 20 / pullback 15 / volume 20 / spread 15 / volatility 15 / RL 15
2. 成交量因子改为分段打分
3. 达标阈值从 75 提高到 80
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, List
from dataclasses import dataclass
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ScoreBreakdown:
    """评分明细 V4.2.1"""
    trend_consistency: int = 0   # 趋势一致性 (0-20)
    pullback_breakout: int = 0   # 回撤后突破 (0-15)
    volume_confirm: int = 0      # 成交量确认 (0-20) - 分段打分
    spread_quality: int = 0      # 点差质量 (0-15)
    volatility_range: int = 0    # 波动率适中 (0-15)
    rl_filter: int = 0           # RL过滤意见 (0-15)
    total_score: int = 0         # 总分 (0-100)
    is_qualified: bool = False   # 是否达标 (>=80)


class ScoringEngineV421:
    """入场评分引擎 V4.2.1"""
    
    def __init__(self, config: Dict = None):
        """初始化评分引擎"""
        self.config = config or {}
        
        # V4.2.1 新权重结构
        self.weights = {
            'trend_consistency': 20,   # 从 30 降到 20
            'pullback_breakout': 15,   # 从 20 降到 15
            'volume_confirm': 20,      # 从 15 升到 20 (分段打分)
            'spread_quality': 15,      # 保持 15
            'volatility_range': 15,    # 从 10 升到 15
            'rl_filter': 15            # 从 10 升到 15
        }
        
        # 阈值参数
        self.thresholds = self.config.get('scoring', {}).get('thresholds', {
            'spread_max_bps': 5,
            'volume_lookback': 20,
            'volatility_min': 0.0005,
            'volatility_max': 0.02,
            'ema_fast_period': 9,
            'ema_slow_period': 21
        })
        
        # V4.2.1: 入场阈值从 75 提高到 80
        self.entry_threshold = 80
        
        # EMA 参数
        self.ema_fast_period = self.thresholds.get('ema_fast_period', 9)
        self.ema_slow_period = self.thresholds.get('ema_slow_period', 21)
        
        logger.info(f"✅ 评分引擎 V4.2.1 初始化完成，入场阈值: {self.entry_threshold}")
        logger.info(f"📊 权重配置: {self.weights}")
    
    def calculate_score(self, 
                       ohlcv_df: pd.DataFrame,
                       current_price: float = None,
                       spread_bps: float = None,
                       rl_decision: str = None) -> ScoreBreakdown:
        """计算入场评分"""
        if ohlcv_df is None or len(ohlcv_df) < self.ema_slow_period:
            logger.warning("数据不足，无法计算评分")
            return ScoreBreakdown()
        
        if 'close' not in ohlcv_df.columns:
            logger.error("数据格式错误，缺少 'close' 列")
            return ScoreBreakdown()
        
        if current_price is None:
            current_price = ohlcv_df['close'].iloc[-1]
        
        breakdown = ScoreBreakdown()
        
        # 1. 趋势一致性 (20分)
        breakdown.trend_consistency = self._calc_trend_consistency(ohlcv_df)
        
        # 2. 回撤后突破 (15分)
        breakdown.pullback_breakout = self._calc_pullback_breakout(ohlcv_df, current_price)
        
        # 3. 成交量确认 (20分) - V4.2.1 分段打分
        breakdown.volume_confirm = self._calc_volume_confirm_v421(ohlcv_df)
        
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
        
        # V4.2.1: 判断是否达标 (>=80)
        breakdown.is_qualified = breakdown.total_score >= self.entry_threshold
        
        logger.info(
            f"📊 评分结果: {breakdown.total_score}/100 "
            f"{'✅ 达标' if breakdown.is_qualified else '❌ 未达标'}"
        )
        
        return breakdown
    
    def _calc_trend_consistency(self, df: pd.DataFrame) -> int:
        """趋势一致性 (20分) - V4.2.1 降低权重"""
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            ema_slow = df['close'].ewm(span=self.ema_slow_period, adjust=False).mean()
            
            current_fast = ema_fast.iloc[-1]
            current_slow = ema_slow.iloc[-1]
            
            distance_pct = abs(current_fast - current_slow) / current_slow
            min_distance = 0.0001
            
            if distance_pct < min_distance:
                logger.debug(f"EMA快慢线粘合，距离: {distance_pct:.4f}")
                return 0
            
            # V4.2.1: 满分从 30 降到 20
            if current_fast > current_slow:
                logger.debug(f"做多趋势确认")
                return self.weights['trend_consistency']
            else:
                logger.debug(f"做空趋势确认")
                return self.weights['trend_consistency']
                
        except Exception as e:
            logger.error(f"趋势一致性计算失败: {e}")
            return 0
    
    def _calc_pullback_breakout(self, df: pd.DataFrame, current_price: float) -> int:
        """回撤后突破 (15分) - V4.2.1 降低权重"""
        try:
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            
            recent_prices = df['close'].tail(10).values
            recent_ema = ema_fast.tail(10).values
            
            pullback_occurred = False
            
            # 检查最近5根K线是否有回踩
            for i in range(-5, 0):
                price = recent_prices[i]
                ema = recent_ema[i]
                
                if abs(price - ema) / ema < 0.002:
                    pullback_occurred = True
                    break
            
            if not pullback_occurred:
                logger.debug("未检测到回踩快线")
                return 0
            
            current_ema = ema_fast.iloc[-1]
            
            # 做多突破
            if current_price > current_ema and pullback_occurred:
                logger.debug(f"检测到回踩后突破做多")
                return self.weights['pullback_breakout']
            # 做空突破
            elif current_price < current_ema and pullback_occurred:
                logger.debug(f"检测到回踩后突破做空")
                return self.weights['pullback_breakout']
            else:
                return 0
                
        except Exception as e:
            logger.error(f"回撤后突破计算失败: {e}")
            return 0
    
    def _calc_volume_confirm_v421(self, df: pd.DataFrame) -> int:
        """
        成交量确认 V4.2.1 - 分段打分 (20分)
        
        新分段规则:
        - volume_ratio < 0.9 → 0 分
        - 0.9–1.05 → 5 分
        - 1.05–1.2 → 10 分
        - > 1.2 → 20 分
        """
        try:
            lookback = self.thresholds.get('volume_lookback', 20)
            
            volume = df['volume']
            volume_ma = volume.rolling(window=lookback).mean()
            
            current_volume = volume.iloc[-1]
            current_ma = volume_ma.iloc[-1]
            
            volume_ratio = current_volume / current_ma if current_ma > 0 else 0
            
            # V4.2.1 分段打分
            if volume_ratio < 0.9:
                # 成交量明显低于均值
                logger.debug(f"成交量不足: {volume_ratio:.2f}x (< 0.9)")
                return 0
            elif volume_ratio < 1.05:
                # 成交量接近均值
                logger.debug(f"成交量接近均值: {volume_ratio:.2f}x (0.9-1.05)")
                return 5
            elif volume_ratio < 1.2:
                # 成交量温和放大
                logger.debug(f"成交量温和放大: {volume_ratio:.2f}x (1.05-1.2)")
                return 10
            else:
                # 成交量显著放大
                logger.debug(f"成交量显著放大: {volume_ratio:.2f}x (> 1.2)")
                return 20
                
        except Exception as e:
            logger.error(f"成交量确认计算失败: {e}")
            return 0
    
    def _calc_spread_quality(self, spread_bps: float) -> int:
        """点差质量 (15分)"""
        if spread_bps is None:
            logger.warning("未提供点差数据")
            return 0
        
        try:
            max_spread = self.thresholds.get('spread_max_bps', 5)
            
            if spread_bps <= max_spread * 0.5:
                logger.debug(f"点差极佳: {spread_bps:.2f} bps")
                return self.weights['spread_quality']
            elif spread_bps <= max_spread:
                logger.debug(f"点差良好: {spread_bps:.2f} bps")
                return int(self.weights['spread_quality'] * 0.7)
            elif spread_bps <= max_spread * 1.5:
                logger.debug(f"点差一般: {spread_bps:.2f} bps")
                return int(self.weights['spread_quality'] * 0.3)
            else:
                logger.debug(f"点差过大: {spread_bps:.2f} bps")
                return 0
                
        except Exception as e:
            logger.error(f"点差质量计算失败: {e}")
            return 0
    
    def _calc_volatility_range(self, df: pd.DataFrame) -> int:
        """波动率适中 (15分) - V4.2.1 提高权重"""
        try:
            high = df['high']
            low = df['low']
            close = df['close']
            
            tr1 = high - low
            tr2 = abs(high - close.shift(1))
            tr3 = abs(low - close.shift(1))
            
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            avg_tr_pct = (true_range.tail(20).mean() / close.iloc[-1])
            
            vol_min = self.thresholds.get('volatility_min', 0.0005)
            vol_max = self.thresholds.get('volatility_max', 0.02)
            
            if vol_min <= avg_tr_pct <= vol_max:
                logger.debug(f"波动率适中: {avg_tr_pct:.4f}")
                return self.weights['volatility_range']
            elif avg_tr_pct < vol_min:
                logger.debug(f"波动率过小: {avg_tr_pct:.4f}")
                return int(self.weights['volatility_range'] * 0.3)
            else:
                logger.debug(f"波动率过大: {avg_tr_pct:.4f}")
                return 0
                
        except Exception as e:
            logger.error(f"波动率计算失败: {e}")
            return 0
    
    def _calc_rl_filter(self, rl_decision: str) -> int:
        """RL 过滤意见 (15分) - V4.2.1 提高权重"""
        if rl_decision is None:
            logger.debug("未启用 RL 过滤，默认给分")
            return self.weights['rl_filter']
        
        rl_decision = rl_decision.upper()
        
        if rl_decision == 'ALLOW':
            logger.debug("RL 放行")
            return self.weights['rl_filter']
        elif rl_decision == 'REDUCE':
            logger.debug("RL 建议缩小仓位")
            return int(self.weights['rl_filter'] * 0.5)
        elif rl_decision == 'REJECT':
            logger.debug("RL 拒绝")
            return 0
        else:
            logger.warning(f"未知的 RL 决策: {rl_decision}")
            return 0
    
    def get_score_report(self, breakdown: ScoreBreakdown) -> str:
        """生成评分报告"""
        report = []
        report.append("=" * 50)
        report.append("📊 入场评分报告 V4.2.1")
        report.append("=" * 50)
        report.append(f"趋势一致性: {breakdown.trend_consistency:>3}/20")
        report.append(f"回撤后突破: {breakdown.pullback_breakout:>3}/15")
        report.append(f"成交量确认: {breakdown.volume_confirm:>3}/20 (分段)")
        report.append(f"点差质量:   {breakdown.spread_quality:>3}/15")
        report.append(f"波动率适中: {breakdown.volatility_range:>3}/15")
        report.append(f"RL过滤:    {breakdown.rl_filter:>3}/15")
        report.append("-" * 50)
        report.append(f"总分:      {breakdown.total_score:>3}/100")
        report.append(f"达标状态:  {'✅ 达标 (>=80)' if breakdown.is_qualified else '❌ 未达标'}")
        report.append("=" * 50)
        
        return "\n".join(report)


if __name__ == "__main__":
    # 测试
    engine = ScoringEngineV421()
    print("✅ ScoringEngineV421 加载成功")
    print(f"权重配置: {engine.weights}")
    print(f"达标阈值: {engine.entry_threshold}")
