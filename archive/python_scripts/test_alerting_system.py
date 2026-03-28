#!/usr/bin/env python3
"""
告警系统测试套件
Test Suite for Alerting System
"""

import json
import time
from datetime import datetime
from observability_logger import logger, TaskStatus
from alerting_system import AlertingSystem, AlertLevel


class AlertingSystemTester:
    """告警系统测试器"""
    
    def __init__(self):
        self.alerting = AlertingSystem(logger)
        self.test_results = []
    
    def test_rule_001_success_rate(self):
        """测试规则 001: 成功率低于阈值"""
        print("\n🧪 测试 ALERT-001: 成功率低于阈值")
        
        # 模拟低成功率
        stats = {"success_rate": 0.93}  # < 0.95
        self.alerting.check_and_alert(stats)
        
        # 检查是否触发告警
        active = self.alerting.get_active_alerts()
        alert_001 = [a for a in active if a.rule_id == "ALERT-001"]
        
        passed = len(alert_001) > 0
        self.test_results.append({
            "test": "ALERT-001",
            "passed": passed,
            "message": "成功率 93% 应触发告警"
        })
        
        print(f"  {'✅' if passed else '❌'} 成功率 93% {'触发' if passed else '未触发'}告警")
        return passed
    
    def test_rule_002_timeout_rate(self):
        """测试规则 002: Timeout 率突然升高"""
        print("\n🧪 测试 ALERT-002: Timeout 率突然升高")
        
        stats = {"timeout_rate": 0.12}  # > 0.10
        self.alerting.check_and_alert(stats)
        
        active = self.alerting.get_active_alerts()
        alert_002 = [a for a in active if a.rule_id == "ALERT-002"]
        
        passed = len(alert_002) > 0
        self.test_results.append({
            "test": "ALERT-002",
            "passed": passed,
            "message": "Timeout 率 12% 应触发告警"
        })
        
        print(f"  {'✅' if passed else '❌'} Timeout 率 12% {'触发' if passed else '未触发'}告警")
        return passed
    
    def test_rule_007_grok_code_p95(self):
        """测试规则 007: GROK-CODE P95 明显恶化"""
        print("\n🧪 测试 ALERT-007: GROK-CODE P95 明显恶化")
        
        stats = {"grok_code_p95": 45000}  # > 40000
        self.alerting.check_and_alert(stats)
        
        active = self.alerting.get_active_alerts()
        alert_007 = [a for a in active if a.rule_id == "ALERT-007"]
        
        passed = len(alert_007) > 0
        self.test_results.append({
            "test": "ALERT-007",
            "passed": passed,
            "message": "GROK-CODE P95 45s 应触发告警"
        })
        
        print(f"  {'✅' if passed else '❌'} GROK-CODE P95 45s {'触发' if passed else '未触发'}告警")
        return passed
    
    def test_deduplication(self):
        """测试去重机制"""
        print("\n🧪 测试去重机制")
        
        # 第一次触发
        stats = {"success_rate": 0.90}
        self.alerting.check_and_alert(stats)
        
        initial_count = len(self.alerting.get_active_alerts())
        
        # 立即第二次触发（应被去重）
        self.alerting.check_and_alert(stats)
        
        final_count = len(self.alerting.get_active_alerts())
        
        passed = final_count == initial_count
        self.test_results.append({
            "test": "DEDUPLICATION",
            "passed": passed,
            "message": "重复告警应被去重"
        })
        
        print(f"  {'✅' if passed else '❌'} 重复告警{'被正确去重' if passed else '未被去重'}")
        return passed
    
    def test_alert_levels(self):
        """测试告警分级"""
        print("\n🧪 测试告警分级")
        
        # 触发 WARNING 级别
        stats_warning = {"timeout_rate": 0.15}
        self.alerting.check_and_alert(stats_warning)
        
        # 触发 CRITICAL 级别
        stats_critical = {"success_rate": 0.90}
        self.alerting.check_and_alert(stats_critical)
        
        active = self.alerting.get_active_alerts()
        
        warning_alerts = [a for a in active if a.level == AlertLevel.WARNING]
        critical_alerts = [a for a in active if a.level == AlertLevel.CRITICAL]
        
        passed = len(warning_alerts) > 0 and len(critical_alerts) > 0
        
        self.test_results.append({
            "test": "ALERT_LEVELS",
            "passed": passed,
            "message": f"应有 WARNING 和 CRITICAL 级别告警"
        })
        
        print(f"  {'✅' if passed else '❌'} WARNING: {len(warning_alerts)} 个, CRITICAL: {len(critical_alerts)} 个")
        return passed
    
    def test_alert_summary(self):
        """测试告警摘要"""
        print("\n🧪 测试告警摘要")
        
        summary = self.alerting.get_alert_summary()
        
        passed = (
            "total_active" in summary and
            "warning" in summary and
            "critical" in summary
        )
        
        self.test_results.append({
            "test": "ALERT_SUMMARY",
            "passed": passed,
            "message": "告警摘要应包含关键字段"
        })
        
        print(f"  {'✅' if passed else '❌'} 告警摘要: {summary}")
        return passed
    
    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 60)
        print("🧪 告警系统测试套件")
        print("=" * 60)
        
        tests = [
            self.test_rule_001_success_rate,
            self.test_rule_002_timeout_rate,
            self.test_rule_007_grok_code_p95,
            self.test_deduplication,
            self.test_alert_levels,
            self.test_alert_summary
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"  ❌ 测试异常: {e}")
                self.test_results.append({
                    "test": test.__name__,
                    "passed": False,
                    "message": f"异常: {e}"
                })
        
        # 汇总
        passed = sum(1 for r in self.test_results if r["passed"])
        total = len(self.test_results)
        
        print("\n" + "=" * 60)
        print("📊 测试结果汇总")
        print("=" * 60)
        print(f"通过: {passed}/{total}")
        
        for result in self.test_results:
            emoji = "✅" if result["passed"] else "❌"
            print(f"  {emoji} {result['test']}: {result['message']}")
        
        return passed == total


if __name__ == "__main__":
    tester = AlertingSystemTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 所有告警系统测试通过！")
    else:
        print("\n⚠️ 部分测试未通过，请检查")