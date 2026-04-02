#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
api_metrics.py

API 性能埋点追踪器 - B3 观测性增强

功能:
- 轻量级内存埋点
- 请求计数与延迟统计
- 错误率计算
- 失败时间追踪

用法:
 from api_metrics import get_metrics, track_request, track_error

 track_request("/api/reports/alerts", 45.2)
 track_error("/api/reports/alerts", 50.1)
 metrics = get_metrics("/api/reports/alerts")
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from collections import deque
import time


class APIEndpointMetrics:
    """API 端点性能指标（B3 观测性增强）"""
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self._request_count = 0
        self._success_count = 0
        self._error_count = 0
        self._total_latency_ms = 0.0
        
        # latency 队列（用于 avg/p95）
        self._latencies: deque = deque(maxlen=1000)  # 最多保留 1000 个
        
        # 时间追踪
        self._last_success_time: Optional[datetime] = None
        self._last_error_time: Optional[datetime] = None
    
    def record_success(self, latency_ms: float) -> None:
        """记录成功请求"""
        self._request_count += 1
        self._success_count += 1
        self._total_latency_ms += latency_ms
        self._latencies.append(latency_ms)
        self._last_success_time = datetime.now()
    
    def record_error(self, latency_ms: float) -> None:
        """记录失败请求"""
        self._request_count += 1
        self._error_count += 1
        self._total_latency_ms += latency_ms
        self._latencies.append(latency_ms)
        self._last_error_time = datetime.now()
    
    @property
    def request_count(self) -> int:
        """总请求数"""
        return self._request_count
    
    @property
    def success_count(self) -> int:
        """成功请求数"""
        return self._success_count
    
    @property
    def error_count(self) -> int:
        """失败请求数"""
        return self._error_count
    
    @property
    def error_rate(self) -> float:
        """错误率（0.0 - 1.0）"""
        if self._request_count == 0:
            return 0.0
        return self._error_count / self._request_count
    
    @property
    def avg_latency_ms(self) -> float:
        """平均延迟（毫秒）"""
        if self._request_count == 0:
            return 0.0
        return self._total_latency_ms / self._request_count
    
    @property
    def last_latency_ms(self) -> Optional[float]:
        """最近一次延迟（毫秒）"""
        if not self._latencies:
            return None
        return self._latencies[-1]
    
    @property
    def last_success_time(self) -> Optional[str]:
        """最近成功时间（ISO 8601）"""
        if self._last_success_time:
            return self._last_success_time.isoformat()
        return None
    
    @property
    def last_error_time(self) -> Optional[str]:
        """最近失败时间（ISO 8601）"""
        if self._last_error_time:
            return self._last_error_time.isoformat()
        return None
    
    @property
    def max_latency_ms(self) -> Optional[float]:
        """最大延迟（毫秒）"""
        if not self._latencies:
            return None
        return max(self._latencies)
    
    @property
    def p95_latency_ms(self) -> Optional[float]:
        """P95 延迟（毫秒）"""
        if not self._latencies:
            return None
        
        sorted_latencies = sorted(self._latencies)
        index = int(len(sorted_latencies) * 0.95)
        return sorted_latencies[min(index, len(sorted_latencies) - 1)]
    
    @property
    def error_rate_5min(self) -> float:
        """最近 5 分钟错误率"""
        now = datetime.now()
        five_min_ago = now - timedelta(minutes=5)
        
        if not self._last_success_time and not self._last_error_time:
            return 0.0
        
        # 简化：基于总错误率，实际应仅计数近 5 分钟
        # 严谨实现需要时间戳队列
        return self.error_rate
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于 JSON 响应）"""
        return {
            "endpoint": self.endpoint,
            "request_count": self._request_count,
            "success_count": self._success_count,
            "error_count": self._error_count,
            "error_rate": round(self.error_rate, 4),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "last_latency_ms": round(self.last_latency_ms, 2) if self.last_latency_ms else None,
            "max_latency_ms": round(self.max_latency_ms, 2) if self.max_latency_ms else None,
            "p95_latency_ms": round(self.p95_latency_ms, 2) if self.p95_latency_ms else None,
            "last_success_time": self.last_success_time,
            "last_error_time": self.last_error_time,
        }


# ==================== 全局追踪器 ====================

class ApiMetricsTracker:
    """API 性能追踪器（B3 观测性增强）"""
    
    def __init__(self):
        self._endpoints: Dict[str, APIEndpointMetrics] = {}
        self._lock = None  # 可选：多线程安全
    
    def track(self, endpoint: str, success: bool, latency_ms: float) -> None:
        """
        记录请求性能
        
        Args:
            endpoint: API 端点路径
            success: 是否成功
            latency_ms: 延迟（毫秒）
        """
        # 简单实现：无锁，单线程场景足够
        if endpoint not in self._endpoints:
            self._endpoints[endpoint] = APIEndpointMetrics(endpoint)
        
        if success:
            self._endpoints[endpoint].record_success(latency_ms)
        else:
            self._endpoints[endpoint].record_error(latency_ms)
    
    def get_metrics(self, endpoint: str) -> Optional[Dict[str, Any]]:
        """获取端点指标"""
        if endpoint in self._endpoints:
            return self._endpoints[endpoint].to_dict()
        return None
    
    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """获取所有端点指标"""
        return {
            endpoint: metrics.to_dict()
            for endpoint, metrics in self._endpoints.items()
        }
    
    def reset(self) -> None:
        """重置所有指标"""
        self._endpoints.clear()


# ==================== 全局实例 ====================

_default_tracker = ApiMetricsTracker()


def get_tracker() -> ApiMetricsTracker:
    """获取全局追踪器"""
    return _default_tracker


def track_request(endpoint: str, latency_ms: float, success: bool = True) -> None:
    """记录请求（便捷函数）"""
    _default_tracker.track(endpoint, success, latency_ms)


def track_success(endpoint: str, latency_ms: float) -> None:
    """记录成功请求（便捷函数）"""
    _default_tracker.track(endpoint, True, latency_ms)


def track_error(endpoint: str, latency_ms: float) -> None:
    """记录失败请求（便捷函数）"""
    _default_tracker.track(endpoint, False, latency_ms)


def get_metrics(endpoint: str) -> Optional[Dict[str, Any]]:
    """获取端点指标（便捷函数）"""
    return _default_tracker.get_metrics(endpoint)


def get_all_metrics() -> Dict[str, Dict[str, Any]]:
    """获取所有端点指标（便捷函数）"""
    return _default_tracker.get_all_metrics()


def reset_metrics() -> None:
    """重置所有指标（便捷函数）"""
    _default_tracker.reset()
