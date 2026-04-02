#!/usr/local/bin/python3.14
"""
Helix 驾驶舱 FastAPI 服务入口

核心功能：
- API 路由注册
- WebSocket 事件推送
- 健康检查接口
- 系统状态监控
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.core.logger import setup_logging
from app.api.v1 import api_router
from app.core.events import get_event_bus
from app.ws.manager import WebSocketManager

# 配置日志
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动阶段
    logger.info("🚀 Helix 驾驶舱服务启动...")
    try:
        event_bus = await get_event_bus()
        logger.info("✅ 事件总线已启动")
    except Exception as e:
        logger.warning(f"⚠️ 事件总线启动失败: {e}")
        event_bus = None
    
    yield
    
    # 关闭阶段
    logger.info("🛑 Helix 驾驶舱服务关闭...")
    if event_bus:
        await event_bus.stop()
        logger.info("✅ 事件总线已停止")


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    # 加载配置
    settings = Settings()
    
    # 设置日志
    setup_logging(settings.log_level)
    
    # 创建应用
    app = FastAPI(
        title="Helix 交易驾驶舱",
        description="加密货币量化交易系统驾驶舱 API",
        version="0.1.0",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
        lifespan=lifespan,
    )
    
    # CORS 配置
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 注册 API 路由
    app.include_router(api_router, prefix="/api/v1")
    
    # WebSocket 管理器
    ws_manager = WebSocketManager()
    
    @app.get("/")
    async def root():
        """根路径，返回服务信息"""
        return {
            "service": "Helix Trading Cockpit API",
            "version": "0.1.0",
            "status": "running",
            "docs": "/docs" if settings.enable_docs else "disabled",
        }
    
    @app.get("/health")
    async def health_check():
        """健康检查接口"""
        return {
            "status": "healthy",
            "timestamp": asyncio.get_event_loop().time(),
            "version": "0.1.0",
        }
    
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """WebSocket 连接端点"""
        await ws_manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                # 处理 WebSocket 消息
                logger.info(f"WebSocket 消息: {data}")
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket 错误: {e}")
            ws_manager.disconnect(websocket)
    
    return app


# 应用实例
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    settings = Settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
