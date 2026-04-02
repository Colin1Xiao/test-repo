#!/usr/bin/env python3
"""
P1-2 告警去重与冷却功能测试

测试场景：
1. 同一个问题连续出现 5 次 → 60 秒内只发一条，累计次数增加
2. 60 秒后问题仍存在 → 再发一条更新告警，带累计次数
3. 问题消失 → 发一条 INFO recovered
4. 问题消失后又复发 → 当成新一轮活跃告警，重新计数
"""

import sys
import time
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入 panel_v40 中的告警函数
from panel_v40 import (
    alert_key,
    should_emit_alert,
    update_active_alerts,
    collect_candidate_issues,
    build_alerts,
    build_alert_summary,
    alert_cooldowns,
    active_alerts,
    ALERT_COOLDOWN_SEC,
)


def test_alert_key():
    """测试 alert_key 函数"""
    print("\n=== 测试 1: alert_key 函数 ===")
    
    issue1 = {
        "type": "source_failure",
        "source": "okx_capital",
        "title": "OKX 余额获取失败",
        "message": "连续 3 次拉取失败",
    }
    
    issue2 = {
        "type": "source_failure",
        "source": "okx_capital",
        "title": "OKX 余额获取失败",
        "message": "连续 4 次拉取失败",  # message 不同
    }
    
    key1 = alert_key(issue1)
    key2 = alert_key(issue2)
    
    print(f"Issue 1 key: {key1}")
    print(f"Issue 2 key: {key2}")
    print(f"Keys match (expected True): {key1 == key2}")
    
    assert key1 == key2, "相同问题应该有相同的 key，即使 message 不同"
    print("✅ alert_key 测试通过")


def test_should_emit_alert():
    """测试 should_emit_alert 冷却逻辑"""
    print("\n=== 测试 2: should_emit_alert 冷却逻辑 ===")
    
    # 清空状态
    alert_cooldowns.clear()
    
    issue = {
        "type": "source_failure",
        "source": "okx_capital",
        "title": "OKX 余额获取失败",
        "message": "连续失败",
    }
    
    now = time.time()
    
    # 第 1 次：应该发射
    should_emit1, count1 = should_emit_alert(issue, now)
    print(f"第 1 次：should_emit={should_emit1}, count={count1} (预期：True, 1)")
    assert should_emit1 == True and count1 == 1
    
    # 第 2 次（立即）：不应该发射
    should_emit2, count2 = should_emit_alert(issue, now + 10)
    print(f"第 2 次（+10s）：should_emit={should_emit2}, count={count2} (预期：False, 2)")
    assert should_emit2 == False and count2 == 2
    
    # 第 3 次（+30s）：不应该发射
    should_emit3, count3 = should_emit_alert(issue, now + 30)
    print(f"第 3 次（+30s）：should_emit={should_emit3}, count={count3} (预期：False, 3)")
    assert should_emit3 == False and count3 == 3
    
    # 第 4 次（+65s，超过冷却）：应该发射
    should_emit4, count4 = should_emit_alert(issue, now + 65)
    print(f"第 4 次（+65s）：should_emit={should_emit4}, count={count4} (预期：True, 4)")
    assert should_emit4 == True and count4 == 4
    
    print("✅ should_emit_alert 测试通过")


def test_update_active_alerts():
    """测试 update_active_alerts 完整流程"""
    print("\n=== 测试 3: update_active_alerts 完整流程 ===")
    
    # 清空状态
    alert_cooldowns.clear()
    active_alerts.clear()
    
    now = time.time()
    
    # 场景 1：同一个问题连续出现
    print("\n场景 1: 同一个问题连续出现 5 次")
    issue = {
        "level": "CRITICAL",
        "type": "source_failure",
        "source": "okx_capital",
        "title": "OKX 余额获取失败",
        "message": "连续失败",
    }
    
    emitted_count = 0
    for i in range(5):
        issues = [issue]
        emitted = update_active_alerts(issues, now + i * 10)
        emitted_count += len(emitted)
        if emitted:
            print(f"  第{i+1}次：发射告警，dedup_count={emitted[0].get('dedup_count')}")
        else:
            print(f"  第{i+1}次：冷却中，未发射")
    
    print(f"总发射次数：{emitted_count} (预期：1)")
    assert emitted_count == 1, "60 秒内应该只发射 1 次"
    
    # 场景 2：60 秒后问题仍存在
    print("\n场景 2: 60 秒后问题仍存在")
    issues = [issue]
    emitted = update_active_alerts(issues, now + 70)
    print(f"60 秒后发射：{len(emitted)} 条，dedup_count={emitted[0].get('dedup_count') if emitted else 0} (预期：1, 6)")
    assert len(emitted) == 1 and emitted[0].get('dedup_count', 0) == 6
    
    # 场景 3：问题消失 → 恢复事件
    print("\n场景 3: 问题消失 → 恢复事件")
    issues = []  # 没有问题
    emitted = update_active_alerts(issues, now + 80)
    print(f"恢复事件：{len(emitted)} 条")
    if emitted:
        print(f"  类型：{emitted[0].get('type')}")
        print(f"  级别：{emitted[0].get('level')}")
        print(f"  标题：{emitted[0].get('title')}")
    assert len(emitted) == 1 and emitted[0].get('level') == 'INFO' and 'recovered' in emitted[0].get('type', '')
    
    # 场景 4：问题消失后又复发
    print("\n场景 4: 问题消失后又复发")
    alert_cooldowns.clear()
    active_alerts.clear()
    
    issues = [issue]
    emitted = update_active_alerts(issues, now + 100)
    print(f"复发后发射：{len(emitted)} 条，dedup_count={emitted[0].get('dedup_count') if emitted else 0} (预期：1, 1)")
    assert len(emitted) == 1 and emitted[0].get('dedup_count', 0) == 1
    
    print("✅ update_active_alerts 测试通过")


def test_collect_candidate_issues():
    """测试 collect_candidate_issues 问题收集"""
    print("\n=== 测试 4: collect_candidate_issues 问题收集 ===")
    
    # 模拟健康状态异常
    raw = {
        "health": {
            "overall": "error",
            "snapshot_age_sec": 120,
            "worker_alive": False,
            "sources": {
                "okx_capital": {
                    "status": "error",
                    "fail_count": 5,
                    "last_error": "Connection timeout",
                },
                "okx_position": {
                    "status": "ok",
                    "fail_count": 0,
                },
            }
        },
        "risk": {
            "circuit_breaker": True,
            "current_daily_loss": 600,
            "max_daily_loss": 500,
            "daily_trades": 25,
            "max_daily_trades": 20,
            "gate_status": "blocked",
            "gate_reasons": ["circuit_breaker", "max_daily_loss"],
        }
    }
    
    issues = collect_candidate_issues(raw)
    
    print(f"收集到 {len(issues)} 个问题:")
    for issue in issues:
        print(f"  - [{issue['level']}] {issue['title']}: {issue['message']}")
    
    # 验证关键问题都被收集
    types = [i['type'] for i in issues]
    expected_types = ['worker_timeout', 'snapshot_stale', 'source_failure', 'circuit_breaker', 'max_daily_loss', 'max_daily_trades', 'gate_blocked']
    
    for expected in expected_types:
        assert expected in types, f"应该收集到 {expected} 类型问题"
    
    print("✅ collect_candidate_issues 测试通过")


def test_build_alerts_full():
    """测试 build_alerts 完整流程"""
    print("\n=== 测试 5: build_alerts 完整流程 ===")
    
    # 清空状态
    alert_cooldowns.clear()
    active_alerts.clear()
    
    raw = {
        "health": {
            "overall": "error",
            "snapshot_age_sec": 120,
            "worker_alive": False,
            "sources": {
                "okx_capital": {"status": "error", "fail_count": 5},
            }
        },
        "risk": {
            "circuit_breaker": True,
            "current_daily_loss": 600,
            "max_daily_loss": 500,
        }
    }
    
    alerts, summary = build_alerts(raw)
    
    print(f"生成 {len(alerts)} 条告警:")
    for alert in alerts:
        print(f"  - [{alert['level']}] {alert['title']} (dedup_count={alert.get('dedup_count', 1)})")
    
    print(f"\n摘要：{summary}")
    
    # 验证排序：CRITICAL 在前
    if len(alerts) > 1:
        assert alerts[0]['level'] == 'CRITICAL', "CRITICAL 应该排在最前面"
    
    # 验证摘要
    assert summary['total'] == len(alerts)
    assert summary['critical'] == sum(1 for a in alerts if a['level'] == 'CRITICAL')
    
    print("✅ build_alerts 完整流程测试通过")


def main():
    print("=" * 60)
    print("P1-2 告警去重与冷却功能测试")
    print("=" * 60)
    
    try:
        test_alert_key()
        test_should_emit_alert()
        test_update_active_alerts()
        test_collect_candidate_issues()
        test_build_alerts_full()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ 测试失败：{e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试异常：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
