"""
应用配置管理
"""

import os
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """应用配置"""
    
    # 应用基础配置
    app_name: str = "Helix Trading Cockpit"
    app_version: str = "0.1.0"
    
    # 服务器配置
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    reload: bool = Field(default=False, env="RELOAD")
    
    # CORS 配置
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        env="CORS_ORIGINS"
    )
    
    # 日志配置
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        env="LOG_FORMAT"
    )
    
    # API 文档配置
    enable_docs: bool = Field(default=True, env="ENABLE_DOCS")
    
    # 数据库配置 (预留)
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    
    # 事件总线配置
    event_bus_workers: int = Field(default=4, env="EVENT_BUS_WORKERS")
    
    # 项目路径
    project_root: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent)
    data_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "data")
    logs_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "logs")
    
    # M2 验证相关
    m2_paper_mode: bool = Field(default=True, env="M2_PAPER_MODE")
    m2_live_validation: bool = Field(default=False, env="M2_LIVE_VALIDATION")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 确保目录存在
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
    
    @property
    def debug(self) -> bool:
        """是否调试模式"""
        return self.log_level.upper() == "DEBUG"
    
    @property
    def api_url(self) -> str:
        """API 基础 URL"""
        return f"http://{self.host}:{self.port}/api/v1"
    
    @property
    def ws_url(self) -> str:
        """WebSocket URL"""
        return f"ws://{self.host}:{self.port}/ws"


# 全局配置实例
settings = Settings()
