"""
Order State Machine — 订单状态机

管理订单的完整生命周期：
PENDING → ACCEPTED → PARTIALLY_FILLED → FILLED
                    → CANCELLED
                    → REJECTED

每个状态转换都会产生事件，用于审计和回放。
"""

import time
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from pathlib import Path
from decimal import Decimal

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.order import Order
from schemas.enums import Side as OrderSide, OrderType, OrderStatus


class OrderEvent(Enum):
    """订单事件类型"""
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# 状态转换矩阵（映射到 enums.py 中的 OrderStatus）
STATE_TRANSITIONS = {
    OrderStatus.DRAFT: {  # PENDING
        OrderEvent.ACCEPTED: OrderStatus.ACKED,  # ACCEPTED
        OrderEvent.REJECTED: OrderStatus.REJECTED,
        OrderEvent.CANCELLED: OrderStatus.CANCELED,
    },
    OrderStatus.ACKED: {  # ACCEPTED
        OrderEvent.PARTIALLY_FILLED: OrderStatus.PARTIAL,
        OrderEvent.FILLED: OrderStatus.FILLED,
        OrderEvent.CANCELLED: OrderStatus.CANCELED,
    },
    OrderStatus.PARTIAL: {  # PARTIALLY_FILLED
        OrderEvent.PARTIALLY_FILLED: OrderStatus.PARTIAL,
        OrderEvent.FILLED: OrderStatus.FILLED,
        OrderEvent.CANCELLED: OrderStatus.CANCELED,
    },
    # 终态，不可转换
    OrderStatus.FILLED: {},
    OrderStatus.CANCELED: {},
    OrderStatus.REJECTED: {},
}


@dataclass
class OrderState:
    """订单状态"""
    order: Order
    current_status: OrderStatus = OrderStatus.DRAFT  # PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # 执行统计
    filled_quantity: Decimal = Decimal("0.0")
    remaining_quantity: Decimal = Decimal("0.0")
    average_fill_price: Decimal = Decimal("0.0")
    total_fees: Decimal = Decimal("0.0")
    
    # 事件历史
    events: List[Dict[str, Any]] = field(default_factory=list)
    
    # 元数据
    venue_order_id: Optional[str] = None
    reject_reason: Optional[str] = None
    cancel_reason: Optional[str] = None
    
    def __post_init__(self):
        self.remaining_quantity = self.order.qty if self.order.qty else Decimal("0.0")
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "order_id": self.order.order_id,
            "current_status": self.current_status.value,
            "filled_quantity": self.filled_quantity,
            "remaining_quantity": self.remaining_quantity,
            "average_fill_price": self.average_fill_price,
            "total_fees": self.total_fees,
            "venue_order_id": self.venue_order_id,
            "reject_reason": self.reject_reason,
            "cancel_reason": self.cancel_reason,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "event_count": len(self.events),
        }


class OrderStateMachine:
    """订单状态机"""
    
    def __init__(self, order: Order):
        self.state = OrderState(order=order)
        self._event_callback: Optional[callable] = None
    
    def set_event_callback(self, callback: callable) -> None:
        """设置事件回调（用于发布到 EventBus）"""
        self._event_callback = callback
    
    def submit(self) -> bool:
        """提交订单"""
        if self.state.current_status != OrderStatus.DRAFT:
            return False
        
        self._record_event(
            event=OrderEvent.SUBMITTED,
            details={"submitted_at": datetime.utcnow().isoformat()}
        )
        return True
    
    def accept(self, venue_order_id: str) -> bool:
        """接受订单"""
        if not self._can_transition(OrderEvent.ACCEPTED):
            return False
        
        self.state.venue_order_id = venue_order_id
        self._transition(OrderEvent.ACCEPTED)
        
        self._record_event(
            event=OrderEvent.ACCEPTED,
            details={
                "venue_order_id": venue_order_id,
                "accepted_at": datetime.utcnow().isoformat()
            }
        )
        
        # 发布事件
        self._publish_event(EventType.ORDER_ACCEPTED, {
            "order_id": self.state.order.order_id,
            "venue_order_id": venue_order_id,
        })
        
        return True
    
    def reject(self, reason: str) -> bool:
        """拒绝订单"""
        if not self._can_transition(OrderEvent.REJECTED):
            return False
        
        self.state.reject_reason = reason
        self._transition(OrderEvent.REJECTED)
        
        self._record_event(
            event=OrderEvent.REJECTED,
            details={
                "reason": reason,
                "rejected_at": datetime.utcnow().isoformat()
            }
        )
        
        # 发布事件
        self._publish_event(EventType.ORDER_REJECTED, {
            "order_id": self.state.order.order_id,
            "reason": reason,
        })
        
        return True
    
    def partial_fill(
        self,
        fill_quantity: Any,
        fill_price: Any,
        fee: Any = Decimal("0.0")
    ) -> bool:
        """部分成交"""
        if not self._can_transition(OrderEvent.PARTIALLY_FILLED):
            return False
        
        # 更新执行统计
        old_filled = self.state.filled_quantity
        self.state.filled_quantity += fill_quantity
        self.state.remaining_quantity -= fill_quantity
        self.state.total_fees += fee
        
        # 计算平均成交价
        total_notional = (old_filled * self.state.average_fill_price + 
                         fill_quantity * fill_price)
        self.state.average_fill_price = total_notional / self.state.filled_quantity
        
        self._transition(OrderEvent.PARTIALLY_FILLED)
        
        self._record_event(
            event=OrderEvent.PARTIALLY_FILLED,
            details={
                "fill_quantity": fill_quantity,
                "fill_price": fill_price,
                "fee": fee,
                "filled_at": datetime.utcnow().isoformat()
            }
        )
        
        # 发布事件
        self._publish_event(EventType.ORDER_FILLED, {
            "order_id": self.state.order.order_id,
            "fill_quantity": fill_quantity,
            "fill_price": fill_price,
            "fee": fee,
            "is_partial": True,
        })
        
        return True
    
    def fill(
        self,
        fill_quantity: Any,
        fill_price: Any,
        fee: Any = Decimal("0.0")
    ) -> bool:
        """完全成交"""
        if self.state.current_status not in [OrderStatus.ACKED, OrderStatus.PARTIAL]:
            return False
        
        # 更新执行统计
        old_filled = self.state.filled_quantity
        self.state.filled_quantity += fill_quantity
        self.state.remaining_quantity = 0
        self.state.total_fees += fee
        
        # 计算平均成交价
        total_notional = (old_filled * self.state.average_fill_price + 
                         fill_quantity * fill_price)
        self.state.average_fill_price = total_notional / self.state.filled_quantity
        
        self._transition(OrderEvent.FILLED)
        
        self._record_event(
            event=OrderEvent.FILLED,
            details={
                "fill_quantity": fill_quantity,
                "fill_price": fill_price,
                "fee": fee,
                "filled_at": datetime.utcnow().isoformat()
            }
        )
        
        # 发布事件
        self._publish_event(EventType.ORDER_FILLED, {
            "order_id": self.state.order.order_id,
            "fill_quantity": fill_quantity,
            "fill_price": fill_price,
            "fee": fee,
            "is_partial": False,
        })
        
        return True
    
    def cancel(self, reason: str = "user_requested") -> bool:
        """取消订单"""
        if not self._can_transition(OrderEvent.CANCELLED):
            return False
        
        self.state.cancel_reason = reason
        self._transition(OrderEvent.CANCELLED)
        
        self._record_event(
            event=OrderEvent.CANCELLED,
            details={
                "reason": reason,
                "cancelled_at": datetime.utcnow().isoformat()
            }
        )
        
        # 发布事件
        self._publish_event(EventType.ORDER_CANCELLED, {
            "order_id": self.state.order.order_id,
            "reason": reason,
        })
        
        return True
    
    def is_terminal(self) -> bool:
        """是否终态"""
        return self.state.current_status in [
            OrderStatus.FILLED,
            OrderStatus.CANCELED,
            OrderStatus.REJECTED,
        ]
    
    def _can_transition(self, event: OrderEvent) -> bool:
        """检查是否可以转换"""
        current = self.state.current_status
        transitions = STATE_TRANSITIONS.get(current, {})
        return event in transitions
    
    def _transition(self, event: OrderEvent) -> None:
        """执行状态转换"""
        current = self.state.current_status
        transitions = STATE_TRANSITIONS.get(current, {})
        
        if event in transitions:
            self.state.current_status = transitions[event]
            self.state.updated_at = datetime.utcnow()
    
    def _record_event(self, event: OrderEvent, details: Dict[str, Any]) -> None:
        """记录事件历史"""
        self.state.events.append({
            "event": event.value,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details,
        })
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件到 EventBus"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.EXECUTION_ENGINE,
                payload=payload,
                correlation_id=self.state.order.order_id,
            )
            self._event_callback(envelope)


class OrderStateManager:
    """订单状态管理器（管理多个订单）"""
    
    def __init__(self):
        self._orders: Dict[str, OrderStateMachine] = {}
        self._event_callback: Optional[callable] = None
    
    def set_event_callback(self, callback: callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
        # 传播到所有现有订单
        for order_fsm in self._orders.values():
            order_fsm.set_event_callback(callback)
    
    def create_order(self, order: Order) -> OrderStateMachine:
        """创建订单状态机"""
        if order.order_id in self._orders:
            raise ValueError(f"Order {order.order_id} already exists")
        
        fsm = OrderStateMachine(order)
        if self._event_callback:
            fsm.set_event_callback(self._event_callback)
        
        self._orders[order.order_id] = fsm
        return fsm
    
    def get_order(self, order_id: str) -> Optional[OrderStateMachine]:
        """获取订单状态机"""
        return self._orders.get(order_id)
    
    def get_active_orders(self) -> List[OrderStateMachine]:
        """获取所有活跃订单"""
        return [
            fsm for fsm in self._orders.values()
            if not fsm.is_terminal()
        ]
    
    def get_terminal_orders(self) -> List[OrderStateMachine]:
        """获取所有终态订单"""
        return [
            fsm for fsm in self._orders.values()
            if fsm.is_terminal()
        ]
    
    def summary(self) -> Dict[str, Any]:
        """汇总统计"""
        total = len(self._orders)
        active = len(self.get_active_orders())
        terminal = len(self.get_terminal_orders())
        
        filled = sum(1 for fsm in self._orders.values() 
                    if fsm.state.current_status == OrderStatus.FILLED)
        cancelled = sum(1 for fsm in self._orders.values() 
                       if fsm.state.current_status == OrderStatus.CANCELED)
        rejected = sum(1 for fsm in self._orders.values() 
                      if fsm.state.current_status == OrderStatus.REJECTED)
        
        return {
            "total_orders": total,
            "active_orders": active,
            "terminal_orders": terminal,
            "filled": filled,
            "cancelled": cancelled,
            "rejected": rejected,
        }


# 使用示例
if __name__ == "__main__":
    # 创建订单
    order = Order(
        order_id="ORD-TEST-001",
        symbol="ETH/USDT",
        side=OrderSide.BUY,
        type=OrderType.LIMIT,
        quantity=0.1,
        price=2000.0,
    )
    
    # 创建状态机
    fsm = OrderStateMachine(order)
    
    # 模拟订单生命周期
    print(f"初始状态：{fsm.state.current_status.value}")
    
    fsm.submit()
    print(f"提交后：{fsm.state.current_status.value}")
    
    fsm.accept("VENUE-123")
    print(f"接受后：{fsm.state.current_status.value}, venue_id={fsm.state.venue_order_id}")
    
    fsm.partial_fill(0.05, 2000.5, 0.01)
    print(f"部分成交后：{fsm.state.current_status.value}, filled={fsm.state.filled_quantity}")
    
    fsm.fill(0.05, 2000.6, 0.01)
    print(f"完全成交后：{fsm.state.current_status.value}, filled={fsm.state.filled_quantity}")
    
    print(f"\n事件历史：{len(fsm.state.events)} 个事件")
    for event in fsm.state.events:
        print(f"  - {event['event']} @ {event['timestamp']}")
    
    print(f"\n终态：{fsm.is_terminal()}")
