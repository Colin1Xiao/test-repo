#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
backfill_jsonl_to_sqlite.py

回填历史 JSONL 数据到 SQLite

功能：
- 回填 control_audit / alerts / decision_log
- 幂等（哈希去重）
- 容错（坏行跳过）
- 支持分表回填

用法:
 python3 backfill_jsonl_to_sqlite.py
 python3 backfill_jsonl_to_sqlite.py --table alerts
 python3 backfill_jsonl_to_sqlite.py --table all
 python3 backfill_jsonl_to_sqlite.py --table control_audit --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generator, Optional

# 导入存储模块
try:
    from storage_sqlite import SQLiteStorage
except ImportError:
    print("[错误] 无法导入 storage_sqlite 模块")
    sys.exit(1)

# 配置
DATA_DIR = Path(__file__).parent / "data"
LOGS_DIR = Path(__file__).parent / "logs"
DB_PATH = DATA_DIR / "panel_v41.db"

# JSONL 文件路径
JSONL_FILES = {
    "control_audit": DATA_DIR / "control_audit.jsonl",
    "alerts": LOGS_DIR / "alerts.jsonl",
    "decision_log": LOGS_DIR / "decision_log.jsonl",
}

# 标准化动作映射
ACTION_MAPPING = {
    "buy": {"buy", "BUY", "LONG", "ACCEPT", "EXECUTE", "✅ EXECUTE"},
    "sell": {"sell", "SELL", "SHORT"},
    "reject_long": {"reject_long", "REJECT_LONG"},
    "reject_short": {"reject_short", "REJECT_SHORT"},
}


def normalize_action(raw_action: Optional[str]) -> str:
    """标准化动作"""
    if not raw_action:
        return "hold"
    
    raw = raw_action.strip()
    
    for normalized, variants in ACTION_MAPPING.items():
        if raw in variants:
            return normalized
    
    # 默认 hold
    return "hold"


def normalize_risk_check(risk_check: Optional[str]) -> Optional[str]:
    """标准化 risk_check 字段"""
    if not risk_check:
        return None
    
    risk = risk_check.strip().lower()
    
    if risk in {"passed", "limited", "rejected", "not_applicable"}:
        return risk
    
    return None


def compute_hash(record: Dict[str, Any]) -> str:
    """计算记录哈希（用于去重）"""
    # 使用关键字段组合
    key_fields = {
        "control_audit": ["ts", "action", "operator"],
        "alerts": ["ts", "level", "type", "title"],
        "decision_log": ["ts", "decision", "score"],
    }
    
    table = record.get("_table", "unknown")
    fields = key_fields.get(table, list(record.keys()))
    
    key_str = "|".join(str(record.get(f, "")) for f in fields)
    return hashlib.md5(key_str.encode("utf-8")).hexdigest()


def read_jsonl(filepath: Path) -> Generator[Dict[str, Any], None, None]:
    """读取 JSONL 文件（容错）"""
    if not filepath.exists():
        print(f"[警告] 文件不存在：{filepath}")
        return
    
    line_num = 0
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line_num += 1
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
                yield record
            except json.JSONDecodeError as e:
                print(f"[坏行] {filepath}:{line_num} - {e}")
                yield {"_bad": True, "_error": str(e)}


def backfill_control_audit(storage: SQLiteStorage, dry_run: bool = False) -> Dict[str, int]:
    """回填 control_audit"""
    filepath = JSONL_FILES["control_audit"]
    stats = {"read": 0, "inserted": 0, "skipped": 0, "bad": 0}
    
    if not filepath.exists():
        print(f"[跳过] 文件不存在：{filepath}")
        return stats
    
    print(f"\n📋 回填 control_audit...")
    print(f"   源文件：{filepath}")
    
    with storage.connect() as conn:
        for record in read_jsonl(filepath):
            stats["read"] += 1
            
            if record.get("_bad"):
                stats["bad"] += 1
                continue
            
            # 提取字段
            ts = record.get("ts", "")
            action = record.get("action", "update")
            operator = record.get("operator", "")
            reason = record.get("reason", "")
            before = record.get("before", {})
            after = record.get("after", {})
            
            # 计算哈希（去重）
            record["_table"] = "control_audit"
            record_hash = compute_hash(record)
            
            # 检查是否已存在
            cur = conn.execute(
                "SELECT id FROM control_audit WHERE ts=? AND action=? AND operator=?",
                (ts, action, operator),
            )
            if cur.fetchone():
                stats["skipped"] += 1
                continue
            
            # 插入
            if not dry_run:
                try:
                    conn.execute(
                        """
                        INSERT INTO control_audit(ts, action, operator, reason, before_json, after_json)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (ts, action, operator, reason, json.dumps(before), json.dumps(after)),
                    )
                    stats["inserted"] += 1
                except Exception as e:
                    print(f"[插入失败] ts={ts}, action={action}: {e}")
                    stats["bad"] += 1
            else:
                stats["inserted"] += 1
    
    return stats


def backfill_alerts(storage: SQLiteStorage, dry_run: bool = False) -> Dict[str, int]:
    """回填 alerts（支持新旧两种格式）"""
    filepath = JSONL_FILES["alerts"]
    stats = {"read": 0, "inserted": 0, "skipped": 0, "bad": 0}
    
    if not filepath.exists():
        print(f"[跳过] 文件不存在：{filepath}")
        return stats
    
    print(f"\n🚨 回填 alerts...")
    print(f"   源文件：{filepath}")
    
    with storage.connect() as conn:
        for record in read_jsonl(filepath):
            stats["read"] += 1
            
            if record.get("_bad"):
                stats["bad"] += 1
                continue
            
            # 检查是否为旧格式（包含 alerts 数组）
            if "alerts" in record and "timestamp" in record:
                # 旧格式：{"timestamp": "...", "alerts": ["msg1", "msg2"]}
                ts = record.get("timestamp", "")
                for alert_msg in record.get("alerts", []):
                    # 旧格式告警，转换为新格式
                    level = "WARN"  # 旧告警默认 WARN
                    if "过低" in alert_msg or "失败" in alert_msg:
                        level = "WARN"
                    elif "错误" in alert_msg or "异常" in alert_msg:
                        level = "CRITICAL"
                    
                    alert_type = "legacy_alert"
                    source = "system"
                    title = "系统告警"
                    message = alert_msg
                    
                    # 检查是否已存在
                    cur = conn.execute(
                        "SELECT id FROM alerts WHERE ts=? AND message=?",
                        (ts, message),
                    )
                    if cur.fetchone():
                        stats["skipped"] += 1
                        continue
                    
                    # 插入
                    if not dry_run:
                        try:
                            conn.execute(
                                """
                                INSERT INTO alerts(ts, level, type, source, title, message, dedup_count, context_json)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                """,
                                (ts, level, alert_type, source, title, message, 1, "{}"),
                            )
                            stats["inserted"] += 1
                        except Exception as e:
                            print(f"[插入失败] ts={ts}: {e}")
                            stats["bad"] += 1
                    else:
                        stats["inserted"] += 1
            else:
                # 新格式：P1-2 告警系统格式
                ts = record.get("ts", "")
                level = record.get("level", "INFO")
                alert_type = record.get("type", "unknown")
                source = record.get("source")
                title = record.get("title", "")
                message = record.get("message", "")
                dedup_count = record.get("dedup_count", 1)
                context = record.get("context", {})
                
                # 验证 level
                if level not in {"CRITICAL", "WARN", "INFO"}:
                    print(f"[跳过] 无效 level: {level}")
                    stats["skipped"] += 1
                    continue
                
                # 检查是否已存在
                cur = conn.execute(
                    "SELECT id FROM alerts WHERE ts=? AND level=? AND type=? AND title=?",
                    (ts, level, alert_type, title),
                )
                if cur.fetchone():
                    stats["skipped"] += 1
                    continue
                
                # 插入
                if not dry_run:
                    try:
                        conn.execute(
                            """
                            INSERT INTO alerts(ts, level, type, source, title, message, dedup_count, context_json)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (ts, level, alert_type, source, title, message, dedup_count, json.dumps(context)),
                        )
                        stats["inserted"] += 1
                    except Exception as e:
                        print(f"[插入失败] ts={ts}, level={level}: {e}")
                        stats["bad"] += 1
                else:
                    stats["inserted"] += 1
    
    return stats


def backfill_decision_events(storage: SQLiteStorage, dry_run: bool = False) -> Dict[str, int]:
    """回填 decision_events"""
    filepath = JSONL_FILES["decision_log"]
    stats = {"read": 0, "inserted": 0, "skipped": 0, "bad": 0}
    
    if not filepath.exists():
        print(f"[跳过] 文件不存在：{filepath}")
        return stats
    
    print(f"\n🧠 回填 decision_events...")
    print(f"   源文件：{filepath}")
    
    with storage.connect() as conn:
        for record in read_jsonl(filepath):
            stats["read"] += 1
            
            if record.get("_bad"):
                stats["bad"] += 1
                continue
            
            # 提取字段
            ts = record.get("timestamp", "")
            raw_action = record.get("decision", record.get("decision_type", ""))
            signal = record.get("signal")
            confidence = record.get("confidence")
            structure_bias = record.get("regime", record.get("structure_bias"))
            risk_check = record.get("risk_check")
            position_state = record.get("position_state")
            reasons = record.get("reasons", record.get("checks", []))
            summary = record.get("summary", "")
            
            # 标准化
            normalized_action = normalize_action(raw_action)
            risk_check = normalize_risk_check(risk_check)
            
            # 计算哈希（去重）
            record["_table"] = "decision_events"
            record_hash = compute_hash(record)
            
            # 检查是否已存在
            cur = conn.execute(
                "SELECT id FROM decision_events WHERE ts=? AND raw_action=?",
                (ts, raw_action),
            )
            if cur.fetchone():
                stats["skipped"] += 1
                continue
            
            # 插入
            if not dry_run:
                try:
                    conn.execute(
                        """
                        INSERT INTO decision_events(
                            ts, raw_action, normalized_action, signal, confidence,
                            structure_bias, risk_check, position_state, reasons_json, summary
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            ts, raw_action, normalized_action, signal, confidence,
                            structure_bias, risk_check, position_state, json.dumps(reasons), summary,
                        ),
                    )
                    stats["inserted"] += 1
                except Exception as e:
                    print(f"[插入失败] ts={ts}, action={raw_action}: {e}")
                    stats["bad"] += 1
            else:
                stats["inserted"] += 1
    
    return stats


def print_stats(table: str, stats: Dict[str, int]) -> None:
    """打印统计"""
    print(f"\n{table}:")
    print(f"   读取：{stats['read']:6d} 条")
    print(f"   插入：{stats['inserted']:6d} 条")
    print(f"   跳过：{stats['skipped']:6d} 条")
    print(f"   坏行：{stats['bad']:6d} 条")


def main() -> int:
    parser = argparse.ArgumentParser(description="回填历史 JSONL 数据到 SQLite")
    parser.add_argument(
        "--table",
        choices=["control_audit", "alerts", "decision_events", "all"],
        default="all",
        help="要回填的表（默认：all）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="空跑模式（不实际写入）",
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("SQLite 历史数据回填")
    print("=" * 70)
    print(f"数据库：{DB_PATH}")
    print(f"模式：{'空跑' if args.dry_run else '实际写入'}")
    print(f"表：{args.table}")
    
    storage = SQLiteStorage(DB_PATH)
    
    total_stats = {
        "read": 0,
        "inserted": 0,
        "skipped": 0,
        "bad": 0,
    }
    
    # 按顺序回填
    tables = []
    if args.table == "all":
        tables = ["control_audit", "alerts", "decision_events"]
    else:
        tables = [args.table]
    
    for table in tables:
        try:
            if table == "control_audit":
                stats = backfill_control_audit(storage, args.dry_run)
            elif table == "alerts":
                stats = backfill_alerts(storage, args.dry_run)
            elif table == "decision_events":
                stats = backfill_decision_events(storage, args.dry_run)
            else:
                print(f"[未知表] {table}")
                continue
            
            print_stats(table, stats)
            
            # 累计
            for key in total_stats:
                total_stats[key] += stats.get(key, 0)
        
        except Exception as e:
            print(f"[错误] {table} 回填失败：{e}")
            import traceback
            traceback.print_exc()
            return 1
    
    # 总计
    print()
    print("=" * 70)
    print("总计:")
    print(f"   读取：{total_stats['read']:6d} 条")
    print(f"   插入：{total_stats['inserted']:6d} 条")
    print(f"   跳过：{total_stats['skipped']:6d} 条")
    print(f"   坏行：{total_stats['bad']:6d} 条")
    print("=" * 70)
    
    if args.dry_run:
        print("\n⚠️  空跑模式，未实际写入数据")
    else:
        print(f"\n✅ 回填完成！共插入 {total_stats['inserted']} 条记录")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
