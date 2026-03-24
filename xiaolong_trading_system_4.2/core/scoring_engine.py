#!/usr/bin/env python3
"""
Scoring Engine - 入场评分引擎 (V4.2)
多因子量化评分系统，输入市场数据，输出评分和是否达标
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
    """评分明细"""
    trend_consistency: int = 0  # 趋势一致性 (0-30)
    pullback_breakout: int = 0  # 回撤后突破 (0-20)
    volume_confirm: int = 0     # 成交量确认 (0-15)
    spread_quality: int = 0     # 点差质量 (0-15)
    volatility_range: int = 0   # 波动率适中 (0-10)
    rl_filter: int = 0          # RL过滤意见 (0-10)
    total_score: int = 0        # 总分 (0-100)
    is_qualified: bool = False  # 是否达标 (>=75)


class ScoringEngine:
    """入场评分引擎"""
    
    def __init__(self, config: Dict = None):
        """初始化评分引擎"""
        self.config = config or {}
        
        # 评分权重
        self.weights = self.config.get('scoring', {}).get('weights', {
            'trend_consistency': 30,
            'pullback_breakout': 20,
            'volume_confirm': 15,
            'spread_quality': 15,
            'volatility_range': 10,
            'rl_filter': 10
        })
        
        # 阈值参数
        self.thresholds = self.config.get('scoring', {}).get('thresholds', {
            'spread_max_bps': 5,
            'volume_lookback': 20,
            'volatility_min': 0.0005,
            'volatility_max': 0.02,
            'ema_fast_period': 9,
            'ema_slow_period': 21
        })
        
        # 入场阈值
        self.entry_threshold = self.config.get('scoring', {}).get('entry_threshold', 75)
        
        # EMA 参数
        self.ema_fast_period = self.thresholds.get('ema_fast_period', 9)
        self.ema_slow_period = self.thresholds.get('ema_slow_period', 21)
        
        logger.info(f"✅ 评分引擎初始化完成，入场阈值: {self.entry_threshold}")
    
    def calculate_score(self, 
                       ohlcv_df: pd.DataFrame,
                       current_price: float = None,
                       spread_bps: float = None,
                       rl_decision: str = None) -> ScoreBreakdown:
        """
        计算入场评分
        
        Args:
            ohlcv_df: OHLCV数据 (columns: timestamp, open, high, low, close, volume)
            current_price: 当前价格 (可选，默认使用最新close)
            spread_bps: 当前点差 (bps)
            rl_decision: RL决策 ('ALLOW', 'REJECT', 'REDUCE')
            
        Returns:
            ScoreBreakdown: 评分明细对象
        """
        if ohlcv_df is None or len(ohlcv_df) < self.ema_slow_period:
            logger.warning("数据不足，无法计算评分")
            return ScoreBreakdown()
        
        # 确保列名正确
        if 'close' not in ohlcv_df.columns:
            logger.error("数据格式错误，缺少 'close' 列")
            return ScoreBreakdown()
        
        # 当前价格
        if current_price is None:
            current_price = ohlcv_df['close'].iloc[-1]
        
        breakdown = ScoreBreakdown()
        
        # 1. 计算趋势一致性 (30分)
        breakdown.trend_consistency = self._calc_trend_consistency(ohlcv_df)
        
        # 2. 计算回撤后突破 (20分)
        breakdown.pullback_breakout = self._calc_pullback_breakout(ohlcv_df, current_price)
        
        # 3. 计算成交量确认 (15分)
        breakdown.volume_confirm = self._calc_volume_confirm(ohlcv_df)
        
        # 4. 计算点差质量 (15分)
        breakdown.spread_quality = self._calc_spread_quality(spread_bps)
        
        # 5. 计算波动率适中 (10分)
        breakdown.volatility_range = self._calc_volatility_range(ohlcv_df)
        
        # 6. RL 过滤意见 (10分)
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
        
        # 判断是否达标
        breakdown.is_qualified = breakdown.total_score >= self.entry_threshold
        
        logger.info(
            f"📊 评分结果: {breakdown.total_score}/100 "
            f"{'✅ 达标' if breakdown.is_qualified else '❌ 未达标'}"
        )
        
        return breakdown
    
    def _calc_trend_consistency(self, df: pd.DataFrame) -> int:
        """
        计算趋势一致性 (30分)
        
        规则:
        - EMA快线在慢线上方 → 做多方向，得30分
        - EMA快线在慢线下方 → 做空方向，得30分
        - 快慢线粘合或频繁交叉 → 得0分
        """
        try:
            # 计算 EMA
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            ema_slow = df['close'].ewm(span=self.ema_slow_period, adjust=False).mean()
            
            # 当前值
            current_fast = ema_fast.iloc[-1]
            current_slow = ema_slow.iloc[-1]
            
            # 计算快慢线距离
            distance_pct = abs(current_fast - current_slow) / current_slow
            
            # 快慢线必须有一定距离 (避免粘合)
            min_distance = 0.0001  # 0.01%
            
            if distance_pct < min_distance:
                # 快慢线粘合，趋势不明确
                logger.debug(f"EMA快慢线粘合，距离: {distance_pct:.4f}")
                return 0
            
            # 判断趋势方向
            if current_fast > current_slow:
                # 快线在慢线上方 → 做多趋势
                logger.debug(f"做多趋势确认，EMA{self.ema_fast_period} > EMA{self.ema_slow_period}")
                return self.weights['trend_consistency']
            else:
                # 快线在慢线下方 → 做空趋势
                logger.debug(f"做空趋势确认，EMA{self.ema_fast_period} < EMA{self.ema_slow_period}")
                return self.weights['trend_consistency']
                
        except Exception as e:
            logger.error(f"趋势一致性计算失败: {e}")
            return 0
    
    def _calc_pullback_breakout(self, df: pd.DataFrame, current_price: float) -> int:
        """
        计算回撤后突破 (20分)
        
        规则:
        - 价格回踩快线附近 (±0.1%)
        - 之后重新站回快线上方 (做多) 或跌破快线下方 (做空)
        - 确认突破有效
        """
        try:
            # 计算 EMA 快线
            ema_fast = df['close'].ewm(span=self.ema_fast_period, adjust=False).mean()
            
            # 最近几根K线
            recent_prices = df['close'].tail(10).values
            recent_ema = ema_fast.tail(10).values
            
            # 判断是否有回踩
            pullback_occurred = False
            breakout_confirmed = False
            
            # 检查最近5根K线是否有回踩快线
            for i in range(-5, 0):
                price = recent_prices[i]
                ema = recent_ema[i]
                
                # 回踩定义：价格接近快线 (±0.2%)
                if abs(price - ema) / ema < 0.002:
                    pullback_occurred = True
                    pullback_idx = i
                    break
            
            if not pullback_occurred:
                logger.debug("未检测到回踩快线")
                return 0
            
            # 检查是否突破
            current_ema = ema_fast.iloc[-1]
            
            # 做多突破：价格重新站上快线
            if current_price > current_ema:
                # 检查是否是有效的突破
                if pullback_occurred:
                    logger.debug(f"检测到回踩后突破做多，价格: {current_price:.2f}, EMA: {current_ema:.2f}")
                    breakout_confirmed = True
            
            # 做空突破：价格跌破快线
            elif current_price < current_ema:
                if pullback_occurred:
                    logger.debug(f"检测到回踩后突破做空，价格: {current_price:.2f}, EMA: {current_ema:.2f}")
                    breakout_confirmed = True
            
            if breakout_confirmed:
                return self.weights['pullback_breakout']
            else:
                return 0
                
        except Exception as e:
            logger.error(f"回撤后突破计算失败: {e}")
            return 0
    
    def _calc_volume_confirm(self, df: pd.DataFrame) -> int:
        """
        计算成交量确认 (15分)
        
        规则:
        - 最近成交量高于滚动均值
        - 成交量放大确认趋势有效
        """
        try:
            lookback = self.thresholds.get('volume_lookback', 20)
            
            # 成交量
            volume = df['volume']
            
            # 滚动均值
            volume_ma = volume.rolling(window=lookback).mean()
            
            # 当前成交量
            current_volume = volume.iloc[-1]
            current_ma = volume_ma.iloc[-1]
            
            # 成交量放大倍数
            volume_ratio = current_volume / current_ma if current_ma > 0 else 0
            
            # 成交量确认
            if volume_ratio > 1.5:
                # 成交量放大50%以上
                logger.debug(f"成交量显著放大: {volume_ratio:.2f}x")
                return self.weights['volume_confirm']
            elif volume_ratio > 1.2:
                # 成交量放大20%以上
                logger.debug(f"成交量温和放大: {volume_ratio:.2f}x")
                return int(self.weights['volume_confirm'] * 0.7)
            elif volume_ratio > 1.0:
                # 成交量略高于均值
                logger.debug(f"成交量略高于均值: {volume_ratio:.2f}x")
                return int(self.weights['volume_confirm'] * 0.5)
            else:
                # 成交量不足
                logger.debug(f"成交量低于均值: {volume_ratio:.2f}x")
                return 0
                
        except Exception as e:
            logger.error(f"成交量确认计算失败: {e}")
            return 0
    
    def _calc_spread_quality(self, spread_bps: float) -> int:
        """
        计算点差质量 (15分)
        
        规则:
        - 点差越小得分越高
        - 点差过大扣分
        """
        if spread_bps is None:
            logger.warning("未提供点差数据")
            return 0
        
        try:
            max_spread = self.thresholds.get('spread_max_bps', 5)
            
            if spread_bps <= max_spread * 0.5:
                # 点差极佳 (< 2.5 bps)
                logger.debug(f"点差极佳: {spread_bps:.2f} bps")
                return self.weights['spread_quality']
            elif spread_bps <= max_spread:
                # 点差良好 (< 5 bps)
                logger.debug(f"点差良好: {spread_bps:.2f} bps")
                return int(self.weights['spread_quality'] * 0.7)
            elif spread_bps <= max_spread * 1.5:
                # 点差一般 (< 7.5 bps)
                logger.debug(f"点差一般: {spread_bps:.2f} bps")
                return int(self.weights['spread_quality'] * 0.3)
            else:
                # 点差过大
                logger.debug(f"点差过大: {spread_bps:.2f} bps")
                return 0
                
        except Exception as e:
            logger.error(f"点差质量计算失败: {e}")
            return 0
    
    def _calc_volatility_range(self, df: pd.DataFrame) -> int:
        """
        计算波动率适中 (10分)
        
        规则:
        - 波动率太小 → 无交易机会
        - 波动率太大 → 风险过高
        - 波动率适中 → 得分
        """
        try:
            # 计算真实波动幅度 (ATR-like)
            high = df['high']
            low = df['low']
            close = df['close']
            
            # 真实波动
            tr1 = high - low
            tr2 = abs(high - close.shift(1))
            tr3 = abs(low - close.shift(1))
            
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            
            # 平均真实波动率 (占价格比例)
            avg_tr_pct = (true_range.tail(20).mean() / close.iloc[-1])
            
            vol_min = self.thresholds.get('volatility_min', 0.0005)
            vol_max = self.thresholds.get('volatility_max', 0.02)
            
            if vol_min <= avg_tr_pct <= vol_max:
                # 波动率适中
                logger.debug(f"波动率适中: {avg_tr_pct:.4f}")
                return self.weights['volatility_range']
            elif avg_tr_pct < vol_min:
                # 波动率过小
                logger.debug(f"波动率过小: {avg_tr_pct:.4f}")
                return int(self.weights['volatility_range'] * 0.3)
            else:
                # 波动率过大
                logger.debug(f"波动率过大: {avg_tr_pct:.4f}")
                return 0
                
        except Exception as e:
            logger.error(f"波动率计算失败: {e}")
            return 0
    
    def _calc_rl_filter(self, rl_decision: str) -> int:
        """
        计算 RL 过滤意见 (10分)
        
        规则:
        - RL 放行 → 得分
        - RL 拒绝 → 0分 (可能影响最终评分)
        - RL 缩小仓位 → 部分得分
        """
        if rl_decision is None:
            # 未启用 RL，默认给分
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
        report.append("📊 入场评分报告")
        report.append("=" * 50)
        report.append(f"趋势一致性: {breakdown.trend_consistency:>3}/30")
        report.append(f"回撤后突破: {breakdown.pullback_breakout:>3}/20")
        report.append(f"成交量确认: {breakdown.volume_confirm:>3}/15")
        report.append(f"点差质量:   {breakdown.spread_quality:>3}/15")
        report.append(f"波动率适中: {breakdown.volatility_range:>3}/10")
        report.append(f"RL过滤:    {breakdown.rl_filter:>3}/10")
        report.append("-" * 50)
        report.append(f"总分:      {breakdown.total_score:>3}/100")
        report.append(f"达标状态:  {'✅ 达标 (>=75)' if breakdown.is_qualified else '❌ 未达标'}")
        report.append("=" * 50)
        
        return "\n".join(report)


# 测试代码
if __name__ == "__main__":
    # 创建测试数据
    import pandas as pd
    import numpy as np
    
    # 生成测试 OHLCV 数据
    np.random.seed(42)
    n = 100
    
    prices = 74000 + np.cumsum(np.random.randn(n) * 50)
    
    df = pd.DataFrame({
        'timestamp': pd.date_range('2026-03-17', periods=n, freq='1min'),
        'open': prices + np.random.randn(n) * 10,
        'high': prices + np.abs(np.random.randn(n) * 20),
        'low': prices - np.abs(np.random.randn(n) * 20),
        'close': prices + np.random.randn(n) * 10,
        'volume': np.random.randint(100, 1000, n)
    })
    
    # 创建评分引擎
    engine = ScoringEngine()
    
    # 计算评分
    breakdown = engine.calculate_score(
        ohlcv_df=df,
        spread_bps=3.5,
        rl_decision='ALLOW'
    )
    
    # 输出报告
    print(engine.get_score_report(breakdown))