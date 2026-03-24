#!/usr/bin/env python3
"""
自适应交易引擎 (Adaptive Trading Engine)

核心组件：整合市场状态检测、策略库、风险管理、参数优化
实现自适应策略选择和动态参数调整
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import json
import warnings
from datetime import datetime

warnings.filterwarnings('ignore')

# 导入本地模块
from market_state_detector import MarketStateDetector, MarketState, StateDetection
from strategy_pool import (
    StrategyPool, BaseStrategy, TradeSignal, SignalType,
    StrategyType, StrategyPerformance
)


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


@dataclass
class PositionInfo:
    """仓位信息"""
    symbol: str
    side: str  # 'long' or 'short'
    size: float
    entry_price: float
    current_price: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    strategy_name: str
    open_time: int
    unrealized_pnl: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            'symbol': self.symbol,
            'side': self.side,
            'size': self.size,
            'entry_price': self.entry_price,
            'current_price': self.current_price,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'strategy_name': self.strategy_name,
            'open_time': self.open_time,
            'unrealized_pnl': self.unrealized_pnl
        }


@dataclass
class RiskMetrics:
    """风险指标"""
    total_exposure: float         # 总风险暴露
    long_exposure: float          # 多头暴露
    short_exposure: float         # 空头暴露
    net_exposure: float           # 净暴露
    portfolio_volatility: float   # 组合波动率
    var_95: float                 # 95% VaR
    expected_shortfall: float     # 预期亏损
    max_position_size: float      # 最大仓位限制
    correlation_avg: float        # 平均相关性
    liquidity_score: float        # 流动性评分
    
    def to_dict(self) -> Dict:
        return {
            'total_exposure': self.total_exposure,
            'long_exposure': self.long_exposure,
            'short_exposure': self.short_exposure,
            'net_exposure': self.net_exposure,
            'portfolio_volatility': self.portfolio_volatility,
            'var_95': self.var_95,
            'expected_shortfall': self.expected_shortfall,
            'max_position_size': self.max_position_size,
            'correlation_avg': self.correlation_avg,
            'liquidity_score': self.liquidity_score
        }


@dataclass
class AdaptiveDecision:
    """自适应决策"""
    action: str                   # 'open', 'close', 'adjust', 'wait'
    strategy_name: str
    signal: Optional[TradeSignal]
    position_size: float          # 仓位大小 (0-1)
    risk_level: RiskLevel
    confidence: float
    reasoning: str
    market_state: MarketState
    alternative_strategies: List[str]
    
    def to_dict(self) -> Dict:
        return {
            'action': self.action,
            'strategy_name': self.strategy_name,
            'signal': self.signal.to_dict() if self.signal else None,
            'position_size': self.position_size,
            'risk_level': self.risk_level.value,
            'confidence': self.confidence,
            'reasoning': self.reasoning,
            'market_state': self.market_state.value,
            'alternative_strategies': self.alternative_strategies
        }


@dataclass
class EngineState:
    """引擎状态"""
    timestamp: int
    market_state: MarketState
    active_strategy: str
    positions: List[PositionInfo]
    risk_metrics: RiskMetrics
    daily_pnl: float
    consecutive_losses: int
    circuit_breaker_status: str  # 'normal', 'reduce', 'stop'
    
    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp,
            'market_state': self.market_state.value,
            'active_strategy': self.active_strategy,
            'positions': [p.to_dict() for p in self.positions],
            'risk_metrics': self.risk_metrics.to_dict(),
            'daily_pnl': self.daily_pnl,
            'consecutive_losses': self.consecutive_losses,
            'circuit_breaker_status': self.circuit_breaker_status
        }


class RiskManager:
    """
    风险管理器
    
    负责仓位管理、风险控制、熔断机制
    """
    
    def __init__(
        self,
        max_total_exposure: float = 1.0,
        max_single_position: float = 0.3,
        max_daily_loss: float = 0.05,
        volatility_threshold: float = 3.0,
        correlation_threshold: float = 0.7
    ):
        """
        初始化风险管理器
        
        Args:
            max_total_exposure: 最大总风险暴露 (相对于资本)
            max_single_position: 最大单一仓位
            max_daily_loss: 最大日亏损 (触发熔断)
            volatility_threshold: 波动率异常阈值 (倍数)
            correlation_threshold: 相关性阈值
        """
        self.max_total_exposure = max_total_exposure
        self.max_single_position = max_single_position
        self.max_daily_loss = max_daily_loss
        self.volatility_threshold = volatility_threshold
        self.correlation_threshold = correlation_threshold
        
        self.benchmark_volatility = 0.02  # 基准波动率 2%
        self.normal_volatility = 0.02
        self.daily_start_capital = 100000.0
        self.current_capital = 100000.0
        self.positions: List[PositionInfo] = []
        self.trade_log: List[Dict] = []
        
        # 熔断状态
        self.circuit_breaker = 'normal'  # 'normal', 'reduce', 'stop'
        self.consecutive_losses = 0
    
    def calculate_position_size(
        self,
        signal: TradeSignal,
        current_volatility: float,
        strategy_confidence: float
    ) -> float:
        """
        计算仓位大小
        
        基于波动率、策略置信度动态调整
        """
        # 基础仓位
        base_position = 0.2  # 20% 基础仓位
        
        # 波动率调整
        vol_ratio = self.benchmark_volatility / max(current_volatility, 0.001)
        vol_adjusted = base_position * vol_ratio
        
        # 置信度调整
        confidence_adjusted = vol_adjusted * strategy_confidence
        
        # 限制在合理范围
        position_size = np.clip(confidence_adjusted, 0.05, self.max_single_position)
        
        return position_size
    
    def adjust_for_correlation(
        self,
        position_size: float,
        correlation_matrix: np.ndarray
    ) -> float:
        """根据相关性调整仓位"""
        if correlation_matrix.size == 0:
            return position_size
        
        avg_correlation = np.mean(np.abs(correlation_matrix))
        
        if avg_correlation > self.correlation_threshold:
            reduction = (avg_correlation - self.correlation_threshold) / (1 - self.correlation_threshold)
            adjusted = position_size * (1 - reduction * 0.5)
            return max(adjusted, position_size * 0.5)
        
        return position_size
    
    def check_circuit_breaker(
        self,
        current_volatility: float,
        daily_pnl: float
    ) -> str:
        """
        检查熔断机制
        
        Returns:
            'normal', 'reduce', or 'stop'
        """
        # 日亏损检查
        if daily_pnl < -self.max_daily_loss:
            return 'stop'
        
        # 波动率异常检查
        if current_volatility > self.volatility_threshold * self.normal_volatility:
            return 'reduce'
        
        # 连续亏损检查
        if self.consecutive_losses >= 5:
            return 'stop'
        
        return 'normal'
    
    def update_positions(
        self,
        signal: TradeSignal,
        position_size: float,
        current_price: float
    ):
        """更新仓位"""
        if signal.signal_type == SignalType.CLOSE:
            # 平仓
            for i, pos in enumerate(self.positions):
                if pos.strategy_name == signal.strategy_name:
                    # 计算盈亏
                    if pos.side == 'long':
                        pnl = (current_price - pos.entry_price) / pos.entry_price
                    else:
                        pnl = (pos.entry_price - current_price) / pos.entry_price
                    
                    self.current_capital *= (1 + pnl)
                    self.trade_log.append({
                        'type': 'close',
                        'strategy': signal.strategy_name,
                        'pnl': pnl,
                        'timestamp': signal.timestamp
                    })
                    
                    if pnl < 0:
                        self.consecutive_losses += 1
                    else:
                        self.consecutive_losses = 0
                    
                    self.positions.pop(i)
                    break
        
        elif signal.signal_type in [SignalType.LONG, SignalType.SHORT]:
            # 开仓
            side = 'long' if signal.signal_type == SignalType.LONG else 'short'
            position = PositionInfo(
                symbol='BTC',  # 简化：假设单品种
                side=side,
                size=position_size,
                entry_price=current_price,
                current_price=current_price,
                stop_loss=signal.stop_loss,
                take_profit=signal.take_profit,
                strategy_name=signal.strategy_name,
                open_time=signal.timestamp
            )
            self.positions.append(position)
            
            self.trade_log.append({
                'type': 'open',
                'strategy': signal.strategy_name,
                'side': side,
                'size': position_size,
                'timestamp': signal.timestamp
            })
    
    def calculate_risk_metrics(
        self,
        returns: np.ndarray,
        correlation_matrix: Optional[np.ndarray] = None
    ) -> RiskMetrics:
        """计算风险指标"""
        # 总暴露
        total_exposure = sum(p.size for p in self.positions)
        long_exposure = sum(p.size for p in self.positions if p.side == 'long')
        short_exposure = sum(p.size for p in self.positions if p.side == 'short')
        net_exposure = long_exposure - short_exposure
        
        # 组合波动率
        portfolio_vol = np.std(returns) * np.sqrt(365 * 24) if len(returns) > 1 else 0
        
        # VaR (历史模拟法)
        var_95 = np.percentile(returns, 5) if len(returns) > 0 else 0
        
        # 预期亏损 (ES)
        es_returns = returns[returns <= var_95] if len(returns) > 0 else np.array([0])
        expected_shortfall = np.mean(es_returns) if len(es_returns) > 0 else 0
        
        # 相关性
        avg_corr = np.mean(np.abs(correlation_matrix)) if correlation_matrix is not None and correlation_matrix.size > 0 else 0
        
        # 流动性评分 (简化：基于成交量)
        liquidity_score = 1.0  # 默认满分
        
        return RiskMetrics(
            total_exposure=total_exposure,
            long_exposure=long_exposure,
            short_exposure=short_exposure,
            net_exposure=net_exposure,
            portfolio_volatility=portfolio_vol,
            var_95=var_95,
            expected_shortfall=expected_shortfall,
            max_position_size=self.max_single_position,
            correlation_avg=avg_corr,
            liquidity_score=liquidity_score
        )
    
    def reset_daily(self):
        """重置日度统计"""
        self.daily_start_capital = self.current_capital
        self.consecutive_losses = 0
        if self.circuit_breaker == 'stop':
            self.circuit_breaker = 'normal'


class ParameterOptimizer:
    """
    参数优化器
    
    实现滚动窗口优化、贝叶斯优化、遗传算法
    """
    
    def __init__(self, optimization_window: int = 60, reoptimize_frequency: int = 24):
        """
        初始化优化器
        
        Args:
            optimization_window: 优化窗口长度 (小时)
            reoptimize_frequency: 重新优化频率 (小时)
        """
        self.optimization_window = optimization_window
        self.reoptimize_frequency = reoptimize_frequency
        self.last_optimization = 0
        self.parameter_history: Dict[str, List[Dict]] = {}
        self.performance_cache: Dict[str, float] = {}
    
    def rolling_window_optimize(
        self,
        strategy: BaseStrategy,
        df: pd.DataFrame,
        param_grid: Dict[str, List]
    ) -> Dict[str, Any]:
        """
        滚动窗口参数优化
        
        Args:
            strategy: 策略实例
            df: 历史数据
            param_grid: 参数网格
            
        Returns:
            最优参数
        """
        n = len(df)
        if n < self.optimization_window:
            return {}
        
        # 使用最近 N 期数据优化
        optimization_df = df.iloc[-self.optimization_window:]
        
        best_params = {}
        best_performance = -np.inf
        
        # 网格搜索
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        def grid_search(idx, current_params):
            nonlocal best_params, best_performance
            
            if idx == len(param_names):
                # 评估当前参数组合
                # 简化：使用 Sharpe 作为目标
                score = self._evaluate_params(strategy, optimization_df, current_params)
                if score > best_performance:
                    best_performance = score
                    best_params = current_params.copy()
                return
            
            for value in param_values[idx]:
                current_params[param_names[idx]] = value
                grid_search(idx + 1, current_params)
        
        grid_search(0, {})
        
        # 参数平滑
        if strategy.name in self.parameter_history:
            history = self.parameter_history[strategy.name]
            if len(history) > 0:
                avg_params = {}
                for key in best_params:
                    historical_values = [h.get(key, best_params[key]) for h in history[-5:]]
                    avg_params[key] = 0.7 * best_params[key] + 0.3 * np.mean(historical_values)
                best_params = avg_params
        
        # 记录历史
        if strategy.name not in self.parameter_history:
            self.parameter_history[strategy.name] = []
        self.parameter_history[strategy.name].append(best_params)
        
        return best_params
    
    def _evaluate_params(
        self,
        strategy: BaseStrategy,
        df: pd.DataFrame,
        params: Dict
    ) -> float:
        """评估参数组合的性能"""
        # 简化评估：返回 Sharpe 比率
        # 实际实现应该回测策略
        
        # 临时设置参数
        original_params = {}
        for key, value in params.items():
            if hasattr(strategy, key):
                original_params[key] = getattr(strategy, key)
                setattr(strategy, key, value)
        
        # 生成信号并计算性能
        signals = []
        for i in range(20, len(df)):
            chunk = df.iloc[:i+1]
            signal = strategy.generate_signal(chunk)
            if signal:
                signals.append(signal)
        
        # 恢复参数
        for key, value in original_params.items():
            setattr(strategy, key, value)
        
        # 简化评分
        if len(signals) == 0:
            return 0
        
        return len(signals) * 0.1  # 简化评分
    
    def bayesian_optimization(
        self,
        objective: Callable,
        param_bounds: Dict[str, Tuple],
        n_iterations: int = 20
    ) -> Dict[str, Any]:
        """
        贝叶斯优化
        
        Args:
            objective: 目标函数 (越大越好)
            param_bounds: 参数边界 {param_name: (min, max)}
            n_iterations: 迭代次数
            
        Returns:
            最优参数
        """
        # 简化实现：随机搜索 + 精英保留
        best_params = {}
        best_score = -np.inf
        
        for i in range(n_iterations):
            # 采样参数
            current_params = {
                name: np.uniform(low, high)
                for name, (low, high) in param_bounds.items()
            }
            
            # 评估
            score = objective(current_params)
            
            if score > best_score:
                best_score = score
                best_params = current_params.copy()
        
        return best_params
    
    def should_reoptimize(self, current_timestamp: int) -> bool:
        """判断是否应该重新优化"""
        return current_timestamp - self.last_optimization >= self.reoptimize_frequency
    
    def update_optimization_time(self, timestamp: int):
        """更新优化时间"""
        self.last_optimization = timestamp


class AdaptiveEngine:
    """
    自适应交易引擎
    
    核心组件：
    - 市场状态检测
    - 策略库管理
    - 风险管理
    - 参数优化
    - 性能监控
    """
    
    def __init__(
        self,
        initial_capital: float = 100000.0,
        max_drawdown: float = 0.15,
        target_sharpe: float = 1.5
    ):
        """
        初始化自适应引擎
        
        Args:
            initial_capital: 初始资本
            max_drawdown: 最大回撤限制
            target_sharpe: 目标 Sharpe 比率
        """
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.max_drawdown = max_drawdown
        self.target_sharpe = target_sharpe
        
        # 核心组件
        self.market_detector = MarketStateDetector()
        self.strategy_pool = StrategyPool()
        self.risk_manager = RiskManager()
        self.param_optimizer = ParameterOptimizer()
        
        # 状态跟踪
        self.active_strategy: Optional[str] = None
        self.strategy_weights: Dict[str, float] = {}
        self.performance_history: List[Dict] = []
        self.state_history: List[EngineState] = []
        
        # 强化学习选择器 (简化版)
        self.rl_selector = SimpleRLSelector()
        
        # 初始化权重
        for name in self.strategy_pool.strategies:
            self.strategy_weights[name] = 1.0 / len(self.strategy_pool.strategies)
    
    def select_strategy(
        self,
        market_state: MarketState,
        performance: Dict[str, StrategyPerformance]
    ) -> Tuple[str, float]:
        """
        选择最优策略
        
        Args:
            market_state: 当前市场状态
            performance: 策略性能
            
        Returns:
            (策略名称，权重)
        """
        # 基于规则初选
        if market_state == MarketState.TRENDING:
            candidates = self.strategy_pool.get_strategies_by_type(StrategyType.TREND)
        elif market_state == MarketState.RANGING:
            candidates = self.strategy_pool.get_strategies_by_type(StrategyType.RANGE)
        elif market_state == MarketState.BREAKOUT:
            candidates = self.strategy_pool.get_strategies_by_type(StrategyType.BREAKOUT)
        else:  # EXTREME
            candidates = self.strategy_pool.get_strategies_by_type(StrategyType.HEDGE)
        
        if not candidates:
            candidates = list(self.strategy_pool.strategies.keys())
        
        # 基于性能重排序
        candidate_scores = {}
        for name in candidates:
            if name in performance:
                # 综合评分：Sharpe + 近期表现
                perf = performance[name]
                score = (
                    0.4 * perf.sharpe_ratio +
                    0.3 * perf.rolling_sharpe_20 +
                    0.2 * perf.win_rate +
                    0.1 * perf.profit_loss_ratio
                )
                candidate_scores[name] = score
            else:
                candidate_scores[name] = 0
        
        # 使用强化学习选择器
        best_strategy = self.rl_selector.select(
            candidates=candidates,
            scores=candidate_scores,
            market_state=market_state.value
        )
        
        # 计算权重 (Softmax)
        temperature = 2.0
        exp_scores = {
            name: np.exp(score * temperature)
            for name, score in candidate_scores.items()
        }
        total = sum(exp_scores.values())
        weights = {name: score / total for name, score in exp_scores.items()}
        
        return best_strategy, weights.get(best_strategy, 0.5)
    
    def make_decision(
        self,
        df: pd.DataFrame,
        current_timestamp: int
    ) -> AdaptiveDecision:
        """
        做出交易决策
        
        Args:
            df: 市场数据
            current_timestamp: 当前时间戳
            
        Returns:
            AdaptiveDecision 对象
        """
        # 1. 检测市场状态
        detection = self.market_detector.detect(df)
        market_state = detection.state
        
        # 2. 评估策略性能
        performance = self.strategy_pool.evaluate_performance()
        
        # 3. 选择策略
        active_strategy, weight = self.select_strategy(market_state, performance)
        self.active_strategy = active_strategy
        
        # 4. 生成信号
        signals = self.strategy_pool.generate_signals(df)
        selected_signal = signals.get(active_strategy)
        
        # 5. 风险管理
        current_vol = detection.features.volatility
        circuit_status = self.risk_manager.check_circuit_breaker(
            current_vol,
            self.risk_manager.current_capital / self.risk_manager.daily_start_capital - 1
        )
        
        # 6. 计算仓位
        if selected_signal and circuit_status != 'stop':
            position_size = self.risk_manager.calculate_position_size(
                selected_signal,
                current_vol,
                detection.confidence
            )
            position_size *= weight  # 策略权重调整
        else:
            position_size = 0
        
        # 7. 确定动作
        if circuit_status == 'stop':
            action = 'close'
            reasoning = f"熔断触发：{circuit_status}"
        elif position_size > 0 and selected_signal:
            action = 'open' if self.risk_manager.positions == [] else 'adjust'
            reasoning = f"市场状态：{market_state.value}, 策略：{active_strategy}, 置信度：{detection.confidence:.2f}"
        else:
            action = 'wait'
            reasoning = f"等待机会，市场状态：{market_state.value}"
        
        # 8. 获取备选策略
        all_scores = {name: perf.sharpe_ratio for name, perf in performance.items()}
        alternative_strategies = sorted(all_scores.keys(), key=lambda x: all_scores[x], reverse=True)[1:4]
        
        # 9. 确定风险等级
        if current_vol > 0.1:
            risk_level = RiskLevel.EXTREME
        elif current_vol > 0.05:
            risk_level = RiskLevel.HIGH
        elif current_vol > 0.02:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW
        
        decision = AdaptiveDecision(
            action=action,
            strategy_name=active_strategy,
            signal=selected_signal,
            position_size=position_size,
            risk_level=risk_level,
            confidence=detection.confidence,
            reasoning=reasoning,
            market_state=market_state,
            alternative_strategies=alternative_strategies
        )
        
        # 10. 执行决策
        self._execute_decision(decision, df, current_timestamp)
        
        return decision
    
    def _execute_decision(
        self,
        decision: AdaptiveDecision,
        df: pd.DataFrame,
        timestamp: int
    ):
        """执行决策"""
        current_price = df['close'].values[-1]
        
        if decision.action == 'open' and decision.signal:
            self.risk_manager.update_positions(
                decision.signal,
                decision.position_size,
                current_price
            )
            self.strategy_pool.update_strategies({decision.strategy_name: decision.signal})
        
        elif decision.action == 'close':
            # 平掉所有仓位
            for pos in self.risk_manager.positions.copy():
                close_signal = TradeSignal(
                    signal_type=SignalType.CLOSE,
                    price=current_price,
                    timestamp=timestamp,
                    strategy_name=pos.strategy_name
                )
                self.risk_manager.update_positions(close_signal, 0, current_price)
        
        # 更新仓位市值
        for pos in self.risk_manager.positions:
            pos.current_price = current_price
            if pos.side == 'long':
                pos.unrealized_pnl = (current_price - pos.entry_price) / pos.entry_price
            else:
                pos.unrealized_pnl = (pos.entry_price - current_price) / pos.entry_price
    
    def run_backtest(
        self,
        df: pd.DataFrame,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        运行回测
        
        Args:
            df: 历史数据
            verbose: 是否打印详细信息
            
        Returns:
            回测结果
        """
        if verbose:
            print("=" * 60)
            print("自适应策略回测")
            print("=" * 60)
        
        # 初始化
        self.risk_manager.current_capital = self.initial_capital
        self.risk_manager.daily_start_capital = self.initial_capital
        self.strategy_pool.reset_all()
        
        equity_curve = [self.initial_capital]
        decisions_log = []
        
        # 滚动回测
        window = 100  # 需要至少 100 期数据
        step = 10     # 每 10 期决策一次
        
        for i in range(window, len(df), step):
            chunk = df.iloc[:i+1]
            timestamp = i
            
            # 做出决策
            decision = self.make_decision(chunk, timestamp)
            decisions_log.append(decision.to_dict())
            
            # 更新资本
            self.current_capital = self.risk_manager.current_capital
            equity_curve.append(self.current_capital)
            
            # 定期重新优化参数
            if self.param_optimizer.should_reoptimize(timestamp):
                self._optimize_parameters(chunk)
                self.param_optimizer.update_optimization_time(timestamp)
            
            if verbose and i % 100 == 0:
                print(f"时间 {i}: 资本={self.current_capital:.2f}, 状态={decision.market_state.value}, 策略={decision.strategy_name}")
        
        # 计算回测指标
        returns = np.diff(equity_curve) / equity_curve[:-1]
        total_return = equity_curve[-1] / self.initial_capital - 1
        annual_return = (1 + total_return) ** (365 * 24 / len(returns)) - 1 if len(returns) > 0 else 0
        volatility = np.std(returns) * np.sqrt(365 * 24) if len(returns) > 1 else 0
        sharpe = annual_return / volatility if volatility > 0 else 0
        
        # 最大回撤
        equity = np.array(equity_curve)
        peak = np.maximum.accumulate(equity)
        drawdown = (peak - equity) / peak
        max_drawdown = np.max(drawdown)
        
        results = {
            'total_return': total_return,
            'annual_return': annual_return,
            'volatility': volatility,
            'sharpe_ratio': sharpe,
            'max_drawdown': max_drawdown,
            'calmar_ratio': annual_return / max_drawdown if max_drawdown > 0 else 0,
            'final_capital': equity_curve[-1],
            'total_trades': len(self.risk_manager.trade_log),
            'equity_curve': equity_curve,
            'decisions_log': decisions_log
        }
        
        if verbose:
            print("\n" + "=" * 60)
            print("回测结果")
            print("=" * 60)
            print(f"总收益率：{total_return:.2%}")
            print(f"年化收益率：{annual_return:.2%}")
            print(f"年化波动率：{volatility:.2%}")
            print(f"Sharpe 比率：{sharpe:.2f}")
            print(f"最大回撤：{max_drawdown:.2%}")
            print(f"卡尔玛比率：{annual_return / max_drawdown if max_drawdown > 0 else 0:.2f}")
            print(f"最终资本：${equity_curve[-1]:.2f}")
            print(f"总交易数：{len(self.risk_manager.trade_log)}")
            print("=" * 60)
        
        return results
    
    def _optimize_parameters(self, df: pd.DataFrame):
        """优化策略参数"""
        # 对每个策略进行参数优化
        for name, strategy in self.strategy_pool.strategies.items():
            if hasattr(strategy, 'fast_period'):
                param_grid = {
                    'fast_period': [8, 12, 16],
                    'slow_period': [20, 26, 32]
                }
                best_params = self.param_optimizer.rolling_window_optimize(
                    strategy, df, param_grid
                )
                if best_params:
                    for key, value in best_params.items():
                        setattr(strategy, key, value)
    
    def get_current_state(self) -> EngineState:
        """获取当前引擎状态"""
        risk_metrics = self.risk_manager.calculate_risk_metrics(
            np.array([t.get('pnl', 0) for t in self.risk_manager.trade_log])
        )
        
        daily_pnl = self.risk_manager.current_capital / self.risk_manager.daily_start_capital - 1
        
        return EngineState(
            timestamp=len(self.state_history),
            market_state=self.market_detector.previous_state or MarketState.UNKNOWN,
            active_strategy=self.active_strategy or 'none',
            positions=self.risk_manager.positions,
            risk_metrics=risk_metrics,
            daily_pnl=daily_pnl,
            consecutive_losses=self.risk_manager.consecutive_losses,
            circuit_breaker_status=self.risk_manager.circuit_breaker
        )
    
    def export_state(self, filepath: str):
        """导出状态到 JSON"""
        state = self.get_current_state()
        with open(filepath, 'w') as f:
            json.dump(state.to_dict(), f, indent=2)
    
    def reset(self):
        """重置引擎"""
        self.current_capital = self.initial_capital
        self.risk_manager.reset_daily()
        self.strategy_pool.reset_all()
        self.active_strategy = None
        self.state_history = []


class SimpleRLSelector:
    """
    简化版强化学习选择器
    
    使用 Thompson Sampling 进行策略选择
    """
    
    def __init__(self):
        # 每个策略的成功/失败计数
        self.success_counts: Dict[str, float] = {}
        self.failure_counts: Dict[str, float] = {}
    
    def select(
        self,
        candidates: List[str],
        scores: Dict[str, float],
        market_state: str
    ) -> str:
        """
        选择策略
        
        使用 Thompson Sampling + 性能评分
        """
        if not candidates:
            return ''
        
        # 初始化计数
        for name in candidates:
            if name not in self.success_counts:
                self.success_counts[name] = 1.0
                self.failure_counts[name] = 1.0
        
        # Thompson Sampling
        sampled_scores = {}
        for name in candidates:
            # 从 Beta 分布采样
            alpha = self.success_counts[name]
            beta = self.failure_counts[name]
            sampled = np.random.beta(alpha, beta)
            
            # 结合性能评分
            base_score = scores.get(name, 0)
            sampled_scores[name] = 0.5 * sampled + 0.5 * (base_score / max(1, max(scores.values())))
        
        # 选择最高分
        return max(sampled_scores.keys(), key=lambda x: sampled_scores[x])
    
    def update(self, strategy_name: str, success: bool):
        """更新策略计数"""
        if strategy_name in self.success_counts:
            if success:
                self.success_counts[strategy_name] += 1
            else:
                self.failure_counts[strategy_name] += 1


def create_test_data(n_periods: int = 2000) -> pd.DataFrame:
    """创建测试数据"""
    np.random.seed(42)
    
    # 模拟真实市场：混合多种状态
    returns = np.random.normal(0.0005, 0.02, n_periods)
    
    # 添加趋势阶段
    returns[200:500] += 0.002  # 上涨趋势
    returns[800:1100] -= 0.002  # 下跌趋势
    
    # 添加震荡阶段
    returns[500:800] = np.random.normal(0, 0.015, 300)
    returns[1400:1700] = np.random.normal(0, 0.015, 300)
    
    # 添加突破
    returns[600] *= 5
    returns[1200] *= -5
    
    # 添加极端事件
    returns[1500] *= 8
    
    close = 100 * np.exp(np.cumsum(returns))
    
    data = []
    for i in range(n_periods):
        c = close[i]
        range_pct = abs(returns[i]) + 0.01
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
    # 测试自适应引擎
    print("=" * 60)
    print("自适应交易引擎测试")
    print("=" * 60)
    
    # 创建测试数据
    df = create_test_data(n_periods=2000)
    print(f"\n测试数据：{len(df)} 期")
    
    # 初始化引擎
    engine = AdaptiveEngine(
        initial_capital=100000,
        max_drawdown=0.15,
        target_sharpe=1.5
    )
    
    # 运行回测
    results = engine.run_backtest(df, verbose=True)
    
    # 导出状态
    engine.export_state('engine_state.json')
    print("\n状态已导出到 engine_state.json")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
