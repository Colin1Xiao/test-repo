#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
performance_monitor.py - UI-3.10A 性能监控模块

功能:
- API 响应时间追踪
- 慢请求检测
- 前端错误收集
- 数据库查询监控
"""

from __future__ import annotations
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, List, Optional
from pathlib import Path
import sqlite3
import hashlib

logger = logging.getLogger(__name__)

# =============================================================================
# 配置常量
# =============================================================================

# 慢请求阈值 (毫秒)
API_SLOW_THRESHOLD_MS = 1000.0
DB_SLOW_THRESHOLD_MS = 500.0

# 数据保留天数
MONITOR_RETENTION_DAYS = 30

# =============================================================================
# 数据库操作
# =============================================================================

class MonitorDB:
    """监控数据库操作类"""
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_tables()
    
    def _get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_tables(self):
        """初始化监控表"""
        schema_file = Path(__file__).parent / 'monitor_schema.sql'
        if schema_file.exists():
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema = f.read()
            
            conn = self._get_connection()
            try:
                # 移除 CREATE INDEX 语句（SQLite 不支持在 IF NOT EXISTS 中创建索引）
                for statement in schema.split(';'):
                    statement = statement.strip()
                    if statement and not statement.startswith('INDEX'):
                        conn.execute(statement)
                conn.commit()
            except Exception as e:
                logger.warning(f"初始化监控表失败：{e}")
            finally:
                conn.close()
    
    def log_performance(self, endpoint: str, method: str, status_code: int, 
                       duration_ms: float, request_id: str = None, 
                       meta: Dict = None) -> int:
        """
        记录性能日志
        
        Returns:
            插入的行 ID
        """
        is_slow = 1 if duration_ms > API_SLOW_THRESHOLD_MS else 0
        request_id = request_id or str(uuid.uuid4())
        meta_json = json.dumps(meta) if meta else None
        
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO performance_logs 
                (endpoint, method, status_code, duration_ms, is_slow, request_id, meta_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (endpoint, method, status_code, duration_ms, is_slow, request_id, meta_json))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"记录性能日志失败：{e}")
            return -1
        finally:
            conn.close()
    
    def log_frontend_error(self, page: str, message: str, source: str = None,
                          lineno: int = None, colno: int = None, 
                          stack: str = None, user_agent: str = None) -> int:
        """
        记录前端错误
        
        Returns:
            插入的行 ID
        """
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO frontend_errors 
                (page, message, source, lineno, colno, stack, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (page, message, source, lineno, colno, stack, user_agent))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"记录前端错误失败：{e}")
            return -1
        finally:
            conn.close()
    
    def log_db_query(self, query_type: str, table_name: str, duration_ms: float,
                    query_text: str = None) -> int:
        """
        记录数据库查询性能
        
        Returns:
            插入的行 ID
        """
        is_slow = 1 if duration_ms > DB_SLOW_THRESHOLD_MS else 0
        query_hash = hashlib.md5(query_text.encode()).hexdigest()[:16] if query_text else None
        query_preview = query_text[:200] if query_text else None
        
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO db_query_logs 
                (query_type, table_name, duration_ms, is_slow, query_hash, query_preview)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (query_type, table_name, duration_ms, is_slow, query_hash, query_preview))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"记录 DB 查询失败：{e}")
            return -1
        finally:
            conn.close()
    
    def get_recent_performance(self, limit: int = 100, 
                               slow_only: bool = False) -> List[Dict]:
        """获取最近的性能日志"""
        conn = self._get_connection()
        try:
            query = """
                SELECT * FROM performance_logs 
                WHERE 1=1
            """
            params = []
            
            if slow_only:
                query += " AND is_slow = 1"
            
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
    
    def get_recent_errors(self, limit: int = 100, 
                         unprocessed_only: bool = False) -> List[Dict]:
        """获取最近的前端错误"""
        conn = self._get_connection()
        try:
            query = """
                SELECT * FROM frontend_errors 
                WHERE 1=1
            """
            params = []
            
            if unprocessed_only:
                query += " AND is_processed = 0"
            
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
    
    def get_performance_stats(self, hours: int = 24) -> Dict:
        """获取性能统计"""
        conn = self._get_connection()
        try:
            # 使用 SQLite 的 datetime 函数
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_requests,
                    AVG(duration_ms) as avg_duration,
                    MAX(duration_ms) as max_duration,
                    SUM(CASE WHEN is_slow = 1 THEN 1 ELSE 0 END) as slow_requests,
                    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as server_errors
                FROM performance_logs
                WHERE created_at >= datetime('now', ? || ' hours')
            """, (f'-{hours}',))
            
            row = cursor.fetchone()
            if row:
                return {
                    'total_requests': row['total_requests'] or 0,
                    'avg_duration': row['avg_duration'],
                    'max_duration': row['max_duration'],
                    'slow_requests': row['slow_requests'] or 0,
                    'server_errors': row['server_errors'] or 0,
                }
            return {}
        finally:
            conn.close()
    
    def get_error_stats(self, hours: int = 24) -> Dict:
        """获取错误统计"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_errors,
                    COUNT(DISTINCT page) as affected_pages,
                    COUNT(DISTINCT message) as unique_errors
                FROM frontend_errors
                WHERE created_at >= datetime('now', ? || ' hours')
            """, (f'-{hours}',))
            
            row = cursor.fetchone()
            if row:
                return {
                    'total_errors': row['total_errors'] or 0,
                    'affected_pages': row['affected_pages'] or 0,
                    'unique_errors': row['unique_errors'] or 0,
                }
            return {}
        finally:
            conn.close()
    
    def cleanup_old_data(self):
        """清理过期数据"""
        conn = self._get_connection()
        try:
            cutoff = datetime.now() - timedelta(days=MONITOR_RETENTION_DAYS)
            
            conn.execute("DELETE FROM performance_logs WHERE created_at < ?", (cutoff.isoformat(),))
            conn.execute("DELETE FROM frontend_errors WHERE created_at < ?", (cutoff.isoformat(),))
            conn.execute("DELETE FROM db_query_logs WHERE created_at < ?", (cutoff.isoformat(),))
            conn.execute("DELETE FROM monitor_stats WHERE stat_date < ?", (cutoff.date().isoformat(),))
            
            conn.commit()
            logger.info(f"清理 {MONITOR_RETENTION_DAYS} 天前的监控数据")
        except Exception as e:
            logger.error(f"清理过期数据失败：{e}")
        finally:
            conn.close()


# =============================================================================
# Flask 中间件
# =============================================================================

def setup_performance_monitor(app, db: MonitorDB):
    """
    为 Flask 应用设置性能监控中间件
    
    Args:
        app: Flask 应用实例
        db: MonitorDB 实例
    """
    
    @app.before_request
    def before_request():
        """请求前记录开始时间"""
        from flask import g
        g.start_time = time.time()
        g.request_id = str(uuid.uuid4())
    
    @app.after_request
    def after_request(response):
        """请求后记录性能数据"""
        from flask import request, g
        
        if hasattr(g, 'start_time'):
            duration_ms = (time.time() - g.start_time) * 1000
            endpoint = request.path
            method = request.method
            status_code = response.status_code
            
            # 记录性能日志
            db.log_performance(
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                request_id=getattr(g, 'request_id', None),
                meta={
                    'remote_addr': request.remote_addr,
                    'user_agent': request.headers.get('User-Agent', '')[:200]
                }
            )
            
            # 慢请求日志
            if duration_ms > API_SLOW_THRESHOLD_MS:
                logger.warning(f"慢请求：{method} {endpoint} - {duration_ms:.2f}ms")
            
            # 添加响应头
            response.headers['X-Request-ID'] = getattr(g, 'request_id', '')
            response.headers['X-Response-Time'] = f"{duration_ms:.2f}ms"
        
        return response


# =============================================================================
# 装饰器
# =============================================================================

def track_performance(db: MonitorDB, endpoint_name: str = None):
    """
    性能追踪装饰器
    
    用法:
        @track_performance(db, "my_function")
        def my_function():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                status_code = 200
                return result
            except Exception as e:
                status_code = 500
                raise
            finally:
                duration_ms = (time.time() - start) * 1000
                db.log_performance(
                    endpoint=endpoint_name or func.__name__,
                    method='FUNCTION',
                    status_code=status_code,
                    duration_ms=duration_ms
                )
        return wrapper
    return decorator


# =============================================================================
# 全局实例
# =============================================================================

_monitor_db: Optional[MonitorDB] = None

def get_monitor_db(data_dir: Path = None) -> MonitorDB:
    """获取全局监控数据库实例"""
    global _monitor_db
    
    if _monitor_db is None:
        if data_dir is None:
            data_dir = Path(__file__).parent / 'data'
        
        data_dir.mkdir(exist_ok=True, parents=True)
        db_path = data_dir / 'monitor.db'
        _monitor_db = MonitorDB(db_path)
        logger.info(f"监控数据库初始化：{db_path}")
    
    return _monitor_db
