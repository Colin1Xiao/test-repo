"""
市场数据端点
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class MarketOverview(BaseModel):
    """市场概览"""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_markets: int = Field(default=0, description="总交易对数量")
    active_markets: int = Field(default=0, description="活跃交易对数量")
    volume_24h: float = Field(default=0.0, description="24小时交易量")
    market_cap: Optional[float] = Field(default=None, description="总市值")
    btc_dominance: Optional[float] = Field(default=None, description="BTC 主导率")
    fear_greed_index: Optional[float] = Field(default=None, description="恐惧贪婪指数")
    
    class Config:
        schema_extra = {
            "example": {
                "timestamp": "2026-04-01T21:30:00Z",
                "total_markets": 150,
                "active_markets": 120,
                "volume_24h": 50000000000.0,
                "market_cap": 2500000000000.0,
                "btc_dominance": 52.5,
                "fear_greed_index": 65.0,
            }
        }


class Ticker(BaseModel):
    """行情数据"""
    symbol: str = Field(description="交易对")
    exchange: str = Field(description="交易所")
    last_price: float = Field(description="最新价格")
    change_24h: float = Field(description="24小时涨跌幅")
    volume_24h: float = Field(description="24小时交易量")
    high_24h: float = Field(description="24小时最高价")
    low_24h: float = Field(description="24小时最低价")
    bid: float = Field(description="买一价")
    ask: float = Field(description="卖一价")
    spread: float = Field(description="买卖价差")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        schema_extra = {
            "example": {
                "symbol": "BTC/USDT",
                "exchange": "okx",
                "last_price": 65000.0,
                "change_24h": 2.5,
                "volume_24h": 2500000000.0,
                "high_24h": 65500.0,
                "low_24h": 64500.0,
                "bid": 64999.0,
                "ask": 65001.0,
                "spread": 0.0003,
                "timestamp": "2026-04-01T21:30:00Z",
            }
        }


class MarketListResponse(BaseModel):
    """市场列表响应"""
    markets: List[Ticker]
    total: int
    page: int
    page_size: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# 模拟数据 (开发阶段)
_mock_markets = [
    Ticker(
        symbol="BTC/USDT",
        exchange="okx",
        last_price=65000.0,
        change_24h=2.5,
        volume_24h=2500000000.0,
        high_24h=65500.0,
        low_24h=64500.0,
        bid=64999.0,
        ask=65001.0,
        spread=0.0003,
    ),
    Ticker(
        symbol="ETH/USDT",
        exchange="okx",
        last_price=3500.0,
        change_24h=1.8,
        volume_24h=1500000000.0,
        high_24h=3550.0,
        low_24h=3450.0,
        bid=3499.0,
        ask=3501.0,
        spread=0.0006,
    ),
    Ticker(
        symbol="SOL/USDT",
        exchange="okx",
        last_price=150.0,
        change_24h=5.2,
        volume_24h=800000000.0,
        high_24h=155.0,
        low_24h=145.0,
        bid=149.9,
        ask=150.1,
        spread=0.0013,
    ),
]


@router.get("/overview", response_model=MarketOverview)
async def market_overview():
    """
    获取市场概览
    
    返回加密货币市场整体概览数据
    """
    return MarketOverview(
        total_markets=3,
        active_markets=3,
        volume_24h=4800000000.0,
        market_cap=2500000000000.0,
        btc_dominance=52.5,
        fear_greed_index=65.0,
    )


@router.get("/tickers", response_model=MarketListResponse)
async def list_tickers(
    exchange: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    获取行情列表
    
    参数:
    - exchange: 交易所过滤 (可选)
    - page: 页码
    - page_size: 每页数量
    """
    
    # 过滤交易所
    markets = _mock_markets
    if exchange:
        markets = [m for m in markets if m.exchange == exchange]
    
    # 分页
    total = len(markets)
    start = (page - 1) * page_size
    end = start + page_size
    paged_markets = markets[start:end]
    
    return MarketListResponse(
        markets=paged_markets,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tickers/{symbol}", response_model=Ticker)
async def get_ticker(symbol: str):
    """
    获取单个交易对行情
    
    参数:
    - symbol: 交易对符号 (如 BTC/USDT)
    """
    
    for ticker in _mock_markets:
        if ticker.symbol == symbol:
            # 更新价格，模拟实时变化
            import random
            ticker.last_price *= (1 + random.uniform(-0.001, 0.001))
            ticker.timestamp = datetime.now(timezone.utc)
            return ticker
    
    raise HTTPException(status_code=404, detail=f"未找到交易对: {symbol}")


@router.get("/exchanges")
async def list_exchanges():
    """
    获取支持的交易所列表
    """
    exchanges = list(set([m.exchange for m in _mock_markets]))
    return {
        "exchanges": exchanges,
        "total": len(exchanges),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
