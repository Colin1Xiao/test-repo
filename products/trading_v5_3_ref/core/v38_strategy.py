#!/usr/bin/env python3
"""
V3.8 策略 - 动态 Trailing 优化版

核心改变（只改 Exit）：
- 动态 Trailing：根据盈利阶段调整
- 盈利越多 → trailing 越宽

阶段：
- 初期 (pnl < 0.15%): trailing = 0.15%
- 中期 (0.15%~0.30%): trailing = 0.20%
- 强趋势 (> 0.30%): trailing = 0.30%
"""

from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import time


@dataclass
class V38Signal:
    score: float
    direction: str
    volume_ratio: float
    price_change: float
    timestamp: datetime = None
    def __post_init__(self):
        if self.timestamp is None: self.timestamp = datetime.now()


@dataclass
class V38Decision:
    should_enter: bool
    entry_score: int
    reason: str
    regime_score: int
    vol_score: int
    trend_direction: str
    params: Dict
    breakdown: Dict


class V38Strategy:
    """V3.8 动态 Trailing 策略"""
    
    ENTRY_THRESHOLD = 4
    STOP_LOSS = -0.0007
    TIME_EXIT = 90
    
    # 动态 Trailing 阶段
    TRAILING_STAGES = [
        (0.0015, 0.0015),  # pnl < 0.15% → trailing 0.15%
        (0.003, 0.0020),   # 0.15%~0.30% → trailing 0.20%
        (float('inf'), 0.0030)  # > 0.30% → trailing 0.30%
    ]
    
    def __init__(self):
        self.stats = {
            "signals_checked": 0, "signals_passed": 0, "score_distribution": {},
            "trailing_stages": {"conservative": 0, "moderate": 0, "aggressive": 0}
        }
        print("🎯 V3.8 动态 Trailing 初始化完成")
        print("   Exit 改变：动态 trailing (0.15%/0.20%/0.30%)")
    
    def get_regime_score(self, candles: list) -> int:
        if not candles or len(candles) < 20: return 0
        prices = [c.get("close", c.get("c", 0)) for c in candles[-20:]]
        high, low = max(prices), min(prices)
        range_pct = (high - low) / low if low > 0 else 0
        up_moves = sum(1 for i in range(1, len(prices)) if prices[i] > prices[i-1])
        dc = up_moves / (len(prices) - 1)
        if range_pct > 0.004 and (dc > 0.6 or dc < 0.4): return 2
        elif range_pct > 0.002: return 1
        return 0
    
    def get_vol_score(self, candles: list) -> int:
        if not candles or len(candles) < 10: return 0
        prices = [c.get("close", c.get("c", 0)) for c in candles[-10:]]
        returns = [abs(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices)) if prices[i-1] > 0]
        if not returns: return 0
        vol = sum(returns) / len(returns)
        if vol > 0.002: return 2
        elif vol > 0.001: return 1
        return 0
    
    def get_trend_direction(self, candles: list) -> str:
        if not candles or len(candles) < 2: return "LONG"
        first = candles[0].get("close", candles[0].get("c", 0))
        last = candles[-1].get("close", candles[-1].get("c", 0))
        return "LONG" if last >= first else "SHORT"
    
    def should_enter(self, signal: V38Signal, candles: list) -> V38Decision:
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
        
        print(f"[V3.8 SCORE] total={score}", flush=True)
        
        if score not in self.stats["score_distribution"]: self.stats["score_distribution"][score] = 0
        self.stats["score_distribution"][score] += 1
        
        should_enter = score >= self.ENTRY_THRESHOLD
        if should_enter: self.stats["signals_passed"] += 1
        
        return V38Decision(
            should_enter=should_enter, entry_score=score,
            reason=f"SCORE_{'PASSED' if should_enter else 'LOW'}: {score}",
            regime_score=regime_score, vol_score=vol_score, trend_direction=trend,
            params={"max_hold_sec": 90}, breakdown=breakdown
        )
    
    def check_exit(self, position: Dict, current_price: float, candles: list) -> Optional[str]:
        """V3.8 Exit（动态 Trailing）"""
        entry_price = position.get("entry_price", 0)
        entry_time = position.get("entry_time", 0)
        if entry_price <= 0: return None
        
        pnl = (current_price - entry_price) / entry_price
        if position.get("direction") == "SHORT": pnl = -pnl
        hold_time = time.time() - entry_time
        
        # 1. STOP LOSS
        if pnl <= self.STOP_LOSS: return "STOP_LOSS"
        
        # 2. 动态 Trailing
        peak = position.get("peak_price", entry_price)
        if current_price > peak:
            position["peak_price"] = current_price
            return None
        
        drawdown = (current_price - peak) / peak if peak > 0 else 0
        
        # 选择 trailing 阈值
        for threshold, trailing in self.TRAILING_STAGES:
            if pnl < threshold:
                current_trailing = trailing
                break
        
        if current_trailing == 0.0015:
            self.stats["trailing_stages"]["conservative"] += 1
        elif current_trailing == 0.0020:
            self.stats["trailing_stages"]["moderate"] += 1
        else:
            self.stats["trailing_stages"]["aggressive"] += 1
        
        if drawdown < -current_trailing: return "TRAILING_STOP"
        
        # 3. TIME_EXIT
        if hold_time >= self.TIME_EXIT: return "TIME_EXIT"
        
        return None
    
    def get_stats(self) -> Dict:
        total = self.stats["signals_checked"]
        passed = self.stats["signals_passed"]
        return {**self.stats, "pass_rate": (passed / total * 100) if total > 0 else 0}


_v38_strategy = None
def get_v38_strategy() -> V38Strategy:
    global _v38_strategy
    if _v38_strategy is None: _v38_strategy = V38Strategy()
    return _v38_strategy