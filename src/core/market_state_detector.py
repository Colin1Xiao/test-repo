#!/usr/bin/env python3
"""
市场状态检测器 (Market State Detector)

识别市场状态：趋势市、震荡市、突破市、极端市
使用技术指标和统计方法进行分类
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass
from enum import Enum
import warnings

warnings.filterwarnings('ignore')


class MarketState(Enum):
    """市场状态枚举"""
    TRENDING = "trending"      # 趋势市
    RANGING = "ranging"        # 震荡市
    BREAKOUT = "breakout"      # 突破市
    EXTREME = "extreme"        # 极端市
    UNKNOWN = "unknown"        # 未知


@dataclass
class MarketFeatures:
    """市场特征数据类"""
    adx: float                    # ADX 趋势强度
    adx_plus: float               # +DI
    adx_minus: float              # -DI
    volatility: float             # 当前波动率
    volatility_percentile: float  # 波动率分位数 (0-1)
    volume_ratio: float           # 成交量比率
    skewness: float               # 价格分布偏度
    kurtosis: float               # 价格分布峰度
    atr: float                    # 平均真实波幅
    bb_width: float               # 布林带宽度百分比
    
    def to_dict(self) -> Dict:
        return {
            'adx': self.adx,
            'adx_plus': self.adx_plus,
            'adx_minus': self.adx_minus,
            'volatility': self.volatility,
            'volatility_percentile': self.volatility_percentile,
            'volume_ratio': self.volume_ratio,
            'skewness': self.skewness,
            'kurtosis': self.kurtosis,
            'atr': self.atr,
            'bb_width': self.bb_width
        }


@dataclass
class StateDetection:
    """状态检测结果"""
    state: MarketState
    confidence: float             # 置信度 (0-1)
    features: MarketFeatures
    transition_prob: Dict[str, float]  # 状态转换概率
    
    def to_dict(self) -> Dict:
        return {
            'state': self.state.value,
            'confidence': self.confidence,
            'features': self.features.to_dict(),
            'transition_prob': self.transition_prob
        }


class MarketStateDetector:
    """
    市场状态检测器
    
    使用多指标融合和隐马尔可夫模型识别市场状态
    """
    
    def __init__(
        self,
        adx_period: int = 14,
        volatility_window: int = 20,
        volume_window: int = 20,
        bb_period: int = 20,
        bb_std: float = 2.0
    ):
        """
        初始化检测器
        
        Args:
            adx_period: ADX 计算周期
            volatility_window: 波动率计算窗口
            volume_window: 成交量平均窗口
            bb_period: 布林带周期
            bb_std: 布林带标准差倍数
        """
        self.adx_period = adx_period
        self.volatility_window = volatility_window
        self.volume_window = volume_window
        self.bb_period = bb_period
        self.bb_std = bb_std
        
        # 状态转换概率矩阵 (马尔可夫链)
        # 顺序：trending, ranging, breakout, extreme
        self.transition_matrix = np.array([
            [0.70, 0.20, 0.08, 0.02],  # trending ->
            [0.15, 0.75, 0.08, 0.02],  # ranging ->
            [0.10, 0.10, 0.70, 0.10],  # breakout ->
            [0.05, 0.05, 0.10, 0.80],  # extreme ->
        ])
        
        self.state_names = ['trending', 'ranging', 'breakout', 'extreme']
        self.previous_state = None
        self.state_history: List[MarketState] = []
        
        # 历史波动率用于计算分位数
        self.volatility_history: List[float] = []
        self.max_vol_history = 100  # 最多保留 100 个历史波动率值
    
    def calculate_adx(self, df: pd.DataFrame) -> Tuple[float, float, float]:
        """
        计算 ADX 指标
        
        Returns:
            (ADX, +DI, -DI)
        """
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        
        n = len(close)
        if n < self.adx_period + 1:
            return 0.0, 0.0, 0.0
        
        # 计算真实波幅 TR
        tr = np.zeros(n)
        tr[0] = high[0] - low[0]
        for i in range(1, n):
            tr[i] = max(
                high[i] - low[i],
                abs(high[i] - close[i-1]),
                abs(low[i] - close[i-1])
            )
        
        # 计算方向移动
        plus_dm = np.zeros(n)
        minus_dm = np.zeros(n)
        for i in range(1, n):
            plus_dm[i] = max(0, high[i] - high[i-1]) if (high[i] - high[i-1]) > (low[i-1] - low[i]) else 0
            minus_dm[i] = max(0, low[i-1] - low[i]) if (low[i-1] - low[i]) > (high[i] - high[i-1]) else 0
        
        # 平滑计算 (Wilder's smoothing)
        atr = np.zeros(n)
        plus_di = np.zeros(n)
        minus_di = np.zeros(n)
        
        # 初始值 (简单平均)
        atr[self.adx_period-1] = np.mean(tr[1:self.adx_period+1])
        plus_di[self.adx_period-1] = 100 * np.sum(plus_dm[1:self.adx_period+1]) / atr[self.adx_period-1] if atr[self.adx_period-1] > 0 else 0
        minus_di[self.adx_period-1] = 100 * np.sum(minus_dm[1:self.adx_period+1]) / atr[self.adx_period-1] if atr[self.adx_period-1] > 0 else 0
        
        # Wilder's smoothing
        for i in range(self.adx_period, n):
            atr[i] = (atr[i-1] * (self.adx_period - 1) + tr[i]) / self.adx_period
            plus_di[i] = (plus_di[i-1] * (self.adx_period - 1) + 100 * plus_dm[i] / atr[i]) / self.adx_period if atr[i] > 0 else 0
            minus_di[i] = (minus_di[i-1] * (self.adx_period - 1) + 100 * minus_dm[i] / atr[i]) / self.adx_period if atr[i] > 0 else 0
        
        # 计算 DX 和 ADX
        dx = np.zeros(n)
        for i in range(self.adx_period, n):
            di_sum = plus_di[i] + minus_di[i]
            if di_sum > 0:
                dx[i] = 100 * abs(plus_di[i] - minus_di[i]) / di_sum
        
        # 平滑 ADX
        adx = np.zeros(n)
        adx[2*self.adx_period-1] = np.mean(dx[self.adx_period:2*self.adx_period])
        for i in range(2*self.adx_period, n):
            adx[i] = (adx[i-1] * (self.adx_period - 1) + dx[i]) / self.adx_period
        
        return adx[-1], plus_di[-1], minus_di[-1]
    
    def calculate_volatility(self, df: pd.DataFrame) -> Tuple[float, float]:
        """
        计算波动率及其分位数
        
        Returns:
            (当前波动率，波动率分位数)
        """
        close = df['close'].values
        n = len(close)
        
        if n < 2:
            return 0.0, 0.5
        
        # 计算对数收益率
        returns = np.diff(np.log(close))
        
        # 滚动波动率 (年化)
        if len(returns) >= self.volatility_window:
            rolling_vol = []
            for i in range(self.volatility_window - 1, len(returns)):
                window_vol = np.std(returns[i-self.volatility_window+1:i+1]) * np.sqrt(365 * 24)  # 小时数据年化
                rolling_vol.append(window_vol)
            
            current_vol = rolling_vol[-1]
            
            # 计算分位数
            self.volatility_history.append(current_vol)
            if len(self.volatility_history) > self.max_vol_history:
                self.volatility_history.pop(0)
            
            percentile = np.percentile(self.volatility_history, np.searchsorted(np.sort(self.volatility_history), current_vol)) / 100
            percentile = np.clip(percentile, 0, 1)
        else:
            current_vol = np.std(returns) * np.sqrt(365 * 24) if len(returns) > 0 else 0.0
            percentile = 0.5
        
        return current_vol, percentile
    
    def calculate_volume_ratio(self, df: pd.DataFrame) -> float:
        """计算成交量比率"""
        if 'volume' not in df.columns:
            return 1.0
        
        volume = df['volume'].values
        n = len(volume)
        
        if n < self.volume_window:
            return 1.0
        
        avg_volume = np.mean(volume[-self.volume_window:])
        current_volume = volume[-1]
        
        return current_volume / avg_volume if avg_volume > 0 else 1.0
    
    def calculate_price_distribution(self, df: pd.DataFrame) -> Tuple[float, float]:
        """
        计算价格分布的偏度和峰度
        
        Returns:
            (偏度，峰度)
        """
        close = df['close'].values
        n = len(close)
        
        if n < 10:
            return 0.0, 3.0
        
        returns = np.diff(np.log(close))
        
        if len(returns) < 10:
            return 0.0, 3.0
        
        # 偏度
        mean_ret = np.mean(returns)
        std_ret = np.std(returns)
        
        if std_ret > 0:
            skewness = np.mean(((returns - mean_ret) / std_ret) ** 3)
            kurtosis = np.mean(((returns - mean_ret) / std_ret) ** 4)
        else:
            skewness = 0.0
            kurtosis = 3.0
        
        return skewness, kurtosis
    
    def calculate_bollinger_width(self, df: pd.DataFrame) -> float:
        """计算布林带宽度百分比"""
        close = df['close'].values
        n = len(close)
        
        if n < self.bb_period:
            return 0.0
        
        # 计算布林带
        sma = np.mean(close[-self.bb_period:])
        std = np.std(close[-self.bb_period:])
        
        upper = sma + self.bb_std * std
        lower = sma - self.bb_std * std
        
        # 宽度百分比
        bb_width = (upper - lower) / sma if sma > 0 else 0.0
        
        return bb_width
    
    def calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """计算平均真实波幅"""
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        n = len(close)
        
        if n < 2:
            return 0.0
        
        tr = np.zeros(n)
        tr[0] = high[0] - low[0]
        for i in range(1, n):
            tr[i] = max(
                high[i] - low[i],
                abs(high[i] - close[i-1]),
                abs(low[i] - close[i-1])
            )
        
        if n < period:
            return np.mean(tr)
        
        # Wilder's smoothing
        atr = np.zeros(n)
        atr[period-1] = np.mean(tr[:period])
        for i in range(period, n):
            atr[i] = (atr[i-1] * (period - 1) + tr[i]) / period
        
        return atr[-1]
    
    def extract_features(self, df: pd.DataFrame) -> MarketFeatures:
        """提取所有市场特征"""
        adx, adx_plus, adx_minus = self.calculate_adx(df)
        volatility, vol_percentile = self.calculate_volatility(df)
        volume_ratio = self.calculate_volume_ratio(df)
        skewness, kurtosis = self.calculate_price_distribution(df)
        atr = self.calculate_atr(df)
        bb_width = self.calculate_bollinger_width(df)
        
        return MarketFeatures(
            adx=adx,
            adx_plus=adx_plus,
            adx_minus=adx_minus,
            volatility=volatility,
            volatility_percentile=vol_percentile,
            volume_ratio=volume_ratio,
            skewness=skewness,
            kurtosis=kurtosis,
            atr=atr,
            bb_width=bb_width
        )
    
    def classify_state(self, features: MarketFeatures) -> Tuple[MarketState, float]:
        """
        基于特征分类市场状态
        
        Returns:
            (市场状态，置信度)
        """
        scores = {
            MarketState.TRENDING: 0.0,
            MarketState.RANGING: 0.0,
            MarketState.BREAKOUT: 0.0,
            MarketState.EXTREME: 0.0
        }
        
        # 趋势市评分
        if features.adx > 25:
            scores[MarketState.TRENDING] += 0.4
        if features.adx > 30:
            scores[MarketState.TRENDING] += 0.2
        if abs(features.adx_plus - features.adx_minus) > 10:
            scores[MarketState.TRENDING] += 0.2
        
        # 震荡市评分
        if features.adx < 20:
            scores[MarketState.RANGING] += 0.4
        if features.volatility_percentile < 0.3:
            scores[MarketState.RANGING] += 0.3
        if features.bb_width < 0.05:
            scores[MarketState.RANGING] += 0.2
        
        # 突破市评分
        if features.volatility_percentile > 0.7:
            scores[MarketState.BREAKOUT] += 0.3
        if features.volume_ratio > 2.0:
            scores[MarketState.BREAKOUT] += 0.3
        if features.adx > 20 and features.adx < 35:
            scores[MarketState.BREAKOUT] += 0.2
        
        # 极端市评分
        if features.volatility_percentile > 0.9:
            scores[MarketState.EXTREME] += 0.4
        if features.kurtosis > 5:
            scores[MarketState.EXTREME] += 0.3
        if abs(features.skewness) > 2:
            scores[MarketState.EXTREME] += 0.2
        
        # 选择最高分
        best_state = max(scores, key=scores.get)
        best_score = scores[best_state]
        
        # 计算置信度 (归一化)
        total_score = sum(scores.values())
        confidence = best_score / total_score if total_score > 0 else 0.5
        confidence = min(confidence, 1.0)
        
        return best_state, confidence
    
    def calculate_transition_probabilities(self, current_state: MarketState) -> Dict[str, float]:
        """计算状态转换概率"""
        state_idx = self.state_names.index(current_state.value)
        probs = self.transition_matrix[state_idx]
        
        return {
            self.state_names[i]: float(probs[i])
            for i in range(len(self.state_names))
        }
    
    def detect(self, df: pd.DataFrame) -> StateDetection:
        """
        检测当前市场状态
        
        Args:
            df: DataFrame，包含 'open', 'high', 'low', 'close', 'volume' 列
            
        Returns:
            StateDetection 对象
        """
        # 提取特征
        features = self.extract_features(df)
        
        # 分类状态
        state, confidence = self.classify_state(features)
        
        # 计算转换概率
        transition_prob = self.calculate_transition_probabilities(state)
        
        # 更新历史
        self.previous_state = state
        self.state_history.append(state)
        
        return StateDetection(
            state=state,
            confidence=confidence,
            features=features,
            transition_prob=transition_prob
        )
    
    def get_state_history(self) -> List[str]:
        """获取状态历史"""
        return [s.value for s in self.state_history]
    
    def reset(self):
        """重置检测器状态"""
        self.previous_state = None
        self.state_history = []
        self.volatility_history = []


def create_sample_data(n_periods: int = 500, state: str = 'trending') -> pd.DataFrame:
    """
    创建示例数据用于测试
    
    Args:
        n_periods: 数据周期数
        state: 市场状态类型
        
    Returns:
        DataFrame with OHLCV data
    """
    np.random.seed(42)
    
    if state == 'trending':
        # 趋势市：带漂移的随机游走
        returns = np.random.normal(0.001, 0.02, n_periods)
    elif state == 'ranging':
        # 震荡市：均值回归
        returns = np.random.normal(0, 0.015, n_periods)
        returns = returns - 0.3 * np.cumsum(returns) / np.arange(1, n_periods+1)
    elif state == 'breakout':
        # 突破市：正常 + 偶尔大幅波动
        returns = np.random.normal(0, 0.02, n_periods)
        breakout_points = np.random.choice(n_periods, size=5, replace=False)
        returns[breakout_points] *= 5
    else:  # extreme
        # 极端市：高波动 + 厚尾
        returns = np.random.standard_t(3, n_periods) * 0.03
    
    close = 100 * np.exp(np.cumsum(returns))
    
    # 生成 OHLCV
    data = []
    for i in range(n_periods):
        c = close[i]
        range_pct = np.abs(returns[i]) + 0.01
        h = c * (1 + range_pct * np.random.uniform(0.3, 0.7))
        l = c * (1 - range_pct * np.random.uniform(0.3, 0.7))
        o = l + (h - l) * np.random.uniform(0.2, 0.8)
        v = np.random.uniform(1000, 10000) * (1 + abs(returns[i]) * 10)
        
        data.append({
            'open': o,
            'high': h,
            'low': l,
            'close': c,
            'volume': v
        })
    
    return pd.DataFrame(data)


if __name__ == "__main__":
    # 测试示例
    print("=" * 60)
    print("市场状态检测器测试")
    print("=" * 60)
    
    detector = MarketStateDetector()
    
    # 测试不同市场状态
    test_states = ['trending', 'ranging', 'breakout', 'extreme']
    
    for state_name in test_states:
        print(f"\n测试 {state_name} 市场:")
        print("-" * 40)
        
        df = create_sample_data(n_periods=500, state=state_name)
        result = detector.detect(df)
        
        print(f"检测状态：{result.state.value}")
        print(f"置信度：{result.confidence:.2f}")
        print(f"ADX: {result.features.adx:.2f}")
        print(f"波动率分位数：{result.features.volatility_percentile:.2f}")
        print(f"成交量比率：{result.features.volume_ratio:.2f}")
        print(f"峰度：{result.features.kurtosis:.2f}")
        print(f"状态转换概率：{result.transition_prob}")
        
        detector.reset()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
