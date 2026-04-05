#!/usr/bin/env python3
"""
Circuit Breaker - 熔断控制器

两个 P0 保险丝：
1. 连续亏损熔断：连续亏损 >= 5 笔 → STOP
2. Edge消失熔断：PF < 1.0 且样本 >= 20 → STOP
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class BreakerType(Enum):
    """熔断类型"""
    CONSECUTIVE_LOSS = "连续亏损熔断"
    EDGE_LOST = "Edge消失熔断"
    DAILY_LOSS = "日亏损熔断"
    DRAWDOWN = "回撤熔断"


@dataclass
class BreakerState:
    """熔断状态"""
    is_triggered: bool = False
    breaker_type: Optional[BreakerType] = None
    trigger_time: str = ""
    trigger_value: float = 0.0
    cooldown_until: str = ""


class CircuitBreaker:
    """
    熔断控制器
    
    两个核心保险丝：
    1. 连续亏损 >= 5 → STOP 10分钟
    2. Profit Factor < 1.0 且样本 >= 20 → STOP
    """
    
    def __init__(
        self,
        max_consecutive_losses: int = 5,
        min_profit_factor: float = 1.0,
        min_trades_for_edge_check: int = 20,
        max_daily_loss_pct: float = 3.0,
        cooldown_minutes: int = 10,
        state_file: str = "logs/circuit_breaker_state.json"
    ):
        """
        初始化
        
        Args:
            max_consecutive_losses: 最大连续亏损次数
            min_profit_factor: 最小盈亏比（低于此触发 Edge 消失熔断）
            min_trades_for_edge_check: Edge 检查最小样本数
            max_daily_loss_pct: 最大日亏损百分比
            cooldown_minutes: 熔断冷却时间（分钟）
            state_file: 状态文件
        """
        self.max_consecutive_losses = max_consecutive_losses
        self.min_profit_factor = min_profit_factor
        self.min_trades = min_trades_for_edge_check
        self.max_daily_loss_pct = max_daily_loss_pct
        self.cooldown_minutes = cooldown_minutes
        self.state_file = state_file
        
        # 状态
        self.state = BreakerState()
        
        # 统计
        self.consecutive_losses = 0
        self.daily_pnl_pct = 0.0
        self.trade_history: List[Dict] = []
        
        # 加载状态
        self._load_state()
    
    def _load_state(self):
        """加载状态"""
        try:
            with open(self.state_file, 'r') as f:
                data = json.load(f)
            
            self.consecutive_losses = data.get('consecutive_losses', 0)
            self.daily_pnl_pct = data.get('daily_pnl_pct', 0.0)
            
            if data.get('is_triggered'):
                self.state.is_triggered = True
                self.state.breaker_type = BreakerType(data.get('breaker_type'))
                self.state.trigger_time = data.get('trigger_time', '')
                self.state.trigger_value = data.get('trigger_value', 0.0)
                self.state.cooldown_until = data.get('cooldown_until', '')
                
        except (FileNotFoundError, json.JSONDecodeError):
            pass
    
    def _save_state(self):
        """保存状态"""
        import os
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        
        data = {
            'consecutive_losses': self.consecutive_losses,
            'daily_pnl_pct': self.daily_pnl_pct,
            'is_triggered': self.state.is_triggered,
            'breaker_type': self.state.breaker_type.value if self.state.breaker_type else None,
            'trigger_time': self.state.trigger_time,
            'trigger_value': self.state.trigger_value,
            'cooldown_until': self.state.cooldown_until,
            'last_update': datetime.now().isoformat()
        }
        
        with open(self.state_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def record_trade(self, pnl_pct: float) -> Optional[BreakerType]:
        """
        记录交易结果
        
        Args:
            pnl_pct: 盈亏百分比
            
        Returns:
            触发的熔断类型，None 表示未触发
        """
        # 更新统计
        if pnl_pct < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
        
        self.daily_pnl_pct += pnl_pct
        
        # 记录历史
        self.trade_history.append({
            'time': datetime.now().isoformat(),
            'pnl_pct': pnl_pct,
            'consecutive_losses': self.consecutive_losses
        })
        
        # 检查熔断
        breaker = self._check_breakers()
        
        if breaker:
            self._trigger(breaker, pnl_pct)
        
        self._save_state()
        
        return breaker
    
    def _check_breakers(self) -> Optional[BreakerType]:
        """检查是否触发熔断"""
        
        # 1. 连续亏损熔断
        if self.consecutive_losses >= self.max_consecutive_losses:
            return BreakerType.CONSECUTIVE_LOSS
        
        # 2. 日亏损熔断
        if abs(self.daily_pnl_pct) >= self.max_daily_loss_pct:
            return BreakerType.DAILY_LOSS
        
        # 3. Edge 消失熔断（需要足够样本）
        if len(self.trade_history) >= self.min_trades:
            profit_factor = self._calculate_profit_factor()
            if profit_factor < self.min_profit_factor:
                return BreakerType.EDGE_LOST
        
        return None
    
    def _calculate_profit_factor(self) -> float:
        """计算盈亏比"""
        wins = [t['pnl_pct'] for t in self.trade_history if t['pnl_pct'] > 0]
        losses = [abs(t['pnl_pct']) for t in self.trade_history if t['pnl_pct'] < 0]
        
        total_profit = sum(wins) if wins else 0
        total_loss = sum(losses) if losses else 0.0001  # 避免除零
        
        return total_profit / total_loss
    
    def _trigger(self, breaker_type: BreakerType, value: float):
        """触发熔断"""
        self.state.is_triggered = True
        self.state.breaker_type = breaker_type
        self.state.trigger_time = datetime.now().isoformat()
        self.state.trigger_value = value
        
        # 计算冷却结束时间
        cooldown_seconds = self.cooldown_minutes * 60
        cooldown_time = time.time() + cooldown_seconds
        self.state.cooldown_until = datetime.fromtimestamp(cooldown_time).isoformat()
        
        # 输出
        print("\n" + "=" * 60)
        print("🚨 CIRCUIT BREAKER TRIGGERED")
        print("=" * 60)
        print(f"类型: {breaker_type.value}")
        print(f"时间: {self.state.trigger_time}")
        print(f"触发值: {value:.2f}%")
        print(f"连续亏损: {self.consecutive_losses} 笔")
        print(f"日累计: {self.daily_pnl_pct:.2f}%")
        print(f"冷却至: {self.state.cooldown_until}")
        print("=" * 60)
    
    def is_breaked(self) -> bool:
        """
        检查是否处于熔断状态
        
        Returns:
            True = 熔断中，False = 正常
        """
        if not self.state.is_triggered:
            return False
        
        # 检查冷却
        if self.state.cooldown_until:
            cooldown_time = datetime.fromisoformat(self.state.cooldown_until)
            if datetime.now() < cooldown_time:
                return True
            else:
                # 冷却结束，重置
                self._reset()
                return False
        
        return True
    
    def _reset(self):
        """重置熔断状态"""
        self.state = BreakerState()
        self.consecutive_losses = 0
        self._save_state()
        
        print("✅ 熔断已重置，系统可继续运行")
    
    def get_status(self) -> Dict:
        """获取状态"""
        return {
            'is_triggered': self.state.is_triggered,
            'breaker_type': self.state.breaker_type.value if self.state.breaker_type else None,
            'consecutive_losses': self.consecutive_losses,
            'daily_pnl_pct': self.daily_pnl_pct,
            'total_trades': len(self.trade_history),
            'profit_factor': self._calculate_profit_factor() if len(self.trade_history) >= 5 else None,
            'cooldown_remaining': self._get_cooldown_remaining()
        }
    
    def _get_cooldown_remaining(self) -> int:
        """获取剩余冷却时间（秒）"""
        if not self.state.cooldown_until:
            return 0
        
        try:
            cooldown_time = datetime.fromisoformat(self.state.cooldown_until)
            remaining = (cooldown_time - datetime.now()).total_seconds()
            return max(0, int(remaining))
        except:
            return 0
    
    def force_reset(self):
        """强制重置（谨慎使用）"""
        self._reset()
        print("⚠️ 熔断已强制重置")


# 全局实例
_breaker: Optional[CircuitBreaker] = None


def get_circuit_breaker() -> CircuitBreaker:
    """获取全局熔断控制器"""
    global _breaker
    if _breaker is None:
        _breaker = CircuitBreaker()
    return _breaker


# 测试
if __name__ == "__main__":
    print("🧪 熔断控制器测试")
    
    breaker = CircuitBreaker()
    
    # 模拟交易
    results = [0.1, -0.2, -0.15, -0.3, -0.25, -0.1]  # 第5笔触发
    
    for pnl in results:
        print(f"\n交易: {pnl:+.2f}%")
        triggered = breaker.record_trade(pnl)
        
        if triggered:
            print(f"🔴 熔断触发: {triggered.value}")
            break
    
    print(f"\n状态: {breaker.get_status()}")
