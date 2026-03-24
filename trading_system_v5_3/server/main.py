#!/usr/bin/env python3
"""
小龙交易系统 V5.3 统一监控服务器

架构: 模块化 FastAPI 应用
端口: 8765
启动: python -m server.main 或 ./start_server.sh

功能模块:
- Dashboard: 主监控面板 (/dashboard/)
- Control: 控制平面 (/control/)
- Decision: 决策追踪 (/decision/)
- Evolution: 演化引擎 (/evolution/)
- Structure: 市场结构 (/structure/)
"""

import sys
from pathlib import Path

# 确保可以导入父目录模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import server_config, trading_config
from .routers import dashboard, control, decision, evolution, structure

# ============================================================
# 创建 FastAPI 应用
# ============================================================
app = FastAPI(
    title="小龙交易系统 V5.3",
    description="统一监控与控制面板",
    version="5.3.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=server_config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 注册路由
# ============================================================
app.include_router(dashboard.router)
app.include_router(control.router)
app.include_router(decision.router)
app.include_router(evolution.router)
app.include_router(structure.router)

# ============================================================
# 根路由
# ============================================================
@app.get("/", response_class=HTMLResponse)
async def root():
    """根路由 - 重定向到仪表板"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url=/dashboard/">
        <title>小龙交易系统 V5.3</title>
    </head>
    <body style="background:#1a1a2e;color:#eee;font-family:sans-serif;text-align:center;padding:50px;">
        <h1>🐉 小龙交易系统 V5.3</h1>
        <p>正在跳转到 <a href="/dashboard/" style="color:#4fc3f7">监控面板</a>...</p>
    </body>
    </html>
    """

@app.get("/api/info")
async def info():
    """系统信息"""
    return JSONResponse(content={
        "name": "小龙交易系统",
        "version": "5.3.0",
        "status": "running",
        "trading": trading_config.to_dict(),
        "modules": ["dashboard", "control", "decision", "evolution", "structure"]
    })


@app.get("/api/health")
async def health():
    """健康检查"""
    return JSONResponse(content={"status": "ok"})


# ============================================================
# 启动入口
# ============================================================
def main():
    """主入口"""
    print("=" * 60)
    print("🐉 小龙交易系统 V5.3 - 统一监控服务器")
    print("=" * 60)
    print(f"  本地访问: http://localhost:{server_config.port}")
    print(f"  监控面板: http://localhost:{server_config.port}/dashboard/")
    print(f"  API文档:  http://localhost:{server_config.port}/docs")
    print(f"  交易模式: {trading_config.mode}")
    print("=" * 60)
    print()
    
    uvicorn.run(
        "server.main:app",
        host=server_config.host,
        port=server_config.port,
        reload=server_config.debug
    )


if __name__ == "__main__":
    main()