#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
init_storage_v41.py

初始化 SQLite 存储层：
- 创建数据库
- 创建 schema_meta / control_audit / alerts / decision_events
- 创建索引
- 设置 SQLite pragma

用法:
 python init_storage_v41.py
 python init_storage_v41.py /path/to/trading_system_v5_3/data/panel_v41.db
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Iterable

SCHEMA_VERSION = "v41.0"

DEFAULT_DB_PATH = Path("data") / "panel_v41.db"

PRAGMAS: tuple[str, ...] = (
    "PRAGMA journal_mode=WAL;",
    "PRAGMA synchronous=NORMAL;",
    "PRAGMA foreign_keys=ON;",
    "PRAGMA temp_store=MEMORY;",
    "PRAGMA busy_timeout=5000;",
)

DDL_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS control_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        action TEXT NOT NULL,
        operator TEXT,
        reason TEXT,
        before_json TEXT NOT NULL,
        after_json TEXT NOT NULL
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_control_audit_ts
    ON control_audit(ts DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_control_audit_action
    ON control_audit(action, ts DESC);
    """,
    """
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        level TEXT NOT NULL CHECK(level IN ('CRITICAL', 'WARN', 'INFO')),
        type TEXT NOT NULL,
        source TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        dedup_count INTEGER NOT NULL DEFAULT 1 CHECK(dedup_count >= 1),
        context_json TEXT
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_alerts_ts
    ON alerts(ts DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_alerts_level
    ON alerts(level, ts DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_alerts_type
    ON alerts(type, ts DESC);
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        raw_action TEXT,
        normalized_action TEXT NOT NULL CHECK(
            normalized_action IN ('buy', 'sell', 'hold', 'reject_long', 'reject_short')
        ),
        signal TEXT,
        confidence REAL,
        structure_bias TEXT,
        risk_check TEXT CHECK(
            risk_check IS NULL OR risk_check IN ('passed', 'limited', 'rejected', 'not_applicable')
        ),
        position_state TEXT,
        reasons_json TEXT,
        summary TEXT
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_decision_ts
    ON decision_events(ts DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_decision_action
    ON decision_events(normalized_action, ts DESC);
    """,
)


def ensure_parent_dir(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def apply_pragmas(conn: sqlite3.Connection, pragmas: Iterable[str]) -> None:
    for stmt in pragmas:
        conn.execute(stmt)


def apply_schema(conn: sqlite3.Connection, statements: Iterable[str]) -> None:
    for stmt in statements:
        conn.execute(stmt)


def upsert_schema_meta(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        INSERT INTO schema_meta(key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        ("schema_version", SCHEMA_VERSION),
    )


def init_db(db_path: Path) -> None:
    ensure_parent_dir(db_path)

    with connect(db_path) as conn:
        apply_pragmas(conn, PRAGMAS)
        apply_schema(conn, DDL_STATEMENTS)
        upsert_schema_meta(conn)
        conn.commit()

    print(f"[OK] initialized sqlite schema at: {db_path}")
    print(f"     schema version: {SCHEMA_VERSION}")
    print(f"     tables: schema_meta, control_audit, alerts, decision_events")
    print(f"     indexes: 8 created")


def main() -> int:
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB_PATH
    init_db(db_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
