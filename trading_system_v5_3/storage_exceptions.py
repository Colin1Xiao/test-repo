#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
storage_exceptions.py

SQLite 存储层异常定义 - A2 稳定性增强

统一异常类和错误码，便于上层捕获和处理。
"""

from __future__ import annotations


class StorageError(Exception):
    """存储层基础异常"""
    
    def __init__(self, message: str, error_code: str = "storage_error", details: dict | None = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "error": self.error_code,
            "message": self.message,
            "details": self.details,
        }


class DatabaseNotInitializedError(StorageError):
    """数据库未初始化"""
    
    def __init__(self, message: str = "Database not initialized", details: dict | None = None):
        super().__init__(
            message=message,
            error_code="database_not_initialized",
            details=details,
        )


class TableNotFoundError(StorageError):
    """表不存在"""
    
    def __init__(self, table_name: str, details: dict | None = None):
        super().__init__(
            message=f"Table '{table_name}' not found",
            error_code="table_not_found",
            details={"table_name": table_name, **(details or {})},
        )


class ColumnNotFoundError(StorageError):
    """列不存在"""
    
    def __init__(self, column_name: str, table_name: str | None = None, details: dict | None = None):
        super().__init__(
            message=f"Column '{column_name}' not found" + (f" in table '{table_name}'" if table_name else ""),
            error_code="column_not_found",
            details={"column_name": column_name, "table_name": table_name, **(details or {})},
        )


class QueryFailedError(StorageError):
    """查询失败"""
    
    def __init__(self, message: str, original_error: str | None = None, details: dict | None = None):
        super().__init__(
            message=message,
            error_code="query_failed",
            details={"original_error": original_error, **(details or {})},
        )


class DatabaseLockedError(StorageError):
    """数据库被锁定"""
    
    def __init__(self, message: str = "Database is locked", details: dict | None = None):
        super().__init__(
            message=message,
            error_code="database_locked",
            details=details,
        )


class SchemaMismatchError(StorageError):
    """Schema 不匹配"""
    
    def __init__(self, expected: str, actual: str | None = None, details: dict | None = None):
        super().__init__(
            message=f"Schema mismatch: expected '{expected}', got '{actual}'" if actual else f"Schema mismatch: expected '{expected}'",
            error_code="schema_mismatch",
            details={"expected_version": expected, "actual_version": actual, **(details or {})},
        )


class ReadOnlyError(StorageError):
    """只读模式错误"""
    
    def __init__(self, operation: str, details: dict | None = None):
        super().__init__(
            message=f"Cannot perform write operation '{operation}' in read-only mode",
            error_code="read_only",
            details={"operation": operation, **(details or {})},
        )


# ==================== 统一错误响应格式 ====================

def make_error_response(
    error_code: str,
    message: str,
    http_status: int = 500,
    details: dict | None = None,
) -> dict:
    """
    构建统一错误响应
    
    返回格式:
    {
        "ok": false,
        "error": {
            "code": "xxx",
            "message": "xxx",
            "details": {...}
        },
        "data": null
    }
    """
    return {
        "ok": False,
        "error": {
            "code": error_code,
            "message": message,
            "details": details or {},
        },
        "data": None,
        "_http_status": http_status,  # 供 API 层使用
    }


def make_success_response(data: any) -> dict:
    """
    构建统一成功响应
    
    返回格式:
    {
        "ok": true,
        "error": null,
        "data": {...}
    }
    """
    return {
        "ok": True,
        "error": None,
        "data": data,
    }
