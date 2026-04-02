"""
Risk Breakers — 熔断器

实现多层熔断机制：
- 市场熔断（stale feed, price gap, spread too wide）
- 连接熔断（disconnect, reject storm, latency spike）
- 风险熔断（loss limit, drawdown limit, exposure limit）

熔断器设计原则：
- 快速触发（毫秒级）
- 慢速恢复（需要冷却时间 + 手动确认）
- 状态可观测（Cockpit 可见）
- 事件可审计（所有触发/恢复都记录）
"""

import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import RiskLevel


class BreakerType(Enum):
    """熔断器类型"""
    MARKET_STALE = "market_stale"  # 行情停滞
    MARKET_GAP = "market_gap"  # 价格跳空
    MARKET_SPREAD = "market_spread"  # 价差过大
    CONNECTION_LOST = "connection_lost"  # 连接断开
    REJECT_STORM = "reject_storm"  # 拒绝风暴
    LATENCY_SPIKE = "latency_spike"  # 延迟尖峰
    LOSS_LIMIT = "loss_limit"  # 亏损限制
    DRAWDOWN_LIMIT = "drawdown_limit"  # 回撤限制
    EXPOSURE_LIMIT = "exposure_limit"  # 敞口限制
    MANUAL_FREEZE = "manual_freeze"  # 手动冻结


class BreakerState(Enum):
    """熔断器状态"""
    ARMED = "armed"  # 已武装（正常监控）
    TRIPPED = "tripped"  # 已触发（熔断中）
    COOLDOWN = "cooldown"  # 冷却中
    DISABLED = "disabled"  # 已禁用


@dataclass
class BreakerConfig:
    """熔断器配置"""
    breaker_type: BreakerType
    enabled: bool = True
    threshold: float = 0.0  # 触发阈值
    window_seconds: float = 0.0  # 时间窗口（用于计数类）
    cooldown_seconds: float = 300.0  # 冷却时间（5 分钟）
    auto_reset: bool = False  # 是否自动恢复
    severity: RiskLevel = RiskLevel.HIGH


@dataclass
class BreakerStateData:
    """熔断器状态数据"""
    breaker_type: BreakerType
    state: BreakerState = BreakerState.ARMED
    tripped_at: Optional[datetime] = None
    reset_at: Optional[datetime] = None
    trip_count: int = 0
    last_trip_reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "breaker_type": self.breaker_type.value,
            "state": self.state.value,
            "tripped_at": self.tripped_at.isoformat() if self.tripped_at else None,
            "reset_at": self.reset_at.isoformat() if self.reset_at else None,
            "trip_count": self.trip_count,
            "last_trip_reason": self.last_trip_reason,
            "metadata": self.metadata,
        }


class CircuitBreaker:
    """单个熔断器"""
    
    def __init__(self, config: BreakerConfig):
        self.config = config
        self.state = BreakerStateData(breaker_type=config.breaker_type)
        self._event_callback: Optional[Callable] = None
        
        # 计数器（用于窗口内计数）
        self._counter: float = 0.0
        self._window_start: Optional[datetime] = None
        
        # 最后检查值（用于变化率检测）
        self._last_value: Optional[float] = None
        self._last_check: Optional[datetime] = None
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def is_armed(self) -> bool:
        """是否已武装（正常监控）"""
        return self.state.state == BreakerState.ARMED and self.config.enabled
    
    def is_tripped(self) -> bool:
        """是否已触发（熔断中）"""
        return self.state.state == BreakerState.TRIPPED
    
    def is_disabled(self) -> bool:
        """是否已禁用"""
        return self.state.state == BreakerState.DISABLED or not self.config.enabled
    
    def check(self, value: float, reason: Optional[str] = None) -> bool:
        """
        检查是否触发熔断
        
        Returns:
            True if tripped, False otherwise
        """
        if not self.config.enabled:
            return False
        
        if self.state.state == BreakerState.TRIPPED:
            # 检查是否可以恢复
            self._check_reset()
            return True
        
        if self.state.state == BreakerState.COOLDOWN:
            # 检查冷却是否结束
            if self._check_cooldown_end():
                self.state.state = BreakerState.ARMED
            else:
                return False
        
        # 检查触发条件
        triggered = self._check_trigger(value)
        
        if triggered:
            self._trip(reason or f"Threshold exceeded: {value} > {self.config.threshold}")
        
        return triggered
    
    def trip(self, reason: str) -> None:
        """手动触发熔断"""
        self._trip(reason)
    
    def reset(self) -> bool:
        """手动重置熔断"""
        if self.state.state != BreakerState.TRIPPED:
            return False
        
        self.state.state = BreakerState.ARMED
        self.state.reset_at = datetime.utcnow()
        self._counter = 0.0
        self._window_start = None
        
        self._publish_event(EventType.BREAKER_RESET, {
            "breaker_type": self.config.breaker_type.value,
            "reset_at": self.state.reset_at.isoformat(),
        })
        
        return True
    
    def disable(self) -> None:
        """禁用熔断器"""
        self.state.state = BreakerState.DISABLED
    
    def enable(self) -> None:
        """启用熔断器"""
        self.config.enabled = True
        if self.state.state == BreakerState.DISABLED:
            self.state.state = BreakerState.ARMED
    
    def _check_trigger(self, value: float) -> bool:
        """检查触发条件"""
        if self.config.window_seconds > 0:
            # 窗口计数类（如 reject storm）
            return self._check_window_count(value)
        else:
            # 阈值类（如 loss limit）
            return value >= self.config.threshold
    
    def _check_window_count(self, value: float) -> bool:
        """检查窗口内计数"""
        now = datetime.utcnow()
        
        # 初始化窗口
        if self._window_start is None:
            self._window_start = now
            self._counter = value
            return False
        
        # 检查窗口是否过期
        window_elapsed = (now - self._window_start).total_seconds()
        if window_elapsed > self.config.window_seconds:
            # 窗口过期，重置
            self._window_start = now
            self._counter = value
            return False
        
        # 窗口内累加
        self._counter += value
        return self._counter >= self.config.threshold
    
    def _check_reset(self) -> None:
        """检查是否可以自动恢复"""
        if not self.config.auto_reset:
            return
        
        if self.state.reset_at is None:
            return
        
        if datetime.utcnow() >= self.state.reset_at:
            self.state.state = BreakerState.ARMED
            self._publish_event(EventType.BREAKER_RESET, {
                "breaker_type": self.config.breaker_type.value,
                "auto_reset": True,
            })
    
    def _check_cooldown_end(self) -> bool:
        """检查冷却是否结束"""
        if self.state.reset_at is None:
            return False
        
        cooldown_end = self.state.reset_at + timedelta(seconds=self.config.cooldown_seconds)
        return datetime.utcnow() >= cooldown_end
    
    def _trip(self, reason: str) -> None:
        """触发熔断"""
        self.state.state = BreakerState.TRIPPED
        self.state.tripped_at = datetime.utcnow()
        self.state.trip_count += 1
        self.state.last_trip_reason = reason
        
        # 设置恢复时间
        if self.config.auto_reset:
            self.state.reset_at = datetime.utcnow() + timedelta(seconds=self.config.cooldown_seconds)
        
        # 重置计数器
        self._counter = 0.0
        self._window_start = None
        
        self._publish_event(EventType.BREAKER_TRIPPED, {
            "breaker_type": self.config.breaker_type.value,
            "reason": reason,
            "trip_count": self.state.trip_count,
        })
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.RISK_ENGINE,
                payload=payload,
            )
            self._event_callback(envelope)


class BreakerPanel:
    """熔断器面板（管理所有熔断器）"""
    
    def __init__(self):
        self._breakers: Dict[BreakerType, CircuitBreaker] = {}
        self._event_callback: Optional[Callable] = None
        self._init_default_breakers()
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
        for breaker in self._breakers.values():
            breaker.set_event_callback(callback)
    
    def _init_default_breakers(self) -> None:
        """初始化默认熔断器"""
        defaults = [
            # 市场熔断
            BreakerConfig(
                breaker_type=BreakerType.MARKET_STALE,
                threshold=60.0,  # 60 秒无更新
                cooldown_seconds=300.0,
                severity=RiskLevel.HIGH,
            ),
            BreakerConfig(
                breaker_type=BreakerType.MARKET_GAP,
                threshold=0.05,  # 5% 跳空
                cooldown_seconds=600.0,
                severity=RiskLevel.CRITICAL,
            ),
            BreakerConfig(
                breaker_type=BreakerType.MARKET_SPREAD,
                threshold=0.001,  # 0.1% 价差
                cooldown_seconds=300.0,
                severity=RiskLevel.MEDIUM,
            ),
            
            # 连接熔断
            BreakerConfig(
                breaker_type=BreakerType.CONNECTION_LOST,
                threshold=1.0,  # 断开即触发
                cooldown_seconds=60.0,
                auto_reset=True,
                severity=RiskLevel.HIGH,
            ),
            BreakerConfig(
                breaker_type=BreakerType.REJECT_STORM,
                threshold=5.0,  # 5 次拒绝
                window_seconds=60.0,  # 60 秒内
                cooldown_seconds=600.0,
                severity=RiskLevel.CRITICAL,
            ),
            BreakerConfig(
                breaker_type=BreakerType.LATENCY_SPIKE,
                threshold=1000.0,  # 1000ms
                cooldown_seconds=300.0,
                severity=RiskLevel.MEDIUM,
            ),
            
            # 风险熔断
            BreakerConfig(
                breaker_type=BreakerType.LOSS_LIMIT,
                threshold=100.0,  # 100 USDT
                cooldown_seconds=3600.0,  # 1 小时
                severity=RiskLevel.CRITICAL,
            ),
            BreakerConfig(
                breaker_type=BreakerType.DRAWDOWN_LIMIT,
                threshold=0.10,  # 10% 回撤
                cooldown_seconds=3600.0,
                severity=RiskLevel.CRITICAL,
            ),
            BreakerConfig(
                breaker_type=BreakerType.EXPOSURE_LIMIT,
                threshold=1000.0,  # 1000 USDT 敞口
                cooldown_seconds=300.0,
                severity=RiskLevel.HIGH,
            ),
            
            # 手动熔断
            BreakerConfig(
                breaker_type=BreakerType.MANUAL_FREEZE,
                enabled=False,  # 默认禁用
                cooldown_seconds=0.0,
                auto_reset=False,
                severity=RiskLevel.CRITICAL,
            ),
        ]
        
        for config in defaults:
            breaker = CircuitBreaker(config)
            if self._event_callback:
                breaker.set_event_callback(self._event_callback)
            self._breakers[config.breaker_type] = breaker
    
    def get_breaker(self, breaker_type: BreakerType) -> Optional[CircuitBreaker]:
        """获取熔断器"""
        return self._breakers.get(breaker_type)
    
    def check(
        self,
        breaker_type: BreakerType,
        value: float,
        reason: Optional[str] = None
    ) -> bool:
        """检查熔断器"""
        breaker = self.get_breaker(breaker_type)
        if not breaker:
            return False
        
        return breaker.check(value, reason)
    
    def trip(self, breaker_type: BreakerType, reason: str) -> None:
        """手动触发熔断器"""
        breaker = self.get_breaker(breaker_type)
        if breaker:
            breaker.trip(reason)
    
    def reset(self, breaker_type: BreakerType) -> bool:
        """手动重置熔断器"""
        breaker = self.get_breaker(breaker_type)
        if breaker:
            return breaker.reset()
        return False
    
    def freeze_all(self, reason: str) -> None:
        """冻结所有熔断器"""
        # 触发手动熔断
        manual = self.get_breaker(BreakerType.MANUAL_FREEZE)
        if manual:
            manual.trip(reason)
        
        # 禁用所有自动恢复
        for breaker in self._breakers.values():
            breaker.config.auto_reset = False
    
    def unfreeze_all(self) -> None:
        """解冻所有熔断器"""
        # 重置手动熔断
        manual = self.get_breaker(BreakerType.MANUAL_FREEZE)
        if manual:
            manual.reset()
        
        # 恢复默认配置
        for breaker in self._breakers.values():
            # 重新加载默认配置
            pass
    
    def is_any_tripped(self) -> bool:
        """是否有熔断器触发"""
        return any(b.is_tripped() for b in self._breakers.values())
    
    def get_tripped_breakers(self) -> List[BreakerType]:
        """获取所有触发的熔断器"""
        return [
            b_type for b_type, breaker in self._breakers.items()
            if breaker.is_tripped()
        ]
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        return {
            "any_tripped": self.is_any_tripped(),
            "tripped_breakers": [b.value for b in self.get_tripped_breakers()],
            "breakers": {
                b_type.value: breaker.state.to_dict()
                for b_type, breaker in self._breakers.items()
            },
        }
    
    def summary(self) -> str:
        """获取摘要"""
        status = self.status()
        lines = [
            f"熔断器面板状态：{'🔴 有触发' if status['any_tripped'] else '🟢 正常'}",
        ]
        
        if status['tripped_breakers']:
            lines.append(f"触发的熔断器：{', '.join(status['tripped_breakers'])}")
        
        return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    panel = BreakerPanel()
    
    print("=== 初始状态 ===")
    print(panel.summary())
    print()
    
    # 模拟行情停滞
    print("=== 模拟行情停滞 60 秒 ===")
    tripped = panel.check(BreakerType.MARKET_STALE, 65.0)
    print(f"触发：{tripped}")
    print(panel.summary())
    print()
    
    # 模拟拒绝风暴
    print("=== 模拟拒绝风暴（5 次/60 秒）=== ")
    for i in range(5):
        tripped = panel.check(BreakerType.REJECT_STORM, 1.0)
        print(f"拒绝 #{i+1}: 触发={tripped}")
    
    print(panel.summary())
    print()
    
    # 手动冻结
    print("=== 手动冻结 ===")
    panel.freeze_all("Manual test")
    print(panel.summary())
