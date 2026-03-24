#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
宏观经济事件驱动交易策略
========================

基于宏观事件影响评分系统的自动化交易策略

作者：小龙 🐉
版本：1.0
日期：2026-03-11

使用方法:
    python event_driven_strategy.py --backtest
    python event_driven_strategy.py --live --symbol BTC/USDT
"""

import json
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import asyncio

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# 枚举和常量
# =============================================================================

class EventType(Enum):
    """事件类型定义"""
    FED_RATE = "美联储利率决议"
    CPI = "CPI 数据"
    NFP = "非农就业数据"
    GDP = "GDP 数据"
    RETAIL = "零售销售数据"
    GEOPOLITICAL = "地缘政治事件"
    REGULATORY = "监管事件"
    CRYPTO_EVENT = "加密货币特有事件"
    FINANCIAL_CRISIS = "金融危机"
    OTHER = "其他"


class RiskLevel(Enum):
    """风险等级"""
    GREEN = "绿色"      # 0-3
    YELLOW = "黄色"     # 3-7
    ORANGE = "橙色"     # 7-12
    RED = "红色"        # 12+


class SentimentState(Enum):
    """市场情绪状态"""
    EXTREME_FEAR = "极度恐惧"    # 0-10
    FEAR = "恐惧"               # 11-25
    NEUTRAL_FEAR = "中性偏恐"    # 26-45
    NEUTRAL = "中性"            # 46-55
    GREED = "贪婪"              # 56-75
    EXTREME_GREED = "极度贪婪"   # 76-100


class PositionDirection(Enum):
    """仓位方向"""
    LONG = "做多"
    SHORT = "做空"
    FLAT = "空仓"


# =============================================================================
# 数据类
# =============================================================================

@dataclass
class EconomicEvent:
    """经济事件数据类"""
    event_id: str
    event_type: EventType
    event_name: str
    event_date: datetime
    expected_value: Optional[float]
    actual_value: Optional[float] = None
    country: str = "US"
    impact_scope: float = 1.0  # 影响范围系数
    is_released: bool = False
    
    def get_base_weight(self) -> float:
        """获取事件基础权重"""
        weights = {
            EventType.FED_RATE: 5.0,
            EventType.CPI: 4.0,
            EventType.NFP: 3.5,
            EventType.GDP: 3.0,
            EventType.RETAIL: 2.5,
            EventType.GEOPOLITICAL: 4.0,
            EventType.REGULATORY: 3.0,
            EventType.CRYPTO_EVENT: 2.5,
            EventType.FINANCIAL_CRISIS: 4.5,
            EventType.OTHER: 2.0,
        }
        return weights.get(self.event_type, 2.0)
    
    def calculate_surprise(self) -> Optional[float]:
        """计算预期差百分比"""
        if self.actual_value is None or self.expected_value is None:
            return None
        if self.expected_value == 0:
            return None
        return (self.actual_value - self.expected_value) / abs(self.expected_value) * 100
    
    def get_surprise_factor(self) -> float:
        """获取预期差系数"""
        surprise = self.calculate_surprise()
        if surprise is None:
            return 1.0
        
        surprise_abs = abs(surprise)
        if surprise_abs > 2.0:
            return 2.5
        elif surprise_abs > 1.0:
            return 1.5
        elif surprise_abs > 0.5:
            return 1.0
        else:
            return 0.5


@dataclass
class ImpactScore:
    """事件影响评分"""
    event: EconomicEvent
    base_weight: float
    scope_multiplier: float
    sentiment_multiplier: float
    surprise_factor: float
    total_score: float
    risk_level: RiskLevel
    
    @classmethod
    def calculate(cls, event: EconomicEvent, sentiment_index: float) -> 'ImpactScore':
        """计算事件影响分数"""
        base_weight = event.get_base_weight()
        scope_multiplier = event.impact_scope
        sentiment_multiplier = cls._get_sentiment_multiplier(sentiment_index)
        surprise_factor = event.get_surprise_factor()
        
        total_score = base_weight * scope_multiplier * sentiment_multiplier * surprise_factor
        
        # 确定风险等级
        if total_score < 3:
            risk_level = RiskLevel.GREEN
        elif total_score < 7:
            risk_level = RiskLevel.YELLOW
        elif total_score < 12:
            risk_level = RiskLevel.ORANGE
        else:
            risk_level = RiskLevel.RED
        
        return cls(
            event=event,
            base_weight=base_weight,
            scope_multiplier=scope_multiplier,
            sentiment_multiplier=sentiment_multiplier,
            surprise_factor=surprise_factor,
            total_score=total_score,
            risk_level=risk_level
        )
    
    @staticmethod
    def _get_sentiment_multiplier(sentiment_index: float) -> float:
        """
        根据恐惧贪婪指数获取情绪系数
        
        参数:
            sentiment_index: 0-100, 0=极度恐惧，100=极度贪婪
        
        返回:
            情绪系数 (0.5-1.5)
        """
        if sentiment_index <= 10:
            return 1.5  # 极度恐惧 - 利空放大
        elif sentiment_index <= 25:
            return 1.3  # 恐惧
        elif sentiment_index <= 45:
            return 1.1  # 中性偏恐
        elif sentiment_index <= 55:
            return 1.0  # 中性
        elif sentiment_index <= 75:
            return 0.7  # 贪婪 - 利好钝化
        else:
            return 0.5  # 极度贪婪 - 利好大幅钝化
    
    def get_state(self) -> str:
        """获取情绪状态描述"""
        sentiment = self.sentiment_multiplier
        if sentiment >= 1.5:
            return SentimentState.EXTREME_FEAR.value
        elif sentiment >= 1.3:
            return SentimentState.FEAR.value
        elif sentiment >= 1.1:
            return SentimentState.NEUTRAL_FEAR.value
        elif sentiment >= 1.0:
            return SentimentState.NEUTRAL.value
        elif sentiment >= 0.7:
            return SentimentState.GREED.value
        else:
            return SentimentState.EXTREME_GREED.value


@dataclass
class TradingSignal:
    """交易信号"""
    signal_id: str
    event: EconomicEvent
    impact_score: ImpactScore
    direction: PositionDirection
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    position_size_pct: float = 0.0
    confidence: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)
    status: str = "pending"  # pending, active, closed, cancelled
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            'signal_id': self.signal_id,
            'event_type': self.event.event_type.value,
            'event_name': self.event.event_name,
            'impact_score': self.impact_score.total_score,
            'risk_level': self.impact_score.risk_level.value,
            'direction': self.direction.value,
            'entry_price': self.entry_price,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'position_size_pct': self.position_size_pct,
            'confidence': self.confidence,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status
        }


@dataclass
class RiskConfig:
    """风险配置"""
    max_position_pct: float = 1.0      # 最大仓位百分比
    max_leverage: int = 10             # 最大杠杆
    risk_per_trade: float = 0.02       # 单笔风险 (2%)
    max_daily_loss: float = 0.05       # 日最大亏损 (5%)
    max_weekly_loss: float = 0.10      # 周最大亏损 (10%)
    
    def get_max_position(self, risk_level: RiskLevel) -> float:
        """根据风险等级获取最大仓位"""
        limits = {
            RiskLevel.GREEN: 1.0,
            RiskLevel.YELLOW: 0.7,
            RiskLevel.ORANGE: 0.4,
            RiskLevel.RED: 0.2,
        }
        return self.max_position_pct * limits.get(risk_level, 0.5)
    
    def get_max_leverage(self, risk_level: RiskLevel) -> int:
        """根据风险等级获取最大杠杆"""
        limits = {
            RiskLevel.GREEN: 10,
            RiskLevel.YELLOW: 5,
            RiskLevel.ORANGE: 3,
            RiskLevel.RED: 2,
        }
        return min(self.max_leverage, limits.get(risk_level, 5))
    
    def get_stop_loss_pct(self, risk_level: RiskLevel) -> float:
        """根据风险等级获取止损百分比"""
        stops = {
            RiskLevel.GREEN: 0.05,      # 5%
            RiskLevel.YELLOW: 0.03,     # 3%
            RiskLevel.ORANGE: 0.02,     # 2%
            RiskLevel.RED: 0.01,        # 1%
        }
        return stops.get(risk_level, 0.03)


# =============================================================================
# 核心策略类
# =============================================================================

class EventDrivenStrategy:
    """
    事件驱动交易策略主类
    
    功能:
    1. 计算事件影响分数
    2. 生成交易信号
    3. 风险管理
    4. 回测支持
    """
    
    def __init__(self, risk_config: Optional[RiskConfig] = None):
        self.risk_config = risk_config or RiskConfig()
        self.signals: List[TradingSignal] = []
        self.positions: List[dict] = []
        self.pnl_history: List[float] = []
        
        # 事件数据库
        self.event_database: List[dict] = []
    
    def calculate_impact_score(
        self, 
        event: EconomicEvent, 
        sentiment_index: float
    ) -> ImpactScore:
        """
        计算事件影响分数
        
        参数:
            event: 经济事件
            sentiment_index: 恐惧贪婪指数 (0-100)
        
        返回:
            ImpactScore 对象
        """
        return ImpactScore.calculate(event, sentiment_index)
    
    def generate_signal(
        self,
        event: EconomicEvent,
        sentiment_index: float,
        current_price: float,
        price_trend: Optional[str] = None
    ) -> Optional[TradingSignal]:
        """
        生成交易信号
        
        参数:
            event: 经济事件
            sentiment_index: 恐惧贪婪指数
            current_price: 当前价格
            price_trend: 价格趋势 ('up', 'down', 'neutral')
        
        返回:
            TradingSignal 或 None
        """
        # 计算影响分数
        impact_score = self.calculate_impact_score(event, sentiment_index)
        
        # 高风险事件不建议开新仓
        if impact_score.risk_level == RiskLevel.RED:
            logger.warning(f"红色风险事件，不建议开新仓：{event.event_name}")
            return None
        
        # 确定方向
        surprise = event.calculate_surprise()
        if surprise is None:
            # 未发布，不生成信号
            return None
        
        # 根据事件类型和超预期方向判断
        direction = self._determine_direction(event, surprise, price_trend)
        
        if direction == PositionDirection.FLAT:
            return None
        
        # 计算仓位大小
        position_pct = self._calculate_position_size(impact_score)
        
        # 计算止损止盈
        stop_loss_pct = self.risk_config.get_stop_loss_pct(impact_score.risk_level)
        stop_loss = self._calculate_stop_loss(current_price, direction, stop_loss_pct)
        take_profit = self._calculate_take_profit(current_price, direction, stop_loss_pct)
        
        # 计算置信度
        confidence = self._calculate_confidence(impact_score, surprise, price_trend)
        
        # 创建信号
        signal = TradingSignal(
            signal_id=f"SIG_{event.event_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            event=event,
            impact_score=impact_score,
            direction=direction,
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            position_size_pct=position_pct,
            confidence=confidence
        )
        
        self.signals.append(signal)
        logger.info(f"生成交易信号：{signal.signal_id}, 方向={direction.value}, "
                   f"影响分数={impact_score.total_score:.2f}, 置信度={confidence:.2f}")
        
        return signal
    
    def _determine_direction(
        self, 
        event: EconomicEvent, 
        surprise: float,
        price_trend: Optional[str]
    ) -> PositionDirection:
        """
        根据事件和超预期确定交易方向
        
        逻辑:
        - 通胀数据 (CPI) 超预期 → 利空 BTC (加息预期)
        - 就业数据 (NFP) 超预期 → 利空 BTC (经济过热)
        - 利率决议加息 → 利空 BTC
        - 利率决议降息 → 利多 BTC
        - 地缘政治风险 → 利多 BTC (避险)
        """
        event_type = event.event_type
        
        # 定义利空超预期的事件类型
        negative_surprise_events = {
            EventType.CPI,
            EventType.NFP,
            EventType.RETAIL,
        }
        
        if event_type in negative_surprise_events:
            # 超预期 → 利空 → 做空
            if surprise > 0.5:
                return PositionDirection.SHORT
            elif surprise < -0.5:
                return PositionDirection.LONG
            else:
                return PositionDirection.FLAT
        
        elif event_type == EventType.FED_RATE:
            # 利率上调 → 利空
            if surprise > 0:
                return PositionDirection.SHORT
            elif surprise < 0:
                return PositionDirection.LONG
            else:
                return PositionDirection.FLAT
        
        elif event_type == EventType.GEOPOLITICAL:
            # 地缘政治风险 → 利多 (避险)
            if surprise > 0:  # 局势恶化
                return PositionDirection.LONG
            else:
                return PositionDirection.FLAT
        
        elif event_type == EventType.REGULATORY:
            # 监管事件需要具体分析
            # 这里简化：超预期严厉 → 利空
            if surprise > 0:
                return PositionDirection.SHORT
            elif surprise < 0:
                return PositionDirection.LONG
            else:
                return PositionDirection.FLAT
        
        # 默认结合价格趋势
        if price_trend == 'up':
            return PositionDirection.LONG
        elif price_trend == 'down':
            return PositionDirection.SHORT
        else:
            return PositionDirection.FLAT
    
    def _calculate_position_size(self, impact_score: ImpactScore) -> float:
        """计算建议仓位百分比"""
        max_position = self.risk_config.get_max_position(impact_score.risk_level)
        
        # 根据影响分数调整
        # 影响分数越高，仓位越小
        position_factor = max(0.2, 1 - impact_score.total_score / 20)
        
        return max_position * position_factor
    
    def _calculate_stop_loss(
        self, 
        price: float, 
        direction: PositionDirection, 
        stop_loss_pct: float
    ) -> float:
        """计算止损价格"""
        if direction == PositionDirection.LONG:
            return price * (1 - stop_loss_pct)
        else:
            return price * (1 + stop_loss_pct)
    
    def _calculate_take_profit(
        self, 
        price: float, 
        direction: PositionDirection, 
        stop_loss_pct: float
    ) -> float:
        """计算止盈价格 (风险回报比 2:1)"""
        risk_reward_ratio = 2.0
        if direction == PositionDirection.LONG:
            return price * (1 + stop_loss_pct * risk_reward_ratio)
        else:
            return price * (1 - stop_loss_pct * risk_reward_ratio)
    
    def _calculate_confidence(
        self, 
        impact_score: ImpactScore, 
        surprise: float,
        price_trend: Optional[str]
    ) -> float:
        """
        计算信号置信度 (0-1)
        
        考虑因素:
        - 影响分数 (权重越高越可信)
        - 预期差大小 (越大越可信)
        - 趋势一致性 (与价格趋势一致更可信)
        """
        # 基础置信度来自影响分数
        base_confidence = min(1.0, impact_score.total_score / 15)
        
        # 预期差调整
        surprise_factor = min(1.0, abs(surprise) / 3)
        
        # 趋势一致性调整
        trend_factor = 1.0
        if price_trend:
            trend_factor = 1.2 if self._is_trend_aligned(impact_score, price_trend) else 0.8
        
        confidence = base_confidence * (0.5 + 0.5 * surprise_factor) * trend_factor
        return min(1.0, max(0.0, confidence))
    
    def _is_trend_aligned(self, impact_score: ImpactScore, trend: str) -> bool:
        """判断趋势是否与信号方向一致"""
        # 简化实现
        return True
    
    def record_event_outcome(
        self,
        event: EconomicEvent,
        price_before: float,
        price_1h: float,
        price_24h: float,
        volume_change: float
    ):
        """记录事件结果到数据库"""
        record = {
            'event_id': event.event_id,
            'event_type': event.event_type.value,
            'event_name': event.event_name,
            'event_date': event.event_date.isoformat(),
            'expected_value': event.expected_value,
            'actual_value': event.actual_value,
            'surprise_pct': event.calculate_surprise(),
            'price_before': price_before,
            'price_1h': price_1h,
            'price_24h': price_24h,
            'price_change_1h_pct': (price_1h - price_before) / price_before * 100,
            'price_change_24h_pct': (price_24h - price_before) / price_before * 100,
            'volume_change_pct': volume_change,
            'recorded_at': datetime.now().isoformat()
        }
        
        self.event_database.append(record)
        logger.info(f"记录事件结果：{event.event_name}, 1h 变化={record['price_change_1h_pct']:.2f}%")
    
    def export_event_database(self, filepath: str):
        """导出事件数据库到 JSON 文件"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.event_database, f, ensure_ascii=False, indent=2)
        logger.info(f"事件数据库已导出：{filepath}")
    
    def get_statistics(self) -> dict:
        """获取策略统计信息"""
        if not self.signals:
            return {'total_signals': 0}
        
        active_signals = [s for s in self.signals if s.status == 'active']
        closed_signals = [s for s in self.signals if s.status == 'closed']
        
        return {
            'total_signals': len(self.signals),
            'active_signals': len(active_signals),
            'closed_signals': len(closed_signals),
            'avg_impact_score': sum(s.impact_score.total_score for s in self.signals) / len(self.signals),
            'avg_confidence': sum(s.confidence for s in self.signals) / len(self.signals),
            'events_recorded': len(self.event_database)
        }


# =============================================================================
# 回测引擎
# =============================================================================

class BacktestEngine:
    """
    策略回测引擎
    
    功能:
    1. 加载历史事件数据
    2. 模拟交易执行
    3. 计算回测绩效
    """
    
    def __init__(self, strategy: EventDrivenStrategy, initial_capital: float = 100000):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.trades: List[dict] = []
        self.equity_curve: List[float] = []
    
    def load_events(self, events: List[EconomicEvent]):
        """加载历史事件"""
        self.events = events
        logger.info(f"加载 {len(events)} 个历史事件")
    
    def run(self, sentiment_history: Dict[str, float], price_history: Dict[str, float]) -> dict:
        """
        运行回测
        
        参数:
            sentiment_history: {event_id: sentiment_index}
            price_history: {event_id: {'before': price, '1h': price, '24h': price}}
        
        返回:
            回测结果字典
        """
        logger.info("开始回测...")
        
        for event in self.events:
            sentiment = sentiment_history.get(event.event_id, 50)  # 默认中性
            prices = price_history.get(event.event_id, {})
            
            if not prices:
                continue
            
            # 生成信号
            signal = self.strategy.generate_signal(
                event=event,
                sentiment_index=sentiment,
                current_price=prices.get('before', 0),
                price_trend=None
            )
            
            if signal and signal.direction != PositionDirection.FLAT:
                # 模拟交易
                pnl = self._simulate_trade(signal, prices)
                self.trades.append({
                    'signal': signal.to_dict(),
                    'pnl': pnl,
                    'pnl_pct': pnl / self.capital * 100
                })
                
                # 更新资金
                self.capital += pnl
                self.equity_curve.append(self.capital)
        
        return self._calculate_metrics()
    
    def _simulate_trade(self, signal: TradingSignal, prices: dict) -> float:
        """模拟单笔交易"""
        entry_price = signal.entry_price
        direction = signal.direction
        
        # 使用 24 小时价格计算盈亏
        exit_price = prices.get('24h', entry_price)
        
        if direction == PositionDirection.LONG:
            pnl_pct = (exit_price - entry_price) / entry_price
        else:
            pnl_pct = (entry_price - exit_price) / entry_price
        
        # 考虑仓位大小
        position_value = self.capital * signal.position_size_pct
        pnl = position_value * pnl_pct
        
        return pnl
    
    def _calculate_metrics(self) -> dict:
        """计算回测指标"""
        if not self.trades:
            return {'total_trades': 0}
        
        total_pnl = sum(t['pnl'] for t in self.trades)
        winning_trades = [t for t in self.trades if t['pnl'] > 0]
        losing_trades = [t for t in self.trades if t['pnl'] < 0]
        
        win_rate = len(winning_trades) / len(self.trades) * 100 if self.trades else 0
        avg_win = sum(t['pnl'] for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t['pnl'] for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else float('inf')
        
        max_drawdown = self._calculate_max_drawdown()
        
        return {
            'total_trades': len(self.trades),
            'total_pnl': total_pnl,
            'total_pnl_pct': total_pnl / self.initial_capital * 100,
            'final_capital': self.capital,
            'win_rate': win_rate,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': profit_factor,
            'max_drawdown': max_drawdown,
            'max_drawdown_pct': max_drawdown / self.initial_capital * 100
        }
    
    def _calculate_max_drawdown(self) -> float:
        """计算最大回撤"""
        if not self.equity_curve:
            return 0
        
        peak = self.equity_curve[0]
        max_dd = 0
        
        for equity in self.equity_curve:
            if equity > peak:
                peak = equity
            drawdown = peak - equity
            if drawdown > max_dd:
                max_dd = drawdown
        
        return max_dd


# =============================================================================
# 示例和测试
# =============================================================================

def create_sample_events() -> List[EconomicEvent]:
    """创建示例事件用于测试"""
    events = [
        EconomicEvent(
            event_id="CPI_2026_02",
            event_type=EventType.CPI,
            event_name="美国 2 月 CPI 年率",
            event_date=datetime(2026, 3, 12, 20, 30),
            expected_value=3.0,
            actual_value=3.5,  # 超预期
            country="US"
        ),
        EconomicEvent(
            event_id="NFP_2026_03",
            event_type=EventType.NFP,
            event_name="美国 3 月非农就业",
            event_date=datetime(2026, 4, 4, 20, 30),
            expected_value=200000,
            actual_value=180000,  # 低于预期
            country="US"
        ),
        EconomicEvent(
            event_id="FOMC_2026_03",
            event_type=EventType.FED_RATE,
            event_name="美联储 3 月利率决议",
            event_date=datetime(2026, 3, 19, 6, 0),
            expected_value=5.25,
            actual_value=5.25,  # 符合预期
            country="US"
        ),
    ]
    return events


def run_demo():
    """运行演示"""
    print("=" * 60)
    print("宏观经济事件驱动交易策略 - 演示")
    print("=" * 60)
    
    # 创建策略
    strategy = EventDrivenStrategy()
    
    # 创建示例事件
    events = create_sample_events()
    
    # 模拟不同情绪环境
    test_cases = [
        (50, "中性情绪"),
        (20, "恐惧情绪"),
        (80, "贪婪情绪"),
    ]
    
    for sentiment, sentiment_name in test_cases:
        print(f"\n{'='*40}")
        print(f"测试场景：{sentiment_name} (指数={sentiment})")
        print(f"{'='*40}")
        
        for event in events:
            # 计算影响分数
            impact = strategy.calculate_impact_score(event, sentiment)
            
            print(f"\n事件：{event.event_name}")
            print(f"  基础权重：{impact.base_weight}")
            print(f"  影响范围：{impact.scope_multiplier}")
            print(f"  情绪系数：{impact.sentiment_multiplier:.2f} ({impact.get_state()})")
            print(f"  预期差系数：{impact.surprise_factor}")
            print(f"  总影响分数：{impact.total_score:.2f}")
            print(f"  风险等级：{impact.risk_level.value}")
            
            # 生成信号
            if event.actual_value is not None:
                signal = strategy.generate_signal(
                    event=event,
                    sentiment_index=sentiment,
                    current_price=65000,  # 假设 BTC 价格
                    price_trend='neutral'
                )
                
                if signal:
                    print(f"  → 生成信号：{signal.direction.value}")
                    print(f"     仓位：{signal.position_size_pct*100:.1f}%")
                    print(f"     止损：{signal.stop_loss:.2f}")
                    print(f"     止盈：{signal.take_profit:.2f}")
                    print(f"     置信度：{signal.confidence:.2f}")
    
    # 记录示例事件结果
    print(f"\n{'='*40}")
    print("记录事件结果")
    print(f"{'='*40}")
    
    strategy.record_event_outcome(
        event=events[0],
        price_before=65000,
        price_1h=64200,
        price_24h=63500,
        volume_change=45.5
    )
    
    # 导出数据库
    strategy.export_event_database('macro-research/event_database_sample.json')
    
    # 显示统计
    stats = strategy.get_statistics()
    print(f"\n策略统计：{json.dumps(stats, indent=2, ensure_ascii=False)}")
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)


def run_backtest_demo():
    """运行回测演示"""
    print("\n" + "=" * 60)
    print("回测演示")
    print("=" * 60)
    
    # 创建策略和回测引擎
    strategy = EventDrivenStrategy()
    backtest = BacktestEngine(strategy, initial_capital=100000)
    
    # 创建更多历史事件
    events = []
    for i in range(20):
        event = EconomicEvent(
            event_id=f"EVENT_{i:03d}",
            event_type=[EventType.CPI, EventType.NFP, EventType.FED_RATE][i % 3],
            event_name=f"事件 {i}",
            event_date=datetime(2025, 1, 1) + timedelta(days=i*7),
            expected_value=3.0 + (i % 3) * 0.5,
            actual_value=3.0 + (i % 3) * 0.5 + (i % 5 - 2) * 0.3,
        )
        events.append(event)
    
    # 准备回测数据
    sentiment_history = {e.event_id: 40 + (i % 3) * 20 for i, e in enumerate(events)}
    price_history = {}
    for i, e in enumerate(events):
        base_price = 50000 + i * 1000
        surprise = e.calculate_surprise() or 0
        # 简化：超预期利空→价格下跌
        price_24h = base_price * (1 - surprise * 0.01)
        price_history[e.event_id] = {
            'before': base_price,
            '1h': base_price * (1 - surprise * 0.005),
            '24h': price_24h
        }
    
    # 运行回测
    backtest.load_events(events)
    results = backtest.run(sentiment_history, price_history)
    
    # 显示结果
    print("\n回测结果:")
    print("-" * 40)
    for key, value in results.items():
        if isinstance(value, float):
            print(f"{key}: {value:.2f}")
        else:
            print(f"{key}: {value}")
    
    print("=" * 60)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--backtest':
        run_backtest_demo()
    else:
        run_demo()
