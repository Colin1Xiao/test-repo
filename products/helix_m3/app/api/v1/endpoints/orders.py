"""
订单管理端点
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class OrderStatus(str, Enum):
    """订单状态"""
    PENDING = "pending"  # 待处理
    OPEN = "open"       # 已开仓
    FILLED = "filled"   # 已成交
    PARTIAL = "partial" # 部分成交
    CANCELLED = "cancelled" # 已取消
    REJECTED = "rejected"   # 已拒绝
    EXPIRED = "expired"     # 已过期


class OrderSide(str, Enum):
    """订单方向"""
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    """订单类型"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"


class Order(BaseModel):
    """订单信息"""
    id: str = Field(description="订单 ID")
    client_order_id: Optional[str] = Field(default=None, description="客户端订单 ID")
    symbol: str = Field(description="交易对")
    exchange: str = Field(description="交易所")
    side: OrderSide = Field(description="方向")
    order_type: OrderType = Field(description="订单类型")
    status: OrderStatus = Field(description="状态")
    quantity: Decimal = Field(description="数量")
    filled_quantity: Decimal = Field(description="已成交数量")
    price: Optional[Decimal] = Field(default=None, description="价格")
    stop_price: Optional[Decimal] = Field(default=None, description="止损价格")
    average_fill_price: Optional[Decimal] = Field(default=None, description="平均成交价")
    commission: Optional[Decimal] = Field(default=None, description="手续费")
    pnl: Optional[Decimal] = Field(default=None, description="盈亏")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    filled_at: Optional[datetime] = Field(default=None, description="成交时间")
    cancelled_at: Optional[datetime] = Field(default=None, description="取消时间")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "order-12345",
                "client_order_id": "cli-001",
                "symbol": "ETH/USDT:USDT",
                "exchange": "okx",
                "side": "buy",
                "order_type": "limit",
                "status": "filled",
                "quantity": "0.13",
                "filled_quantity": "0.13",
                "price": "2000.00",
                "stop_price": None,
                "average_fill_price": "1999.95",
                "commission": "0.26",
                "pnl": "1.09",
                "created_at": "2026-03-21T14:18:00Z",
                "updated_at": "2026-03-21T14:18:05Z",
                "filled_at": "2026-03-21T14:18:05Z",
                "cancelled_at": None,
            }
        }


class OrderSummary(BaseModel):
    """订单总览"""
    total_orders: int = Field(default=0, description="总订单数")
    active_orders: int = Field(default=0, description="活跃订单数")
    filled_orders: int = Field(default=0, description="已成交订单数")
    cancelled_orders: int = Field(default=0, description="已取消订单数")
    total_volume: Decimal = Field(default=Decimal("0"), description="总交易量")
    total_commission: Decimal = Field(default=Decimal("0"), description="总手续费")
    total_pnl: Decimal = Field(default=Decimal("0"), description="总盈亏")
    win_rate: Optional[float] = Field(default=None, description="胜率")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderListResponse(BaseModel):
    """订单列表响应"""
    orders: List[Order]
    summary: OrderSummary
    page: int
    page_size: int
    total: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# 模拟数据 (开发阶段)
_mock_orders = [
    Order(
        id="order-001",
        client_order_id="M2-LIVE-20260321141800",
        symbol="ETH/USDT:USDT",
        exchange="okx",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        status=OrderStatus.FILLED,
        quantity=Decimal("0.13"),
        filled_quantity=Decimal("0.13"),
        price=Decimal("2000.00"),
        average_fill_price=Decimal("1999.95"),
        commission=Decimal("0.26"),
        pnl=Decimal("1.09"),
        created_at=datetime(2026, 3, 21, 14, 18, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 21, 14, 18, 5, tzinfo=timezone.utc),
        filled_at=datetime(2026, 3, 21, 14, 18, 5, tzinfo=timezone.utc),
    ),
    Order(
        id="order-002",
        symbol="BTC/USDT:USDT",
        exchange="okx",
        side=OrderSide.SELL,
        order_type=OrderType.MARKET,
        status=OrderStatus.OPEN,
        quantity=Decimal("0.02"),
        filled_quantity=Decimal("0.00"),
        price=None,
        average_fill_price=None,
        commission=None,
        pnl=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ),
    Order(
        id="order-003",
        symbol="SOL/USDT:USDT",
        exchange="okx",
        side=OrderSide.BUY,
        order_type=OrderType.STOP,
        status=OrderStatus.CANCELLED,
        quantity=Decimal("5.00"),
        filled_quantity=Decimal("0.00"),
        price=Decimal("150.00"),
        stop_price=Decimal("155.00"),
        average_fill_price=None,
        commission=None,
        pnl=None,
        created_at=datetime(2026, 3, 20, 10, 30, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 20, 11, 0, 0, tzinfo=timezone.utc),
        cancelled_at=datetime(2026, 3, 20, 11, 0, 0, tzinfo=timezone.utc),
    ),
]


@router.get("/active", response_model=OrderListResponse)
async def list_active_orders(
    exchange: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    获取活跃订单列表
    
    参数:
    - exchange: 交易所过滤 (可选)
    - page: 页码
    - page_size: 每页数量
    """
    
    # 过滤活跃订单
    active_statuses = {OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.PARTIAL}
    active_orders = [o for o in _mock_orders if o.status in active_statuses]
    
    # 过滤交易所
    if exchange:
        active_orders = [o for o in active_orders if o.exchange == exchange]
    
    # 计算统计
    total_orders = len(active_orders)
    
    summary = OrderSummary(
        total_orders=total_orders,
        active_orders=total_orders,
        filled_orders=0,
        cancelled_orders=0,
        total_volume=Decimal("0"),
        total_commission=Decimal("0"),
        total_pnl=Decimal("0"),
        win_rate=None,
        timestamp=datetime.now(timezone.utc),
    )
    
    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paged_orders = active_orders[start:end]
    
    return OrderListResponse(
        orders=paged_orders,
        summary=summary,
        page=page,
        page_size=page_size,
        total=total_orders,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/", response_model=OrderListResponse)
async def list_orders(
    exchange: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    获取所有订单列表
    
    参数:
    - exchange: 交易所过滤 (可选)
    - status: 状态过滤 (可选)
    - page: 页码
    - page_size: 每页数量
    """
    
    # 过滤
    orders = _mock_orders
    if exchange:
        orders = [o for o in orders if o.exchange == exchange]
    if status:
        orders = [o for o in orders if o.status == status]
    
    # 计算统计
    total_orders = len(orders)
    active_orders = len([o for o in orders if o.status in {OrderStatus.OPEN, OrderStatus.PENDING}])
    filled_orders = len([o for o in orders if o.status == OrderStatus.FILLED])
    cancelled_orders = len([o for o in orders if o.status == OrderStatus.CANCELLED])
    
    # 计算交易量和盈亏
    filled_order_list = [o for o in orders if o.status == OrderStatus.FILLED]
    total_volume = sum(o.filled_quantity * (o.average_fill_price or Decimal("0")) 
                       for o in filled_order_list if o.average_fill_price)
    total_commission = sum(o.commission or Decimal("0") for o in filled_order_list)
    total_pnl = sum(o.pnl or Decimal("0") for o in filled_order_list)
    
    # 计算胜率
    win_orders = len([o for o in filled_order_list if (o.pnl or Decimal("0")) > 0])
    win_rate = (win_orders / filled_orders) if filled_orders > 0 else None
    
    summary = OrderSummary(
        total_orders=total_orders,
        active_orders=active_orders,
        filled_orders=filled_orders,
        cancelled_orders=cancelled_orders,
        total_volume=total_volume,
        total_commission=total_commission,
        total_pnl=total_pnl,
        win_rate=win_rate,
        timestamp=datetime.now(timezone.utc),
    )
    
    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paged_orders = orders[start:end]
    
    return OrderListResponse(
        orders=paged_orders,
        summary=summary,
        page=page,
        page_size=page_size,
        total=total_orders,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str):
    """
    获取单个订单详情
    
    参数:
    - order_id: 订单 ID
    """
    
    for order in _mock_orders:
        if order.id == order_id:
            # 更新时间戳
            order.updated_at = datetime.now(timezone.utc)
            return order
    
    raise HTTPException(status_code=404, detail=f"未找到订单: {order_id}")


@router.get("/summary", response_model=OrderSummary)
async def get_orders_summary():
    """
    获取订单统计总览
    """
    orders = _mock_orders
    
    total_orders = len(orders)
    active_orders = len([o for o in orders if o.status in {OrderStatus.OPEN, OrderStatus.PENDING}])
    filled_orders = len([o for o in orders if o.status == OrderStatus.FILLED])
    cancelled_orders = len([o for o in orders if o.status == OrderStatus.CANCELLED])
    
    # 计算交易量和盈亏
    filled_order_list = [o for o in orders if o.status == OrderStatus.FILLED]
    total_volume = sum(o.filled_quantity * (o.average_fill_price or Decimal("0")) 
                       for o in filled_order_list if o.average_fill_price)
    total_commission = sum(o.commission or Decimal("0") for o in filled_order_list)
    total_pnl = sum(o.pnl or Decimal("0") for o in filled_order_list)
    
    # 计算胜率
    win_orders = len([o for o in filled_order_list if (o.pnl or Decimal("0")) > 0])
    win_rate = (win_orders / filled_orders) if filled_orders > 0 else None
    
    return OrderSummary(
        total_orders=total_orders,
        active_orders=active_orders,
        filled_orders=filled_orders,
        cancelled_orders=cancelled_orders,
        total_volume=total_volume,
        total_commission=total_commission,
        total_pnl=total_pnl,
        win_rate=win_rate,
        timestamp=datetime.now(timezone.utc),
    )
