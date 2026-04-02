"""
健康检查端点
"""

import asyncio
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import Settings

router = APIRouter()
settings = Settings()


class HealthStatus(BaseModel):
    """健康状态响应"""
    service: str = Field(default="Helix Cockpit API")
    status: str = Field(default="healthy")
    version: str = Field(default="0.1.0")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uptime: float = Field(default=0.0)
    components: Dict[str, str] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "service": "Helix Cockpit API",
                "status": "healthy",
                "version": "0.1.0",
                "timestamp": "2026-04-01T21:30:00Z",
                "uptime": 3600.5,
                "components": {
                    "api": "healthy",
                    "database": "healthy",
                    "event_bus": "healthy",
                }
            }
        }


# 启动时间
_start_time = time.time()


def get_uptime() -> float:
    """获取服务运行时间"""
    return time.time() - _start_time


def check_disk_space(path: str = "/", min_gb: int = 1) -> str:
    """检查磁盘空间"""
    try:
        import shutil
        total, used, free = shutil.disk_usage(path)
        free_gb = free / (1024 ** 3)
        return "healthy" if free_gb >= min_gb else f"warning: {free_gb:.1f}GB free"
    except Exception:
        return "unknown"


def check_memory_usage(max_percent: int = 90) -> str:
    """检查内存使用率"""
    try:
        import psutil
        memory = psutil.virtual_memory()
        percent = memory.percent
        return "healthy" if percent <= max_percent else f"warning: {percent:.1f}% used"
    except ImportError:
        return "psutil not installed"
    except Exception:
        return "unknown"


def check_python_version() -> str:
    """检查 Python 版本"""
    version = sys.version_info
    return f"{version.major}.{version.minor}.{version.micro}"


def check_network_connectivity() -> Dict[str, str]:
    """检查网络连通性"""
    results = {}
    
    # 测试本地回环
    try:
        sock = socket.create_connection(("127.0.0.1", settings.port), timeout=2)
        sock.close()
        results["localhost"] = "healthy"
    except Exception:
        results["localhost"] = "unreachable"
    
    # 测试外部连接 (Google DNS)
    try:
        sock = socket.create_connection(("8.8.8.8", 53), timeout=2)
        sock.close()
        results["external_network"] = "healthy"
    except Exception:
        results["external_network"] = "unreachable"
    
    return results


@router.get("/", response_model=HealthStatus)
async def health_check():
    """
    健康检查端点
    
    返回服务整体健康状态，包括：
    - 基础组件状态
    - 系统资源状况
    - 网络连通性
    """
    
    # 收集组件状态
    components = {
        "api": "healthy",
        "disk_space": check_disk_space(),
        "memory": check_memory_usage(),
        "python_version": check_python_version(),
    }
    
    # 添加网络状态
    network_status = check_network_connectivity()
    components.update(network_status)
    
    # 整体状态判断
    all_healthy = all(
        "healthy" in str(value).lower() or value == "unknown" 
        for key, value in components.items() 
        if key not in ["python_version"]
    )
    
    status = "healthy" if all_healthy else "warning"
    
    return HealthStatus(
        status=status,
        uptime=get_uptime(),
        components=components,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/detailed", response_model=HealthStatus)
async def detailed_health_check():
    """
    详细健康检查
    
    包含更全面的系统检查和资源监控
    """
    
    components = {
        "api": "healthy",
        "disk_space": check_disk_space(),
        "memory": check_memory_usage(),
        "python_version": check_python_version(),
        "event_bus": "healthy",  # 预留
    }
    
    # 添加网络状态
    network_status = check_network_connectivity()
    components.update(network_status)
    
    # 添加其他检查
    try:
        # 检查是否可执行外部命令
        result = subprocess.run(["date"], capture_output=True, text=True, timeout=2)
        components["shell_access"] = "healthy"
    except Exception:
        components["shell_access"] = "unavailable"
    
    # 整体状态判断
    critical_components = [v for k, v in components.items() if "warning" in str(v) or "unreachable" in str(v)]
    if any("error" in str(v) for v in components.values()):
        status = "error"
    elif critical_components:
        status = "warning"
    else:
        status = "healthy"
    
    return HealthStatus(
        status=status,
        uptime=get_uptime(),
        components=components,
        timestamp=datetime.now(timezone.utc),
    )
