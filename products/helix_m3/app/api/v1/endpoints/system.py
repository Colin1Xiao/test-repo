"""
系统状态端点
"""

import asyncio
import os
import platform
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import Settings

router = APIRouter()
settings = Settings()


class SystemInfo(BaseModel):
    """系统信息响应"""
    system: str = Field(description="操作系统")
    release: str = Field(description="系统版本")
    machine: str = Field(description="机器架构")
    processor: str = Field(description="处理器")
    python_version: str = Field(description="Python 版本")
    cpu_count: Optional[int] = Field(default=None, description="CPU 核心数")
    memory_total: Optional[int] = Field(default=None, description="总内存 (MB)")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        schema_extra = {
            "example": {
                "system": "Darwin",
                "release": "26.4.0",
                "machine": "x86_64",
                "processor": "Intel",
                "python_version": "3.14.3",
                "cpu_count": 8,
                "memory_total": 32768,
                "timestamp": "2026-04-01T21:30:00Z",
            }
        }


class ServiceStatus(BaseModel):
    """服务状态响应"""
    service: str = Field(description="服务名称")
    status: str = Field(description="状态 (running/stopped/error)")
    version: Optional[str] = Field(default=None, description="版本号")
    uptime: Optional[float] = Field(default=None, description="运行时间 (秒)")
    last_check: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        schema_extra = {
            "example": {
                "service": "helix_cockpit",
                "status": "running",
                "version": "0.1.0",
                "uptime": 3600.5,
                "last_check": "2026-04-01T21:30:00Z",
            }
        }


class SystemStatusResponse(BaseModel):
    """系统状态总体响应"""
    system_info: SystemInfo
    services: List[ServiceStatus]
    environment: Dict[str, str] = Field(description="环境变量摘要")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        schema_extra = {
            "example": {
                "system_info": {
                    "system": "Darwin",
                    "release": "26.4.0",
                    "machine": "x86_64",
                    "processor": "Intel",
                    "python_version": "3.14.3",
                    "cpu_count": 8,
                    "memory_total": 32768,
                },
                "services": [
                    {
                        "service": "helix_cockpit",
                        "status": "running",
                        "version": "0.1.0",
                        "uptime": 3600.5,
                    }
                ],
                "environment": {
                    "HOST": "0.0.0.0",
                    "PORT": "8000",
                    "LOG_LEVEL": "INFO",
                },
                "timestamp": "2026-04-01T21:30:00Z",
            }
        }


def get_system_info() -> SystemInfo:
    """获取系统信息"""
    uname = platform.uname()
    
    # 尝试获取内存信息
    memory_total = None
    try:
        import psutil
        memory_total = psutil.virtual_memory().total // (1024 * 1024)  # MB
    except ImportError:
        pass
    
    # 尝试获取 CPU 信息
    cpu_count = None
    try:
        cpu_count = os.cpu_count()
    except Exception:
        pass
    
    return SystemInfo(
        system=uname.system,
        release=uname.release,
        machine=uname.machine,
        processor=uname.processor,
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        cpu_count=cpu_count,
        memory_total=memory_total,
    )


def get_services_status() -> List[ServiceStatus]:
    """获取服务状态"""
    services = []
    
    # Helix Cockpit 服务状态
    services.append(ServiceStatus(
        service="helix_cockpit",
        status="running",
        version=settings.app_version,
        uptime=0.0,  # 实际运行时从应用状态获取
    ))
    
    # 预留其他服务
    services.append(ServiceStatus(
        service="event_bus",
        status="running",
        version="0.1.0",
    ))
    
    services.append(ServiceStatus(
        service="data_store",
        status="running",
        version="0.1.0",
    ))
    
    return services


def get_environment_summary() -> Dict[str, str]:
    """获取环境变量摘要"""
    # 只显示关键的环境变量
    env_keys = [
        "HOST", "PORT", "LOG_LEVEL", "CORS_ORIGINS",
        "DATABASE_URL", "M2_PAPER_MODE", "M2_LIVE_VALIDATION",
    ]
    
    env_summary = {}
    for key in env_keys:
        value = os.getenv(key)
        if value is not None:
            # 敏感信息掩码
            if "PASSWORD" in key or "SECRET" in key or "KEY" in key:
                env_summary[key] = "***"
            else:
                env_summary[key] = value
    
    return env_summary


@router.get("/status", response_model=SystemStatusResponse)
async def system_status():
    """
    获取系统状态
    
    返回系统整体状态，包括：
    - 系统信息
    - 服务状态
    - 环境配置
    """
    
    return SystemStatusResponse(
        system_info=get_system_info(),
        services=get_services_status(),
        environment=get_environment_summary(),
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/info", response_model=SystemInfo)
async def system_info():
    """
    获取系统信息
    
    返回操作系统、硬件、Python 版本等基础信息
    """
    return get_system_info()


@router.get("/services", response_model=List[ServiceStatus])
async def services_status():
    """
    获取服务状态列表
    
    返回所有服务的运行状态
    """
    return get_services_status()


@router.get("/environment")
async def environment_summary():
    """
    获取环境变量摘要
    
    返回关键环境变量的值（敏感信息已掩码）
    """
    return get_environment_summary()


@router.get("/metrics")
async def system_metrics():
    """
    获取系统指标
    
    返回 CPU、内存、磁盘等系统资源使用情况
    """
    try:
        import psutil
        
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu": {
                "percent": cpu_percent,
                "count": psutil.cpu_count(),
                "frequency": psutil.cpu_freq().current if hasattr(psutil.cpu_freq(), 'current') else None,
            },
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent,
                "used": memory.used,
                "free": memory.free,
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="系统指标功能需要 psutil 库，请安装: pip install psutil"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取系统指标失败: {str(e)}")
