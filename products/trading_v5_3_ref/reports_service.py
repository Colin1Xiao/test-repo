#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
reports_service.py

报表服务层 - P3-3

功能：
- 构建报表数据结构
- 统一返回格式
- 空数据处理

用法：
 from reports_service import build_alert_report, build_decision_report, build_control_report
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from storage_sqlite import SQLiteStorage

DEFAULT_DB_PATH = "data/panel_v41.db"


def get_date_range(days: int) -> dict:
    """获取日期范围"""
    end = datetime.now()
    start = end - timedelta(days=days)
    return {
        "days": days,
        "start": start.strftime("%Y-%m-%d"),
        "end": end.strftime("%Y-%m-%d"),
    }


def build_alert_report(storage: SQLiteStorage, days: int = 7) -> dict[str, Any]:
    """构建告警报表"""
    summary = storage.get_alert_summary(days=days)
    daily_counts = storage.get_alert_daily_counts(days=days)
    level_daily = storage.get_alert_level_daily_counts(days=days)
    type_top = storage.get_alert_type_top(limit=10, days=days)
    source_top = storage.get_alert_source_top(limit=10, days=days)

    # 构建系列数据（用于图表）
    # 按天聚合，包含各级别
    series_by_day = {}
    for row in level_daily:
        day = row["day"]
        if day not in series_by_day:
            series_by_day[day] = {"day": day, "CRITICAL": 0, "WARN": 0, "INFO": 0}
        series_by_day[day][row["level"]] = row["cnt"]

    series = list(series_by_day.values())

    return {
        "range": get_date_range(days),
        "summary": summary,
        "series": {
            "daily_counts": [{"day": d["day"], "value": d["cnt"]} for d in daily_counts],
            "level_daily": series,
        },
        "top": {
            "types": [{"type": t["type"], "count": t["cnt"]} for t in type_top],
            "sources": [{"source": s["source"], "count": s["cnt"]} for s in source_top],
        },
    }


def build_decision_report(storage: SQLiteStorage, days: int = 7) -> dict[str, Any]:
    """构建决策报表"""
    summary = storage.get_decision_summary(days=days)
    action_dist = storage.get_decision_action_distribution(days=days)
    reject_rate = storage.get_decision_reject_rate(days=days)
    avg_confidence = storage.get_decision_avg_confidence(days=days)
    daily_counts = storage.get_decision_daily_counts(days=days)

    # 添加拒绝率到 summary
    summary["reject_rate"] = round(reject_rate, 4)
    summary["avg_confidence"] = round(avg_confidence, 3) if avg_confidence else 0.0

    return {
        "range": get_date_range(days),
        "summary": summary,
        "series": {
            "daily_counts": [{"day": d["day"], "value": d["cnt"]} for d in daily_counts],
            "action_distribution": [
                {"action": a["normalized_action"], "count": a["cnt"]} for a in action_dist
            ],
        },
        "top": {},
    }


def build_control_report(storage: SQLiteStorage, days: int = 7) -> dict[str, Any]:
    """构建控制变更报表"""
    summary = storage.get_control_summary(days=days)
    daily_counts = storage.get_control_daily_counts(days=days)
    action_dist = storage.get_control_action_distribution(days=days)
    latest_mode = storage.get_latest_mode_change()

    return {
        "range": get_date_range(days),
        "summary": summary,
        "series": {
            "daily_counts": [{"day": d["day"], "value": d["cnt"]} for d in daily_counts],
            "action_distribution": [
                {"action": a["action"], "count": a["cnt"]} for a in action_dist
            ],
        },
        "top": {},
        "latest_mode_change": latest_mode,
    }


# ==================== 全局实例 ====================

_default_storage: SQLiteStorage | None = None


def get_storage() -> SQLiteStorage:
    """获取全局存储实例"""
    global _default_storage
    if _default_storage is None:
        _default_storage = SQLiteStorage(DEFAULT_DB_PATH)
    return _default_storage
