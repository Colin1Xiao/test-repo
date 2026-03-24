#!/usr/bin/env python3
"""
Regime Detector - 市场状态识别核心模块

识别三种市场状态：
- RANGE: 震荡行情
- TREND: 趋势行情
- BREAKOUT: 爆发行情
"""

import numpy as np
import pandas as pd
from typing import Optional, Dict, Any
from datetime import datetime

from .regime_types import MarketRegime
from .regime_config import REGIME_CONFIG


class RegimeDetector:
    """
    市场状态识别器
    
    核心逻辑：
    1. 计算价格变化、波动率、成交量等特征
    2. 根据规则判断当前市场状态
    3. 返回对应的MarketRegime枚举
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化识别器
        
        Args:
            config: 自定义配置（可选）
        """
        self.config = config or REGIME_CONFIG
        
        # 阈值参数
        self.volatility_high = 0.025      # 高波动率阈值
        self.volatility_low = 0.01        # 低波动率阈值
        self.price_change_breakout = 0.02  # 爆发行情价格变化阈值
        self.price_change_trend = 0.015    # 趋势行情价格变化阈值
        self.volume_spike = 1.5           # 成交量爆发倍数
        self.directional_threshold = 0.7  # 方向一致性阈值
        
        # 历史状态
        self.history = []
        self.current_regime = MarketRegime.RANGE
        self.last_update = None
        
        print("🔍 Regime Detector 初始化完成")
        print(f"   RANGE阈值: 价格变化<1.5%, 低波动")
        print(f"   TREND阈值: 价格变化>1.5%, 方向一致性>70%")
        print(f"   BREAKOUT阈值: 价格变化>2%, 成交量>1.5x")
    
    def detect(self, df: pd.DataFrame) -> MarketRegime:
        """
        检测当前市场状态
        
        Args:
            df: OHLCV数据 (至少60根K线)
        
        Returns:
            MarketRegime枚举值
        """
        if df is None or len(df) < 60:
            print("⚠️  数据不足，默认RANGE模式")
            return MarketRegime.RANGE
        
        try:
            # ========== 计算核心特征 ==========
            
            # 价格变化
            price_now = df['close'].iloc[-1]
            price_1h_ago = df['close'].iloc[-60] if len(df) >= 60 else df['close'].iloc[0]
            price_5m_ago = df['close'].iloc[-5] if len(df) >= 5 else price_now
            
            price_change_1h = abs((price_now - price_1h_ago) / price_1h_ago)
            price_change_5m = abs((price_now - price_5m_ago) / price_5m_ago)
            
            # 波动率（标准差）
            returns = df['close'].pct_change()
            volatility = returns.rolling(20).std().iloc[-1]
            
            # 成交量
            volume = df['volume'].iloc[-1]
            volume_mean = df['volume'].rolling(20).mean().iloc[-1]
            volume_ratio = volume / volume_mean if volume_mean > 0 else 0
            
            # EMA趋势
            ema_fast = df['close'].ewm(span=10).mean().iloc[-1]
            ema_slow = df['close'].ewm(span=30).mean().iloc[-1]
            trend_direction = 1 if ema_fast > ema_slow else -1
            
            # 方向一致性（最近10根K线方向与趋势方向一致的比例）
            recent_returns = returns.iloc[-10:]
            directional_consistency = np.mean(np.sign(recent_returns) == trend_direction)
            
            # 波动率扩张（当前波动率 vs 过去波动率）
            volatility_past = returns.rolling(20).std().iloc[-20:-1].mean()
            volatility_expanding = volatility > volatility_past * 1.2
            
            # ========== 状态判断（优先级：BREAKOUT > TREND > RANGE） ==========
            
            detected_regime = MarketRegime.RANGE  # 默认
            
            # 🔴 BREAKOUT检测
            if (
                price_change_1h > self.price_change_breakout and
                volume_ratio > self.volume_spike and
                volatility > self.volatility_high
            ):
                detected_regime = MarketRegime.BREAKOUT
                trigger = f"价格变化{price_change_1h*100:.1f}%>2%, 成交量{volume_ratio:.1f}x>1.5x"
            
            # 🔵 TREND检测
            elif (
                price_change_1h > self.price_change_trend and
                directional_consistency > self.directional_threshold
            ):
                detected_regime = MarketRegime.TREND
                trigger = f"价格变化{price_change_1h*100:.1f}%>1.5%, 方向一致性{directional_consistency*100:.0f}%>70%"
            
            # 🟡 RANGE（默认）
            else:
                detected_regime = MarketRegime.RANGE
                trigger = f"价格变化{price_change_1h*100:.1f}%, 成交量{volume_ratio:.1f}x"
            
            # ========== 记录状态变化 ==========
            
            now = datetime.now()
            
            if detected_regime != self.current_regime:
                # 状态切换
                transition = {
                    'from': self.current_regime.value,
                    'to': detected_regime.value,
                    'timestamp': now.isoformat(),
                    'trigger': trigger,
                    'features': {
                        'price_change_1h': price_change_1h,
                        'price_change_5m': price_change_5m,
                        'volatility': volatility,
                        'volume_ratio': volume_ratio,
                        'directional_consistency': directional_consistency
                    }
                }
                self.history.append(transition)
                
                print(f"\n🔄 市场状态切换: {self.current_regime.emoji()} {self.current_regime.value} → {detected_regime.emoji()} {detected_regime.value}")
                print(f"   触发原因: {trigger}")
            
            self.current_regime = detected_regime
            self.last_update = now
            
            return detected_regime
            
        except Exception as e:
            print(f"❌ Regime检测错误: {e}")
            return MarketRegime.RANGE
    
    def get_current_regime(self) -> MarketRegime:
        """获取当前状态（不重新计算）"""
        return self.current_regime
    
    def get_regime_features(self, df: pd.DataFrame) -> Dict[str, float]:
        """
        获取状态特征（用于日志和调试）
        """
        if df is None or len(df) < 60:
            return {}
        
        price_now = df['close'].iloc[-1]
        price_1h_ago = df['close'].iloc[-60]
        
        returns = df['close'].pct_change()
        volatility = returns.rolling(20).std().iloc[-1]
        
        volume = df['volume'].iloc[-1]
        volume_mean = df['volume'].rolling(20).mean().iloc[-1]
        
        return {
            'price_change_1h': abs((price_now - price_1h_ago) / price_1h_ago) * 100,
            'volatility': volatility * 100,
            'volume_ratio': volume / volume_mean if volume_mean > 0 else 0
        }
    
    def get_history(self, limit: int = 10) -> list:
        """获取最近的状态切换历史"""
        return self.history[-limit:] if self.history else []


# 创建默认实例
_default_detector = None

def get_detector() -> RegimeDetector:
    """获取全局探测器实例"""
    global _default_detector
    if _default_detector is None:
        _default_detector = RegimeDetector()
    return _default_detector