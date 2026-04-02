"""
Cockpit Widgets — 驾驶舱组件

实现驾驶舱数据组件：
- KPI 卡片（权益/保证金/敞口）
- 健康状态（交易所连接/速率限制）
- 订单树（父子订单）
- 拒绝热力图
- 保护覆盖指示器
- 熔断器面板
- 事件时间线

设计原则：
- 数据驱动（从 State/Event 读取）
- 实时更新（订阅事件）
- 可组合（组件可复用）

当前阶段：
- 实现数据模型
- 实现数据聚合
- 前端渲染待对接
"""

from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, OrderStatus


@dataclass
class KPIMetric:
    """KPI 指标"""
    name: str
    value: Any
    unit: str
    change: Optional[float] = None  # 变化百分比
    trend: str = "neutral"  # up/down/neutral
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class VenueHealth:
    """交易所健康状态"""
    venue: str
    status: str  # healthy/degraded/down
    latency_ms: float
    rate_limit_remaining: int
    rate_limit_reset: datetime
    last_heartbeat: datetime
    errors_24h: int


@dataclass
class OrderNode:
    """订单树节点"""
    order_id: str
    parent_id: Optional[str]
    symbol: str
    side: Side
    quantity: Decimal
    filled_quantity: Decimal
    status: OrderStatus
    children: List["OrderNode"] = field(default_factory=list)


@dataclass
class RejectStat:
    """拒绝统计"""
    reason: str
    count: int
    last_occurrence: datetime
    percentage: float


@dataclass
class ProtectionStatus:
    """保护状态"""
    symbol: str
    has_protection: bool
    stop_loss: Optional[Decimal]
    take_profit: Optional[Decimal]
    coverage_pct: float  # 覆盖百分比


@dataclass
class BreakerStatus:
    """熔断器状态"""
    breaker_type: str
    state: str  # armed/tripped/cooldown/disabled
    tripped_at: Optional[datetime]
    trip_count: int
    last_reason: Optional[str]


@dataclass
class IncidentEvent:
    """事件时间线条目"""
    event_id: str
    event_type: str
    timestamp: datetime
    severity: str  # info/warning/error/critical
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class CockpitWidgets:
    """驾驶舱组件"""
    
    def __init__(self):
        self._event_callback: Optional[Callable] = None
        
        # 数据缓存
        self._kpi_cache: Dict[str, KPIMetric] = {}
        self._venue_cache: Dict[str, VenueHealth] = {}
        self._orders_cache: Dict[str, OrderNode] = {}
        self._reject_cache: Dict[str, RejectStat] = defaultdict(
            lambda: RejectStat(reason="", count=0, last_occurrence=datetime.utcnow(), percentage=0)
        )
        self._protection_cache: Dict[str, ProtectionStatus] = {}
        self._breaker_cache: Dict[str, BreakerStatus] = {}
        self._incident_cache: List[IncidentEvent] = []
        
        # 订阅事件
        self._subscribe_to_events()
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def _subscribe_to_events(self) -> None:
        """订阅事件（由外部调用）"""
        # 实际使用时，需要注册到 EventBus
        pass
    
    def on_event(self, envelope: EventEnvelope) -> None:
        """处理事件"""
        event_type = envelope.event_type
        
        if event_type == EventType.ORDER_FILLED:
            self._update_order(envelope)
        elif event_type == EventType.ORDER_REJECTED:
            self._update_reject_stat(envelope)
        elif event_type == EventType.BREAKER_TRIPPED:
            self._update_breaker(envelope)
        elif event_type == EventType.MARKET_DATA:
            self._update_market_data(envelope)
    
    # ========== KPI 卡片 ==========
    
    def get_kpi_equity(self, total_balance: Decimal, unrealized_pnl: Decimal) -> KPIMetric:
        """获取权益 KPI"""
        equity = total_balance + unrealized_pnl
        
        return KPIMetric(
            name="总权益",
            value=float(equity),
            unit="USDT",
            trend="up" if unrealized_pnl > 0 else "down" if unrealized_pnl < 0 else "neutral",
        )
    
    def get_kpi_margin(self, used_margin: Decimal, total_margin: Decimal) -> KPIMetric:
        """获取保证金 KPI"""
        utilization = float(used_margin / total_margin * 100) if total_margin > 0 else 0
        
        return KPIMetric(
            name="保证金使用率",
            value=utilization,
            unit="%",
            trend="up" if utilization > 50 else "neutral",
        )
    
    def get_kpi_exposure(self, long_exposure: Decimal, short_exposure: Decimal) -> KPIMetric:
        """获取敞口 KPI"""
        net_exposure = long_exposure - short_exposure
        gross_exposure = long_exposure + short_exposure
        
        return KPIMetric(
            name="净敞口",
            value=float(net_exposure),
            unit="USDT",
            change=float(gross_exposure),
        )
    
    def get_kpi_pnl(self, realized_pnl: Decimal, unrealized_pnl: Decimal) -> KPIMetric:
        """获取盈亏 KPI"""
        total_pnl = realized_pnl + unrealized_pnl
        
        return KPIMetric(
            name="总盈亏",
            value=float(total_pnl),
            unit="USDT",
            trend="up" if total_pnl > 0 else "down" if total_pnl < 0 else "neutral",
        )
    
    # ========== 健康状态 ==========
    
    def get_venue_health(self, venue: str) -> Optional[VenueHealth]:
        """获取交易所健康状态"""
        return self._venue_cache.get(venue)
    
    def update_venue_health(
        self,
        venue: str,
        latency_ms: float,
        rate_limit_remaining: int,
        errors_24h: int,
    ) -> None:
        """更新交易所健康状态"""
        # 根据指标判断状态
        if latency_ms > 1000 or errors_24h > 10:
            status = "degraded"
        elif latency_ms > 5000 or errors_24h > 50:
            status = "down"
        else:
            status = "healthy"
        
        self._venue_cache[venue] = VenueHealth(
            venue=venue,
            status=status,
            latency_ms=latency_ms,
            rate_limit_remaining=rate_limit_remaining,
            rate_limit_reset=datetime.utcnow() + timedelta(hours=1),
            last_heartbeat=datetime.utcnow(),
            errors_24h=errors_24h,
        )
    
    # ========== 订单树 ==========
    
    def get_order_tree(self, symbol: Optional[str] = None) -> List[OrderNode]:
        """获取订单树"""
        # 找到根订单（没有父订单的）
        roots = [
            node for node in self._orders_cache.values()
            if node.parent_id is None and (symbol is None or node.symbol == symbol)
        ]
        
        # 构建树
        for root in roots:
            self._build_order_tree(root)
        
        return roots
    
    def _build_order_tree(self, node: OrderNode) -> None:
        """递归构建订单树"""
        children = [
            n for n in self._orders_cache.values()
            if n.parent_id == node.order_id
        ]
        node.children = children
        
        for child in children:
            self._build_order_tree(child)
    
    def _update_order(self, envelope: EventEnvelope) -> None:
        """更新订单"""
        payload = envelope.payload
        order_id = payload.get("order_id")
        
        if order_id:
            self._orders_cache[order_id] = OrderNode(
                order_id=order_id,
                parent_id=payload.get("parent_id"),
                symbol=payload.get("symbol", ""),
                side=Side.BUY if payload.get("side") == "buy" else Side.SELL,
                quantity=Decimal(str(payload.get("quantity", 0))),
                filled_quantity=Decimal(str(payload.get("filled_quantity", 0))),
                status=OrderStatus.FILLED,
            )
    
    # ========== 拒绝热力图 ==========
    
    def get_reject_stats(self, limit: int = 10) -> List[RejectStat]:
        """获取拒绝统计"""
        stats = list(self._reject_cache.values())
        stats.sort(key=lambda x: x.count, reverse=True)
        return stats[:limit]
    
    def _update_reject_stat(self, envelope: EventEnvelope) -> None:
        """更新拒绝统计"""
        payload = envelope.payload
        reason = payload.get("reason", "unknown")
        
        stat = self._reject_cache[reason]
        stat.reason = reason
        stat.count += 1
        stat.last_occurrence = datetime.utcnow()
    
    # ========== 保护覆盖 ==========
    
    def get_protection_status(self, symbol: str) -> Optional[ProtectionStatus]:
        """获取保护状态"""
        return self._protection_cache.get(symbol)
    
    def update_protection(
        self,
        symbol: str,
        has_protection: bool,
        stop_loss: Optional[Decimal],
        take_profit: Optional[Decimal],
    ) -> None:
        """更新保护状态"""
        self._protection_cache[symbol] = ProtectionStatus(
            symbol=symbol,
            has_protection=has_protection,
            stop_loss=stop_loss,
            take_profit=take_profit,
            coverage_pct=100.0 if has_protection else 0.0,
        )
    
    # ========== 熔断器面板 ==========
    
    def get_breaker_status(self, breaker_type: str) -> Optional[BreakerStatus]:
        """获取熔断器状态"""
        return self._breaker_cache.get(breaker_type)
    
    def get_all_breakers(self) -> List[BreakerStatus]:
        """获取所有熔断器状态"""
        return list(self._breaker_cache.values())
    
    def _update_breaker(self, envelope: EventEnvelope) -> None:
        """更新熔断器状态"""
        payload = envelope.payload
        breaker_type = payload.get("breaker_type", "unknown")
        
        self._breaker_cache[breaker_type] = BreakerStatus(
            breaker_type=breaker_type,
            state="tripped",
            tripped_at=datetime.utcnow(),
            trip_count=payload.get("trip_count", 1),
            last_reason=payload.get("reason"),
        )
    
    # ========== 事件时间线 ==========
    
    def get_incident_timeline(self, limit: int = 50) -> List[IncidentEvent]:
        """获取事件时间线"""
        return self._incident_cache[-limit:]
    
    def add_incident(
        self,
        event_type: str,
        severity: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """添加事件"""
        incident = IncidentEvent(
            event_id=f"INC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            event_type=event_type,
            timestamp=datetime.utcnow(),
            severity=severity,
            description=description,
            metadata=metadata or {},
        )
        self._incident_cache.append(incident)
        
        # 限制缓存大小
        if len(self._incident_cache) > 100:
            self._incident_cache = self._incident_cache[-100:]
    
    # ========== 数据汇总 ==========
    
    def get_overview(self) -> Dict[str, Any]:
        """获取概览数据"""
        return {
            "kpis": {
                "equity": self._kpi_cache.get("equity"),
                "margin": self._kpi_cache.get("margin"),
                "exposure": self._kpi_cache.get("exposure"),
                "pnl": self._kpi_cache.get("pnl"),
            },
            "venues": {
                venue: health.status
                for venue, health in self._venue_cache.items()
            },
            "active_orders": sum(1 for o in self._orders_cache.values() if o.status in [OrderStatus.ACKED, OrderStatus.PARTIAL]),
            "protections": sum(1 for p in self._protection_cache.values() if p.has_protection),
            "active_breakers": sum(1 for b in self._breaker_cache.values() if b.state == "tripped"),
            "recent_incidents": len(self._incident_cache[-10:]),
        }
    
    def get_execution_view(self) -> Dict[str, Any]:
        """获取执行视图"""
        return {
            "order_tree": self.get_order_tree(),
            "reject_stats": self.get_reject_stats(),
        }
    
    def get_risk_view(self) -> Dict[str, Any]:
        """获取风险视图"""
        return {
            "protections": list(self._protection_cache.values()),
            "breakers": self.get_all_breakers(),
        }


# 使用示例
if __name__ == "__main__":
    widgets = CockpitWidgets()
    
    # 更新数据
    widgets.update_venue_health("okx", 50.0, 100, 0)
    widgets.update_protection("ETH/USDT", True, Decimal("1900"), Decimal("2100"))
    
    # 获取概览
    overview = widgets.get_overview()
    print(f"概览：{overview}")
    
    # 获取 KPI
    equity_kpi = widgets.get_kpi_equity(Decimal("1000"), Decimal("50"))
    print(f"权益：{equity_kpi.value} {equity_kpi.unit}")
    
    # 获取订单树
    order_tree = widgets.get_order_tree()
    print(f"订单树：{len(order_tree)} 个根订单")
