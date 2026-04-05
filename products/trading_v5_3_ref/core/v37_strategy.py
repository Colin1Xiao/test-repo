#!/usr/bin/env python3
"""
V3.7 策略 - Exit 优化版

核心改变（只改 Exit，不改 Entry）：
1. 引入 Trailing Stop（让盈利跑）
2. 延长 TIME_EXIT：60s → 90s
3. 记录 peak_price
"""

from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import time


@dataclass
class V37Signal:
    """V3.7 信号数据结构"""
    score: float
    direction: str
    volume_ratio: float
    price_change: float
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class V37Decision:
    """V3.7 决策结果"""
    should_enter: bool
    entry_score: int
    reason: str
    regime_score: int
    vol_score: int
    trend_direction: str
    params: Dict
    breakdown: Dict


class V37Strategy:
    """
    V3.7 策略（Exit 优化版）
    
    Entry 评分（不变）：
    - Regime: TREND=2, MID=1, RANGE=0
    - Volatility: HIGH=2, MID=1, LOW=0
    - Signal Score >= 65: +1
    - Direction == Trend: +1
    - Volume > 1.1x: +1
    - Price Change > 0.1%: +1
    
    入场条件：总分 >= 4
    
    Exit 改变（V3.7）：
    1. Trailing Stop（核心）：回撤 0.15% 触发
    2. STOP LOSS: -0.07%
    3. TIME_EXIT: 90s（延长）
    """
    
    ENTRY_THRESHOLD = 4
    
    # Exit 参数
    STOP_LOSS = -0.0007      # -0.07%
    TRAILING_PCT = -0.0015   # 回撤 0.15%
    TIME_EXIT = 90           # 90秒
    
    def __init__(self):
        self.stats = {
            "signals_checked": 0,
            "signals_passed": 0,
            "score_distribution": {}
        }
        
        print("🎯 V3.7 策略（Exit 优化版）初始化完成")
        print(f"   入场阈值: score >= {self.ENTRY_THRESHOLD}")
        print()
        print("   Exit 改变（V3.7）:")
        print("     1. Trailing Stop: 回撤 0.15% 触发")
        print("     2. STOP LOSS: -0.07%")
        print("     3. TIME_EXIT: 90s")
        print()
        print("   ⚠️ Entry 评分系统不变")
    
    def get_regime_score(self, candles: list) -> int:
        if not candles or len(candles) < 20: return 0
        prices = [c.get("close", c.get("c", 0)) for c in candles[-20:]]
        high, low = max(prices), min(prices)
        range_pct = (high - low) / low if low > 0 else 0
        up_moves = sum(1 for i in range(1, len(prices)) if prices[i] > prices[i-1])
        dc = up_moves / (len(prices) - 1)
        if range_pct > 0.004 and (dc > 0.6 or dc < 0.4): return 2
        elif range_pct > 0.002: return 1
        else: return 0
    
    def get_vol_score(self, candles: list) -> int:
        if not candles or len(candles) < 10: return 0
        prices = [c.get("close", c.get("c", 0)) for c in candles[-10:]]
        returns = []
        for i in range(1, len(prices)):
            if prices[i-1] > 0:
                returns.append(abs(prices[i] - prices[i-1]) / prices[i-1])
        if not returns: return 0
        vol = sum(returns) / len(returns)
        if vol > 0.002: return 2
        elif vol > 0.001: return 1
        else: return 0
    
    def get_trend_direction(self, candles: list) -> str:
        if not candles or len(candles) < 2: return "LONG"
        first = candles[0].get("close", candles[0].get("c", 0))
        last = candles[-1].get("close", candles[-1].get("c", 0))
        return "LONG" if last >= first else "SHORT"
    
    def should_enter(self, signal: V37Signal, candles: list) -> V37Decision:
        self.stats["signals_checked"] += 1
        score = 0
        breakdown = {"regime": 0, "volatility": 0, "signal": 0, "direction": 0, "volume": 0, "price_change": 0}
        
        regime_score = self.get_regime_score(candles)
        breakdown["regime"] = regime_score
        score += regime_score
        
        vol_score = self.get_vol_score(candles)
        breakdown["volatility"] = vol_score
        score += vol_score
        
        if signal.score >= 65: breakdown["signal"] = 1; score += 1
        trend = self.get_trend_direction(candles)
        if signal.direction == trend: breakdown["direction"] = 1; score += 1
        if signal.volume_ratio > 1.1: breakdown["volume"] = 1; score += 1
        if abs(signal.price_change) > 0.001: breakdown["price_change"] = 1; score += 1
        
        print(f"[V3.7 SCORE] total={score} | regime={regime_score} vol={vol_score}", flush=True)
        
        if score not in self.stats["score_distribution"]: self.stats["score_distribution"][score] = 0
        self.stats["score_distribution"][score] += 1
        
        should_enter = score >= self.ENTRY_THRESHOLD
        if should_enter: self.stats["signals_passed"] += 1
        
        return V37Decision(
            should_enter=should_enter, entry_score=score,
            reason=f"SCORE_{'PASSED' if should_enter else 'LOW'}: {score}",
            regime_score=regime_score, vol_score=vol_score, trend_direction=trend,
            params={"max_hold_sec": 90}, breakdown=breakdown
        )
    
    def check_exit(self, position: Dict, current_price: float, candles: list) -> Optional[str]:
        """V3.7 Exit 检查（核心改变）"""
        entry_price = position.get("entry_price", 0)
        entry_time = position.get("entry_time", 0)
        if entry_price <= 0: return None
        
        pnl = (current_price - entry_price) / entry_price
        if position.get("direction") == "SHORT": pnl = -pnl
        hold_time = time.time() - entry_time
        
        # 1. STOP LOSS
        if pnl <= self.STOP_LOSS: return "STOP_LOSS"
        
        # 2. Trailing Stop（核心）
        peak = position.get("peak_price", entry_price)
        if current_price > peak:
            position["peak_price"] = current_price
            return None
        drawdown = (current_price - peak) / peak if peak > 0 else 0
        if drawdown < self.TRAILING_PCT: return "TRAILING_STOP"
        
        # 3. TIME_EXIT
        if hold_time >= self.TIME_EXIT: return "TIME_EXIT"
        
        return None
    
    def get_stats(self) -> Dict:
        total = self.stats["signals_checked"]
        passed = self.stats["signals_passed"]
        return {**self.stats, "pass_rate": (passed / total * 100) if total > 0 else 0}


_v37_strategy = None
def get_v37_strategy() -> V37Strategy:
    global _v37_strategy
    if _v37_strategy is None: _v37_strategy = V37Strategy()
    return _v37_strategy