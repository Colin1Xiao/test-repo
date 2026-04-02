"""
持仓管理端点
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class Position(BaseModel):
    """持仓信息"""
    id: str = Field(description="持仓 ID")
    symbol: str = Field(description="交易对")
    exchange: str = Field(description="交易所")
    side: str = Field(description="方向 (long/short)")
    quantity: Decimal = Field(description="持仓数量")
    entry_price: Decimal = Field(description="开仓价格")
    current_price: Decimal = Field(description="当前价格")
    unrealized_pnl: Decimal = Field(description="未实现盈亏")
    unrealized_pnl_percent: Decimal = Field(description="未实现盈亏率")
    liquidation_price: Optional[Decimal] = Field(default=None, description="清算价格")
    leverage: int = Field(default=1, description="杠杆倍数")
    margin_used: Decimal = Field(description="已用保证金")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        schema_extra = {
            "example": {
                "id": "pos-12345",
                "symbol": "ETH/USDT:USDT",
                "exchange": "okx",
                "side": "long",
                "quantity": "0.13",
                "entry_price": "2000.00",
                "current_price": "2050.00",
                "unrealized_pnl": "6.50",
                "unrealized_pnl_percent": "2.50",
                "liquidation_price": "1800.00",
                "leverage": 100,
                "margin_used": "2.60",
                "timestamp": "2026-04-01T21:30:00Z",
            }
        }


class PositionSummary(BaseModel):
    """持仓总览"""
    total_positions: int = Field(default=0, description="总持仓数量")
    total_value: Decimal = Field(default=Decimal("0"), description="持仓总价值")
    total_unrealized_pnl: Decimal = Field(default=Decimal("0"), description="总未实现盈亏")
    average_leverage: Optional[float] = Field(default=None, description="平均杠杆")
    net_exposure: Decimal = Field(default=Decimal("0"), description="净敞口")
    margin_ratio: Optional[float] = Field(default=None, description="保证金比率")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PositionListResponse(BaseModel):
    """持仓列表响应"""
    positions: List[Position]
    summary: PositionSummary
    page: int
    page_size: int
    total: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# 模拟数据 (开发阶段)
_mock_positions = [
    Position(
        id="pos-001",
        symbol="ETH/USDT:USDT",
        exchange="okx",
        side="long",
        quantity=Decimal("0.13"),
        entry_price=Decimal("2000.00"),
        current_price=Decimal("2050.00"),
        unrealized_pnl=Decimal("6.50"),
        unrealized_pnl_percent=Decimal("2.50"),
        liquidation_price=Decimal("1800.00"),
        leverage=100,
        margin_used=Decimal("2.60"),
    ),
    Position(
        id="pos-002",
        symbol="BTC/USDT:USDT",
        exchange="okx",
        side="short",
        quantity=Decimal("0.02"),
        entry_price=Decimal("65000.00"),
        current_price=Decimal("64500.00"),
        unrealized_pnl=Decimal("100.00"),
        unrealized_pnl_percent=Decimal("0.77"),
        liquidation_price=Decimal("68000.00"),
        leverage=50,
        margin_used=Decimal("26.00"),
    ),
]


@router.get("/", response_model=PositionListResponse)
async def list_positions(
    exchange: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    获取持仓列表

    参数:
    - exchange: 交易所过滤 (可选)
    - page: 页码
    - page_size: 每页数量
    """

    # 过滤交易所
    positions = _mock_positions
    if exchange:
        positions = [p for p in positions if p.exchange == exchange]

    # 计算总览
    total_positions = len(positions)
    total_value = sum(p.quantity * p.current_price for p in positions)
    total_unrealized_pnl = sum(p.unrealized_pnl for p in positions)

    # 计算平均杠杆 (排除无杠杆的)
    leveraged_positions = [p for p in positions if p.leverage > 1]
    average_leverage = (
        sum(p.leverage for p in leveraged_positions) / len(leveraged_positions)
        if leveraged_positions else None
    )

    # 计算净敞口 (多头为正，空头为负)
    net_exposure = sum(
        p.quantity * p.current_price * (1 if p.side == "long" else -1)
        for p in positions
    )

    # 计算保证金比率
    total_margin = sum(p.margin_used for p in positions)
    margin_ratio = (total_margin / total_value) if total_value > 0 else None

    summary = PositionSummary(
        total_positions=total_positions,
        total_value=total_value,
        total_unrealized_pnl=total_unrealized_pnl,
        average_leverage=average_leverage,
        net_exposure=net_exposure,
        margin_ratio=margin_ratio,
        timestamp=datetime.now(timezone.utc),
    )

    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paged_positions = positions[start:end]

    return PositionListResponse(
        positions=paged_positions,
        summary=summary,
        page=page,
        page_size=page_size,
        total=total_positions,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/{position_id}", response_model=Position)
async def get_position(position_id: str):
    """
    获取单个持仓详情

    参数:
    - position_id: 持仓 ID
    """

    for position in _mock_positions:
        if position.id == position_id:
            # 更新当前价格 (模拟实时变化)
            import random
            current_price = position.current_price
            new_price = current_price * Decimal(str(1 + random.uniform(-0.005, 0.005)))
            position.current_price = new_price

            # 重新计算盈亏
            side_multiplier = 1 if position.side == "long" else -1
            pnl = position.quantity * (new_price - position.entry_price) * side_multiplier
            position.unrealized_pnl = pnl
            position.unrealized_pnl_percent = (pnl / (position.quantity * position.entry_price)) * Decimal("100")

            position.timestamp = datetime.now(timezone.utc)
            return position

    raise HTTPException(status_code=404, detail=f"未找到持仓: {position_id}")


@router.get("/summary", response_model=PositionSummary)
async def get_positions_summary():
    """
    获取持仓总览
    """
    positions = _mock_positions

    total_positions = len(positions)
    total_value = sum(p.quantity * p.current_price for p in positions)
    total_unrealized_pnl = sum(p.unrealized_pnl for p in positions)

    # 计算平均杠杆 (排除无杠杆的)
    leveraged_positions = [p for p in positions if p.leverage > 1]
    average_leverage = (
        sum(p.leverage for p in leveraged_positions) / len(leveraged_positions)
        if leveraged_positions else None
    )

    # 计算净敞口
    net_exposure = sum(
        p.quantity * p.current_price * (1 if p.side == "long" else -1)
        for p in positions
    )

    # 计算保证金比率
    total_margin = sum(p.margin_used for p in positions)
    margin_ratio = (total_margin / total_value) if total_value > 0 else None

    return PositionSummary(
        total_positions=total_positions,
        total_value=total_value,
        total_unrealized_pnl=total_unrealized_pnl,
        average_leverage=average_leverage,
        net_exposure=net_exposure,
        margin_ratio=margin_ratio,
        timestamp=datetime.now(timezone.utc),
    )
