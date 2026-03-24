#!/usr/bin/env python3
"""
双向交易策略 - 同时做多和做空
Bidirectional Trading Strategy - Long and Short Simultaneously
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class MarketState:
    """市场状态"""
    trend: str           # 'bull', 'bear', 'neutral'
    volatility: float    # 波动率
    volume_ratio: float  # 量比
    support: float       # 支撑位
    resistance: float    # 阻力位


@dataclass
class Signal:
    """交易信号"""
    symbol: str
    direction: str       # 'long', 'short', 'both', 'none'
    strength: float      # 0-1
    entry_price: float
    stop_loss: float
    take_profit: float
    reason: str


class BidirectionalStrategy:
    """双向交易策略"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {
            'long_weight': 0.5,
            'short_weight': 0.5,
            'min_strength': 0.6,
            'hedge_ratio': 0.5,      # 对冲比例
            'max_spread': 0.02       # 最大价差
        }
        self.positions = {'long': {}, 'short': {}}
        self.signals_history = []
    
    def analyze(self, symbol: str, data: Dict) -> Signal:
        """分析市场并生成信号"""
        # 计算市场状态
        state = self._calculate_market_state(data)
        
        # 生成多空信号
        long_signal = self._calculate_long_signal(state, data)
        short_signal = self._calculate_short_signal(state, data)
        
        # 确定交易方向
        direction, strength = self._determine_direction(
            long_signal, short_signal, state
        )
        
        # 计算入场和出场价格
        entry, stop, profit = self._calculate_prices(
            direction, data, state
        )
        
        signal = Signal(
            symbol=symbol,
            direction=direction,
            strength=strength,
            entry_price=entry,
            stop_loss=stop,
            take_profit=profit,
            reason=self._generate_reason(state, long_signal, short_signal)
        )
        
        self.signals_history.append({
            'timestamp': datetime.now().isoformat(),
            'signal': signal.__dict__
        })
        
        return signal
    
    def _calculate_market_state(self, data: Dict) -> MarketState:
        """计算市场状态"""
        prices = data.get('prices', [])
        volumes = data.get('volumes', [])
        
        if len(prices) < 20:
            return MarketState('neutral', 0, 1, prices[-1] * 0.95, prices[-1] * 1.05)
        
        # 计算趋势
        sma20 = sum(prices[-20:]) / 20
        sma50 = sum(prices[-50:]) / 50 if len(prices) >= 50 else sma20
        
        if prices[-1] > sma20 > sma50:
            trend = 'bull'
        elif prices[-1] < sma20 < sma50:
            trend = 'bear'
        else:
            trend = 'neutral'
        
        # 计算波动率
        returns = [(prices[i] - prices[i-1]) / prices[i-1] 
                   for i in range(1, len(prices))]
        volatility = (sum(r**2 for r in returns) / len(returns)) ** 0.5
        
        # 计算量比
        avg_volume = sum(volumes[-20:]) / 20 if volumes else 1
        current_volume = volumes[-1] if volumes else avg_volume
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        # 计算支撑阻力位
        support = min(prices[-20:])
        resistance = max(prices[-20:])
        
        return MarketState(trend, volatility, volume_ratio, support, resistance)
    
    def _calculate_long_signal(self, state: MarketState, data: Dict) -> float:
        """计算做多信号强度"""
        score = 0.0
        
        # 趋势得分
        if state.trend == 'bull':
            score += 0.4
        elif state.trend == 'neutral':
            score += 0.2
        
        # 波动率得分（适中最好）
        if 0.01 <= state.volatility <= 0.05:
            score += 0.2
        
        # 成交量得分
        if state.volume_ratio > 1.5:
            score += 0.2
        
        # 价格位置得分
        current_price = data.get('prices', [0])[-1]
        if current_price <= state.support * 1.02:
            score += 0.2
        
        return min(score, 1.0)
    
    def _calculate_short_signal(self, state: MarketState, data: Dict) -> float:
        """计算做空信号强度"""
        score = 0.0
        
        # 趋势得分
        if state.trend == 'bear':
            score += 0.4
        elif state.trend == 'neutral':
            score += 0.2
        
        # 波动率得分
        if 0.01 <= state.volatility <= 0.05:
            score += 0.2
        
        # 成交量得分
        if state.volume_ratio > 1.5:
            score += 0.2
        
        # 价格位置得分
        current_price = data.get('prices', [0])[-1]
        if current_price >= state.resistance * 0.98:
            score += 0.2
        
        return min(score, 1.0)
    
    def _determine_direction(self, long_score: float, short_score: float, 
                            state: MarketState) -> Tuple[str, float]:
        """确定交易方向"""
        min_strength = self.config['min_strength']
        
        # 强多空信号
        if long_score >= min_strength and short_score >= min_strength:
            # 双向交易（对冲）
            if state.volatility > 0.03:
                return 'both', (long_score + short_score) / 2
        
        if long_score >= min_strength and long_score > short_score + 0.2:
            return 'long', long_score
        
        if short_score >= min_strength and short_score > long_score + 0.2:
            return 'short', short_score
        
        return 'none', 0.0
    
    def _calculate_prices(self, direction: str, data: Dict, 
                         state: MarketState) -> Tuple[float, float, float]:
        """计算入场、止损、止盈价格"""
        current_price = data.get('prices', [0])[-1]
        
        if direction == 'long':
            entry = current_price
            stop = state.support * 0.99
            profit = state.resistance * 0.98
        elif direction == 'short':
            entry = current_price
            stop = state.resistance * 1.01
            profit = state.support * 1.02
        elif direction == 'both':
            entry = current_price
            stop = entry * 0.95  # 双向时更宽的止损
            profit = entry * 1.05
        else:
            entry = stop = profit = current_price
        
        return entry, stop, profit
    
    def _generate_reason(self, state: MarketState, long_score: float, 
                        short_score: float) -> str:
        """生成信号原因"""
        reasons = []
        
        reasons.append(f"趋势: {state.trend}")
        reasons.append(f"波动率: {state.volatility:.2%}")
        reasons.append(f"量比: {state.volume_ratio:.2f}")
        reasons.append(f"做多得分: {long_score:.2f}")
        reasons.append(f"做空得分: {short_score:.2f}")
        
        return " | ".join(reasons)
    
    def should_enter(self, signal: Signal) -> bool:
        """是否应该入场"""
        return signal.direction != 'none' and signal.strength >= self.config['min_strength']
    
    def calculate_position_size(self, signal: Signal, 
                               total_capital: float) -> Dict[str, float]:
        """计算仓位大小"""
        if signal.direction == 'none':
            return {}
        
        base_size = total_capital * 0.1 * signal.strength  # 10%基础仓位
        
        if signal.direction == 'both':
            hedge_ratio = self.config['hedge_ratio']
            return {
                'long': base_size * hedge_ratio,
                'short': base_size * hedge_ratio
            }
        else:
            return {signal.direction: base_size}
    
    def get_performance(self) -> Dict:
        """获取策略表现"""
        return {
            'total_signals': len(self.signals_history),
            'config': self.config,
            'recent_signals': self.signals_history[-10:]
        }


# 便捷函数
def create_bidirectional_strategy() -> BidirectionalStrategy:
    """创建双向策略实例"""
    return BidirectionalStrategy()