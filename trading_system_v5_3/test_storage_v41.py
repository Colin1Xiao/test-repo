#!/usr/bin/env python3
"""
test_storage_v41.py - 验证 SQLite 存储层
"""

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from storage_sqlite import SQLiteStorage

def test_storage():
    print("=" * 60)
    print("SQLite 存储层 v41 - 功能测试")
    print("=" * 60)
    
    storage = SQLiteStorage("data/panel_v41.db")
    
    # 验证 schema 版本
    version = storage.get_schema_version()
    print(f"\n✅ Schema 版本：{version}")
    assert version == "v41.0", "Schema 版本不匹配"
    
    now = datetime.now().isoformat()
    
    # 测试 1: 插入控制变更
    print("\n--- 测试 1: 插入控制变更 ---")
    audit_id = storage.insert_control_audit(
        ts=now,
        action="open_all",
        operator="test_user",
        reason="测试双写",
        before_obj={"enabled": False, "can_open": False},
        after_obj={"enabled": True, "can_open": True},
    )
    print(f"✅ 插入控制变更 ID: {audit_id}")
    
    # 测试 2: 插入告警
    print("\n--- 测试 2: 插入告警 ---")
    alert_id = storage.insert_alert(
        ts=now,
        level="CRITICAL",
        type_="source_failure",
        source="okx_capital",
        title="OKX 余额获取失败",
        message="连续 3 次拉取失败",
        dedup_count=1,
        context={"fail_count": 3},
    )
    print(f"✅ 插入告警 ID: {alert_id}")
    
    # 测试 3: 插入决策事件
    print("\n--- 测试 3: 插入决策事件 ---")
    decision_id = storage.insert_decision_event(
        ts=now,
        raw_action="accept",
        normalized_action="buy",
        signal="buy",
        confidence=0.85,
        structure_bias="上涨",
        risk_check="passed",
        position_state="FLAT",
        reasons=["信号质量高", "风控通过"],
        summary="多头信号成立，风控通过，允许执行",
    )
    print(f"✅ 插入决策事件 ID: {decision_id}")
    
    # 测试 4: 查询最近告警
    print("\n--- 测试 4: 查询最近告警 ---")
    alerts = storage.get_recent_alerts(limit=10)
    print(f"最近 {len(alerts)} 条告警:")
    for alert in alerts:
        print(f"  - [{alert['level']}] {alert['title']} (dedup={alert['dedup_count']})")
    
    # 测试 5: 查询 CRITICAL 告警
    print("\n--- 测试 5: 查询 CRITICAL 告警 ---")
    critical_alerts = storage.get_recent_alerts(limit=10, level="CRITICAL")
    print(f"CRITICAL 告警：{len(critical_alerts)} 条")
    
    # 测试 6: 查询控制变更
    print("\n--- 测试 6: 查询控制变更 ---")
    changes = storage.get_control_changes(days=7, limit=10)
    print(f"最近 {len(changes)} 次控制变更:")
    for change in changes:
        print(f"  - {change['action']} by {change['operator']} ({change['reason']})")
    
    # 测试 7: 决策统计
    print("\n--- 测试 7: 决策统计 ---")
    stats = storage.get_decision_stats(days=7)
    print("决策动作分布:")
    for stat in stats:
        print(f"  - {stat['normalized_action']}: {stat['cnt']} 次")
    
    # 测试 8: 告警摘要
    print("\n--- 测试 8: 告警摘要（今日） ---")
    summary = storage.get_alert_summary(days=1)
    print(f"今日告警：CRITICAL={summary['CRITICAL']}, WARN={summary['WARN']}, INFO={summary['INFO']}")
    
    print("\n" + "=" * 60)
    print("✅ 所有测试通过！")
    print("=" * 60)

if __name__ == "__main__":
    test_storage()
