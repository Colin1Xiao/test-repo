#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
市场情绪指标计算脚本
计算综合情绪指数 (CSI) 和生成交易信号
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
from enum import Enum

import numpy as np
import pandas as pd

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SentimentLevel(Enum):
    """情绪等级"""
    EXTREME_FEAR = "极度恐惧"
    FEAR = "恐惧"
    NEUTRAL = "中性"
    GREED = "贪婪"
    EXTREME_GREED = "极度贪婪"


class SignalType(Enum):
    """信号类型"""
    EXTREME_FEAR_SUPPORT = "极度恐惧 + 支撑"
    SENTIMENT_RECOVERY = "情绪恢复"
    BULLISH_DIVERGENCE = "看涨背离"
    THRESHOLD_BREAKOUT = "阈值突破"
    EXTREME_GREED_RESISTANCE = "极度贪婪 + 阻力"
    SENTIMENT_DECLINE = "情绪回落"
    BEARISH_DIVERGENCE = "看跌背离"
    THRESHOLD_BREAKDOWN = "阈值跌破"


@dataclass
class CSIMetrics:
    """综合情绪指数指标"""
    timestamp: datetime
    csi: float  # 综合情绪指数 (0-100)
    social_media_score: float  # 社交媒体情绪
    news_score: float  # 新闻媒体情绪
    search_trend_score: float  # 搜索趋势
    trading_data_score: float  # 交易数据
    sentiment_level: str  # 情绪等级
    change_rate: float  # 变化率
    divergence: float  # 分歧度


@dataclass
class TradingSignal:
    """交易信号"""
    timestamp: datetime
    symbol: str
    signal_type: str
    direction: str  # BUY/SELL
    strength: str  # STRONG/MEDIUM/WEAK
    confidence: float
    csi: float
    entry_zone_min: float
    entry_zone_max: float
    stop_loss: float
    take_profits: List[float]
    risk_reward_ratio: float
    position_size: float
    notes: str


class SentimentIndicatorCalculator:
    """
    情绪指标计算器
    计算 CSI 和各种衍生指标
    """
    
    # CSI 权重配置
    WEIGHTS = {
        'social_media': 0.3,
        'news': 0.3,
        'search_trend': 0.2,
        'trading_data': 0.2
    }
    
    # 情绪等级阈值
    THRESHOLDS = {
        'extreme_fear': 20,
        'fear': 40,
        'neutral_low': 40,
        'neutral_high': 60,
        'greed': 80,
        'extreme_greed': 80
    }
    
    def __init__(self):
        self.history: List[CSIMetrics] = []
    
    def calculate_csi(
        self,
        social_media_score: float,
        news_score: float,
        search_trend_score: float,
        trading_data_score: float
    ) -> CSIMetrics:
        """
        计算综合情绪指数
        
        Args:
            social_media_score: 社交媒体情绪得分 (0-100)
            news_score: 新闻媒体情绪得分 (0-100)
            search_trend_score: 搜索趋势得分 (0-100)
            trading_data_score: 交易数据得分 (0-100)
            
        Returns:
            CSIMetrics: 综合情绪指数指标
        """
        # 计算加权 CSI
        csi = (
            social_media_score * self.WEIGHTS['social_media'] +
            news_score * self.WEIGHTS['news'] +
            search_trend_score * self.WEIGHTS['search_trend'] +
            trading_data_score * self.WEIGHTS['trading_data']
        )
        
        # 确定情绪等级
        sentiment_level = self._get_sentiment_level(csi)
        
        # 计算变化率
        change_rate = 0.0
        if self.history:
            prev_csi = self.history[-1].csi
            change_rate = (csi - prev_csi) / prev_csi if prev_csi > 0 else 0
        
        # 计算分歧度 (简化，实际需要各维度标准差)
        scores = [social_media_score, news_score, search_trend_score, trading_data_score]
        divergence = np.std(scores)
        
        metrics = CSIMetrics(
            timestamp=datetime.now(),
            csi=round(csi, 2),
            social_media_score=round(social_media_score, 2),
            news_score=round(news_score, 2),
            search_trend_score=round(search_trend_score, 2),
            trading_data_score=round(trading_data_score, 2),
            sentiment_level=sentiment_level,
            change_rate=round(change_rate, 4),
            divergence=round(divergence, 2)
        )
        
        self.history.append(metrics)
        return metrics
    
    def _get_sentiment_level(self, csi: float) -> str:
        """根据 CSI 值得到情绪等级"""
        if csi < self.THRESHOLDS['extreme_fear']:
            return SentimentLevel.EXTREME_FEAR.value
        elif csi < self.THRESHOLDS['fear']:
            return SentimentLevel.FEAR.value
        elif csi < self.THRESHOLDS['neutral_high']:
            return SentimentLevel.NEUTRAL.value
        elif csi < self.THRESHOLDS['greed']:
            return SentimentLevel.GREED.value
        else:
            return SentimentLevel.EXTREME_GREED.value
    
    def normalize_sentiment_score(
        self,
        raw_scores: List[float],
        method: str = 'minmax'
    ) -> float:
        """
        标准化情感得分到 0-100
        
        Args:
            raw_scores: 原始情感得分列表
            method: 标准化方法 (minmax/zscore)
            
        Returns:
            float: 标准化得分
        """
        if not raw_scores:
            return 50.0
        
        if method == 'minmax':
            min_val = min(raw_scores)
            max_val = max(raw_scores)
            if max_val == min_val:
                return 50.0
            
            # 映射到 0-100
            normalized = [(s - min_val) / (max_val - min_val) * 100 for s in raw_scores]
            return np.mean(normalized[-10:])  # 最近 10 个的平均
        
        elif method == 'zscore':
            mean = np.mean(raw_scores)
            std = np.std(raw_scores)
            if std == 0:
                return 50.0
            
            # Z-score 然后映射到 0-100
            z_scores = [(s - mean) / std for s in raw_scores]
            # 截断到 ±3，然后映射
            z_scores = [max(-3, min(3, z)) for z in z_scores]
            normalized = [(z + 3) / 6 * 100 for z in z_scores]
            return np.mean(normalized[-10:])
        
        return 50.0
    
    def calculate_funding_rate_score(self, funding_rate: float) -> float:
        """
        计算资金费率得分
        
        Args:
            funding_rate: 资金费率 (通常 -0.01 到 0.01)
            
        Returns:
            float: 得分 (0-100)
        """
        # 正值 (多头付费) -> 贪婪，负值 (空头付费) -> 恐惧
        # 映射：-0.01 -> 0, 0 -> 50, 0.01 -> 100
        score = (funding_rate + 0.01) / 0.02 * 100
        return max(0, min(100, score))
    
    def calculate_long_short_score(self, long_short_ratio: float) -> float:
        """
        计算多空比得分
        
        Args:
            long_short_ratio: 多空比 (多头/空头)
            
        Returns:
            float: 得分 (0-100)
        """
        # 假设正常范围 0.5 - 2.0
        # 0.5 -> 0, 1.0 -> 50, 2.0 -> 100
        if long_short_ratio <= 0.5:
            return 0
        elif long_short_ratio >= 2.0:
            return 100
        else:
            return (long_short_ratio - 0.5) / 1.5 * 100
    
    def get_historical_csi(self, hours: int = 24) -> List[CSIMetrics]:
        """获取历史 CSI 数据"""
        cutoff = datetime.now() - timedelta(hours=hours)
        return [m for m in self.history if m.timestamp >= cutoff]


class SignalGenerator:
    """
    交易信号生成器
    基于情绪指标生成买卖信号
    """
    
    def __init__(self, calculator: SentimentIndicatorCalculator):
        self.calculator = calculator
        self.signals: List[TradingSignal] = []
    
    def generate_signals(
        self,
        symbol: str,
        current_price: float,
        support_levels: List[float],
        resistance_levels: List[float]
    ) -> List[TradingSignal]:
        """
        生成交易信号
        
        Args:
            symbol: 交易对
            current_price: 当前价格
            support_levels: 支撑位列表
            resistance_levels: 阻力位列表
            
        Returns:
            List[TradingSignal]: 交易信号列表
        """
        signals = []
        
        if not self.calculator.history:
            return signals
        
        current = self.calculator.history[-1]
        prev = self.calculator.history[-2] if len(self.calculator.history) >= 2 else None
        
        # 检查买入信号
        buy_signals = self._check_buy_signals(
            current, prev, current_price, support_levels
        )
        signals.extend(buy_signals)
        
        # 检查卖出信号
        sell_signals = self._check_sell_signals(
            current, prev, current_price, resistance_levels
        )
        signals.extend(sell_signals)
        
        # 保存信号
        self.signals.extend(signals)
        
        return signals
    
    def _check_buy_signals(
        self,
        current: CSIMetrics,
        prev: Optional[CSIMetrics],
        price: float,
        support_levels: List[float]
    ) -> List[TradingSignal]:
        """检查买入信号"""
        signals = []
        
        # 信号 1: 极度恐惧 + 价格支撑
        if current.csi < 20 and self._is_at_support(price, support_levels):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.EXTREME_FEAR_SUPPORT,
                direction="BUY",
                strength="STRONG",
                confidence=0.85,
                csi=current.csi,
                price=price
            ))
        
        # 信号 2: 情绪从极端恢复
        if (prev and prev.csi < 20 and 20 <= current.csi < 35 and
                current.change_rate > 0.1):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.SENTIMENT_RECOVERY,
                direction="BUY",
                strength="MEDIUM",
                confidence=0.72,
                csi=current.csi,
                price=price
            ))
        
        # 信号 3: 看涨背离 (价格新低但情绪上升)
        if self._is_bullish_divergence(current, prev, price):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.BULLISH_DIVERGENCE,
                direction="BUY",
                strength="STRONG",
                confidence=0.78,
                csi=current.csi,
                price=price
            ))
        
        # 信号 4: 情绪突破阈值
        if prev and prev.csi < 40 and current.csi >= 40:
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.THRESHOLD_BREAKOUT,
                direction="BUY",
                strength="WEAK",
                confidence=0.65,
                csi=current.csi,
                price=price
            ))
        
        return signals
    
    def _check_sell_signals(
        self,
        current: CSIMetrics,
        prev: Optional[CSIMetrics],
        price: float,
        resistance_levels: List[float]
    ) -> List[TradingSignal]:
        """检查卖出信号"""
        signals = []
        
        # 信号 1: 极度贪婪 + 价格阻力
        if current.csi > 80 and self._is_at_resistance(price, resistance_levels):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.EXTREME_GREED_RESISTANCE,
                direction="SELL",
                strength="STRONG",
                confidence=0.83,
                csi=current.csi,
                price=price
            ))
        
        # 信号 2: 情绪从极端回落
        if (prev and prev.csi > 80 and 65 < current.csi <= 80 and
                current.change_rate < -0.1):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.SENTIMENT_DECLINE,
                direction="SELL",
                strength="MEDIUM",
                confidence=0.70,
                csi=current.csi,
                price=price
            ))
        
        # 信号 3: 看跌背离 (价格新高但情绪下降)
        if self._is_bearish_divergence(current, prev, price):
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.BEARISH_DIVERGENCE,
                direction="SELL",
                strength="STRONG",
                confidence=0.76,
                csi=current.csi,
                price=price
            ))
        
        # 信号 4: 情绪跌破阈值
        if prev and prev.csi > 60 and current.csi <= 60:
            signals.append(self._create_signal(
                symbol="BTC/USDT",
                signal_type=SignalType.THRESHOLD_BREAKDOWN,
                direction="SELL",
                strength="WEAK",
                confidence=0.63,
                csi=current.csi,
                price=price
            ))
        
        return signals
    
    def _is_at_support(self, price: float, support_levels: List[float]) -> bool:
        """检查价格是否在支撑位附近 (±2%)"""
        for level in support_levels:
            if abs(price - level) / level < 0.02:
                return True
        return False
    
    def _is_at_resistance(self, price: float, resistance_levels: List[float]) -> bool:
        """检查价格是否在阻力位附近 (±2%)"""
        for level in resistance_levels:
            if abs(price - level) / level < 0.02:
                return True
        return False
    
    def _is_bullish_divergence(
        self,
        current: CSIMetrics,
        prev: Optional[CSIMetrics],
        price: float
    ) -> bool:
        """检查看涨背离"""
        if not prev:
            return False
        # 情绪上升但价格下降
        return current.csi > prev.csi * 1.05  # 情绪上升 5%
    
    def _is_bearish_divergence(
        self,
        current: CSIMetrics,
        prev: Optional[CSIMetrics],
        price: float
    ) -> bool:
        """检查看跌背离"""
        if not prev:
            return False
        # 情绪下降但价格上升
        return current.csi < prev.csi * 0.95  # 情绪下降 5%
    
    def _create_signal(
        self,
        symbol: str,
        signal_type: SignalType,
        direction: str,
        strength: str,
        confidence: float,
        csi: float,
        price: float
    ) -> TradingSignal:
        """创建交易信号"""
        # 计算入场区间
        if direction == "BUY":
            entry_min = price * 0.99
            entry_max = price * 1.01
            stop_loss = price * 0.95
            take_profits = [price * 1.05, price * 1.10, price * 1.15]
        else:
            entry_min = price * 0.99
            entry_max = price * 1.01
            stop_loss = price * 1.05
            take_profits = [price * 0.95, price * 0.90, price * 0.85]
        
        # 计算风险回报比
        risk = abs(entry_min - stop_loss)
        reward = abs(take_profits[0] - entry_max)
        rr_ratio = reward / risk if risk > 0 else 0
        
        # 根据情绪调整仓位
        base_position = 1.0
        if csi < 20 or csi > 80:
            base_position = 0.3  # 极端情绪降低仓位
        elif 45 <= csi <= 55:
            base_position = 0.0  # 中性观望
        
        return TradingSignal(
            timestamp=datetime.now(),
            symbol=symbol,
            signal_type=signal_type.value,
            direction=direction,
            strength=strength,
            confidence=confidence,
            csi=csi,
            entry_zone_min=round(entry_min, 2),
            entry_zone_max=round(entry_max, 2),
            stop_loss=round(stop_loss, 2),
            take_profits=[round(tp, 2) for tp in take_profits],
            risk_reward_ratio=round(rr_ratio, 2),
            position_size=base_position,
            notes=f"CSI={csi}, 情绪={strength}"
        )


class SentimentDashboard:
    """
    情绪仪表盘
    整合指标计算和信号生成
    """
    
    def __init__(self, output_dir: str = "./dashboard"):
        self.calculator = SentimentIndicatorCalculator()
        self.signal_generator = SignalGenerator(self.calculator)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def update(
        self,
        social_score: float,
        news_score: float,
        search_score: float,
        trading_score: float
    ) -> Dict:
        """
        更新仪表盘数据
        
        Args:
            social_score: 社交媒体得分
            news_score: 新闻得分
            search_score: 搜索趋势得分
            trading_score: 交易数据得分
            
        Returns:
            Dict: 更新后的状态
        """
        # 计算 CSI
        csi_metrics = self.calculator.calculate_csi(
            social_score, news_score, search_score, trading_score
        )
        
        # 生成信号 (示例价格，实际应从 API 获取)
        signals = self.signal_generator.generate_signals(
            symbol="BTC/USDT",
            current_price=95000,
            support_levels=[90000, 85000, 80000],
            resistance_levels=[100000, 105000, 110000]
        )
        
        # 保存状态
        self._save_state(csi_metrics, signals)
        
        return {
            'csi': csi_metrics.csi,
            'sentiment_level': csi_metrics.sentiment_level,
            'change_rate': csi_metrics.change_rate,
            'signals_count': len(signals),
            'signals': [self._signal_to_dict(s) for s in signals]
        }
    
    def _signal_to_dict(self, signal: TradingSignal) -> Dict:
        """将信号转换为字典"""
        return {
            'timestamp': signal.timestamp.isoformat(),
            'symbol': signal.symbol,
            'signal_type': signal.signal_type,
            'direction': signal.direction,
            'strength': signal.strength,
            'confidence': signal.confidence,
            'entry_zone': [signal.entry_zone_min, signal.entry_zone_max],
            'stop_loss': signal.stop_loss,
            'take_profits': signal.take_profits,
            'risk_reward_ratio': signal.risk_reward_ratio
        }
    
    def _save_state(self, csi: CSIMetrics, signals: List[TradingSignal]):
        """保存状态到文件"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 保存 CSI 历史
        csi_file = self.output_dir / "csi_history.jsonl"
        with open(csi_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'timestamp': csi.timestamp.isoformat(),
                'csi': csi.csi,
                'social_media': csi.social_media_score,
                'news': csi.news_score,
                'search_trend': csi.search_trend_score,
                'trading_data': csi.trading_data_score,
                'sentiment_level': csi.sentiment_level,
                'change_rate': csi.change_rate,
                'divergence': csi.divergence
            }, ensure_ascii=False) + '\n')
        
        # 保存信号
        if signals:
            signals_file = self.output_dir / f"signals_{timestamp}.json"
            with open(signals_file, 'w', encoding='utf-8') as f:
                json.dump([self._signal_to_dict(s) for s in signals], f, indent=2, ensure_ascii=False)
    
    def get_current_state(self) -> Optional[Dict]:
        """获取当前状态"""
        if not self.calculator.history:
            return None
        
        current = self.calculator.history[-1]
        return {
            'csi': current.csi,
            'sentiment_level': current.sentiment_level,
            'timestamp': current.timestamp.isoformat(),
            'components': {
                'social_media': current.social_media_score,
                'news': current.news_score,
                'search_trend': current.search_trend_score,
                'trading_data': current.trading_data_score
            }
        }


def main():
    """主函数示例"""
    print("=" * 60)
    print("市场情绪指标计算器")
    print("=" * 60)
    
    # 初始化仪表盘
    dashboard = SentimentDashboard()
    
    # 模拟数据更新
    print("\n模拟数据更新:")
    print("-" * 60)
    
    test_data = [
        (30, 40, 50, 45),  # 恐惧
        (25, 35, 45, 40),  # 更恐惧
        (15, 20, 30, 25),  # 极度恐惧
        (35, 45, 55, 50),  # 恢复
        (55, 60, 65, 60),  # 中性
        (70, 75, 70, 75),  # 贪婪
        (85, 90, 80, 85),  # 极度贪婪
    ]
    
    for i, (social, news, search, trading) in enumerate(test_data):
        state = dashboard.update(social, news, search, trading)
        current = dashboard.get_current_state()
        
        print(f"\n更新 {i+1}:")
        print(f"  CSI: {current['csi']} ({current['sentiment_level']})")
        print(f"  变化率：{state['change_rate']:.2%}")
        if state['signals']:
            print(f"  信号：{len(state['signals'])} 个")
            for sig in state['signals']:
                print(f"    - {sig['direction']} {sig['signal_type']} (强度：{sig['strength']})")
    
    print("\n" + "=" * 60)
    print("情绪指标计算模块已就绪")
    print("使用方法:")
    print("  1. 安装依赖：pip install numpy pandas")
    print("  2. 运行：python sentiment_indicators.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
