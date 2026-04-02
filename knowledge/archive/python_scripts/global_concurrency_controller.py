#!/usr/bin/env python3
"""
OpenClaw 全局并发控制器
Global Concurrency Controller

Phase 3: 全局并发控制
"""

import threading
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from queue import PriorityQueue


class PriorityLevel(Enum):
    """优先级"""
    P0 = 0  # 系统控制
    P1 = 1  # 当前交互
    P2 = 2  # 复杂任务
    P3 = 3  # 后台任务


@dataclass
class TaskRequest:
    """任务请求"""
    task_id: str
    session_id: str
    priority: int
    estimated_cost: str
    is_mixed: bool
    chain: Optional[List[str]]
    timestamp: float
    
    def __lt__(self, other):
        return self.priority < other.priority


class GlobalConcurrencyController:
    """全局并发控制器"""
    
    def __init__(self):
        # 全局限制
        self.max_mixed_chains = 3
        self.max_subagents = 5
        
        # 当前状态
        self.active_mixed_chains = 0
        self.active_subagents = 0
        
        # 模型并发限制
        self.model_limits = {
            "MAIN": 2,
            "LONG": 2,
            "CODE-PLUS": 1,
            "GROK-CODE": 2,
            "REASON": 2,
            "CODE": 3,
            "CN": 3,
            "FAST": 5
        }
        
        # 当前模型并发
        self.model_concurrency = {model: 0 for model in self.model_limits}
        
        # 优先级队列
        self.task_queue = PriorityQueue()
        self.queue_lock = threading.Lock()
        
        # 全局锁
        self.global_lock = threading.Lock()
        
        # 统计
        self.stats = {
            "total_requests": 0,
            "accepted": 0,
            "queued": 0,
            "rejected": 0,
            "degraded": 0
        }
        
        # 运行标志
        self.running = True
        self.scheduler_thread = None
    
    def check_resources(self, session_id: str, decision: Dict) -> Tuple[bool, str, str]:
        """
        检查全局资源
        
        返回：(是否允许, 原因, 建议操作)
        """
        with self.global_lock:
            self.stats["total_requests"] += 1
            
            is_mixed = decision.get("is_mixed", False)
            chain = decision.get("chain", [])
            selected_model = decision.get("selected_model")
            priority = decision.get("priority", "P1")
            
            # 检查混合链路
            if is_mixed:
                if self.active_mixed_chains >= self.max_mixed_chains:
                    return False, "全局混合链路已满", "queue"
            
            # 检查模型并发
            if is_mixed and chain:
                for model in chain:
                    if model in self.model_concurrency:
                        if self.model_concurrency[model] >= self.model_limits[model]:
                            return False, f"模型 {model} 并发已满", "queue"
            elif selected_model:
                if selected_model in self.model_concurrency:
                    if self.model_concurrency[selected_model] >= self.model_limits[selected_model]:
                        return False, f"模型 {selected_model} 并发已满", "queue"
            
            # 资源充足
            return True, "允许", "execute"
    
    def acquire_resources(self, decision: Dict) -> bool:
        """占用资源"""
        with self.global_lock:
            is_mixed = decision.get("is_mixed", False)
            chain = decision.get("chain", [])
            selected_model = decision.get("selected_model")
            
            if is_mixed:
                self.active_mixed_chains += 1
                if chain:
                    for model in chain:
                        if model in self.model_concurrency:
                            self.model_concurrency[model] += 1
            elif selected_model:
                if selected_model in self.model_concurrency:
                    self.model_concurrency[selected_model] += 1
            
            self.stats["accepted"] += 1
            return True
    
    def release_resources(self, decision: Dict):
        """释放资源"""
        with self.global_lock:
            is_mixed = decision.get("is_mixed", False)
            chain = decision.get("chain", [])
            selected_model = decision.get("selected_model")
            
            if is_mixed:
                self.active_mixed_chains = max(0, self.active_mixed_chains - 1)
                if chain:
                    for model in chain:
                        if model in self.model_concurrency:
                            self.model_concurrency[model] = max(0, self.model_concurrency[model] - 1)
            elif selected_model:
                if selected_model in self.model_concurrency:
                    self.model_concurrency[selected_model] = max(0, self.model_concurrency[selected_model] - 1)
    
    def queue_task(self, task_id: str, session_id: str, decision: Dict) -> bool:
        """将任务加入队列"""
        priority_str = decision.get("priority", "P1")
        priority = PriorityLevel[priority_str].value if priority_str in PriorityLevel.__members__ else 1
        
        task = TaskRequest(
            task_id=task_id,
            session_id=session_id,
            priority=priority,
            estimated_cost=decision.get("estimated_cost", "medium"),
            is_mixed=decision.get("is_mixed", False),
            chain=decision.get("chain"),
            timestamp=time.time()
        )
        
        with self.queue_lock:
            self.task_queue.put(task)
            self.stats["queued"] += 1
        
        return True
    
    def get_next_task(self) -> Optional[TaskRequest]:
        """获取下一个任务"""
        try:
            with self.queue_lock:
                if not self.task_queue.empty():
                    return self.task_queue.get_nowait()
        except:
            pass
        return None
    
    def start_scheduler(self):
        """启动调度器"""
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        print("✅ 全局并发调度器已启动")
    
    def _scheduler_loop(self):
        """调度循环"""
        while self.running:
            try:
                # 尝试从队列获取任务
                task = self.get_next_task()
                
                if task:
                    # 检查资源
                    decision = {
                        "is_mixed": task.is_mixed,
                        "chain": task.chain,
                        "priority": f"P{task.priority}"
                    }
                    
                    allowed, reason, action = self.check_resources(task.session_id, decision)
                    
                    if allowed:
                        # 执行任务
                        self.acquire_resources(decision)
                        print(f"🚀 执行任务: {task.task_id} [P{task.priority}]")
                        # 这里调用实际执行逻辑
                        # execute_task(task)
                        # 执行完成后释放资源
                        # self.release_resources(decision)
                    else:
                        # 资源不足，重新入队
                        self.queue_task(task.task_id, task.session_id, decision)
                        time.sleep(1)  # 等待资源释放
                else:
                    # 队列为空，等待
                    time.sleep(0.5)
                    
            except Exception as e:
                print(f"调度器异常: {e}")
                time.sleep(1)
    
    def stop_scheduler(self):
        """停止调度器"""
        self.running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        print("✅ 全局并发调度器已停止")
    
    def get_status(self) -> Dict:
        """获取当前状态"""
        with self.global_lock:
            return {
                "active_mixed_chains": self.active_mixed_chains,
                "max_mixed_chains": self.max_mixed_chains,
                "active_subagents": self.active_subagents,
                "max_subagents": self.max_subagents,
                "model_concurrency": self.model_concurrency.copy(),
                "model_limits": self.model_limits,
                "queue_size": self.task_queue.qsize(),
                "stats": self.stats.copy()
            }
    
    def get_model_status(self, model: str) -> Dict:
        """获取模型状态"""
        with self.global_lock:
            if model in self.model_concurrency:
                return {
                    "model": model,
                    "current": self.model_concurrency[model],
                    "limit": self.model_limits[model],
                    "available": self.model_limits[model] - self.model_concurrency[model]
                }
            return {"error": "模型不存在"}
    
    def force_release_all(self):
        """强制释放所有资源（紧急恢复）"""
        with self.global_lock:
            self.active_mixed_chains = 0
            self.active_subagents = 0
            for model in self.model_concurrency:
                self.model_concurrency[model] = 0
            print("⚠️ 已强制释放所有资源")


if __name__ == "__main__":
    print("全局并发控制器已加载")
