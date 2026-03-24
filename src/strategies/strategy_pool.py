#!/usr/bin/env python3
"""
策略库 (Strategy Pool)

包含多种交易策略，支持动态加载和性能评估
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import warnings

warnings.filterwarnings('ignore')


class SignalType(Enum):
    """信号类型"""
    LONG = "long"
    SHORT = "short"
    CLOSE = "close"
    HOLD = "hold"


class StrategyType(Enum):
    """策略类型"""
    TREND = "trend"          # 趋势策略
    RANGE = "range"          # 震荡策略
    BREAKOUT = "breakout"    # 突破策略
    HEDGE = "hedge"          # 对冲策略


@dataclass
class TradeSignal:
    """交易信号"""
    signal_type: SignalType
    price: float
    timestamp: int
    strategy_name: str
    confidence: float = 1.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'signal_type': self.signal_type.value,
            'price': self.price,
            'timestamp': self.timestamp,
            'strategy_name': self.strategy_name,
            'confidence': self.confidence,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'metadata': self.metadata
        }


@dataclass
class StrategyPerformance:
    """策略性能指标"""
    total_return: float           # 总收益率
    annual_return: float          # 年化收益率
    volatility: float             # 年化波动率
    sharpe_ratio: float           # Sharpe 比率
    max_drawdown: float           # 最大回撤
    calmar_ratio: float           # 卡尔玛比率
    win_rate: float               # 胜率
    profit_loss_ratio: float      # 盈亏比
    total_trades: int             # 总交易数
    winning_trades: int           # 盈利交易数
    losing_trades: int            # 亏损交易数
    avg_win: float                # 平均盈利
    avg_loss: float               # 平均亏损
    consecutive_losses: int       # 连续亏损次数
    rolling_sharpe_20: float      # 20 日滚动 Sharpe
    
    def to_dict(self) -> Dict:
        return {
            'total_return': self.total_return,
            'annual_return': self.annual_return,
            'volatility': self.volatility,
            'sharpe_ratio': self.sharpe_ratio,
            'max_drawdown': self.max_drawdown,
            'calmar_ratio': self.calmar_ratio,
            'win_rate': self.win_rate,
            'profit_loss_ratio': self.profit_loss_ratio,
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'avg_win': self.avg_win,
            'avg_loss': self.avg_loss,
            'consecutive_losses': self.consecutive_losses,
            'rolling_sharpe_20': self.rolling_sharpe_20
        }


class BaseStrategy(ABC):
    """策略基类"""
    
    def __init__(self, name: str, strategy_type: StrategyType):
        self.name = name
        self.strategy_type = strategy_type
        self.position = 0  # 当前仓位：1 多，-1 空，0 空仓
        self.entry_price = 0.0
        self.trade_history: List[Dict] = []
        self.equity_curve: List[float] = []
        self.initial_capital = 100000.0
        self.current_capital = self.initial_capital
    
    @abstractmethod
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        """生成交易信号"""
        pass
    
    def update_position(self, signal: TradeSignal):
        """更新仓位"""
        if signal.signal_type == SignalType.LONG:
            self.position = 1
            self.entry_price = signal.price
        elif signal.signal_type == SignalType.SHORT:
            self.position = -1
            self.entry_price = signal.price
        elif signal.signal_type == SignalType.CLOSE:
            # 计算盈亏
            if self.position == 1:
                pnl = (signal.price - self.entry_price) / self.entry_price
            elif self.position == -1:
                pnl = (self.entry_price - signal.price) / self.entry_price
            else:
                pnl = 0
            
            self.trade_history.append({
                'entry_price': self.entry_price,
                'exit_price': signal.price,
                'pnl': pnl,
                'timestamp': signal.timestamp
            })
            
            self.current_capital *= (1 + pnl)
            self.position = 0
            self.entry_price = 0.0
        
        self.equity_curve.append(self.current_capital)
    
    def calculate_performance(self) -> StrategyPerformance:
        """计算策略性能"""
        if len(self.trade_history) == 0:
            return StrategyPerformance(
                total_return=0, annual_return=0, volatility=0, sharpe_ratio=0,
                max_drawdown=0, calmar_ratio=0, win_rate=0, profit_loss_ratio=0,
                total_trades=0, winning_trades=0, losing_trades=0,
                avg_win=0, avg_loss=0, consecutive_losses=0, rolling_sharpe_20=0
            )
        
        # 计算收益序列
        returns = [t['pnl'] for t in self.trade_history]
        
        # 总收益
        total_return = self.current_capital / self.initial_capital - 1
        
        # 年化收益 (假设 365 天)
        n_days = max(1, self.trade_history[-1]['timestamp'] - self.trade_history[0]['timestamp']) / 24
        annual_return = (1 + total_return) ** (365 / max(1, n_days)) - 1
        
        # 波动率
        volatility = np.std(returns) * np.sqrt(365 * 24) if len(returns) > 1 else 0
        
        # Sharpe 比率 (假设无风险利率为 0)
        sharpe_ratio = annual_return / volatility if volatility > 0 else 0
        
        # 最大回撤
        equity = np.array(self.equity_curve) if len(self.equity_curve) > 0 else np.array([self.initial_capital])
        peak = np.maximum.accumulate(equity)
        drawdown = (peak - equity) / peak
        max_drawdown = np.max(drawdown) if len(drawdown) > 0 else 0
        
        # 卡尔玛比率
        calmar_ratio = annual_return / max_drawdown if max_drawdown > 0 else 0
        
        # 胜率和盈亏比
        winning_trades = [r for r in returns if r > 0]
        losing_trades = [r for r in returns if r < 0]
        
        win_rate = len(winning_trades) / len(returns) if len(returns) > 0 else 0
        avg_win = np.mean(winning_trades) if len(winning_trades) > 0 else 0
        avg_loss = abs(np.mean(losing_trades)) if len(losing_trades) > 0 else 0
        profit_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 0
        
        # 连续亏损
        consecutive_losses = 0
        current_streak = 0
        for r in reversed(returns):
            if r < 0:
                current_streak += 1
                consecutive_losses = max(consecutive_losses, current_streak)
            else:
                current_streak = 0
        
        # 滚动 Sharpe (最近 20 笔交易)
        recent_returns = returns[-20:] if len(returns) >= 20 else returns
        rolling_sharpe_20 = (np.mean(recent_returns) / np.std(recent_returns) * np.sqrt(365 * 24)) if len(recent_returns) > 1 and np.std(recent_returns) > 0 else 0
        
        return StrategyPerformance(
            total_return=total_return,
            annual_return=annual_return,
            volatility=volatility,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            calmar_ratio=calmar_ratio,
            win_rate=win_rate,
            profit_loss_ratio=profit_loss_ratio,
            total_trades=len(returns),
            winning_trades=len(winning_trades),
            losing_trades=len(losing_trades),
            avg_win=avg_win,
            avg_loss=avg_loss,
            consecutive_losses=consecutive_losses,
            rolling_sharpe_20=rolling_sharpe_20
        )
    
    def reset(self):
        """重置策略状态"""
        self.position = 0
        self.entry_price = 0.0
        self.trade_history = []
        self.equity_curve = []
        self.current_capital = self.initial_capital


# ==================== 趋势策略 ====================

class MACrossStrategy(BaseStrategy):
    """均线交叉策略"""
    
    def __init__(self, fast_period: int = 12, slow_period: int = 26):
        super().__init__("ma_cross", StrategyType.TREND)
        self.fast_period = fast_period
        self.slow_period = slow_period
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.slow_period:
            return None
        
        # 计算 EMA
        fast_ema = pd.Series(close).ewm(span=self.fast_period, adjust=False).mean().values
        slow_ema = pd.Series(close).ewm(span=self.slow_period, adjust=False).mean().values
        
        # 检测交叉
        if fast_ema[-1] > slow_ema[-1] and fast_ema[-2] <= slow_ema[-2]:
            # 金叉
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.8,
                    stop_loss=close[-1] * 0.95,
                    take_profit=close[-1] * 1.10
                )
        elif fast_ema[-1] < slow_ema[-1] and fast_ema[-2] >= slow_ema[-2]:
            # 死叉
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.8,
                    stop_loss=close[-1] * 1.05,
                    take_profit=close[-1] * 0.90
                )
        
        return None


class ChannelBreakoutStrategy(BaseStrategy):
    """通道突破策略"""
    
    def __init__(self, lookback: int = 20):
        super().__init__("channel_break", StrategyType.TREND)
        self.lookback = lookback
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        n = len(close)
        
        if n < self.lookback + 1:
            return None
        
        # 计算通道
        upper = np.max(high[-self.lookback:-1])
        lower = np.min(low[-self.lookback:-1])
        mid = (upper + lower) / 2
        
        # 突破上轨
        if close[-1] > upper and close[-2] <= upper:
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.75,
                    stop_loss=mid,
                    take_profit=upper + (upper - lower)
                )
        
        # 突破下轨
        elif close[-1] < lower and close[-2] >= lower:
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.75,
                    stop_loss=mid,
                    take_profit=lower - (upper - lower)
                )
        
        return None


class MomentumStrategy(BaseStrategy):
    """动量跟随策略"""
    
    def __init__(self, lookback: int = 10):
        super().__init__("momentum", StrategyType.TREND)
        self.lookback = lookback
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.lookback + 1:
            return None
        
        # 计算动量
        momentum = (close[-1] - close[-self.lookback]) / close[-self.lookback]
        
        # 强动量做多
        if momentum > 0.05 and self.position != 1:
            return TradeSignal(
                signal_type=SignalType.LONG,
                price=close[-1],
                timestamp=n,
                strategy_name=self.name,
                confidence=min(1.0, momentum / 0.1),
                stop_loss=close[-1] * 0.95,
                take_profit=close[-1] * 1.15
            )
        
        # 强负动量做空
        elif momentum < -0.05 and self.position != -1:
            return TradeSignal(
                signal_type=SignalType.SHORT,
                price=close[-1],
                timestamp=n,
                strategy_name=self.name,
                confidence=min(1.0, abs(momentum) / 0.1),
                stop_loss=close[-1] * 1.05,
                take_profit=close[-1] * 0.85
            )
        
        return None


# ==================== 震荡策略 ====================

class MeanReversionStrategy(BaseStrategy):
    """均值回归策略"""
    
    def __init__(self, lookback: int = 20, std_threshold: float = 2.0):
        super().__init__("mean_reversion", StrategyType.RANGE)
        self.lookback = lookback
        self.std_threshold = std_threshold
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.lookback:
            return None
        
        # 计算均值和标准差
        mean = np.mean(close[-self.lookback:])
        std = np.std(close[-self.lookback:])
        
        # 低于均值 -2σ 做多
        if close[-1] < mean - self.std_threshold * std:
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.7,
                    stop_loss=close[-1] * 0.97,
                    take_profit=mean
                )
        
        # 高于均值 +2σ 做空
        elif close[-1] > mean + self.std_threshold * std:
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.7,
                    stop_loss=close[-1] * 1.03,
                    take_profit=mean
                )
        
        return None


class BollingerStrategy(BaseStrategy):
    """布林带策略"""
    
    def __init__(self, period: int = 20, std_dev: float = 2.0):
        super().__init__("bollinger", StrategyType.RANGE)
        self.period = period
        self.std_dev = std_dev
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.period:
            return None
        
        # 计算布林带
        sma = np.mean(close[-self.period:])
        std = np.std(close[-self.period:])
        upper = sma + self.std_dev * std
        lower = sma - self.std_dev * std
        
        # 触及下轨做多
        if close[-1] <= lower and close[-2] > lower:
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.75,
                    stop_loss=lower - std,
                    take_profit=sma
                )
        
        # 触及上轨做空
        elif close[-1] >= upper and close[-2] < upper:
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.75,
                    stop_loss=upper + std,
                    take_profit=sma
                )
        
        return None


class RSIStrategy(BaseStrategy):
    """RSI 超买超卖策略"""
    
    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70):
        super().__init__("rsi", StrategyType.RANGE)
        self.period = period
        self.oversold = oversold
        self.overbought = overbought
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.period + 1:
            return None
        
        # 计算 RSI
        deltas = np.diff(close)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = pd.Series(gains).ewm(span=self.period, adjust=False).mean().values
        avg_loss = pd.Series(losses).ewm(span=self.period, adjust=False).mean().values
        
        rs = avg_gain / avg_loss if avg_loss[-1] > 0 else 100
        rsi = 100 - (100 / (1 + rs))
        
        # RSI 超卖做多
        if rsi[-1] < self.oversold and rsi[-2] >= self.oversold:
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.7,
                    stop_loss=close[-1] * 0.95,
                    take_profit=close[-1] * 1.05
                )
        
        # RSI 超买卖空
        elif rsi[-1] > self.overbought and rsi[-2] <= self.overbought:
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.7,
                    stop_loss=close[-1] * 1.05,
                    take_profit=close[-1] * 0.95
                )
        
        return None


# ==================== 突破策略 ====================

class VolatilityBreakoutStrategy(BaseStrategy):
    """波动率突破策略"""
    
    def __init__(self, atr_period: int = 14, multiplier: float = 2.0):
        super().__init__("volatility_break", StrategyType.BREAKOUT)
        self.atr_period = atr_period
        self.multiplier = multiplier
    
    def _calculate_atr(self, df: pd.DataFrame) -> float:
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        n = len(close)
        
        if n < 2:
            return 0.0
        
        tr = np.zeros(n)
        tr[0] = high[0] - low[0]
        for i in range(1, n):
            tr[i] = max(high[i] - low[i], abs(high[i] - close[i-1]), abs(low[i] - close[i-1]))
        
        if n < self.atr_period:
            return np.mean(tr)
        
        atr = np.zeros(n)
        atr[self.atr_period-1] = np.mean(tr[:self.atr_period])
        for i in range(self.atr_period, n):
            atr[i] = (atr[i-1] * (self.atr_period - 1) + tr[i]) / self.atr_period
        
        return atr[-1]
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        close = df['close'].values
        n = len(close)
        
        if n < self.atr_period + 1:
            return None
        
        atr = self._calculate_atr(df)
        prev_close = close[-2]
        
        # 向上突破
        if close[-1] > prev_close + self.multiplier * atr:
            if self.position != 1:
                return TradeSignal(
                    signal_type=SignalType.LONG,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.8,
                    stop_loss=prev_close,
                    take_profit=prev_close + 3 * atr
                )
        
        # 向下突破
        elif close[-1] < prev_close - self.multiplier * atr:
            if self.position != -1:
                return TradeSignal(
                    signal_type=SignalType.SHORT,
                    price=close[-1],
                    timestamp=n,
                    strategy_name=self.name,
                    confidence=0.8,
                    stop_loss=prev_close,
                    take_profit=prev_close - 3 * atr
                )
        
        return None


class VolumeBreakoutStrategy(BaseStrategy):
    """成交量突破策略"""
    
    def __init__(self, volume_window: int = 20, price_window: int = 20):
        super().__init__("volume_break", StrategyType.BREAKOUT)
        self.volume_window = volume_window
        self.price_window = price_window
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        if 'volume' not in df.columns:
            return None
        
        close = df['close'].values
        volume = df['volume'].values
        high = df['high'].values
        low = df['low'].values
        n = len(close)
        
        if n < max(self.volume_window, self.price_window) + 1:
            return None
        
        # 成交量比率
        avg_volume = np.mean(volume[-self.volume_window:-1])
        volume_ratio = volume[-1] / avg_volume if avg_volume > 0 else 0
        
        # 价格突破
        upper = np.max(high[-self.price_window:-1])
        lower = np.min(low[-self.price_window:-1])
        
        # 成交量放大 + 价格突破
        if volume_ratio > 3.0:
            if close[-1] > upper and close[-2] <= upper:
                if self.position != 1:
                    return TradeSignal(
                        signal_type=SignalType.LONG,
                        price=close[-1],
                        timestamp=n,
                        strategy_name=self.name,
                        confidence=min(1.0, volume_ratio / 5),
                        stop_loss=lower,
                        take_profit=upper + (upper - lower)
                    )
            
            elif close[-1] < lower and close[-2] >= lower:
                if self.position != -1:
                    return TradeSignal(
                        signal_type=SignalType.SHORT,
                        price=close[-1],
                        timestamp=n,
                        strategy_name=self.name,
                        confidence=min(1.0, volume_ratio / 5),
                        stop_loss=upper,
                        take_profit=lower - (upper - lower)
                    )
        
        return None


# ==================== 对冲策略 ====================

class HedgeStrategy(BaseStrategy):
    """对冲策略 (市场中性)"""
    
    def __init__(self):
        super().__init__("hedge", StrategyType.HEDGE)
        self.long_exposure = 0.0
        self.short_exposure = 0.0
    
    def generate_signal(self, df: pd.DataFrame) -> Optional[TradeSignal]:
        # 简化版本：在极端市场下平仓
        close = df['close'].values
        n = len(close)
        
        if n < 20:
            return None
        
        # 计算波动率
        returns = np.diff(np.log(close))
        current_vol = np.std(returns[-10:]) if len(returns) >= 10 else np.std(returns)
        avg_vol = np.std(returns)
        
        # 波动率异常时平仓
        if current_vol > 3 * avg_vol and self.position != 0:
            return TradeSignal(
                signal_type=SignalType.CLOSE,
                price=close[-1],
                timestamp=n,
                strategy_name=self.name,
                confidence=0.9
            )
        
        return None


# ==================== 策略库 ====================

class StrategyPool:
    """
    策略库管理器
    
    管理多个策略实例，提供策略选择、性能评估等功能
    """
    
    def __init__(self):
        self.strategies: Dict[str, BaseStrategy] = {}
        self.performance_history: Dict[str, List[StrategyPerformance]] = {}
        self.initialize_strategies()
    
    def initialize_strategies(self):
        """初始化所有策略"""
        # 趋势策略
        self.add_strategy(MACrossStrategy())
        self.add_strategy(ChannelBreakoutStrategy())
        self.add_strategy(MomentumStrategy())
        
        # 震荡策略
        self.add_strategy(MeanReversionStrategy())
        self.add_strategy(BollingerStrategy())
        self.add_strategy(RSIStrategy())
        
        # 突破策略
        self.add_strategy(VolatilityBreakoutStrategy())
        self.add_strategy(VolumeBreakoutStrategy())
        
        # 对冲策略
        self.add_strategy(HedgeStrategy())
    
    def add_strategy(self, strategy: BaseStrategy):
        """添加策略到策略库"""
        self.strategies[strategy.name] = strategy
        self.performance_history[strategy.name] = []
    
    def remove_strategy(self, name: str):
        """移除策略"""
        if name in self.strategies:
            del self.strategies[name]
            del self.performance_history[name]
    
    def get_strategies_by_type(self, strategy_type: StrategyType) -> List[str]:
        """根据类型获取策略名称列表"""
        return [
            name for name, strategy in self.strategies.items()
            if strategy.strategy_type == strategy_type
        ]
    
    def generate_signals(self, df: pd.DataFrame) -> Dict[str, Optional[TradeSignal]]:
        """为所有策略生成信号"""
        signals = {}
        for name, strategy in self.strategies.items():
            signals[name] = strategy.generate_signal(df)
        return signals
    
    def update_strategies(self, signals: Dict[str, TradeSignal]):
        """更新策略仓位"""
        for name, signal in signals.items():
            if signal and name in self.strategies:
                self.strategies[name].update_position(signal)
    
    def evaluate_performance(self) -> Dict[str, StrategyPerformance]:
        """评估所有策略性能"""
        performance = {}
        for name, strategy in self.strategies.items():
            perf = strategy.calculate_performance()
            performance[name] = perf
            self.performance_history[name].append(perf)
        return performance
    
    def rank_strategies(self, metric: str = 'sharpe_ratio', window: int = None) -> List[str]:
        """
        根据指标对策略排名
        
        Args:
            metric: 排名指标 ('sharpe_ratio', 'total_return', 'win_rate', etc.)
            window: 如果指定，使用最近 N 次评估的平均值
        
        Returns:
            策略名称列表 (从高到低)
        """
        if window and window > 0:
            # 使用历史性能的平均值
            scores = {}
            for name in self.strategies:
                history = self.performance_history.get(name, [])
                if len(history) >= window:
                    recent = history[-window:]
                    scores[name] = np.mean([getattr(p, metric, 0) for p in recent])
                else:
                    scores[name] = 0
        else:
            # 使用当前性能
            performance = self.evaluate_performance()
            scores = {name: getattr(perf, metric, 0) for name, perf in performance.items()}
        
        return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    
    def get_best_strategy(self, metric: str = 'sharpe_ratio') -> Optional[str]:
        """获取最佳策略"""
        ranked = self.rank_strategies(metric)
        return ranked[0] if ranked else None
    
    def reset_all(self):
        """重置所有策略"""
        for strategy in self.strategies.values():
            strategy.reset()
        self.performance_history = {name: [] for name in self.strategies}
    
    def get_strategy_info(self) -> Dict[str, Dict]:
        """获取所有策略信息"""
        info = {}
        for name, strategy in self.strategies.items():
            perf = strategy.calculate_performance()
            info[name] = {
                'name': strategy.name,
                'type': strategy.strategy_type.value,
                'position': strategy.position,
                'performance': perf.to_dict()
            }
        return info


def create_sample_data(n_periods: int = 1000) -> pd.DataFrame:
    """创建示例测试数据"""
    np.random.seed(42)
    
    # 混合市场状态
    returns = np.random.normal(0.0005, 0.02, n_periods)
    
    # 添加一些趋势
    returns[200:400] += 0.002
    returns[600:800] -= 0.002
    
    # 添加一些突破
    returns[500] *= 5
    returns[900] *= -5
    
    close = 100 * np.exp(np.cumsum(returns))
    
    data = []
    for i in range(n_periods):
        c = close[i]
        range_pct = abs(returns[i]) + 0.01
        h = c * (1 + range_pct * np.random.uniform(0.3, 0.7))
        l = c * (1 - range_pct * np.random.uniform(0.3, 0.7))
        o = l + (h - l) * np.random.uniform(0.2, 0.8)
        v = np.random.uniform(1000, 10000)
        
        data.append({
            'open': o,
            'high': h,
            'low': l,
            'close': c,
            'volume': v
        })
    
    return pd.DataFrame(data)


if __name__ == "__main__":
    # 测试策略库
    print("=" * 60)
    print("策略库测试")
    print("=" * 60)
    
    pool = StrategyPool()
    df = create_sample_data(n_periods=1000)
    
    print(f"\n初始化策略数量：{len(pool.strategies)}")
    print(f"策略列表：{list(pool.strategies.keys())}")
    
    # 模拟运行
    print("\n模拟交易运行...")
    window = 50
    for i in range(window, len(df), 10):
        chunk = df.iloc[:i+1]
        signals = pool.generate_signals(chunk)
        pool.update_strategies({k: v for k, v in signals.items() if v})
    
    # 评估性能
    print("\n策略性能评估:")
    print("-" * 60)
    performance = pool.evaluate_performance()
    
    for name, perf in performance.items():
        print(f"\n{name}:")
        print(f"  总收益：{perf.total_return:.2%}")
        print(f"  Sharpe: {perf.sharpe_ratio:.2f}")
        print(f"  最大回撤：{perf.max_drawdown:.2%}")
        print(f"  胜率：{perf.win_rate:.2%}")
        print(f"  交易次数：{perf.total_trades}")
    
    # 排名
    print("\n" + "=" * 60)
    print("策略排名 (按 Sharpe 比率):")
    print("-" * 60)
    ranked = pool.rank_strategies('sharpe_ratio')
    for i, name in enumerate(ranked, 1):
        perf = performance[name]
        print(f"{i}. {name}: Sharpe={perf.sharpe_ratio:.2f}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
