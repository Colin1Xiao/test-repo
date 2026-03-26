#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
utils.py - 小龙交易系统通用工具函数

UI-3.8 优化：提取公共函数，减少代码重复
"""

from __future__ import annotations
from typing import Any, Dict, Optional, Tuple, TypeVar, Callable
from functools import wraps
import logging
import time

logger = logging.getLogger(__name__)

T = TypeVar('T')


def safe_float(value: Any, default: float = 0.0) -> float:
    """安全转换为 float"""
    try:
        if value in (None, "", "--"):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    """安全转换为 int"""
    try:
        if value in (None, "", "--"):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def fmt_pct(value: Any, digits: int = 1) -> str:
    """格式化为百分比字符串"""
    return f"{safe_float(value):.{digits}f}%"


def fmt_money(value: Any, digits: int = 2, currency: str = "USDT") -> str:
    """格式化为货币字符串"""
    return f"{safe_float(value):,.{digits}f} {currency}"


def fmt_num(value: Any, digits: int = 2) -> str:
    """格式化为数字字符串"""
    return f"{safe_float(value):,.{digits}f}"


def fmt_side(value: Any) -> str:
    """格式化仓位方向"""
    if value is None:
        return "FLAT"
    side = str(value).strip().upper()
    if side in {"LONG", "BUY"}:
        return "LONG"
    if side in {"SHORT", "SELL"}:
        return "SHORT"
    return side or "FLAT"


def badge_for_side(value: Any) -> str:
    """获取仓位方向的 badge 类名"""
    side = fmt_side(value)
    if side == "LONG":
        return "side-long"
    if side == "SHORT":
        return "side-short"
    return "state-neutral"


def badge_for_pnl(value: Any) -> str:
    """获取盈亏的 badge 类名"""
    num = safe_float(value)
    if num > 0:
        return "pnl-positive"
    if num < 0:
        return "pnl-negative"
    return "state-neutral"


def badge_for_state(kind: str, value: Any) -> str:
    """
    获取状态 badge 类名
    
    Args:
        kind: 状态类型 (side/pnl/state)
        value: 状态值
    
    Returns:
        CSS 类名
    """
    if kind == "side":
        return badge_for_side(value)
    if kind == "pnl":
        return badge_for_pnl(value)
    if kind == "state":
        if value is True or value == "ok":
            return "state-ok"
        if value is False or value == "error":
            return "state-error"
        if value == "warn":
            return "state-warn"
        return "state-neutral"
    return "state-neutral"


def retry_on_exception(
    max_attempts: int = 3,
    delay: float = 1.0,
    exceptions: Tuple = (Exception,),
    logger: Optional[logging.Logger] = None
) -> Callable:
    """
    重试装饰器
    
    Args:
        max_attempts: 最大重试次数
        delay: 重试间隔（秒）
        exceptions: 需要重试的异常类型
        logger: 日志记录器
    
    Returns:
        装饰器函数
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if logger:
                        logger.warning(
                            f"{func.__name__} 失败 (尝试 {attempt}/{max_attempts}): {e}"
                        )
                    if attempt < max_attempts:
                        time.sleep(delay)
            raise last_exception  # type: ignore
        return wrapper
    return decorator


def timed_execution(logger: Optional[logging.Logger] = None) -> Callable:
    """
    执行时间监控装饰器
    
    Args:
        logger: 日志记录器
    
    Returns:
        装饰器函数
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            start = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                elapsed = (time.time() - start) * 1000  # ms
                if logger:
                    logger.debug(f"{func.__name__} 执行时间：{elapsed:.2f}ms")
        return wrapper
    return decorator


def merge_dicts(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """
    深度合并两个字典
    
    Args:
        base: 基础字典
        override: 覆盖字典
    
    Returns:
        合并后的字典
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    return result


def get_nested(data: Dict[str, Any], path: str, default: Any = None) -> Any:
    """
    安全获取嵌套字典值
    
    Args:
        data: 字典
        path: 路径，如 "a.b.c"
        default: 默认值
    
    Returns:
        值或默认值
    """
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    return current


def truncate_string(s: str, max_length: int = 100, suffix: str = "...") -> str:
    """截断字符串"""
    if len(s) <= max_length:
        return s
    return s[:max_length - len(suffix)] + suffix


def format_timestamp(ts: Optional[str], format: str = "%H:%M:%S") -> str:
    """
    格式化时间戳
    
    Args:
        ts: ISO 格式时间戳
        format: 输出格式
    
    Returns:
        格式化后的时间字符串
    """
    if not ts:
        return "--"
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return dt.strftime(format)
    except (ValueError, AttributeError):
        return str(ts)


# 通用常量
DEFAULT_TIMEOUT = 10.0  # 默认超时（秒）
MAX_RETRIES = 3  # 默认最大重试次数
CACHE_TTL = 300  # 缓存有效期（秒）
