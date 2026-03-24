#!/usr/bin/env python3
"""
多窗口系统测试客户端
用于向运行中的服务提交测试任务
"""

import json
import sys
import time
from datetime import datetime

# 模拟向服务提交任务
def submit_test_tasks():
    """提交测试任务到多窗口系统"""
    
    print("=" * 60)
    print("🧪 多窗口系统测试客户端")
    print("=" * 60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # 导入系统模块
    sys.path.insert(0, '/Users/colin/.openclaw/workspace')
    
    from multi_window_session_manager import MultiWindowSessionManager
    from multi_window_router import WindowRouter
    from global_concurrency_controller import GlobalConcurrencyController
    from priority_scheduler import PriorityScheduler
    
    # 初始化组件
    session_manager = MultiWindowSessionManager()
    concurrency_controller = GlobalConcurrencyController()
    priority_scheduler = PriorityScheduler()
    
    print("✅ 组件初始化完成")
    print()
    
    # 创建测试会话
    print("📱 创建测试会话...")
    sessions = [
        session_manager.create_session("telegram", "interactive", "light", "P1"),
        session_manager.create_session("webchat", "interactive", "standard", "P1"),
        session_manager.create_session("cli", "analysis", "heavy", "P2"),
    ]
    print()
    
    # 测试任务列表
    test_tasks = [
        {
            "name": "简单问答 (Light)",
            "session_idx": 0,
            "input": "Python 是什么？",
            "priority": "P1",
            "expected": "FAST"
        },
        {
            "name": "代码调试 (Standard)",
            "session_idx": 1,
            "input": "分析这个报错：IndexError: list index out of range",
            "priority": "P1",
            "expected": "GROK-CODE链"
        },
        {
            "name": "架构决策 (Heavy)",
            "session_idx": 2,
            "input": "比较 REST API 和 GraphQL 的优劣，给出选型建议",
            "priority": "P2",
            "expected": "REASON链"
        },
        {
            "name": "长文总结 (Heavy)",
            "session_idx": 2,
            "input": "总结这份文档的关键点：" + "这是一份技术文档，包含重要的技术细节和实现方案，需要仔细阅读和理解。" * 50,
            "priority": "P2",
            "expected": "LONG"
        },
        {
            "name": "中文润色 (Light)",
            "session_idx": 0,
            "input": "润色：这个产品很好，用起来很方便",
            "priority": "P1",
            "expected": "CN"
        }
    ]
    
    results = []
    
    print("📝 提交测试任务...")
    print("-" * 60)
    
    for i, task in enumerate(test_tasks, 1):
        session = sessions[task["session_idx"]]
        
        # 路由决策
        router = WindowRouter(session)
        decision = router.route(task["input"])
        
        # 显示结果
        print(f"\n{i}. {task['name']}")
        print(f"   输入: {task['input'][:40]}...")
        print(f"   档位: {session.routing_profile}")
        print(f"   任务类型: {decision.task_type}")
        
        if decision.is_mixed:
            print(f"   路由: {' -> '.join(decision.chain)}")
            actual = decision.chain[0] + "链"
        else:
            print(f"   路由: {decision.selected_model}")
            actual = decision.selected_model
        
        # 检查是否符合预期
        match = (task["expected"] in actual) or (actual in task["expected"])
        status = "✅" if match else "⚠️"
        print(f"   预期: {task['expected']} | 实际: {actual} {status}")
        
        results.append({
            "name": task["name"],
            "expected": task["expected"],
            "actual": actual,
            "match": match
        })
        
        time.sleep(0.3)
    
    print()
    print("-" * 60)
    print()
    
    # 汇总
    passed = sum(1 for r in results if r["match"])
    total = len(results)
    
    print("📊 测试结果汇总")
    print("=" * 60)
    print(f"通过: {passed}/{total} ({passed/total*100:.1f}%)")
    print()
    
    for r in results:
        status = "✅" if r["match"] else "❌"
        print(f"{status} {r['name']}: {r['actual']}")
    
    print()
    
    # 清理会话
    print("🧹 清理测试会话...")
    for session in sessions:
        session_manager.close_session(session.session_id)
    
    print()
    print("✅ 测试完成")
    print("=" * 60)


if __name__ == "__main__":
    submit_test_tasks()
