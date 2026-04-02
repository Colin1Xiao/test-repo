"""
Protection Orders — 保护订单

实现止损止盈保护机制：
- Stop Loss (SL) - 止损单
- Take Profit (TP) - 止盈单
- Trailing Stop - 追踪止损
- Break-even Stop - 保本止损

保护订单设计原则：
- 与主订单绑定
- 交易所侧真实挂单（非逻辑止损）
- 自动调整（追踪/保本）
- 状态可观测

当前阶段：
- 实现平台内部保护订单对象
- 支持 SL/TP 计算
- 对接交易所适配器
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, OrderType, OrderStatus
from schemas.order import Order


class ProtectionType(Enum):
    """保护类型"""
    STOP_LOSS = "stop_loss"  # 止损
    TAKE_PROFIT = "take_profit"  # 止盈
    TRAILING_STOP = "trailing_stop"  # 追踪止损
    BREAK_EVEN = "break_even"  # 保本止损


class ProtectionStatus(Enum):
    """保护状态"""
    PENDING = "pending"  # 待激活
    ACTIVE = "active"  # 已激活
    TRIGGERED = "triggered"  # 已触发
    CANCELLED = "cancelled"  # 已取消
    EXPIRED = "expired"  # 已过期


@dataclass
class ProtectionOrder:
    """保护订单"""
    protection_id: str
    protection_type: ProtectionType
    parent_order_id: str
    symbol: str
    side: Side
    quantity: Decimal
    trigger_price: Decimal  # 触发价格
    limit_price: Optional[Decimal] = None  # 限价（可选）
    status: ProtectionStatus = ProtectionStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    activated_at: Optional[datetime] = None
    triggered_at: Optional[datetime] = None
    triggered_price: Optional[Decimal] = None
    venue_order_id: Optional[str] = None  # 交易所订单 ID
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "protection_id": self.protection_id,
            "protection_type": self.protection_type.value,
            "parent_order_id": self.parent_order_id,
            "symbol": self.symbol,
            "side": self.side.value,
            "quantity": str(self.quantity),
            "trigger_price": str(self.trigger_price),
            "limit_price": str(self.limit_price) if self.limit_price else None,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "triggered_at": self.triggered_at.isoformat() if self.triggered_at else None,
            "triggered_price": str(self.triggered_price) if self.triggered_price else None,
            "venue_order_id": self.venue_order_id,
        }


@dataclass
class ProtectionConfig:
    """保护配置"""
    stop_loss_pct: Decimal = Decimal("0.005")  # 止损 0.5%
    take_profit_pct: Decimal = Decimal("0.002")  # 止盈 0.2%
    trailing_stop_pct: Decimal = Decimal("0.003")  # 追踪止损 0.3%
    break_even_trigger_pct: Decimal = Decimal("0.001")  # 保本触发 0.1%
    auto_activate: bool = True  # 自动激活
    reduce_only: bool = True  # 仅减仓


class ProtectionManager:
    """保护订单管理器"""
    
    def __init__(self, config: Optional[ProtectionConfig] = None):
        self.config = config or ProtectionConfig()
        self._protections: Dict[str, ProtectionOrder] = {}
        self._by_parent: Dict[str, List[str]] = {}  # parent_order_id -> protection_ids
        self._event_callback: Optional[Callable] = None
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def create_protection(
        self,
        protection_type: ProtectionType,
        parent_order_id: str,
        symbol: str,
        side: Side,
        quantity: Decimal,
        entry_price: Decimal,
        trigger_price: Optional[Decimal] = None,
    ) -> ProtectionOrder:
        """创建保护订单"""
        protection_id = f"PROT-{parent_order_id}-{protection_type.value[:2].upper()}"
        
        # 计算触发价格（如果未指定）
        if trigger_price is None:
            trigger_price = self._calculate_trigger_price(
                protection_type, side, entry_price
            )
        
        protection = ProtectionOrder(
            protection_id=protection_id,
            protection_type=protection_type,
            parent_order_id=parent_order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            trigger_price=trigger_price,
        )
        
        self._protections[protection_id] = protection
        
        # 关联到父订单
        if parent_order_id not in self._by_parent:
            self._by_parent[parent_order_id] = []
        self._by_parent[parent_order_id].append(protection_id)
        
        # 自动激活
        if self.config.auto_activate:
            self.activate(protection_id)
        
        return protection
    
    def create_sl_tp(
        self,
        parent_order_id: str,
        symbol: str,
        side: Side,
        quantity: Decimal,
        entry_price: Decimal,
    ) -> Tuple[ProtectionOrder, ProtectionOrder]:
        """创建止损 + 止盈组合"""
        sl = self.create_protection(
            ProtectionType.STOP_LOSS,
            parent_order_id,
            symbol,
            side,
            quantity,
            entry_price,
        )
        
        tp = self.create_protection(
            ProtectionType.TAKE_PROFIT,
            parent_order_id,
            symbol,
            side,
            quantity,
            entry_price,
        )
        
        return sl, tp
    
    def activate(self, protection_id: str) -> bool:
        """激活保护订单"""
        protection = self._protections.get(protection_id)
        if not protection:
            return False
        
        protection.status = ProtectionStatus.ACTIVE
        protection.activated_at = datetime.utcnow()
        
        self._publish_event(EventType.ORDER_SUBMITTED, {
            "protection_id": protection_id,
            "protection_type": protection.protection_type.value,
            "action": "activate",
        })
        
        return True
    
    def trigger(
        self,
        protection_id: str,
        trigger_price: Decimal
    ) -> bool:
        """触发保护订单"""
        protection = self._protections.get(protection_id)
        if not protection:
            return False
        
        protection.status = ProtectionStatus.TRIGGERED
        protection.triggered_at = datetime.utcnow()
        protection.triggered_price = trigger_price
        
        self._publish_event(EventType.ORDER_FILLED, {
            "protection_id": protection_id,
            "protection_type": protection.protection_type.value,
            "action": "trigger",
            "trigger_price": str(trigger_price),
        })
        
        return True
    
    def cancel(self, protection_id: str) -> bool:
        """取消保护订单"""
        protection = self._protections.get(protection_id)
        if not protection:
            return False
        
        protection.status = ProtectionStatus.CANCELLED
        
        self._publish_event(EventType.ORDER_CANCELLED, {
            "protection_id": protection_id,
            "protection_type": protection.protection_type.value,
            "action": "cancel",
        })
        
        return True
    
    def update_trailing_stop(
        self,
        protection_id: str,
        current_price: Decimal
    ) -> bool:
        """更新追踪止损"""
        protection = self._protections.get(protection_id)
        if not protection:
            return False
        
        if protection.protection_type != ProtectionType.TRAILING_STOP:
            return False
        
        if protection.status != ProtectionStatus.ACTIVE:
            return False
        
        # 计算新的触发价格
        if protection.side == Side.BUY:
            # 多头：价格下跌时触发，追踪最高价
            new_trigger = current_price * (Decimal("1") - self.config.trailing_stop_pct)
            if new_trigger > protection.trigger_price:
                protection.trigger_price = new_trigger
        else:
            # 空头：价格上涨时触发，追踪最低价
            new_trigger = current_price * (Decimal("1") + self.config.trailing_stop_pct)
            if new_trigger < protection.trigger_price:
                protection.trigger_price = new_trigger
        
        return True
    
    def update_break_even(
        self,
        protection_id: str,
        current_price: Decimal,
        entry_price: Decimal
    ) -> bool:
        """更新保本止损"""
        protection = self._protections.get(protection_id)
        if not protection:
            return False
        
        if protection.protection_type != ProtectionType.BREAK_EVEN:
            return False
        
        if protection.status != ProtectionStatus.ACTIVE:
            return False
        
        # 检查是否达到保本触发条件
        pnl_pct = abs(current_price - entry_price) / entry_price
        
        if pnl_pct >= self.config.break_even_trigger_pct:
            # 移动到保本价
            protection.trigger_price = entry_price
            
            self._publish_event(EventType.ORDER_SUBMITTED, {
                "protection_id": protection_id,
                "action": "update_break_even",
                "new_trigger_price": str(protection.trigger_price),
            })
        
        return True
    
    def get_protection(self, protection_id: str) -> Optional[ProtectionOrder]:
        """获取保护订单"""
        return self._protections.get(protection_id)
    
    def get_protections_by_parent(self, parent_order_id: str) -> List[ProtectionOrder]:
        """获取父订单的所有保护"""
        protection_ids = self._by_parent.get(parent_order_id, [])
        return [
            self._protections[pid]
            for pid in protection_ids
            if pid in self._protections
        ]
    
    def get_active_protections(self) -> List[ProtectionOrder]:
        """获取所有活跃保护"""
        return [
            p for p in self._protections.values()
            if p.status == ProtectionStatus.ACTIVE
        ]
    
    def check_trigger(self, current_price: Decimal) -> List[ProtectionOrder]:
        """检查是否有保护需要触发"""
        triggered = []
        
        for protection in self.get_active_protections():
            if protection.side == Side.BUY:
                # 多头：价格跌破触发价
                if current_price <= protection.trigger_price:
                    self.trigger(protection.protection_id, current_price)
                    triggered.append(protection)
            else:
                # 空头：价格突破触发价
                if current_price >= protection.trigger_price:
                    self.trigger(protection.protection_id, current_price)
                    triggered.append(protection)
        
        return triggered
    
    def _calculate_trigger_price(
        self,
        protection_type: ProtectionType,
        side: Side,
        entry_price: Decimal
    ) -> Decimal:
        """计算触发价格"""
        if protection_type == ProtectionType.STOP_LOSS:
            if side == Side.BUY:
                return entry_price * (Decimal("1") - self.config.stop_loss_pct)
            else:
                return entry_price * (Decimal("1") + self.config.stop_loss_pct)
        
        elif protection_type == ProtectionType.TAKE_PROFIT:
            if side == Side.BUY:
                return entry_price * (Decimal("1") + self.config.take_profit_pct)
            else:
                return entry_price * (Decimal("1") - self.config.take_profit_pct)
        
        elif protection_type == ProtectionType.TRAILING_STOP:
            return entry_price  # 初始为入场价，后续动态调整
        
        elif protection_type == ProtectionType.BREAK_EVEN:
            return entry_price
        
        return entry_price
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.RISK_ENGINE,
                payload=payload,
            )
            self._event_callback(envelope)
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        active = self.get_active_protections()
        triggered = [p for p in self._protections.values() if p.status == ProtectionStatus.TRIGGERED]
        
        return {
            "total_protections": len(self._protections),
            "active_protections": len(active),
            "triggered_protections": len(triggered),
            "protections": [p.to_dict() for p in self._protections.values()],
        }


# 使用示例
if __name__ == "__main__":
    manager = ProtectionManager(ProtectionConfig(
        stop_loss_pct=Decimal("0.005"),  # 0.5%
        take_profit_pct=Decimal("0.002"),  # 0.2%
    ))
    
    print("=== 创建 SL/TP 组合 ===")
    
    sl, tp = manager.create_sl_tp(
        parent_order_id="ORD-001",
        symbol="ETH/USDT",
        side=Side.BUY,
        quantity=Decimal("0.1"),
        entry_price=Decimal("2000.0"),
    )
    
    print(f"止损：{sl.trigger_price} (触发价)")
    print(f"止盈：{tp.trigger_price} (触发价)")
    
    print("\n=== 检查触发 ===")
    
    # 价格下跌 1% - 应触发止损
    triggered = manager.check_trigger(Decimal("1980.0"))
    print(f"价格 1980: 触发 {len(triggered)} 个保护")
    
    print("\n=== 状态 ===")
    print(manager.status())
