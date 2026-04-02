"""
日志配置模块
"""

import logging
import logging.config
import sys
from pathlib import Path

from app.core.config import Settings


def setup_logging(level: str = "INFO"):
    """配置日志系统"""
    
    # 日志级别映射
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    
    log_level = level_map.get(level.upper(), logging.INFO)
    
    # 配置
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "detailed": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(lineno)d - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": sys.stdout,
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "detailed",
                "filename": "logs/helix_cockpit.log",
                "maxBytes": 10 * 1024 * 1024,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "": {  # 根记录器
                "handlers": ["console", "file"],
                "level": log_level,
            },
            "app": {
                "handlers": ["console", "file"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            "fastapi": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
        },
    }
    
    # 确保日志目录存在
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # 应用配置
    logging.config.dictConfig(logging_config)
    
    logger = logging.getLogger(__name__)
    logger.info(f"日志系统初始化完成，级别: {level}")
    
    return logger
