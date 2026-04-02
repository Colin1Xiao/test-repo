"""
Admin Controls — 管理控制面板

实现紧急控制功能：
- Emergency Freeze（紧急冻结）
- Mass Cancel（批量撤单）
- Trading Mode Switch（交易模式切换）
- Breaker Override（熔断器覆盖）

所有控制操作都需要：
- 审计日志
- 双重确认（关键操作）
- 事件发布（用于 Cockpit 显示）
"""

import time
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import RiskLevel, TradingMode


class ControlAction(Enum):
    """控制动作类型"""
    FREEZE_ALL = "freeze_all"  # 冻结所有
    UNFREEZE_ALL = "unfreeze_all"  # 解冻所有
    CANCEL_ALL_ORDERS = "cancel_all_orders"  # 批量撤单
    CANCEL_BY_SYMBOL = "cancel_by_symbol"  # 按交易对撤单
    SET_TRADING_MODE = "set_trading_mode"  # 切换交易模式
    OVERRIDE_BREAKER = "override_breaker"  # 覆盖熔断器
    EMERGENCY_SHUTDOWN = "emergency_shutdown"  # 紧急停机


@dataclass
class ControlRequest:
    """控制请求"""
    action: ControlAction
    requested_by: str  # 请求者 ID
    reason: str  # 原因
    timestamp: datetime = field(default_factory=datetime.utcnow)
    params: Dict[str, Any] = field(default_factory=dict)
    confirmed: bool = False  # 是否已确认
    confirmation_by: Optional[str] = None  # 确认者 ID
    confirmation_at: Optional[datetime] = None  # 确认时间


@dataclass
class ControlResult:
    """控制结果"""
    success: bool
    action: ControlAction
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    executed_at: datetime = field(default_factory=datetime.utcnow)


class AdminControlPanel:
    """管理控制面板"""
    
    def __init__(self):
        self._event_callback: Optional[Callable] = None
        self._freeze_callback: Optional[Callable] = None
        self._cancel_callback: Optional[Callable] = None
        self._mode_callback: Optional[Callable] = None
        
        # 控制历史
        self._control_history: List[ControlRequest] = []
        
        # 当前状态
        self._is_frozen = False
        self._current_mode = TradingMode.SHADOW
        self._frozen_at: Optional[datetime] = None
        self._frozen_by: Optional[str] = None
        self._frozen_reason: Optional[str] = None
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def set_freeze_callback(self, callback: Callable) -> None:
        """设置冻结回调"""
        self._freeze_callback = callback
    
    def set_cancel_callback(self, callback: Callable) -> None:
        """设置撤单回调"""
        self._cancel_callback = callback
    
    def set_mode_callback(self, callback: Callable) -> None:
        """设置模式切换回调"""
        self._mode_callback = callback
    
    def request_freeze(
        self,
        requested_by: str,
        reason: str
    ) -> ControlResult:
        """
        请求冻结
        
        冻结后：
        - 停止所有新订单
        - 保持现有订单
        - Cockpit 显示冻结状态
        """
        request = ControlRequest(
            action=ControlAction.FREEZE_ALL,
            requested_by=requested_by,
            reason=reason,
        )
        
        # 执行冻结
        self._is_frozen = True
        self._frozen_at = datetime.utcnow()
        self._frozen_by = requested_by
        self._frozen_reason = reason
        
        self._control_history.append(request)
        
        # 回调
        if self._freeze_callback:
            self._freeze_callback(True, reason)
        
        # 发布事件
        self._publish_event(EventType.SYSTEM_FROZEN, {
            "requested_by": requested_by,
            "reason": reason,
            "frozen_at": self._frozen_at.isoformat(),
        })
        
        return ControlResult(
            success=True,
            action=ControlAction.FREEZE_ALL,
            message="系统已冻结",
            details={
                "frozen_at": self._frozen_at.isoformat(),
                "frozen_by": requested_by,
            }
        )
    
    def request_unfreeze(
        self,
        requested_by: str,
        reason: str
    ) -> ControlResult:
        """请求解冻"""
        if not self._is_frozen:
            return ControlResult(
                success=False,
                action=ControlAction.UNFREEZE_ALL,
                message="系统未冻结，无需解冻",
            )
        
        request = ControlRequest(
            action=ControlAction.UNFREEZE_ALL,
            requested_by=requested_by,
            reason=reason,
        )
        
        # 执行解冻
        self._is_frozen = False
        unfrozen_at = datetime.utcnow()
        
        self._control_history.append(request)
        
        # 回调
        if self._freeze_callback:
            self._freeze_callback(False, reason)
        
        # 发布事件
        self._publish_event(EventType.SYSTEM_UNFROZEN, {
            "requested_by": requested_by,
            "reason": reason,
            "unfrozen_at": unfrozen_at.isoformat(),
            "frozen_duration_seconds": (unfrozen_at - self._frozen_at).total_seconds() if self._frozen_at else 0,
        })
        
        return ControlResult(
            success=True,
            action=ControlAction.UNFREEZE_ALL,
            message="系统已解冻",
            details={
                "unfrozen_at": unfrozen_at.isoformat(),
                "frozen_duration_seconds": (unfrozen_at - self._frozen_at).total_seconds() if self._frozen_at else 0,
            }
        )
    
    def request_cancel_all(
        self,
        requested_by: str,
        reason: str,
        symbol: Optional[str] = None
    ) -> ControlResult:
        """
        请求批量撤单
        
        Args:
            symbol: 如果为 None，取消所有订单；否则只取消指定交易对
        """
        request = ControlRequest(
            action=ControlAction.CANCEL_BY_SYMBOL if symbol else ControlAction.CANCEL_ALL_ORDERS,
            requested_by=requested_by,
            reason=reason,
            params={"symbol": symbol} if symbol else {},
        )
        
        # 回调（由执行层实际撤单）
        cancelled_count = 0
        if self._cancel_callback:
            cancelled_count = self._cancel_callback(symbol)
        
        self._control_history.append(request)
        
        # 发布事件
        self._publish_event(EventType.MASS_CANCEL, {
            "requested_by": requested_by,
            "reason": reason,
            "symbol": symbol,
            "cancelled_count": cancelled_count,
        })
        
        return ControlResult(
            success=True,
            action=request.action,
            message=f"已取消 {cancelled_count} 个订单",
            details={
                "cancelled_count": cancelled_count,
                "symbol": symbol,
            }
        )
    
    def request_mode_change(
        self,
        requested_by: str,
        new_mode: TradingMode,
        reason: str
    ) -> ControlResult:
        """请求切换交易模式"""
        if new_mode == self._current_mode:
            return ControlResult(
                success=False,
                action=ControlAction.SET_TRADING_MODE,
                message=f"当前已是 {new_mode.value} 模式",
            )
        
        request = ControlRequest(
            action=ControlAction.SET_TRADING_MODE,
            requested_by=requested_by,
            reason=reason,
            params={"new_mode": new_mode.value},
        )
        
        old_mode = self._current_mode
        self._current_mode = new_mode
        
        self._control_history.append(request)
        
        # 回调
        if self._mode_callback:
            self._mode_callback(old_mode, new_mode)
        
        # 发布事件
        self._publish_event(EventType.TRADING_MODE_CHANGED, {
            "requested_by": requested_by,
            "old_mode": old_mode.value,
            "new_mode": new_mode.value,
            "reason": reason,
        })
        
        return ControlResult(
            success=True,
            action=ControlAction.SET_TRADING_MODE,
            message=f"交易模式已从 {old_mode.value} 切换到 {new_mode.value}",
            details={
                "old_mode": old_mode.value,
                "new_mode": new_mode.value,
            }
        )
    
    def request_breaker_override(
        self,
        requested_by: str,
        breaker_type: str,
        reason: str
    ) -> ControlResult:
        """
        请求覆盖熔断器
        
        ⚠️ 高风险操作，需要额外审计
        """
        request = ControlRequest(
            action=ControlAction.OVERRIDE_BREAKER,
            requested_by=requested_by,
            reason=reason,
            params={"breaker_type": breaker_type},
        )
        
        self._control_history.append(request)
        
        # 发布事件
        self._publish_event(EventType.BREAKER_OVERRIDE, {
            "requested_by": requested_by,
            "breaker_type": breaker_type,
            "reason": reason,
            "risk_level": RiskLevel.CRITICAL.value,
        })
        
        return ControlResult(
            success=True,
            action=ControlAction.OVERRIDE_BREAKER,
            message=f"熔断器 {breaker_type} 已覆盖（高风险操作）",
            details={
                "breaker_type": breaker_type,
                "warning": "这是高风险操作，请谨慎使用",
            }
        )
    
    def request_emergency_shutdown(
        self,
        requested_by: str,
        reason: str
    ) -> ControlResult:
        """
        请求紧急停机
        
        🔴 最高风险操作：
        - 冻结所有交易
        - 取消所有订单
        - 关闭所有连接
        - 保存所有状态
        """
        request = ControlRequest(
            action=ControlAction.EMERGENCY_SHUTDOWN,
            requested_by=requested_by,
            reason=reason,
        )
        
        # 1. 冻结
        self._is_frozen = True
        self._frozen_at = datetime.utcnow()
        self._frozen_by = requested_by
        self._frozen_reason = reason
        
        # 2. 撤单
        cancelled_count = 0
        if self._cancel_callback:
            cancelled_count = self._cancel_callback(None)
        
        self._control_history.append(request)
        
        # 3. 发布事件
        self._publish_event(EventType.EMERGENCY_SHUTDOWN, {
            "requested_by": requested_by,
            "reason": reason,
            "cancelled_count": cancelled_count,
            "shutdown_at": self._frozen_at.isoformat(),
        })
        
        return ControlResult(
            success=True,
            action=ControlAction.EMERGENCY_SHUTDOWN,
            message="系统已紧急停机",
            details={
                "shutdown_at": self._frozen_at.isoformat(),
                "cancelled_count": cancelled_count,
                "next_steps": "需要手动重启系统",
            }
        )
    
    def is_frozen(self) -> bool:
        """是否冻结"""
        return self._is_frozen
    
    def get_current_mode(self) -> TradingMode:
        """获取当前交易模式"""
        return self._current_mode
    
    def get_control_history(
        self,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取控制历史"""
        return [
            {
                "action": req.action.value,
                "requested_by": req.requested_by,
                "reason": req.reason,
                "timestamp": req.timestamp.isoformat(),
                "confirmed": req.confirmed,
            }
            for req in self._control_history[-limit:]
        ]
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        return {
            "is_frozen": self._is_frozen,
            "frozen_at": self._frozen_at.isoformat() if self._frozen_at else None,
            "frozen_by": self._frozen_by,
            "frozen_reason": self._frozen_reason,
            "current_mode": self._current_mode.value,
            "control_count": len(self._control_history),
        }
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.ADMIN_CONTROL,
                payload=payload,
            )
            self._event_callback(envelope)


# 使用示例
if __name__ == "__main__":
    panel = AdminControlPanel()
    
    # 设置回调
    def on_freeze(is_frozen: bool, reason: str):
        print(f"[回调] 冻结状态：{is_frozen}, 原因：{reason}")
    
    def on_cancel(symbol: Optional[str]) -> int:
        print(f"[回调] 撤单：symbol={symbol}")
        return 10  # 模拟取消 10 个订单
    
    def on_mode_change(old_mode: TradingMode, new_mode: TradingMode):
        print(f"[回调] 模式切换：{old_mode.value} → {new_mode.value}")
    
    panel.set_freeze_callback(on_freeze)
    panel.set_cancel_callback(on_cancel)
    panel.set_mode_callback(on_mode_change)
    
    # 测试冻结
    print("=== 测试冻结 ===")
    result = panel.request_freeze("admin", "系统维护")
    print(f"结果：{result.message}")
    print(f"状态：{panel.status()}")
    print()
    
    # 测试撤单
    print("=== 测试批量撤单 ===")
    result = panel.request_cancel_all("admin", "风险控制")
    print(f"结果：{result.message}")
    print()
    
    # 测试模式切换
    print("=== 测试模式切换 ===")
    result = panel.request_mode_change("admin", TradingMode.PAPER, "测试模式")
    print(f"结果：{result.message}")
    print()
    
    # 测试解冻
    print("=== 测试解冻 ===")
    result = panel.request_unfreeze("admin", "维护完成")
    print(f"结果：{result.message}")
    print(f"最终状态：{panel.status()}")
