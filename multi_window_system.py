#!/usr/bin/env python3
"""
OpenClaw 多模型处理系统 (OpenClaw Multi-Model Processing System)
统一名称: OCNMPS (OpenClaw NMPS)
简称: ocnmps

功能: 多窗口隔离 + 多模型路由 + 混合任务链
启动命令: python3 multi_window_system.py
"""

import json
import time
import threading
import signal
import sys
from datetime import datetime
from typing import Dict, Optional

from multi_window_session_manager import MultiWindowSessionManager, SessionContext
from multi_window_router import WindowRouter, TaskType
from global_concurrency_controller import GlobalConcurrencyController
from priority_scheduler import PriorityScheduler, DegradationLevel, PriorityTask


class OpenClawMMPS:
    """OpenClaw 多模型处理系统主服务"""
    
    def __init__(self):
        self.session_manager = MultiWindowSessionManager()
        self.concurrency_controller = GlobalConcurrencyController()
        self.priority_scheduler = PriorityScheduler()
        
        self.running = False
        self.scheduler_thread = None
        self.stats_thread = None
        
        # 统计
        self.stats = {
            "tasks_processed": 0,
            "tasks_succeeded": 0,
            "tasks_failed": 0,
            "start_time": None
        }
        
        # 注册信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """信号处理"""
        print(f"\n⚠️ 收到信号 {signum}，正在停止服务...")
        self.stop()
        sys.exit(0)
    
    def start(self):
        """启动服务"""
        print("=" * 70)
        print("🚀 OpenClaw 多模型处理系统 (OCNMPS / ocnmps) 启动")
        print("=" * 70)
        print(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        self.running = True
        self.stats["start_time"] = datetime.now()
        
        # 启动全局并发调度器
        self.concurrency_controller.start_scheduler()
        print()
        
        # 启动任务调度线程
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        print("✅ 任务调度器已启动")
        
        # 启动统计线程
        self.stats_thread = threading.Thread(target=self._stats_loop, daemon=True)
        self.stats_thread.start()
        print("✅ 统计监控已启动")
        
        print()
        print("=" * 70)
        print("服务运行中...")
        print("=" * 70)
        print()
    
    def stop(self):
        """停止服务"""
        self.running = False
        
        if self.concurrency_controller:
            self.concurrency_controller.stop_scheduler()
        
        print("\n✅ 服务已停止")
        self._print_final_stats()
    
    def _scheduler_loop(self):
        """任务调度循环"""
        while self.running:
            try:
                # 从优先级队列获取任务
                task = self.priority_scheduler.get_next_task()
                
                if task:
                    # 检查等待时间
                    should_degrade, action = self.priority_scheduler.check_wait_time(task)
                    
                    if should_degrade and action == "degrade":
                        # 应用降级
                        task = self.priority_scheduler.apply_degradation(
                            task, 
                            DegradationLevel.MEDIUM
                        )
                        print(f"⬇️ 任务 {task.task_id} 已降级")
                    
                    # 检查全局资源
                    decision = {
                        "is_mixed": task.is_mixed,
                        "chain": task.chain,
                        "selected_model": None,
                        "priority": f"P{task.priority}"
                    }
                    
                    allowed, reason, action = self.concurrency_controller.check_resources(
                        task.session_id, decision
                    )
                    
                    if allowed:
                        # 占用资源
                        self.concurrency_controller.acquire_resources(decision)
                        
                        # 执行任务
                        self._execute_task(task, decision)
                        
                        # 释放资源
                        self.concurrency_controller.release_resources(decision)
                    else:
                        # 资源不足，重新入队
                        self.priority_scheduler.submit_task(
                            task.task_id, task.session_id, f"P{task.priority}",
                            task.task_type, task.input_length, task.estimated_cost,
                            task.is_mixed, task.chain
                        )
                        time.sleep(0.5)
                else:
                    time.sleep(0.1)
                    
            except Exception as e:
                print(f"调度器异常: {e}")
                time.sleep(1)
    
    def _execute_task(self, task: PriorityTask, decision: Dict):
        """执行任务"""
        try:
            print(f"🚀 执行任务: {task.task_id} [P{task.priority}] [{task.task_type}]")
            
            if task.is_mixed and task.chain:
                print(f"   链路: {' -> '.join(task.chain)}")
                # 模拟混合链路执行
                for i, model in enumerate(task.chain):
                    print(f"   Step {i+1}/{len(task.chain)}: {model} 执行中...")
                    time.sleep(0.5)  # 模拟执行时间
            else:
                model = decision.get("selected_model", "MAIN")
                print(f"   单模型: {model} 执行中...")
                time.sleep(0.3)  # 模拟执行时间
            
            self.stats["tasks_succeeded"] += 1
            print(f"   ✅ 完成")
            
        except Exception as e:
            self.stats["tasks_failed"] += 1
            print(f"   ❌ 失败: {e}")
        
        self.stats["tasks_processed"] += 1
    
    def _stats_loop(self):
        """统计监控循环"""
        while self.running:
            try:
                time.sleep(30)  # 每30秒输出一次统计
                if self.running:
                    self._print_stats()
            except Exception as e:
                print(f"统计异常: {e}")
    
    def _print_stats(self):
        """打印统计"""
        runtime = datetime.now() - self.stats["start_time"]
        hours, remainder = divmod(runtime.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        cc_status = self.concurrency_controller.get_status()
        ps_status = self.priority_scheduler.get_queue_status()
        
        print()
        print("-" * 70)
        print(f"📊 运行统计 [{hours:02d}:{minutes:02d}:{seconds:02d}]")
        print("-" * 70)
        print(f"任务处理: {self.stats['tasks_processed']} | 成功: {self.stats['tasks_succeeded']} | 失败: {self.stats['tasks_failed']}")
        print(f"活跃混合链路: {cc_status['active_mixed_chains']}/{cc_status['max_mixed_chains']}")
        print(f"队列任务数: {ps_status['total_tasks']}")
        print(f"降级级别: {ps_status['current_degradation']}")
        print("-" * 70)
    
    def _print_final_stats(self):
        """打印最终统计"""
        runtime = datetime.now() - self.stats["start_time"]
        print()
        print("=" * 70)
        print("📊 最终统计")
        print("=" * 70)
        print(f"运行时长: {runtime}")
        print(f"总任务数: {self.stats['tasks_processed']}")
        print(f"成功: {self.stats['tasks_succeeded']}")
        print(f"失败: {self.stats['tasks_failed']}")
        print("=" * 70)
    
    def create_session(self, channel_type: str, window_type: str = "interactive", 
                      routing_profile: str = "standard", priority: str = "P1") -> SessionContext:
        """创建会话"""
        return self.session_manager.create_session(channel_type, window_type, routing_profile, priority)
    
    def submit_task(self, session_id: str, input_text: str, priority: str = "P1") -> str:
        """提交任务"""
        # 获取会话
        session = self.session_manager.get_session(session_id)
        if not session:
            return "会话不存在"
        
        # 路由决策
        router = WindowRouter(session)
        decision = router.route(input_text)
        
        # 生成任务ID
        task_id = f"task_{datetime.now().strftime('%Y%m%d%H%M%S')}_{hash(input_text) % 10000}"
        
        # 提交到优先级队列
        success = self.priority_scheduler.submit_task(
            task_id, session_id, priority,
            decision.task_type, len(input_text), decision.estimated_cost,
            decision.is_mixed, decision.chain
        )
        
        if success:
            print(f"📥 任务已提交: {task_id} [{decision.task_type}] [P{priority}]")
            if decision.is_mixed:
                print(f"   链路: {' -> '.join(decision.chain)}")
            else:
                print(f"   模型: {decision.selected_model}")
            return task_id
        else:
            return "提交失败"
    
    def get_status(self) -> Dict:
        """获取系统状态"""
        return {
            "running": self.running,
            "sessions": len(self.session_manager.active_sessions),
            "concurrency": self.concurrency_controller.get_status(),
            "scheduler": self.priority_scheduler.get_queue_status(),
            "stats": self.stats
        }


def demo():
    """演示模式"""
    system = OpenClawMMPS()
    system.start()
    
    print("🎬 演示模式 - 创建会话并提交任务\n")
    
    # 创建不同档位的会话
    sessions = [
        system.create_session("webchat", "interactive", "light", "P1"),
        system.create_session("telegram", "interactive", "standard", "P1"),
        system.create_session("cli", "analysis", "heavy", "P2"),
    ]
    
    print()
    
    # 提交不同类型的任务
    tasks = [
        (sessions[0].session_id, "Docker 是什么？", "P1"),
        (sessions[1].session_id, "分析这个报错并修复代码", "P1"),
        (sessions[2].session_id, "比较单体架构和微服务架构", "P2"),
        (sessions[0].session_id, "讲个笑话", "P1"),
        (sessions[1].session_id, "总结这份技术文档", "P2"),
    ]
    
    for session_id, text, priority in tasks:
        system.submit_task(session_id, text, priority)
        time.sleep(0.5)
    
    print()
    print("等待任务执行完成...")
    time.sleep(10)
    
    # 关闭会话
    for session in sessions:
        system.session_manager.close_session(session.session_id)
    
    system.stop()


def interactive():
    """交互模式"""
    system = OpenClawMMPS()
    system.start()
    
    # 创建一个标准会话
    session = system.create_session("cli", "interactive", "standard", "P1")
    
    print(f"\n💬 交互模式")
    print(f"会话ID: {session.session_id}")
    print("输入 'quit' 退出\n")
    
    try:
        while system.running:
            try:
                user_input = input("你: ").strip()
                if user_input.lower() == 'quit':
                    break
                if user_input:
                    system.submit_task(session.session_id, user_input, "P1")
                    time.sleep(1)  # 等待任务入队
            except EOFError:
                break
            except KeyboardInterrupt:
                break
    finally:
        system.session_manager.close_session(session.session_id)
        system.stop()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="OpenClaw 多模型处理系统 (MMPS)")
    parser.add_argument("--mode", choices=["demo", "interactive", "service"], 
                       default="demo", help="运行模式")
    
    args = parser.parse_args()
    
    if args.mode == "demo":
        demo()
    elif args.mode == "interactive":
        interactive()
    elif args.mode == "service":
        system = OpenClawMMPS()
        system.start()
        # 保持运行
        while system.running:
            time.sleep(1)
