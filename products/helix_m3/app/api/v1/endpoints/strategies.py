"""
策略管理端点
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class StrategyStatus(str, Enum):
    """策略状态"""
    ACTIVE = "active"      # 活跃
    PAUSED = "paused"      # 暂停
    STOPPED = "stopped"    # 停止
    BACKTESTING = "backtesting"  # 回测中


class StrategyType(str, Enum):
    """策略类型"""
    ARBITRAGE = "arbitrage"      # 套利
    TREND_FOLLOWING = "trend_following"  # 趋势跟踪
    MEAN_REVERSION = "mean_reversion"    # 均值回归
    MOMENTUM = "momentum"        # 动量
    BREAKOUT = "breakout"        # 突破
    HEDGING = "hedging"          # 对冲
    MARKET_MAKING = "market_making"  # 做市


class StrategyPerformance(BaseModel):
    """策略表现"""
    total_trades: int = Field(default=0, description="总交易次数")
    win_rate: float = Field(default=0.0, description="胜率")
    profit_factor: float = Field(default=0.0, description="盈亏比")
    total_pnl: Decimal = Field(default=Decimal("0"), description="总盈亏")
    sharpe_ratio: Optional[float] = Field(default=None, description="夏普比率")
    max_drawdown: float = Field(default=0.0, description="最大回撤")
    avg_win: Decimal = Field(default=Decimal("0"), description="平均盈利")
    avg_loss: Decimal = Field(default=Decimal("0"), description="平均亏损")
    expectancy: float = Field(default=0.0, description="期望值")


class Strategy(BaseModel):
    """策略信息"""
    id: str = Field(description="策略 ID")
    name: str = Field(description="策略名称")
    description: str = Field(description="策略描述")
    strategy_type: StrategyType = Field(description="策略类型")
    status: StrategyStatus = Field(description="状态")
    version: str = Field(default="1.0.0", description="版本")
    symbols: List[str] = Field(default_factory=list, description="交易对列表")
    exchanges: List[str] = Field(default_factory=list, description="交易所列表")
    
    # 参数
    parameters: Dict[str, float] = Field(default_factory=dict, description="策略参数")
    risk_parameters: Dict[str, float] = Field(default_factory=dict, description="风险参数")
    
    # 表现
    performance: StrategyPerformance = Field(default_factory=StrategyPerformance)
    
    # 元数据
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = Field(default=None, description="启动时间")
    last_trade_at: Optional[datetime] = Field(default=None, description="最后交易时间")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "strategy-001",
                "name": "Tail Capture V5.4",
                "description": "尾部捕获策略 - 低胜率高赔率",
                "strategy_type": "breakout",
                "status": "active",
                "version": "5.4.0",
                "symbols": ["ETH/USDT:USDT"],
                "exchanges": ["okx"],
                "parameters": {
                    "leverage": 100,
                    "stop_loss_pct": 0.005,
                    "take_profit_pct": 0.002,
                    "position_size": 0.13,
                },
                "risk_parameters": {
                    "max_daily_loss": 0.05,
                    "max_consecutive_losses": 10,
                    "max_position_size": 0.13,
                },
                "performance": {
                    "total_trades": 46,
                    "win_rate": 11.4,
                    "profit_factor": 3.23,
                    "total_pnl": "15.67",
                    "sharpe_ratio": 1.85,
                    "max_drawdown": 0.015,
                    "avg_win": "0.35",
                    "avg_loss": "-0.10",
                    "expectancy": 0.0003,
                },
                "created_at": "2026-03-19T10:00:00Z",
                "updated_at": "2026-04-01T20:00:00Z",
                "started_at": "2026-03-19T10:00:00Z",
                "last_trade_at": "2026-03-21T14:18:05Z",
            }
        }


class StrategyListResponse(BaseModel):
    """策略列表响应"""
    strategies: List[Strategy]
    total: int
    page: int
    page_size: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# 模拟数据 (开发阶段)
_mock_strategies = [
    Strategy(
        id="strategy-001",
        name="Tail Capture V5.4",
        description="尾部捕获策略 - 低胜率高赔率，专注于捕捉极端行情",
        strategy_type=StrategyType.BREAKOUT,
        status=StrategyStatus.ACTIVE,
        version="5.4.0",
        symbols=["ETH/USDT:USDT"],
        exchanges=["okx"],
        parameters={
            "leverage": 100,
            "stop_loss_pct": 0.005,
            "take_profit_pct": 0.002,
            "position_size": 0.13,
            "time_exit_seconds": 30,
        },
        risk_parameters={
            "max_daily_loss": 0.05,
            "max_consecutive_losses": 10,
            "max_position_size": 0.13,
            "risk_per_trade": 0.005,
        },
        performance=StrategyPerformance(
            total_trades=46,
            win_rate=11.4,
            profit_factor=3.23,
            total_pnl=Decimal("15.67"),
            sharpe_ratio=1.85,
            max_drawdown=0.015,
            avg_win=Decimal("0.35"),
            avg_loss=Decimal("-0.10"),
            expectancy=0.0003,
        ),
        created_at=datetime(2026, 3, 19, 10, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 1, 20, 0, 0, tzinfo=timezone.utc),
        started_at=datetime(2026, 3, 19, 10, 0, 0, tzinfo=timezone.utc),
        last_trade_at=datetime(2026, 3, 21, 14, 18, 5, tzinfo=timezone.utc),
    ),
    Strategy(
        id="strategy-002",
        name="Mean Reversion Grid",
        description="均值回归网格策略 - 在价格区间内进行网格交易",
        strategy_type=StrategyType.MEAN_REVERSION,
        status=StrategyStatus.PAUSED,
        version="2.1.0",
        symbols=["BTC/USDT:USDT", "ETH/USDT:USDT"],
        exchanges=["okx", "binance"],
        parameters={
            "grid_levels": 10,
            "grid_spacing_pct": 0.01,
            "position_per_grid": 0.01,
            "rebalance_threshold": 0.005,
        },
        risk_parameters={
            "max_grid_size": 0.1,
            "max_total_exposure": 1.0,
        },
        performance=StrategyPerformance(
            total_trades=125,
            win_rate=62.4,
            profit_factor=1.28,
            total_pnl=Decimal("8.92"),
            sharpe_ratio=0.65,
            max_drawdown=0.042,
            avg_win=Decimal("0.12"),
            avg_loss=Decimal("-0.08"),
            expectancy=0.0001,
        ),
        created_at=datetime(2026, 2, 15, 9, 0, 0, tzinfo=timezone.utc),
        started_at=datetime(2026, 2, 20, 10, 0, 0, tzinfo=timezone.utc),
        last_trade_at=datetime(2026, 3, 30, 16, 30, 0, tzinfo=timezone.utc),
    ),
    Strategy(
        id="strategy-003",
        name="Trend Momentum",
        description="趋势动量策略 - 跟随强势趋势进行交易",
        strategy_type=StrategyType.MOMENTUM,
        status=StrategyStatus.STOPPED,
        version="1.5.0",
        symbols=["SOL/USDT:USDT", "AVAX/USDT:USDT"],
        exchanges=["okx"],
        parameters={
            "lookback_period": 20,
            "momentum_threshold": 0.02,
            "trailing_stop_pct": 0.03,
            "position_size": 0.05,
        },
        risk_parameters={
            "max_daily_loss": 0.03,
            "max_position_size": 0.1,
        },
        performance=StrategyPerformance(
            total_trades=38,
            win_rate=31.6,
            profit_factor=1.05,
            total_pnl=Decimal("1.23"),
            sharpe_ratio=0.12,
            max_drawdown=0.085,
            avg_win=Decimal("0.28"),
            avg_loss=Decimal("-0.25"),
            expectancy=-0.0005,
        ),
        created_at=datetime(2026, 1, 10, 14, 0, 0, tzinfo=timezone.utc),
        started_at=datetime(2026, 1, 15, 9, 0, 0, tzinfo=timezone.utc),
        last_trade_at=datetime(2026, 2, 28, 11, 45, 0, tzinfo=timezone.utc),
    ),
]


@router.get("/", response_model=StrategyListResponse)
async def list_strategies(
    status: Optional[StrategyStatus] = None,
    strategy_type: Optional[StrategyType] = None,
    exchange: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    获取策略列表
    
    参数:
    - status: 状态过滤 (可选)
    - strategy_type: 策略类型过滤 (可选)
    - exchange: 交易所过滤 (可选)
    - page: 页码
    - page_size: 每页数量
    """
    
    # 过滤
    strategies = _mock_strategies
    if status:
        strategies = [s for s in strategies if s.status == status]
    if strategy_type:
        strategies = [s for s in strategies if s.strategy_type == strategy_type]
    if exchange:
        strategies = [s for s in strategies if exchange in s.exchanges]
    
    # 分页
    total = len(strategies)
    start = (page - 1) * page_size
    end = start + page_size
    paged_strategies = strategies[start:end]
    
    return StrategyListResponse(
        strategies=paged_strategies,
        total=total,
        page=page,
        page_size=page_size,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/{strategy_id}", response_model=Strategy)
async def get_strategy(strategy_id: str):
    """
    获取单个策略详情
    
    参数:
    - strategy_id: 策略 ID
    """
    
    for strategy in _mock_strategies:
        if strategy.id == strategy_id:
            # 更新时间戳
            strategy.updated_at = datetime.now(timezone.utc)
            return strategy
    
    raise HTTPException(status_code=404, detail=f"未找到策略: {strategy_id}")


@router.get("/{strategy_id}/performance", response_model=StrategyPerformance)
async def get_strategy_performance(strategy_id: str):
    """
    获取策略表现数据
    
    参数:
    - strategy_id: 策略 ID
    """
    
    for strategy in _mock_strategies:
        if strategy.id == strategy_id:
            return strategy.performance
    
    raise HTTPException(status_code=404, detail=f"未找到策略: {strategy_id}")


@router.get("/{strategy_id}/recent-trades")
async def get_strategy_recent_trades(
    strategy_id: str,
    limit: int = 10,
):
    """
    获取策略最近交易记录
    
    参数:
    - strategy_id: 策略 ID
    - limit: 返回数量限制
    """
    
    # 这里应该从数据库查询相关交易记录
    # 目前返回模拟数据
    
    return {
        "strategy_id": strategy_id,
        "trades": [
            {
                "id": f"trade-{i}",
                "timestamp": f"2026-03-{30-i}T{10+i}:00:00Z",
                "symbol": "ETH/USDT:USDT",
                "side": "buy" if i % 2 == 0 else "sell",
                "quantity": 0.13,
                "price": 2000.0 + i * 10,
                "pnl": 1.09 if i % 2 == 0 else -0.10,
                "status": "filled",
            }
            for i in range(min(limit, 10))
        ],
        "total": 10,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/summary")
async def get_strategies_summary():
    """
    获取策略总览统计
    """
    
    strategies = _mock_strategies
    
    # 按状态统计
    status_summary = {}
    for status in StrategyStatus:
        count = len([s for s in strategies if s.status == status])
        if count > 0:
            status_summary[status.value] = count
    
    # 按类型统计
    type_summary = {}
    for strategy_type in StrategyType:
        count = len([s for s in strategies if s.strategy_type == strategy_type])
        if count > 0:
            type_summary[strategy_type.value] = count
    
    # 总体表现
    total_pnl = sum(s.performance.total_pnl for s in strategies)
    avg_win_rate = sum(s.performance.win_rate for s in strategies) / len(strategies)
    total_trades = sum(s.performance.total_trades for s in strategies)
    
    return {
        "total_strategies": len(strategies),
        "status_summary": status_summary,
        "type_summary": type_summary,
        "performance_summary": {
            "total_pnl": float(total_pnl),
            "average_win_rate": avg_win_rate,
            "total_trades": total_trades,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
