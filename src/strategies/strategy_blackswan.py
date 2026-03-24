#!/usr/bin/env python3
"""
黑天鹅防护策略 - 极端行情检测与自动清仓
Black Swan Protection Strategy - Extreme Market Detection & Auto Liquidation
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class AlertLevel(Enum):
    """警报等级"""
    GREEN = "green"      # 正常
    YELLOW = "yellow"    # 注意
    ORANGE = "orange"    # 警告
    RED = "red"          # 危险 - 清仓
    BLACK = "black"      # 黑天鹅 - 紧急清仓


@dataclass
class MarketCondition:
    """市场状况"""
    symbol: str
    price_change_5m: float
    price_change_1h: float
    price_change_24h: float
    volume_spike: float
    volatility: float
    liquidation_risk: float
    alert_level: AlertLevel


class BlackSwanStrategy:
    """黑天鹅防护策略"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {
            # 价格变动阈值
            'yellow_threshold': 0.03,    # 3% - 注意
            'orange_threshold': 0.05,    # 5% - 警告
            'red_threshold': 0.08,       # 8% - 清仓
            'black_threshold': 0.15,     # 15% - 黑天鹅
            
            # 时间窗口
            'short_window': 5,           # 5分钟
            'medium_window': 60,         # 1小时
            'long_window': 1440,         # 24小时
            
            # 成交量阈值
            'volume_spike_threshold': 3.0,  # 3倍平均成交量
            
            # 波动率阈值
            'volatility_threshold': 0.05,
            
            # 自动清仓设置
            'auto_liquidate': True,
            'liquidate_levels': ['red', 'black']
        }
        
        self.alert_history = []
        self.liquidation_history = []
        self.is_protection_active = True
    
    def analyze(self, symbol: str, data: Dict) -> MarketCondition:
        """分析市场状况"""
        prices = data.get('prices', [])
        volumes = data.get('volumes', [])
        
        if len(prices) < 10:
            return self._create_condition(symbol, 0, 0, 0, 1, 0, 0, AlertLevel.GREEN)
        
        # 计算价格变动
        change_5m = self._calculate_change(prices, 5)
        change_1h = self._calculate_change(prices, 60)
        change_24h = self._calculate_change(prices, 1440)
        
        # 计算成交量激增
        volume_spike = self._calculate_volume_spike(volumes)
        
        # 计算波动率
        volatility = self._calculate_volatility(prices)
        
        # 计算爆仓风险
        liquidation_risk = self._calculate_liquidation_risk(
            change_5m, change_1h, volatility, volume_spike
        )
        
        # 确定警报等级
        alert_level = self._determine_alert_level(
            change_5m, change_1h, change_24h, volume_spike, volatility
        )
        
        condition = MarketCondition(
            symbol=symbol,
            price_change_5m=change_5m,
            price_change_1h=change_1h,
            price_change_24h=change_24h,
            volume_spike=volume_spike,
            volatility=volatility,
            liquidation_risk=liquidation_risk,
            alert_level=alert_level
        )
        
        # 记录警报
        if alert_level != AlertLevel.GREEN:
            self._record_alert(condition)
        
        return condition
    
    def _calculate_change(self, prices: List[float], periods: int) -> float:
        """计算价格变动率"""
        if len(prices) < periods:
            periods = len(prices) - 1
        
        if periods < 1:
            return 0
        
        old_price = prices[-periods - 1] if len(prices) > periods else prices[0]
        current_price = prices[-1]
        
        return (current_price - old_price) / old_price
    
    def _calculate_volume_spike(self, volumes: List[float]) -> float:
        """计算成交量激增倍数"""
        if len(volumes) < 20:
            return 1.0
        
        avg_volume = sum(volumes[-20:-1]) / 19
        current_volume = volumes[-1]
        
        return current_volume / avg_volume if avg_volume > 0 else 1.0
    
    def _calculate_volatility(self, prices: List[float]) -> float:
        """计算波动率"""
        if len(prices) < 20:
            return 0
        
        returns = [(prices[i] - prices[i-1]) / prices[i-1] 
                   for i in range(len(prices) - 20, len(prices))]
        
        if not returns:
            return 0
        
        avg_return = sum(returns) / len(returns)
        variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
        
        return variance ** 0.5 * (1440 ** 0.5)  # 年化
    
    def _calculate_liquidation_risk(self, change_5m: float, change_1h: float,
                                   volatility: float, volume_spike: float) -> float:
        """计算爆仓风险"""
        risk = 0.0
        
        # 短期暴跌风险
        if abs(change_5m) > 0.05:
            risk += 0.3
        
        # 持续下跌风险
        if change_1h < -0.08:
            risk += 0.3
        
        # 高波动风险
        if volatility > 0.5:
            risk += 0.2
        
        # 成交量激增风险（可能伴随大行情）
        if volume_spike > 5:
            risk += 0.2
        
        return min(risk, 1.0)
    
    def _determine_alert_level(self, change_5m: float, change_1h: float,
                              change_24h: float, volume_spike: float,
                              volatility: float) -> AlertLevel:
        """确定警报等级"""
        # 检查黑天鹅条件
        if abs(change_5m) >= self.config['black_threshold']:
            return AlertLevel.BLACK
        
        if abs(change_1h) >= self.config['black_threshold']:
            return AlertLevel.BLACK
        
        # 检查红色警报
        if abs(change_5m) >= self.config['red_threshold']:
            return AlertLevel.RED
        
        if abs(change_1h) >= self.config['red_threshold']:
            return AlertLevel.RED
        
        # 检查橙色警报
        if abs(change_5m) >= self.config['orange_threshold']:
            return AlertLevel.ORANGE
        
        if volume_spike >= self.config['volume_spike_threshold'] and abs(change_5m) > 0.02:
            return AlertLevel.ORANGE
        
        # 检查黄色警报
        if abs(change_5m) >= self.config['yellow_threshold']:
            return AlertLevel.YELLOW
        
        if volatility >= self.config['volatility_threshold']:
            return AlertLevel.YELLOW
        
        return AlertLevel.GREEN
    
    def _create_condition(self, symbol: str, change_5m: float, change_1h: float,
                         change_24h: float, volume_spike: float, volatility: float,
                         liquidation_risk: float, alert_level: AlertLevel) -> MarketCondition:
        """创建市场状况对象"""
        return MarketCondition(
            symbol=symbol,
            price_change_5m=change_5m,
            price_change_1h=change_1h,
            price_change_24h=change_24h,
            volume_spike=volume_spike,
            volatility=volatility,
            liquidation_risk=liquidation_risk,
            alert_level=alert_level
        )
    
    def _record_alert(self, condition: MarketCondition):
        """记录警报"""
        self.alert_history.append({
            'timestamp': datetime.now().isoformat(),
            'symbol': condition.symbol,
            'level': condition.alert_level.value,
            'change_5m': condition.price_change_5m,
            'change_1h': condition.price_change_1h,
            'volatility': condition.volatility
        })
    
    def should_liquidate(self, condition: MarketCondition) -> Tuple[bool, str]:
        """是否应该清仓"""
        if not self.config['auto_liquidate']:
            return False, "auto_liquidate disabled"
        
        if condition.alert_level.value in self.config['liquidate_levels']:
            reason = f"{condition.alert_level.value.upper()} alert triggered"
            
            # 记录清仓
            self.liquidation_history.append({
                'timestamp': datetime.now().isoformat(),
                'symbol': condition.symbol,
                'level': condition.alert_level.value,
                'reason': reason,
                'change_5m': condition.price_change_5m,
                'change_1h': condition.price_change_1h
            })
            return True, reason
        
        return False, "normal"
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            'total_alerts': len(self.alert_history),
            'total_liquidations': len(self.liquidation_history),
            'recent_alerts': self.alert_history[-20:],
            'recent_liquidations': self.liquidation_history[-10:],
            'is_protection_active': self.is_protection_active
        }
    
    def enable_protection(self):
        """启用防护"""
        self.is_protection_active = True
    
    def disable_protection(self):
        """禁用防护"""
        self.is_protection_active = False
