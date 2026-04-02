"""
API v1 路由注册
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health, system, market, positions, orders, strategies

api_router = APIRouter()

# 健康检查
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"]
)

# 系统状态
api_router.include_router(
    system.router,
    prefix="/system",
    tags=["system"]
)

# 市场数据
api_router.include_router(
    market.router,
    prefix="/market",
    tags=["market"]
)

# 持仓信息
api_router.include_router(
    positions.router,
    prefix="/positions",
    tags=["positions"]
)

# 订单管理
api_router.include_router(
    orders.router,
    prefix="/orders",
    tags=["orders"]
)

# 策略管理
api_router.include_router(
    strategies.router,
    prefix="/strategies",
    tags=["strategies"]
)
