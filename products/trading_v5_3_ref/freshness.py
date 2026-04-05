#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
freshness.py

数据新鲜度指标 - B1+B2 观测性增强

功能:
- 统一 freshness 计算逻辑
- 提供 freshness 状态判断
- 支持多数据源新鲜度追踪

用法:
 from freshness import FreshnessTracker, FreshnessStatus
 
 tracker = FreshnessTracker()
 tracker.update("alerts", data_ts)
 status = tracker.get_status("alerts")
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from enum import Enum


class FreshnessStatus(str, Enum):
    """新鲜度状态枚举"""
    FRESH = "fresh"      # ≤ 15s
    DELAYED = "delayed"  # ≤ 60s
    STALE = "stale"      # > 60s
    UNKNOWN = "unknown"  # 无数据或异常


# 新鲜度阈值（秒）
FRESHNESS_THRESHOLDS = {
    "fresh": 15,    # 0-15s: 新鲜
    "delayed": 60,  # 15-60s: 延迟
    "stale": 999999  # > 60s: 陈旧
}


class FreshnessTracker:
    """数据新鲜度追踪器（B1+B2 观测性增强）"""
    
    def __init__(self):
        self._last_update: Dict[str, datetime] = {}
        self._last_data_ts: Dict[str, Optional[datetime]] = {}
    
    def update(self, source: str, data_ts: Optional[datetime] = None) -> None:
        """
        更新数据源新鲜度
        
        Args:
            source: 数据源名称（如 "alerts", "decisions", "control"）
            data_ts: 数据时间戳（如不提供则使用当前时间）
        """
        now = datetime.now()
        self._last_update[source] = now
        self._last_data_ts[source] = data_ts or now
    
    def get_age_sec(self, source: str) -> Optional[int]:
        """
        获取数据源年龄（秒）
        
        Returns:
            年龄（秒），如数据源不存在则返回 None
        """
        if source not in self._last_data_ts:
            return None
        
        data_ts = self._last_data_ts[source]
        if data_ts is None:
            return None
        
        age = (datetime.now() - data_ts).total_seconds()
        return int(age)
    
    def get_status(self, source: str) -> FreshnessStatus:
        """
        获取数据源新鲜度状态
        
        Returns:
            FreshnessStatus 枚举值
        """
        age = self.get_age_sec(source)
        
        if age is None:
            return FreshnessStatus.UNKNOWN
        
        if age <= FRESHNESS_THRESHOLDS["fresh"]:
            return FreshnessStatus.FRESH
        elif age <= FRESHNESS_THRESHOLDS["delayed"]:
            return FreshnessStatus.DELAYED
        else:
            return FreshnessStatus.STALE
    
    def get_status_string(self, source: str) -> str:
        """获取状态字符串（用于 JSON 响应）"""
        return self.get_status(source).value
    
    def get_all_statuses(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有数据源的新鲜度状态
        
        Returns:
            {
                "alerts": {"status": "fresh", "age_sec": 5},
                "decisions": {"status": "delayed", "age_sec": 30},
                ...
            }
        """
        result = {}
        for source in self._last_data_ts.keys():
            age = self.get_age_sec(source)
            status = self.get_status(source)
            result[source] = {
                "status": status.value,
                "age_sec": age,
                "last_update": self._last_update[source].isoformat() if source in self._last_update else None,
                "data_ts": self._last_data_ts[source].isoformat() if self._last_data_ts[source] else None,
            }
        return result
    
    def get_overall_status(self) -> FreshnessStatus:
        """
        获取总体新鲜度状态（取最差的那个）
        
        Returns:
            总体 FreshnessStatus
        """
        if not self._last_data_ts:
            return FreshnessStatus.UNKNOWN
        
        statuses = [self.get_status(source) for source in self._last_data_ts.keys()]
        
        # 按严重程度排序
        severity = {
            FreshnessStatus.STALE: 3,
            FreshnessStatus.DELAYED: 2,
            FreshnessStatus.FRESH: 1,
            FreshnessStatus.UNKNOWN: 0,
        }
        
        worst_status = max(statuses, key=lambda s: severity.get(s, 0))
        return worst_status


# ==================== 全局实例 ====================

_default_tracker = FreshnessTracker()


def get_tracker() -> FreshnessTracker:
    """获取全局新鲜度追踪器"""
    return _default_tracker


def update_freshness(source: str, data_ts: Optional[datetime] = None) -> None:
    """更新数据源新鲜度（便捷函数）"""
    _default_tracker.update(source, data_ts)


def get_freshness_status(source: str) -> str:
    """获取数据源新鲜度状态字符串（便捷函数）"""
    return _default_tracker.get_status_string(source)


def get_freshness_age(source: str) -> Optional[int]:
    """获取数据源年龄（便捷函数）"""
    return _default_tracker.get_age_sec(source)


def get_all_freshness_statuses() -> Dict[str, Dict[str, Any]]:
    """获取所有数据源新鲜度状态（便捷函数）"""
    return _default_tracker.get_all_statuses()


def get_overall_freshness_status() -> str:
    """获取总体新鲜度状态字符串（便捷函数）"""
    return _default_tracker.get_overall_status().value
