"""
Risk Envelopes — 风险包线

实现多层风险包线机制：
- 仓位包线（Position Envelope）
- 订单包线（Order Envelope）
- 策略包线（Strategy Envelope）
- 账户包线（Account Envelope）

包线设计原则：
- 多层防护，逐层收紧
- 动态调整（基于市场状态）
- 可观测（Cockpit 可见）
- 可审计（所有突破都记录）
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, RiskDecisionType, RiskLevel
from schemas.risk import RiskDecision


class EnvelopeType(Enum):
    """包线类型"""
    POSITION = "position"  # 仓位包线
    ORDER = "order"  # 订单包线
    STRATEGY = "strategy"  # 策略包线
    ACCOUNT = "account"  # 账户包线
    DAILY = "daily"  # 日度包线


class EnvelopeAction(Enum):
    """包线动作"""
    ALLOW = "allow"  # 允许
    REDUCE = "reduce"  # 减仓
    BLOCK = "block"  # 阻断
    ALERT = "alert"  # 警报


@dataclass
class EnvelopeConfig:
    """包线配置"""
    envelope_type: EnvelopeType
    enabled: bool = True
    soft_limit: Decimal = Decimal("0")  # 软限制（警报）
    hard_limit: Decimal = Decimal("0")  # 硬限制（阻断）
    warning_threshold: Decimal = Decimal("0.8")  # 警告阈值（80%）
    dynamic_adjustment: bool = False  # 是否动态调整
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EnvelopeState:
    """包线状态"""
    envelope_type: EnvelopeType
    current_value: Decimal = Decimal("0")
    limit_value: Decimal = Decimal("0")
    utilization_pct: Decimal = Decimal("0")
    last_updated: datetime = field(default_factory=datetime.utcnow)
    breaches: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "envelope_type": self.envelope_type.value,
            "current_value": str(self.current_value),
            "limit_value": str(self.limit_value),
            "utilization_pct": float(self.utilization_pct),
            "last_updated": self.last_updated.isoformat(),
            "breach_count": len(self.breaches),
        }


class RiskEnvelope:
    """单个风险包线"""
    
    def __init__(self, config: EnvelopeConfig):
        self.config = config
        self.state = EnvelopeState(envelope_type=config.envelope_type)
        self._event_callback: Optional[Callable] = None
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def update(self, value: Decimal) -> None:
        """更新当前值"""
        self.state.current_value = value
        self.state.limit_value = self.config.hard_limit
        
        if self.config.hard_limit > 0:
            self.state.utilization_pct = value / self.config.hard_limit
        else:
            self.state.utilization_pct = Decimal("0")
        
        self.state.last_updated = datetime.utcnow()
        
        # 检查是否突破
        self._check_breach()
    
    def check(self, proposed_value: Decimal) -> RiskDecision:
        """检查提议值是否超出包线"""
        if not self.config.enabled:
            return RiskDecision(
                approved=True,
                reason="包线已禁用",
                risk_level="low",
            )
        
        # 检查硬限制
        if proposed_value > self.config.hard_limit:
            self._record_breach(proposed_value, "hard_limit")
            return RiskDecision(
                approved=False,
                reason=f"超出硬限制：{proposed_value} > {self.config.hard_limit}",
                risk_level="critical",
            )
        
        # 检查软限制
        if proposed_value > self.config.soft_limit:
            self._record_breach(proposed_value, "soft_limit")
            
            if self.config.soft_limit > 0:
                return RiskDecision(
                    approved=True,
                    reason=f"超出软限制：{proposed_value} > {self.config.soft_limit}",
                    risk_level="high",
                )
        
        # 检查警告阈值
        if self.state.utilization_pct >= self.config.warning_threshold:
            return RiskDecision(
                approved=True,
                reason=f"接近限制：{float(self.state.utilization_pct):.1%}",
                risk_level="medium",
            )
        
        return RiskDecision(
            approved=True,
            reason="在包线范围内",
            risk_level="low",
        )
    
    def _check_breach(self) -> None:
        """检查是否突破"""
        if self.state.current_value > self.config.hard_limit:
            self._record_breach(self.state.current_value, "hard_limit_breach")
        elif self.state.current_value > self.config.soft_limit:
            self._record_breach(self.state.current_value, "soft_limit_breach")
    
    def _record_breach(self, value: Decimal, breach_type: str) -> None:
        """记录突破事件"""
        breach = {
            "timestamp": datetime.utcnow().isoformat(),
            "value": str(value),
            "limit": str(self.config.hard_limit if breach_type == "hard_limit" else self.config.soft_limit),
            "type": breach_type,
        }
        self.state.breaches.append(breach)
        
        # 发布事件
        self._publish_event(EventType.RISK_RULE_TRIGGERED, {
            "envelope_type": self.config.envelope_type.value,
            "breach_type": breach_type,
            "value": str(value),
            "limit": str(self.config.hard_limit),
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
    
    def reset(self) -> None:
        """重置状态"""
        self.state.current_value = Decimal("0")
        self.state.utilization_pct = Decimal("0")
        self.state.last_updated = datetime.utcnow()
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        return {
            "enabled": self.config.enabled,
            "soft_limit": str(self.config.soft_limit),
            "hard_limit": str(self.config.hard_limit),
            "warning_threshold": float(self.config.warning_threshold),
            "state": self.state.to_dict(),
        }


class EnvelopeManager:
    """包线管理器"""
    
    def __init__(self):
        self._envelopes: Dict[EnvelopeType, RiskEnvelope] = {}
        self._event_callback: Optional[Callable] = None
        self._init_default_envelopes()
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
        for envelope in self._envelopes.values():
            envelope.set_event_callback(callback)
    
    def _init_default_envelopes(self) -> None:
        """初始化默认包线"""
        # 仓位包线
        self._envelopes[EnvelopeType.POSITION] = RiskEnvelope(
            EnvelopeConfig(
                envelope_type=EnvelopeType.POSITION,
                soft_limit=Decimal("500"),  # 500 USDT
                hard_limit=Decimal("1000"),  # 1000 USDT
                warning_threshold=Decimal("0.8"),
            )
        )
        
        # 订单包线
        self._envelopes[EnvelopeType.ORDER] = RiskEnvelope(
            EnvelopeConfig(
                envelope_type=EnvelopeType.ORDER,
                soft_limit=Decimal("100"),  # 100 USDT
                hard_limit=Decimal("200"),  # 200 USDT
                warning_threshold=Decimal("0.9"),
            )
        )
        
        # 策略包线
        self._envelopes[EnvelopeType.STRATEGY] = RiskEnvelope(
            EnvelopeConfig(
                envelope_type=EnvelopeType.STRATEGY,
                soft_limit=Decimal("300"),
                hard_limit=Decimal("500"),
                warning_threshold=Decimal("0.7"),
            )
        )
        
        # 账户包线
        self._envelopes[EnvelopeType.ACCOUNT] = RiskEnvelope(
            EnvelopeConfig(
                envelope_type=EnvelopeType.ACCOUNT,
                soft_limit=Decimal("800"),
                hard_limit=Decimal("1000"),
                warning_threshold=Decimal("0.8"),
            )
        )
        
        # 日度包线
        self._envelopes[EnvelopeType.DAILY] = RiskEnvelope(
            EnvelopeConfig(
                envelope_type=EnvelopeType.DAILY,
                soft_limit=Decimal("50"),  # 日亏损 50 USDT 警报
                hard_limit=Decimal("100"),  # 日亏损 100 USDT 停止
                warning_threshold=Decimal("0.5"),
            )
        )
    
    def get_envelope(self, envelope_type: EnvelopeType) -> Optional[RiskEnvelope]:
        """获取包线"""
        return self._envelopes.get(envelope_type)
    
    def update_envelope(
        self,
        envelope_type: EnvelopeType,
        value: Decimal
    ) -> None:
        """更新包线值"""
        envelope = self.get_envelope(envelope_type)
        if envelope:
            envelope.update(value)
    
    def check_order(
        self,
        order_notional: Decimal,
        position_exposure: Decimal,
        daily_pnl: Decimal
    ) -> RiskDecision:
        """检查订单（综合所有包线）"""
        decisions = []
        
        # 检查订单包线
        order_envelope = self.get_envelope(EnvelopeType.ORDER)
        if order_envelope:
            decisions.append(order_envelope.check(order_notional))
        
        # 检查仓位包线
        position_envelope = self.get_envelope(EnvelopeType.POSITION)
        if position_envelope:
            decisions.append(position_envelope.check(position_exposure))
        
        # 检查日度包线
        daily_envelope = self.get_envelope(EnvelopeType.DAILY)
        if daily_envelope:
            # 日亏损为负值，转换为正数比较
            daily_loss = abs(daily_pnl) if daily_pnl < 0 else Decimal("0")
            decisions.append(daily_envelope.check(daily_loss))
        
        # 综合决策
        if any(not d.approved for d in decisions):
            reasons = [d.reason for d in decisions if not d.approved]
            return RiskDecision(
                approved=False,
                reason="; ".join(reasons),
                risk_level="critical",
            )
        
        warnings = [d for d in decisions if d.risk_level in ["medium", "high"]]
        if warnings:
            reasons = [w.reason for w in warnings]
            return RiskDecision(
                approved=True,
                reason="; ".join(reasons),
                risk_level="medium",
            )
        
        return RiskDecision(
            approved=True,
            reason="通过所有包线检查",
            risk_level="low",
        )
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        return {
            "envelope_count": len(self._envelopes),
            "envelopes": {
                et.value: env.status()
                for et, env in self._envelopes.items()
            },
        }
    
    def summary(self) -> str:
        """获取摘要"""
        status = self.status()
        lines = ["风险包线状态:"]
        
        for et_value, env_status in status["envelopes"].items():
            state = env_status["state"]
            utilization = float(state["utilization_pct"]) * 100
            lines.append(f"  {et_value}: {state['current_value']} / {state['limit_value']} ({utilization:.1f}%)")
        
        return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    manager = EnvelopeManager()
    
    print("=== 初始状态 ===")
    print(manager.summary())
    
    print("\n=== 测试订单检查 ===")
    
    # 正常订单
    result1 = manager.check_order(
        order_notional=Decimal("50"),
        position_exposure=Decimal("300"),
        daily_pnl=Decimal("-20"),
    )
    print(f"订单 1: approved={result1.approved}, reason={result1.reason}")
    
    # 大额订单
    result2 = manager.check_order(
        order_notional=Decimal("250"),  # 超过 200
        position_exposure=Decimal("300"),
        daily_pnl=Decimal("-20"),
    )
    print(f"订单 2: approved={result2.approved}, reason={result2.reason}")
    
    # 日亏损过大
    result3 = manager.check_order(
        order_notional=Decimal("50"),
        position_exposure=Decimal("300"),
        daily_pnl=Decimal("-120"),  # 超过 100
    )
    print(f"订单 3: approved={result3.approved}, reason={result3.reason}")
    
    print("\n=== 最终状态 ===")
    print(manager.summary())
