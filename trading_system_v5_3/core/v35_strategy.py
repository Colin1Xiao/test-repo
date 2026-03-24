#!/usr/bin/env python3
"""
V3.5 自适应策略 - Entry & Exit 核心模块

核心升级：
1. Regime Filter → 只在 TREND 交易
2. Volatility Filter → LOW 波动不交易
3. Dynamic TP/SL → 根据波动强度调整
4. Trend Alignment → 顺势交易

设计原则：
- 更聪明过滤，不是更严格
- 让利润跑（HIGH波动扩大止盈）
- 避开垃圾市场（LOW波动）
"""

from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import time

from .v35_volatility import (
    VolatilityFilter, 
    VolatilityClass, 
    get_volatility_filter
)
from .regime.regime_detector import RegimeDetector, get_detector
from .regime.regime_types import MarketRegime


@dataclass
class V35Signal:
    """V3.5 信号数据结构"""
    score: float
    direction: str  # "LONG" or "SHORT"
    volume_ratio: float
    price_change: float
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class V35Decision:
    """V3.5 决策结果"""
    should_enter: bool
    reason: str
    regime: str
    volatility_class: str
    trend_direction: str
    params: Dict  # TP/SL/Time
    signal: Optional[V35Signal] = None


class V35Strategy:
    """
    V3.5 自适应策略控制器
    
    Entry 条件（必须全部满足）：
    1. Regime == TREND
    2. Volatility != LOW
    3. Score >= 65
    4. Direction == Trend Direction
    5. Volume Ratio > 1.1
    6. Price Change > 0.1%
    """
    
    # Entry 阈值
    MIN_SCORE = 65
    MIN_VOLUME_RATIO = 1.1
    MIN_PRICE_CHANGE = 0.001  # 0.1%
    
    def __init__(self):
        """初始化"""
        self.volatility_filter = get_volatility_filter()
        self.regime_detector = get_detector()
        
        # 统计
        self.stats = {
            "signals_checked": 0,
            "signals_rejected": 0,
            "reject_reasons": {
                "regime": 0,
                "volatility": 0,
                "score": 0,
                "direction": 0,
                "volume": 0,
                "price_change": 0
            },
            "signals_passed": 0
        }
        
        print("🎯 V3.5 Strategy 初始化完成")
        print(f"   MIN_SCORE: {self.MIN_SCORE}")
        print(f"   MIN_VOLUME: {self.MIN_VOLUME_RATIO}x")
        print(f"   MIN_PRICE_CHANGE: {self.MIN_PRICE_CHANGE*100}%")
    
    def detect_trend_direction(self, candles: list) -> str:
        """
        判断趋势方向
        
        Args:
            candles: K线数据
        
        Returns:
            "LONG" or "SHORT"
        """
        if not candles or len(candles) < 2:
            return "LONG"  # 默认
        
        # 最近收盘价 vs 第一根收盘价
        first_close = candles[0].get("close", candles[0].get("c", 0))
        last_close = candles[-1].get("close", candles[-1].get("c", 0))
        
        return "LONG" if last_close >= first_close else "SHORT"
    
    def should_enter(
        self, 
        signal: V35Signal, 
        candles: list,
        df=None  # pandas DataFrame for regime detection
    ) -> V35Decision:
        """
        V3.5 Entry 决策
        
        Args:
            signal: 信号数据
            candles: K线数据（用于波动率）
            df: DataFrame（用于Regime检测）
        
        Returns:
            V35Decision 决策结果
        """
        self.stats["signals_checked"] += 1
        
        # ========== Step 1: Regime Filter ==========
        if df is not None:
            regime = self.regime_detector.detect(df)
            regime_str = regime.value
        else:
            # 简化检测：用 candles 判断
            regime_str = self._simple_regime_detect(candles)
        
        if regime_str != "trend":
            self.stats["reject_reasons"]["regime"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"REGIME_FILTER: {regime_str} != trend",
                regime=regime_str,
                volatility_class="N/A",
                trend_direction="N/A",
                params={}
            )
        
        # ========== Step 2: Volatility Filter ==========
        should_trade, vol_params = self.volatility_filter.should_trade(candles)
        
        if not should_trade:
            self.stats["reject_reasons"]["volatility"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"VOLATILITY_FILTER: {vol_params.volatility_class.value} = LOW",
                regime=regime_str,
                volatility_class=vol_params.volatility_class.value,
                trend_direction="N/A",
                params={}
            )
        
        # ========== Step 3: Trend Direction ==========
        trend_direction = self.detect_trend_direction(candles)
        
        # ========== Step 4: Signal Quality ==========
        
        # 4.1 Score
        if signal.score < self.MIN_SCORE:
            self.stats["reject_reasons"]["score"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"SCORE_FILTER: {signal.score} < {self.MIN_SCORE}",
                regime=regime_str,
                volatility_class=vol_params.volatility_class.value,
                trend_direction=trend_direction,
                params={}
            )
        
        # 4.2 Direction Alignment
        if signal.direction != trend_direction:
            self.stats["reject_reasons"]["direction"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"DIRECTION_FILTER: signal={signal.direction} != trend={trend_direction}",
                regime=regime_str,
                volatility_class=vol_params.volatility_class.value,
                trend_direction=trend_direction,
                params={}
            )
        
        # 4.3 Volume
        if signal.volume_ratio < self.MIN_VOLUME_RATIO:
            self.stats["reject_reasons"]["volume"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"VOLUME_FILTER: {signal.volume_ratio:.2f}x < {self.MIN_VOLUME_RATIO}x",
                regime=regime_str,
                volatility_class=vol_params.volatility_class.value,
                trend_direction=trend_direction,
                params={}
            )
        
        # 4.4 Price Change
        if abs(signal.price_change) < self.MIN_PRICE_CHANGE:
            self.stats["reject_reasons"]["price_change"] += 1
            self.stats["signals_rejected"] += 1
            return V35Decision(
                should_enter=False,
                reason=f"PRICE_CHANGE_FILTER: {signal.price_change*100:.2f}% < {self.MIN_PRICE_CHANGE*100}%",
                regime=regime_str,
                volatility_class=vol_params.volatility_class.value,
                trend_direction=trend_direction,
                params={}
            )
        
        # ========== PASS ==========
        self.stats["signals_passed"] += 1
        
        return V35Decision(
            should_enter=True,
            reason="ALL_FILTERS_PASSED",
            regime=regime_str,
            volatility_class=vol_params.volatility_class.value,
            trend_direction=trend_direction,
            params={
                "take_profit": vol_params.take_profit,
                "stop_loss": vol_params.stop_loss,
                "max_hold_sec": vol_params.max_hold_sec
            },
            signal=signal
        )
    
    def _simple_regime_detect(self, candles: list) -> str:
        """
        简化 Regime 检测（无 DataFrame 时使用）
        
        基于：
        - 价格范围
        - 方向一致性
        """
        if not candles or len(candles) < 20:
            return "range"
        
        prices = [c.get("close", c.get("c", 0)) for c in candles[-20:]]
        
        high = max(prices)
        low = min(prices)
        
        # 波动范围
        range_pct = (high - low) / low if low > 0 else 0
        
        # 方向一致性
        up_moves = sum(1 for i in range(1, len(prices)) if prices[i] > prices[i-1])
        direction_consistency = up_moves / (len(prices) - 1)
        
        # 判断
        if range_pct > 0.004 and (direction_consistency > 0.6 or direction_consistency < 0.4):
            return "trend"
        else:
            return "range"
    
    def check_exit(
        self,
        position: Dict,
        current_price: float,
        vol_class: str
    ) -> Optional[str]:
        """
        V3.5 Exit 检查
        
        Args:
            position: 持仓信息
            current_price: 当前价格
            vol_class: 波动率等级
        
        Returns:
            Exit 原因 或 None
        """
        # 获取动态参数
        vol_enum = VolatilityClass(vol_class) if vol_class in ["LOW", "MID", "HIGH"] else VolatilityClass.MID
        params = self.volatility_filter.get_params(vol_enum)
        
        entry_price = position.get("entry_price", 0)
        entry_time = position.get("entry_time", 0)
        
        if entry_price <= 0:
            return None
        
        # 计算 PnL
        pnl = (current_price - entry_price) / entry_price
        
        # 方向调整
        if position.get("direction") == "SHORT":
            pnl = -pnl
        
        # 持仓时间
        hold_time = time.time() - entry_time
        
        # 检查 Exit 条件
        if pnl >= params["take_profit"]:
            return "TAKE_PROFIT"
        
        if pnl <= -params["stop_loss"]:
            return "STOP_LOSS"
        
        if hold_time >= params["max_hold"]:
            return "TIME_EXIT"
        
        return None
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            **self.stats,
            "pass_rate": (
                self.stats["signals_passed"] / self.stats["signals_checked"] * 100
                if self.stats["signals_checked"] > 0 else 0
            )
        }
    
    def reset_stats(self):
        """重置统计"""
        self.stats = {
            "signals_checked": 0,
            "signals_rejected": 0,
            "reject_reasons": {
                "regime": 0,
                "volatility": 0,
                "score": 0,
                "direction": 0,
                "volume": 0,
                "price_change": 0
            },
            "signals_passed": 0
        }


# 单例
_v35_strategy = None

def get_v35_strategy() -> V35Strategy:
    """获取全局实例"""
    global _v35_strategy
    if _v35_strategy is None:
        _v35_strategy = V35Strategy()
    return _v35_strategy