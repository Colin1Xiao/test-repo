#!/usr/bin/env python3
"""
1%波动捕捉策略 - 高胜率短线交易
1% Volatility Capture Strategy - High Win Rate Short-term Trading
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class VolatilitySignal:
    """波动信号"""
    symbol: str
    direction: str       # 'long', 'short', 'none'
    entry_price: float
    target_price: float  # 1%目标
    stop_price: float    # 0.5%止损
    confidence: float    # 置信度 0-1
    timeframe: str       # '1m', '5m', '15m'


class Strategy1Percent:
    """1%波动捕捉策略"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {
            'target_pct': 0.01,        # 1%盈利目标
            'stop_pct': 0.005,         # 0.5%止损
            'min_volatility': 0.008,   # 最小波动率
            'max_volatility': 0.03,    # 最大波动率
            'leverage': 50,            # 50倍杠杆
            'min_confidence': 0.65,    # 最小置信度
            'max_daily_trades': 20,    # 每日最大交易数
            'cooldown_minutes': 5      # 冷却时间
        }
        self.daily_trades = 0
        self.last_trade_time = None
        self.trade_history = []
        self.win_count = 0
        self.loss_count = 0
    
    def analyze(self, symbol: str, data: Dict) -> VolatilitySignal:
        """分析市场数据生成信号"""
        prices = data.get('prices', [])
        volumes = data.get('volumes', [])
        
        if len(prices) < 20:
            return self._null_signal(symbol)
        
        current_price = prices[-1]
        
        # 检查冷却时间
        if not self._check_cooldown():
            return self._null_signal(symbol)
        
        # 检查每日交易限制
        if self.daily_trades >= self.config['max_daily_trades']:
            return self._null_signal(symbol)
        
        # 计算技术指标
        volatility = self._calculate_volatility(prices)
        trend = self._calculate_trend(prices)
        momentum = self._calculate_momentum(prices)
        volume_signal = self._analyze_volume(volumes)
        
        # 检查波动率范围
        if not (self.config['min_volatility'] <= volatility <= self.config['max_volatility']):
            return self._null_signal(symbol)
        
        # 生成信号
        direction, confidence = self._generate_signal(
            trend, momentum, volume_signal, volatility
        )
        
        if direction == 'none' or confidence < self.config['min_confidence']:
            return self._null_signal(symbol)
        
        # 计算入场和出场价格
        entry, target, stop = self._calculate_prices(direction, current_price)
        
        return VolatilitySignal(
            symbol=symbol,
            direction=direction,
            entry_price=entry,
            target_price=target,
            stop_price=stop,
            confidence=confidence,
            timeframe='5m'
        )
    
    def _calculate_volatility(self, prices: List[float]) -> float:
        """计算波动率"""
        if len(prices) < 2:
            return 0
        
        returns = [(prices[i] - prices[i-1]) / prices[i-1] 
                   for i in range(1, min(len(prices), 21))]
        
        if not returns:
            return 0
        
        avg_return = sum(returns) / len(returns)
        variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
        
        return variance ** 0.5
    
    def _calculate_trend(self, prices: List[float]) -> str:
        """计算趋势"""
        if len(prices) < 20:
            return 'neutral'
        
        sma5 = sum(prices[-5:]) / 5
        sma10 = sum(prices[-10:]) / 10
        sma20 = sum(prices[-20:]) / 20
        
        current = prices[-1]
        
        if current > sma5 > sma10 > sma20:
            return 'strong_bull'
        elif current > sma5 > sma10:
            return 'bull'
        elif current < sma5 < sma10 < sma20:
            return 'strong_bear'
        elif current < sma5 < sma10:
            return 'bear'
        else:
            return 'neutral'
    
    def _calculate_momentum(self, prices: List[float]) -> float:
        """计算动量"""
        if len(prices) < 10:
            return 0
        
        # RSI简化版
        gains = []
        losses = []
        
        for i in range(len(prices) - 10, len(prices)):
            change = prices[i] - prices[i-1]
            if change > 0:
                gains.append(change)
            else:
                losses.append(abs(change))
        
        avg_gain = sum(gains) / 10 if gains else 0
        avg_loss = sum(losses) / 10 if losses else 0
        
        if avg_loss == 0:
            return 1.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        # 归一化到 -1 到 1
        return (rsi - 50) / 50
    
    def _analyze_volume(self, volumes: List[float]) -> str:
        """分析成交量"""
        if len(volumes) < 20:
            return 'normal'
        
        avg_volume = sum(volumes[-20:]) / 20
        current_volume = volumes[-1]
        
        ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        if ratio > 2.0:
            return 'very_high'
        elif ratio > 1.5:
            return 'high'
        elif ratio < 0.5:
            return 'low'
        else:
            return 'normal'
    
    def _generate_signal(self, trend: str, momentum: float, 
                        volume: str, volatility: float) -> Tuple[str, float]:
        """生成交易信号"""
        long_score = 0.0
        short_score = 0.0
        
        # 趋势得分
        if trend in ['strong_bull', 'bull']:
            long_score += 0.3
        elif trend in ['strong_bear', 'bear']:
            short_score += 0.3
        
        # 动量得分
        if momentum > 0.2:
            long_score += 0.25
        elif momentum < -0.2:
            short_score += 0.25
        
        # 成交量得分
        if volume in ['high', 'very_high']:
            long_score += 0.2
            short_score += 0.2
        
        # 波动率得分（适中最好）
        if 0.01 <= volatility <= 0.02:
            long_score += 0.25
            short_score += 0.25
        
        # 确定方向
        if long_score > short_score and long_score >= self.config['min_confidence']:
            return 'long', long_score
        elif short_score > long_score and short_score >= self.config['min_confidence']:
            return 'short', short_score
        
        return 'none', 0.0
    
    def _calculate_prices(self, direction: str, current_price: float) -> Tuple[float, float, float]:
        """计算价格"""
        target_pct = self.config['target_pct']
        stop_pct = self.config['stop_pct']
        
        if direction == 'long':
            entry = current_price
            target = entry * (1 + target_pct)
            stop = entry * (1 - stop_pct)
        else:  # short
            entry = current_price
            target = entry * (1 - target_pct)
            stop = entry * (1 + stop_pct)
        
        return entry, target, stop
    
    def _check_cooldown(self) -> bool:
        """检查冷却时间"""
        if self.last_trade_time is None:
            return True
        
        cooldown = timedelta(minutes=self.config['cooldown_minutes'])
        return datetime.now() - self.last_trade_time >= cooldown
    
    def _null_signal(self, symbol: str) -> VolatilitySignal:
        """返回空信号"""
        return VolatilitySignal(
            symbol=symbol,
            direction='none',
            entry_price=0,
            target_price=0,
            stop_price=0,
            confidence=0,
            timeframe='5m'
        )
    
    def record_trade(self, signal: VolatilitySignal, result: str, pnl: float):
        """记录交易结果"""
        self.trade_history.append({
            'timestamp': datetime.now().isoformat(),
            'symbol': signal.symbol,
            'direction': signal.direction,
            'entry': signal.entry_price,
            'target': signal.target_price,
            'stop': signal.stop_price,
            'result': result,
            'pnl': pnl
        })
        
        self.daily_trades += 1
        self.last_trade_time = datetime.now()
        
        if result == 'win':
            self.win_count += 1
        elif result == 'loss':
            self.loss_count += 1
    
    def get_stats(self) -> Dict:
        """获取策略统计"""
        total = self.win_count + self.loss_count
        
        return {
            'total_trades': total,
            'win_count': self.win_count,
            'loss_count': self.loss_count,
            'win_rate': self.win_count / total if total > 0 else 0,
            'daily_trades': self.daily_trades,
            'max_daily_trades': self.config['max_daily_trades'],
            'recent_trades': self.trade_history[-10:]
        }
    
    def reset_daily(self):
        """重置每日计数"""
        self.daily_trades = 0


# 便捷函数
def create_1pct_strategy(leverage: int = 50) -> Strategy1Percent:
    """创建1%策略实例"""
    config = {
        'target_pct': 0.01,
        'stop_pct': 0.005,
        'leverage': leverage,
        'min_confidence': 0.65
    }
    return Strategy1Percent(config)