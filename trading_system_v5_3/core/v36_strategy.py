#!/usr/bin/env python3
"""
V3.6 评分制策略 - 修正版

关键修正：
- 没有任何单一条件可以"直接否决交易"
- Regime 改为评分，不是硬过滤
- score >= 4 即可入场
"""

from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import time


@dataclass
class V36Signal:
    """V3.6 信号数据结构"""
    score: float
    direction: str
    volume_ratio: float
    price_change: float
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class V36Decision:
    """V3.6 决策结果"""
    should_enter: bool
    entry_score: int
    reason: str
    regime_score: int
    vol_score: int
    trend_direction: str
    params: Dict
    breakdown: Dict


class V36Strategy:
    """
    V3.6 评分制策略（修正版）
    
    评分结构（无硬过滤）：
    - Regime: TREND=2, MID=1, RANGE=0
    - Volatility: HIGH=2, MID=1, LOW=0
    - Signal Score >= 65: +1
    - Direction == Trend: +1
    - Volume > 1.1x: +1
    - Price Change > 0.1%: +1
    
    入场条件：总分 >= 4
    """
    
    ENTRY_THRESHOLD = 4
    
    def __init__(self):
        """初始化"""
        self.stats = {
            "signals_checked": 0,
            "signals_passed": 0,
            "score_distribution": {}
        }
        
        print("🎯 V3.6 评分制策略（修正版）初始化完成")
        print(f"   入场阈值: score >= {self.ENTRY_THRESHOLD}")
        print("   ⚠️ 无硬过滤：所有条件参与评分")
        print("   评分结构:")
        print("     - Regime: TREND=2, MID=1, RANGE=0")
        print("     - Volatility: HIGH=2, MID=1, LOW=0")
        print("     - Score >= 65: +1")
        print("     - Direction == Trend: +1")
        print("     - Volume > 1.1x: +1")
        print("     - Price Change > 0.1%: +1")
    
    def get_regime_score(self, candles: list) -> int:
        """
        Regime 评分（不再阻断）
        
        TREND = 2
        MID = 1
        RANGE = 0
        """
        if not candles or len(candles) < 20:
            return 0
        
        prices = [c.get("close", c.get("c", 0)) for c in candles[-20:]]
        
        high = max(prices)
        low = min(prices)
        
        range_pct = (high - low) / low if low > 0 else 0
        
        # 方向一致性
        up_moves = sum(1 for i in range(1, len(prices)) if prices[i] > prices[i-1])
        direction_consistency = up_moves / (len(prices) - 1)
        
        # 不再 return False，而是给分
        if range_pct > 0.004 and (direction_consistency > 0.6 or direction_consistency < 0.4):
            return 2  # TREND
        elif range_pct > 0.002:
            return 1  # MID
        else:
            return 0  # RANGE
    
    def get_vol_score(self, candles: list) -> int:
        """
        Volatility 评分
        
        HIGH = 2
        MID = 1
        LOW = 0
        """
        if not candles or len(candles) < 10:
            return 0
        
        prices = [c.get("close", c.get("c", 0)) for c in candles[-10:]]
        
        returns = []
        for i in range(1, len(prices)):
            if prices[i-1] > 0:
                r = abs(prices[i] - prices[i-1]) / prices[i-1]
                returns.append(r)
        
        if not returns:
            return 0
        
        vol = sum(returns) / len(returns)
        
        if vol > 0.002:
            return 2  # HIGH
        elif vol > 0.001:
            return 1  # MID
        else:
            return 0  # LOW
    
    def get_trend_direction(self, candles: list) -> str:
        """判断趋势方向"""
        if not candles or len(candles) < 2:
            return "LONG"
        
        first_close = candles[0].get("close", candles[0].get("c", 0))
        last_close = candles[-1].get("close", candles[-1].get("c", 0))
        
        return "LONG" if last_close >= first_close else "SHORT"
    
    def should_enter(self, signal: V36Signal, candles: list) -> V36Decision:
        """
        V3.6 Entry 决策（无硬过滤）
        """
        self.stats["signals_checked"] += 1
        
        score = 0
        breakdown = {
            "regime": 0,
            "volatility": 0,
            "signal": 0,
            "direction": 0,
            "volume": 0,
            "price_change": 0
        }
        
        # === Regime（不再阻断）
        regime_score = self.get_regime_score(candles)
        breakdown["regime"] = regime_score
        score += regime_score
        
        # === Volatility
        vol_score = self.get_vol_score(candles)
        breakdown["volatility"] = vol_score
        score += vol_score
        
        # === Signal Score
        if signal.score >= 65:
            breakdown["signal"] = 1
            score += 1
        
        # === Direction Alignment
        trend = self.get_trend_direction(candles)
        if signal.direction == trend:
            breakdown["direction"] = 1
            score += 1
        
        # === Volume
        if signal.volume_ratio > 1.1:
            breakdown["volume"] = 1
            score += 1
        
        # === Price Momentum
        if abs(signal.price_change) > 0.001:
            breakdown["price_change"] = 1
            score += 1
        
        # Debug log（非常重要）
        print(f"[V3.6 SCORE] total={score} | regime={regime_score} vol={vol_score} signal={breakdown['signal']} dir={breakdown['direction']} vol_ratio={breakdown['volume']} price={breakdown['price_change']}", flush=True)
        
        # 记录评分分布
        if score not in self.stats["score_distribution"]:
            self.stats["score_distribution"][score] = 0
        self.stats["score_distribution"][score] += 1
        
        # === 最终阈值
        should_enter = score >= self.ENTRY_THRESHOLD
        
        if should_enter:
            self.stats["signals_passed"] += 1
            reason = f"SCORE_PASSED: {score} >= {self.ENTRY_THRESHOLD}"
        else:
            reason = f"SCORE_TOO_LOW: {score} < {self.ENTRY_THRESHOLD}"
        
        # 动态参数
        if vol_score >= 2:
            params = {"take_profit": 0.0035, "stop_loss": 0.0010, "max_hold_sec": 90}
        else:
            params = {"take_profit": 0.0020, "stop_loss": 0.0006, "max_hold_sec": 60}
        
        return V36Decision(
            should_enter=should_enter,
            entry_score=score,
            reason=reason,
            regime_score=regime_score,
            vol_score=vol_score,
            trend_direction=trend,
            params=params,
            breakdown=breakdown
        )
    
    def check_exit(self, position: Dict, current_price: float, candles: list) -> Optional[str]:
        """Exit 检查"""
        vol_score = self.get_vol_score(candles)
        
        if vol_score >= 2:
            tp = 0.0035
            sl = 0.0010
            max_time = 90
        else:
            tp = 0.0020
            sl = 0.0006
            max_time = 60
        
        entry_price = position.get("entry_price", 0)
        entry_time = position.get("entry_time", 0)
        
        if entry_price <= 0:
            return None
        
        pnl = (current_price - entry_price) / entry_price
        
        if position.get("direction") == "SHORT":
            pnl = -pnl
        
        hold_time = time.time() - entry_time
        
        if pnl >= tp:
            return "TAKE_PROFIT"
        
        if pnl <= -sl:
            return "STOP_LOSS"
        
        if hold_time >= max_time:
            return "TIME_EXIT"
        
        return None
    
    def get_stats(self) -> Dict:
        """获取统计"""
        total = self.stats["signals_checked"]
        passed = self.stats["signals_passed"]
        return {
            **self.stats,
            "pass_rate": (passed / total * 100) if total > 0 else 0
        }


# 单例
_v36_strategy = None

def get_v36_strategy() -> V36Strategy:
    """获取全局实例"""
    global _v36_strategy
    if _v36_strategy is None:
        _v36_strategy = V36Strategy()
    return _v36_strategy