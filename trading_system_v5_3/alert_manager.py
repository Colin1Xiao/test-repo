#!/usr/bin/env python3
"""
🐉 小龙监控告警管理器 (UI-3.10D)

功能:
- 告警规则管理 (alert_rules 表)
- 告警事件记录 (alert_events 表)
- 规则评估引擎
"""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger('alert_manager')

# 数据库路径
DB_PATH = Path(__file__).parent / 'data' / 'monitor.db'


def get_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_tables():
    """初始化告警表结构"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 告警规则表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                window_minutes INTEGER NOT NULL DEFAULT 5,
                threshold REAL NOT NULL,
                operator TEXT NOT NULL DEFAULT '>=',
                severity TEXT NOT NULL DEFAULT 'WARN',
                is_enabled INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 告警事件表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alert_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                rule_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'NEW',
                message TEXT NOT NULL,
                observed_value REAL NOT NULL,
                threshold REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
            )
        """)
        
        conn.commit()
        
        # 插入默认规则
        _insert_default_rules(cursor)
        conn.commit()
        
        logger.info("告警表初始化完成")
        
    finally:
        conn.close()


def _insert_default_rules(cursor):
    """插入默认告警规则"""
    # 检查是否已有规则
    cursor.execute("SELECT COUNT(*) FROM alert_rules")
    if cursor.fetchone()[0] > 0:
        return
    
    default_rules = [
        # 1. 慢请求告警
        {
            'name': '慢请求告警',
            'metric_type': 'slow_requests',
            'window_minutes': 5,
            'threshold': 3,
            'operator': '>=',
            'severity': 'WARN'
        },
        # 2. 错误量告警
        {
            'name': '前端错误告警',
            'metric_type': 'frontend_errors',
            'window_minutes': 5,
            'threshold': 3,
            'operator': '>=',
            'severity': 'WARN'
        },
        # 3. 慢查询告警
        {
            'name': '慢查询告警',
            'metric_type': 'slow_queries',
            'window_minutes': 10,
            'threshold': 5,
            'operator': '>=',
            'severity': 'WARN'
        },
        # 4. 可用性告警
        {
            'name': '服务端错误告警',
            'metric_type': 'server_errors',
            'window_minutes': 5,
            'threshold': 1,
            'operator': '>=',
            'severity': 'CRITICAL'
        }
    ]
    
    for rule in default_rules:
        cursor.execute("""
            INSERT INTO alert_rules (name, metric_type, window_minutes, threshold, operator, severity)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            rule['name'],
            rule['metric_type'],
            rule['window_minutes'],
            rule['threshold'],
            rule['operator'],
            rule['severity']
        ))


# =============================================================================
# 规则管理 API
# =============================================================================

def get_all_rules() -> List[Dict]:
    """获取所有告警规则"""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM alert_rules ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def create_rule(
    name: str,
    metric_type: str,
    window_minutes: int,
    threshold: float,
    operator: str = '>=',
    severity: str = 'WARN'
) -> int:
    """创建告警规则"""
    conn = get_connection()
    try:
        cursor = conn.execute("""
            INSERT INTO alert_rules (name, metric_type, window_minutes, threshold, operator, severity)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, metric_type, window_minutes, threshold, operator, severity))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_rule(rule_id: int, **kwargs) -> bool:
    """更新告警规则"""
    conn = get_connection()
    try:
        fields = []
        values = []
        for key, value in kwargs.items():
            if key in ['name', 'metric_type', 'operator', 'severity']:
                fields.append(f"{key} = ?")
                values.append(value)
            elif key in ['window_minutes', 'threshold', 'is_enabled']:
                fields.append(f"{key} = ?")
                values.append(value)
        
        if not fields:
            return False
        
        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(rule_id)
        
        query = f"UPDATE alert_rules SET {', '.join(fields)} WHERE id = ?"
        cursor = conn.execute(query, values)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_rule(rule_id: int) -> bool:
    """删除告警规则"""
    conn = get_connection()
    try:
        cursor = conn.execute("DELETE FROM alert_rules WHERE id = ?", (rule_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# =============================================================================
# 告警事件 API
# =============================================================================

def get_recent_events(limit: int = 50) -> List[Dict]:
    """获取最近告警事件"""
    conn = get_connection()
    try:
        cursor = conn.execute("""
            SELECT * FROM alert_events 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def create_event(
    rule_id: int,
    rule_name: str,
    severity: str,
    message: str,
    observed_value: float,
    threshold: float,
    status: str = 'NEW'
) -> int:
    """创建告警事件"""
    conn = get_connection()
    try:
        cursor = conn.execute("""
            INSERT INTO alert_events (rule_id, rule_name, severity, message, observed_value, threshold, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (rule_id, rule_name, severity, message, observed_value, threshold, status))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


# =============================================================================
# 规则评估引擎
# =============================================================================

def evaluate_rules() -> List[Dict]:
    """评估所有启用的规则，返回触发的告警"""
    rules = get_all_rules()
    triggered_alerts = []
    
    for rule in rules:
        if not rule['is_enabled']:
            continue
        
        # 获取指标值
        metric_value = _get_metric_value(
            rule['metric_type'],
            rule['window_minutes']
        )
        
        # 判断是否触发告警
        if _check_threshold(metric_value, rule['threshold'], rule['operator']):
            # 创建告警事件
            event_id = create_event(
                rule_id=rule['id'],
                rule_name=rule['name'],
                severity=rule['severity'],
                message=f"{rule['name']}: {metric_value} {rule['operator']} {rule['threshold']}",
                observed_value=metric_value,
                threshold=rule['threshold']
            )
            
            triggered_alerts.append({
                'event_id': event_id,
                'rule': rule,
                'observed_value': metric_value
            })
            
            logger.warning(f"告警触发：{rule['name']} (观测值={metric_value}, 阈值={rule['threshold']})")
    
    return triggered_alerts


def _get_metric_value(metric_type: str, window_minutes: int) -> float:
    """获取指标值"""
    conn = get_connection()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        if metric_type == 'slow_requests':
            # 慢请求数量 (duration_ms > 1000)
            cursor = conn.execute("""
                SELECT COUNT(*) FROM performance_logs
                WHERE created_at >= ? AND duration_ms > 1000
            """, (cutoff.isoformat(),))
            return cursor.fetchone()[0]
        
        elif metric_type == 'frontend_errors':
            # 前端错误数量
            cursor = conn.execute("""
                SELECT COUNT(*) FROM frontend_errors
                WHERE created_at >= ?
            """, (cutoff.isoformat(),))
            return cursor.fetchone()[0]
        
        elif metric_type == 'slow_queries':
            # 慢查询数量 (duration_ms > 500)
            cursor = conn.execute("""
                SELECT COUNT(*) FROM db_query_logs
                WHERE created_at >= ? AND duration_ms > 500
            """, (cutoff.isoformat(),))
            return cursor.fetchone()[0]
        
        elif metric_type == 'server_errors':
            # 服务端错误数量 (status_code >= 500)
            cursor = conn.execute("""
                SELECT COUNT(*) FROM performance_logs
                WHERE created_at >= ? AND status_code >= 500
            """, (cutoff.isoformat(),))
            return cursor.fetchone()[0]
        
        else:
            logger.error(f"未知指标类型：{metric_type}")
            return 0.0
    
    finally:
        conn.close()


def _check_threshold(value: float, threshold: float, operator: str) -> bool:
    """检查是否达到阈值"""
    if operator == '>=':
        return value >= threshold
    elif operator == '>':
        return value > threshold
    elif operator == '<=':
        return value <= threshold
    elif operator == '<':
        return value < threshold
    elif operator == '==':
        return value == threshold
    else:
        return False


# 初始化
init_tables()
