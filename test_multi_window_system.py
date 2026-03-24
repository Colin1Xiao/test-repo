#!/usr/bin/env python3
"""
OpenClaw 多窗口系统完整测试
Complete Test for Multi-Window System
"""

import json
import time
import threading
from datetime import datetime

# 导入各模块
from multi_window_session_manager import MultiWindowSessionManager, SessionContext
from multi_window_router import WindowRouter
from global_concurrency_controller import GlobalConcurrencyController
from priority_scheduler import PriorityScheduler, DegradationLevel


class MultiWindowSystemTester:
    """多窗口系统测试器"""
    
    def __init__(self):
        self.session_manager = MultiWindowSessionManager()
        self.concurrency_controller = GlobalConcurrencyController()
        self.priority_scheduler = PriorityScheduler()
        
        self.test_results = []
        self.passed = 0
        self.failed = 0
    
    def log_test(self, name: str, passed: bool, message: str):
        """记录测试结果"""
        self.test_results.append({
            "name": name,
            "passed": passed,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        emoji = "✅" if passed else "❌"
        print(f"{emoji} {name}: {message}")
    
    def test_phase1_session_isolation(self):
        """测试 Phase 1: 会话隔离"""
        print("\n" + "="*60)
        print("🧪 测试 Phase 1: 会话隔离")
        print("="*60)
        
        # 测试 1: 创建多个窗口
        try:
            sessions = [
                self.session_manager.create_session("webchat", "interactive", "standard", "P1"),
                self.session_manager.create_session("telegram", "interactive", "light", "P1"),
                self.session_manager.create_session("cli", "analysis", "heavy", "P2"),
            ]
            self.log_test("创建多窗口", True, f"创建 {len(sessions)} 个窗口成功")
        except Exception as e:
            self.log_test("创建多窗口", False, f"失败: {e}")
            return
        
        # 测试 2: 窗口隔离
        try:
            # 向每个窗口添加不同消息
            for i, session in enumerate(sessions):
                self.session_manager.add_message(session.session_id, "user", f"消息 {i}")
            
            # 验证消息隔离
            isolated = True
            for i, session in enumerate(sessions):
                messages = session.history
                if len(messages) != 1 or messages[0]["content"] != f"消息 {i}":
                    isolated = False
                    break
            
            self.log_test("窗口消息隔离", isolated, "消息隔离正常" if isolated else "消息串线")
        except Exception as e:
            self.log_test("窗口消息隔离", False, f"失败: {e}")
        
        # 测试 3: 资源预算隔离
        try:
            budgets = [s.resource_budget for s in sessions]
            different = len(set(json.dumps(b, sort_keys=True) for b in budgets)) == len(budgets)
            self.log_test("资源预算隔离", different, "预算配置独立" if different else "预算配置相同")
        except Exception as e:
            self.log_test("资源预算隔离", False, f"失败: {e}")
        
        # 清理
        for session in sessions:
            self.session_manager.close_session(session.session_id)
    
    def test_phase2_independent_routing(self):
        """测试 Phase 2: 独立路由"""
        print("\n" + "="*60)
        print("🧪 测试 Phase 2: 独立路由")
        print("="*60)
        
        # 测试 1: 不同档位路由
        try:
            class MockSession:
                def __init__(self, profile):
                    self.routing_profile = profile
            
            test_cases = [
                ("Docker 是什么？", "light", "FAST"),  # 简单问答 -> FAST
                ("分析这个报错并修复", "standard", "GROK-CODE"),  # 调试 -> GROK-CODE
                ("比较单体架构和微服务架构的优劣", "heavy", "REASON"),  # 推理决策 -> REASON链
            ]
            
            all_passed = True
            for input_text, profile, expected_model in test_cases:
                session = MockSession(profile)
                router = WindowRouter(session)
                decision = router.route(input_text)
                
                if decision.selected_model == expected_model or (decision.is_mixed and expected_model in decision.chain):
                    self.log_test(f"{profile} 档位路由", True, f"{input_text[:20]}... -> {expected_model}")
                else:
                    all_passed = False
                    self.log_test(f"{profile} 档位路由", False, f"期望 {expected_model}, 实际 {decision.selected_model or decision.chain}")
            
        except Exception as e:
            self.log_test("档位路由", False, f"失败: {e}")
        
        # 测试 2: 降级路由
        try:
            session = MockSession("light")
            router = WindowRouter(session)
            
            # Light 档位请求混合任务
            decision = router.route("分析这个报错并修复代码")
            
            if not decision.is_mixed:
                self.log_test("Light 档位降级", True, "混合任务降级为单模型")
            else:
                self.log_test("Light 档位降级", False, "未触发降级")
        except Exception as e:
            self.log_test("Light 档位降级", False, f"失败: {e}")
    
    def test_phase3_global_concurrency(self):
        """测试 Phase 3: 全局并发控制"""
        print("\n" + "="*60)
        print("🧪 测试 Phase 3: 全局并发控制")
        print("="*60)
        
        # 测试 1: 资源检查
        try:
            decision = {
                "is_mixed": True,
                "chain": ["GROK-CODE", "CODE", "MAIN"],
                "priority": "P1"
            }
            
            allowed, reason, action = self.concurrency_controller.check_resources("session_1", decision)
            self.log_test("资源检查", allowed, f"资源检查通过: {reason}")
        except Exception as e:
            self.log_test("资源检查", False, f"失败: {e}")
        
        # 测试 2: 资源占用与释放
        try:
            self.concurrency_controller.acquire_resources(decision)
            status = self.concurrency_controller.get_status()
            
            if status["active_mixed_chains"] == 1:
                self.log_test("资源占用", True, "混合链路占用成功")
            else:
                self.log_test("资源占用", False, "占用计数异常")
            
            self.concurrency_controller.release_resources(decision)
            status = self.concurrency_controller.get_status()
            
            if status["active_mixed_chains"] == 0:
                self.log_test("资源释放", True, "混合链路释放成功")
            else:
                self.log_test("资源释放", False, "释放计数异常")
        except Exception as e:
            self.log_test("资源占用/释放", False, f"失败: {e}")
    
    def test_phase4_priority_and_degradation(self):
        """测试 Phase 4: 优先级与降级"""
        print("\n" + "="*60)
        print("🧪 测试 Phase 4: 优先级与降级")
        print("="*60)
        
        # 测试 1: 优先级队列
        try:
            tasks = [
                ("task_1", "P0", "system_check"),
                ("task_2", "P1", "simple_qa"),
                ("task_3", "P2", "debug"),
                ("task_4", "P3", "background"),
            ]
            
            for task_id, priority, task_type in tasks:
                self.priority_scheduler.submit_task(
                    task_id, "session_1", priority, task_type,
                    100, "low", False, None
                )
            
            # 验证优先级顺序
            task = self.priority_scheduler.get_next_task()
            if task and task.priority == 0:  # P0
                self.log_test("优先级队列", True, "P0 任务优先出队")
            else:
                self.log_test("优先级队列", False, "优先级顺序错误")
        except Exception as e:
            self.log_test("优先级队列", False, f"失败: {e}")
        
        # 测试 2: 降级策略
        try:
            from priority_scheduler import DegradationLevel
            
            task = self.priority_scheduler.get_next_task()
            if task:
                degraded = self.priority_scheduler.apply_degradation(task, DegradationLevel.MEDIUM)
                if not degraded.is_mixed:
                    self.log_test("降级策略", True, "混合任务降级为单模型")
                else:
                    self.log_test("降级策略", False, "降级未生效")
            else:
                self.log_test("降级策略", False, "无任务可降级")
        except Exception as e:
            self.log_test("降级策略", False, f"失败: {e}")
    
    def run_all_tests(self):
        """运行所有测试"""
        print("="*60)
        print("🚀 OpenClaw 多窗口系统完整测试")
        print("="*60)
        
        self.test_phase1_session_isolation()
        self.test_phase2_independent_routing()
        self.test_phase3_global_concurrency()
        self.test_phase4_priority_and_degradation()
        
        # 汇总
        print("\n" + "="*60)
        print("📊 测试结果汇总")
        print("="*60)
        print(f"通过: {self.passed}")
        print(f"失败: {self.failed}")
        print(f"通过率: {self.passed/(self.passed+self.failed)*100:.1f}%")
        
        if self.failed == 0:
            print("\n🎉 所有测试通过！多窗口系统就绪！")
        else:
            print(f"\n⚠️ {self.failed} 个测试未通过，请检查")
        
        return self.failed == 0


if __name__ == "__main__":
    tester = MultiWindowSystemTester()
    success = tester.run_all_tests()