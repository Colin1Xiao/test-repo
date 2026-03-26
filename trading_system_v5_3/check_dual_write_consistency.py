#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
check_dual_write_consistency.py

双写一致性检查脚本

功能：
- 对比 JSONL 与 SQLite 记录数
- 检查最近记录时间戳
- 验证枚举字段纯净度
- 输出差异报告

用法:
 python check_dual_write_consistency.py
 python check_dual_write_consistency.py --verbose
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

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
    "control_audit": DATA_DIR / "control_audit.jsonl",  # 在 data/ 目录
    "alerts": LOGS_DIR / "alerts.jsonl",
    "decision_log": LOGS_DIR / "decision_log.jsonl",
}

# 枚举字段验证
ENUM_VALIDATION = {
    "alerts": {
        "field": "level",
        "allowed": {"CRITICAL", "WARN", "INFO"},
    },
    "decision_events": {
        "field": "normalized_action",
        "allowed": {"buy", "sell", "hold", "reject_long", "reject_short"},
    },
}


def count_jsonl_lines(filepath: Path) -> int:
    """统计 JSONL 文件行数"""
    if not filepath.exists():
        return 0
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def get_last_jsonl_record(filepath: Path) -> dict | None:
    """读取 JSONL 最后一条记录"""
    if not filepath.exists():
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
            if not lines:
                return None
            return json.loads(lines[-1])
    except Exception:
        return None


def check_enum_purity(storage: SQLiteStorage) -> dict[str, dict]:
    """检查枚举字段纯净度"""
    result = {}
    
    with storage.connect() as conn:
        for table, config in ENUM_VALIDATION.items():
            field = config["field"]
            allowed = config["allowed"]
            
            # 查询所有不合规的值
            placeholders = ",".join("?" for _ in allowed)
            query = f"""
                SELECT DISTINCT {field} 
                FROM {table} 
                WHERE {field} NOT IN ({placeholders})
            """
            
            try:
                cur = conn.execute(query, list(allowed))
                invalid_values = [row[0] for row in cur.fetchall()]
                
                result[table] = {
                    "field": field,
                    "allowed": sorted(allowed),
                    "invalid_values": invalid_values,
                    "is_pure": len(invalid_values) == 0,
                }
            except Exception as e:
                result[table] = {
                    "field": field,
                    "error": str(e),
                    "is_pure": False,
                }
    
    return result


def check_timestamp_consistency(jsonl_record: dict | None, sqlite_record: dict | None, table: str) -> dict:
    """检查时间戳一致性"""
    if not jsonl_record and not sqlite_record:
        return {"status": "both_empty", "diff_seconds": 0}
    
    if not jsonl_record:
        return {"status": "jsonl_missing", "diff_seconds": None}
    
    if not sqlite_record:
        return {"status": "sqlite_missing", "diff_seconds": None}
    
    # 提取时间戳
    jsonl_ts = jsonl_record.get("ts")
    sqlite_ts = sqlite_record.get("ts")
    
    if not jsonl_ts or not sqlite_ts:
        return {"status": "timestamp_missing", "diff_seconds": None}
    
    # 解析时间戳
    try:
        jsonl_dt = datetime.fromisoformat(jsonl_ts.replace("Z", "+00:00"))
        sqlite_dt = datetime.fromisoformat(sqlite_ts.replace("Z", "+00:00"))
        diff = abs((sqlite_dt - jsonl_dt).total_seconds())
        
        return {
            "status": "ok",
            "jsonl_ts": jsonl_ts[:19],
            "sqlite_ts": sqlite_ts[:19],
            "diff_seconds": diff,
        }
    except Exception:
        return {"status": "parse_error", "diff_seconds": None}


def run_consistency_check(verbose: bool = False) -> dict[str, Any]:
    """运行一致性检查"""
    storage = SQLiteStorage(DB_PATH)
    
    result = {
        "timestamp": datetime.now().isoformat(),
        "tables": {},
        "enum_validation": {},
        "overall_status": "ok",
        "issues": [],
    }
    
    # 表对比配置
    table_configs = {
        "control_audit": {
            "jsonl_file": JSONL_FILES["control_audit"],
            "sqlite_table": "control_audit",
            "compare_timestamp": True,
        },
        "alerts": {
            "jsonl_file": JSONL_FILES["alerts"],
            "sqlite_table": "alerts",
            "compare_timestamp": True,
        },
        "decision_events": {
            "jsonl_file": JSONL_FILES["decision_log"],
            "sqlite_table": "decision_events",
            "compare_timestamp": False,  # decision_log 格式不同，跳过时间戳对比
        },
    }
    
    # 逐表检查
    with storage.connect() as conn:
        for table, config in table_configs.items():
            jsonl_file = config["jsonl_file"]
            sqlite_table = config["sqlite_table"]
            
            # 统计记录数
            jsonl_count = count_jsonl_lines(jsonl_file)
            
            try:
                cur = conn.execute(f"SELECT COUNT(*) FROM {sqlite_table}")
                sqlite_count = cur.fetchone()[0]
            except Exception as e:
                sqlite_count = 0
                result["issues"].append(f"{table}: SQLite 查询失败 - {e}")
                result["overall_status"] = "error"
            
            # 计算差异
            diff = sqlite_count - jsonl_count
            diff_pct = (diff / jsonl_count * 100) if jsonl_count > 0 else 0
            
            table_result = {
                "jsonl_count": jsonl_count,
                "sqlite_count": sqlite_count,
                "diff": diff,
                "diff_pct": round(diff_pct, 2),
                "status": "ok" if diff == 0 else "mismatch",
            }
            
            # 时间戳对比（如果配置）
            if config.get("compare_timestamp"):
                jsonl_last = get_last_jsonl_record(jsonl_file)
                
                try:
                    cur = conn.execute(
                        f"SELECT * FROM {sqlite_table} ORDER BY ts DESC LIMIT 1"
                    )
                    sqlite_last = dict(cur.fetchone()) if cur.fetchone else None
                except Exception:
                    sqlite_last = None
                
                ts_check = check_timestamp_consistency(jsonl_last, sqlite_last, table)
                table_result["timestamp_check"] = ts_check
                
                if ts_check.get("status") not in ["ok", "both_empty"]:
                    result["issues"].append(f"{table}: 时间戳不一致 - {ts_check['status']}")
            
            result["tables"][table] = table_result
            
            # 判断整体状态
            if diff != 0:
                if abs(diff_pct) > 5:
                    result["overall_status"] = "warning"
                if abs(diff_pct) > 20:
                    result["overall_status"] = "error"
    
    # 枚举字段纯净度检查
    result["enum_validation"] = check_enum_purity(storage)
    
    for table, enum_result in result["enum_validation"].items():
        if not enum_result.get("is_pure", False):
            invalid = enum_result.get("invalid_values", [])
            result["issues"].append(f"{table}: 枚举字段污染 - {invalid}")
            result["overall_status"] = "warning"
    
    return result


def print_report(result: dict[str, Any], verbose: bool = False) -> None:
    """打印检查报告"""
    print("=" * 70)
    print("双写一致性检查报告")
    print("=" * 70)
    print(f"检查时间：{result['timestamp'][:19]}")
    print()
    
    # 表对比
    print("📊 表记录对比")
    print("-" * 70)
    
    for table, data in result["tables"].items():
        status_icon = "✅" if data["status"] == "ok" else "⚠️"
        print(f"\n{status_icon} {table}")
        print(f"   JSONL:  {data['jsonl_count']:6d} 条")
        print(f"   SQLite: {data['sqlite_count']:6d} 条")
        
        diff = data["diff"]
        if diff == 0:
            print(f"   差异：  {diff:+6d} ({data['diff_pct']:+.2f}%)")
        elif diff > 0:
            print(f"   差异：  {diff:+6d} ({data['diff_pct']:+.2f}%) 🔺 SQLite 多 {diff} 条")
        else:
            print(f"   差异：  {diff:+6d} ({data['diff_pct']:+.2f}%) 🔻 SQLite 少 {abs(diff)} 条")
        
        # 时间戳检查
        ts_check = data.get("timestamp_check", {})
        if ts_check.get("status") == "ok":
            print(f"   时间戳：✅ 一致 (差异 {ts_check.get('diff_seconds', 0):.1f} 秒)")
        elif ts_check.get("status"):
            print(f"   时间戳：⚠️ {ts_check['status']}")
    
    print()
    
    # 枚举字段检查
    print("🔍 枚举字段纯净度")
    print("-" * 70)
    
    for table, enum_result in result["enum_validation"].items():
        if "error" in enum_result:
            print(f"⚠️  {table}: 检查失败 - {enum_result['error']}")
        elif enum_result.get("is_pure", False):
            print(f"✅  {table}.{enum_result['field']}: 纯净")
        else:
            invalid = enum_result.get("invalid_values", [])
            print(f"🔴 {table}.{enum_result['field']}: 发现污染值 {invalid}")
    
    print()
    
    # 问题汇总
    if result["issues"]:
        print("⚠️  发现问题")
        print("-" * 70)
        for i, issue in enumerate(result["issues"], 1):
            print(f"{i}. {issue}")
        print()
    
    # 整体状态
    print("=" * 70)
    
    # 特殊处理：如果是双写初期，差异是正常的（历史数据未回填）
    total_diff = sum(t.get("diff", 0) for t in result["tables"].values())
    if total_diff < -1000:
        print("ℹ️  注：双写初期差异正常（历史数据未回填）")
        print("   建议：运行回填脚本后再次检查")
        print()
    
    status_map = {
        "ok": ("✅", "双写一致性正常"),
        "warning": ("⚠️", "存在轻微差异，需关注"),
        "error": ("🔴", "存在严重差异，需排查"),
    }
    
    icon, message = status_map.get(result["overall_status"], ("❓", "未知状态"))
    print(f"整体状态：{icon} {message}")
    print("=" * 70)
    
    # 详细输出（verbose 模式）
    if verbose:
        print()
        print("📋 详细数据")
        print("-" * 70)
        print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> int:
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    
    try:
        result = run_consistency_check(verbose)
        print_report(result, verbose)
        
        # 返回码
        if result["overall_status"] == "error":
            return 2
        elif result["overall_status"] == "warning":
            return 1
        else:
            return 0
    
    except Exception as e:
        print(f"🔴 检查失败：{e}")
        import traceback
        traceback.print_exc()
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
