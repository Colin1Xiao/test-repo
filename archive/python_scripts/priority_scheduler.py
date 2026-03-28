#!/usr/bin/env python3
"""
OpenClaw 优先级调度器
Priority Scheduler with Degradation

Phase 4: 优先级与降级
"""

import time
from typing import Dict, List, Optional, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
from queue import PriorityQueue
import threading


class PriorityLevel(Enum):
    """优先级"""
    P0 = 0  # 系统控制
    P1 = 1  # 当前交互
    P2 = 2  # 复杂任务
    P3 = 3  # 后台任务


class DegradationLevel(Enum):
    """降级级别"""
    NONE = "none"
    LIGHT = "light"      # 轻度降级
    MEDIUM = "medium"    # 中度降级
    SEVERE = "severe"    # 重度降级


@dataclass
class PriorityTask:
    """优先级任务"""
    task_id: str
    session_id: str
    priority: int
    original_priority: str
    task_type: str
    input_length: int
    estimated_cost: str
    is_mixed: bool
    chain: Optional[List[str]]
    timestamp: float
    wait_time: float = 0
    degraded: bool = False
    degradation_level: str = "none"
    
    def __lt__(self, other):
        # 优先级高的先执行
        if self.priority != other.priority:
            return self.priority < other.priority
        # 同优先级，先到的先执行
        return self.timestamp < other.timestamp


class PriorityScheduler:
    """优先级调度器"""
    
    def __init__(self):
        # 优先级队列
        self.task_queue = PriorityQueue()
        self.queue_lock = threading.Lock()
        
        # 等待时间管理
        self.max_wait_times = {
            PriorityLevel.P0: 5,    # 5秒
            PriorityLevel.P1: 30,   # 30秒
            PriorityLevel.P2: 120,  # 2分钟
            PriorityLevel.P3: 600   # 10分钟
        }
        
        # 降级策略
        self.degradation_policies = {
            DegradationLevel.LIGHT: {
                "description": "轻度降级：减少混合链路步骤",
                "actions": [
                    "3步链路 -> 2步",
                    "2步链路 -> 1步",
                    "保持单模型"
                ]
            },
            DegradationLevel.MEDIUM: {
                "description": "中度降级：强制单模型",
                "actions": [
                    "所有混合 -> 单模型",
                    "长文本 -> 先摘要",
                    "复杂推理 -> 简化"
                ]
            },
            DegradationLevel.SEVERE: {
                "description": "重度降级：最小可用",
                "actions": [
                    "所有任务 -> FAST/MAIN",
                    "拒绝新 P3 任务",
                    "返回缓存/默认回复"
                ]
            }
        }
        
        # 当前降级状态
        self.current_degradation = DegradationLevel.NONE
        self.degradation_lock = threading.Lock()
        
        # 统计
        self.stats = {
            "total_queued": 0,
            "total_executed": 0,
            "total_degraded": 0,
            "total_rejected": 0,
            "avg_wait_time": 0
        }
    
    def submit_task(self, task_id: str, session_id: str, 
                   priority_str: str, task_type: str,
                   input_length: int, estimated_cost: str,
                   is_mixed: bool, chain: Optional[List[str]]) -> bool:
        """
        提交任务到队列
        
        返回：是否成功入队
        """
        # 检查是否严重降级
        if self.current_degradation == DegradationLevel.SEVERE:
            if priority_str == "P3":
                self.stats["total_rejected"] += 1
                return False
        
        priority = PriorityLevel[priority_str].value if priority_str in PriorityLevel.__members__ else 1
        
        task = PriorityTask(
            task_id=task_id,
            session_id=session_id,
            priority=priority,
            original_priority=priority_str,
            task_type=task_type,
            input_length=input_length,
            estimated_cost=estimated_cost,
            is_mixed=is_mixed,
            chain=chain,
            timestamp=time.time()
        )
        
        with self.queue_lock:
            self.task_queue.put(task)
            self.stats["total_queued"] += 1
        
        return True
    
    def get_next_task(self) -> Optional[PriorityTask]:
        """获取下一个任务"""
        try:
            with self.queue_lock:
                if not self.task_queue.empty():
                    task = self.task_queue.get_nowait()
                    task.wait_time = time.time() - task.timestamp
                    return task
        except:
            pass
        return None
    
    def check_wait_time(self, task: PriorityTask) -> Tuple[bool, str]:
        """
        检查任务等待时间
        
        返回：(是否超时, 建议操作)
        """
        max_wait = self.max_wait_times.get(PriorityLevel(task.priority), 60)
        
        if task.wait_time > max_wait:
            if task.priority <= 1:  # P0 或 P1
                return True, "degrade"  # 降级执行
            else:
                return True, "reject"   # 拒绝
        
        return False, "continue"
    
    def apply_degradation(self, task: PriorityTask, level: DegradationLevel) -> PriorityTask:
        """
        应用降级策略
        """
        task.degraded = True
        task.degradation_level = level.value
        
        if level == DegradationLevel.LIGHT:
            # 轻度降级：减少链路步骤
            if task.is_mixed and task.chain:
                if len(task.chain) > 2:
                    task.chain = task.chain[:2] + ["MAIN"]
                elif len(task.chain) == 2:
                    task.chain = [task.chain[0], "MAIN"]
        
        elif level == DegradationLevel.MEDIUM:
            # 中度降级：强制单模型
            if task.is_mixed:
                task.is_mixed = False
                task.chain = None
                # 选择降级后的单模型
                if task.task_type in ["debug", "reasoning"]:
                    task.estimated_cost = "medium"
                else:
                    task.estimated_cost = "low"
        
        elif level == DegradationLevel.SEVERE:
            # 重度降级：最小可用
            task.is_mixed = False
            task.chain = None
            task.estimated_cost = "low"
            # 强制使用 FAST 或 MAIN
        
        self.stats["total_degraded"] += 1
        return task
    
    def set_degradation_level(self, level: DegradationLevel, reason: str):
        """设置降级级别"""
        with self.degradation_lock:
            old_level = self.current_degradation
            self.current_degradation = level
            
            if level != old_level:
                print(f"⚠️ 降级级别变更: {old_level.value} -> {level.value}")
                print(f"   原因: {reason}")
                print(f"   策略: {self.degradation_policies[level]['description']}")
    
    def auto_degradation_check(self, global_status: Dict):
        """
        自动降级检查
        
        基于全局状态自动调整降级级别
        """
        active_mixed = global_status.get("active_mixed_chains", 0)
        max_mixed = global_status.get("max_mixed_chains", 3)
        queue_size = global_status.get("queue_size", 0)
        
        # 严重降级条件
        if active_mixed >= max_mixed and queue_size > 10:
            self.set_degradation_level(
                DegradationLevel.SEVERE,
                "混合链路满载且队列堆积"
            )
        
        # 中度降级条件
        elif active_mixed >= max_mixed * 0.8 and queue_size > 5:
            self.set_degradation_level(
                DegradationLevel.MEDIUM,
                "混合链路高负载"
            )
        
        # 轻度降级条件
        elif queue_size > 3:
            self.set_degradation_level(
                DegradationLevel.LIGHT,
                "队列开始堆积"
            )
        
        # 恢复正常
        elif self.current_degradation != DegradationLevel.NONE:
            if active_mixed < max_mixed * 0.5 and queue_size < 2:
                self.set_degradation_level(
                    DegradationLevel.NONE,
                    "负载恢复正常"
                )
    
    def get_queue_status(self) -> Dict:
        """获取队列状态"""
        with self.queue_lock:
            # 统计各优先级任务数
            priority_counts = {p.name: 0 for p in PriorityLevel}
            
            # 复制队列进行统计（不取出）
            temp_queue = PriorityQueue()
            tasks = []
            
            while not self.task_queue.empty():
                task = self.task_queue.get_nowait()
                tasks.append(task)
                priority_name = PriorityLevel(task.priority).name
                priority_counts[priority_name] += 1
            
            # 放回队列
            for task in tasks:
                temp_queue.put(task)
            
            self.task_queue = temp_queue
            
            return {
                "total_tasks": len(tasks),
                "priority_breakdown": priority_counts,
                "current_degradation": self.current_degradation.value,
                "stats": self.stats.copy()
            }
    
    def should_preempt(self, current_task: PriorityTask, new_task: PriorityTask) -> bool:
        """
        判断是否应该抢占
        
        P0 任务可以抢占 P1-P3
        P1 任务可以抢占 P2-P3
        """
        return new_task.priority < current_task.priority


class DegradationPolicy:
    """降级策略执行器"""
    
    def __init__(self):
        self.chain_degradation_map = {
            # 3 步链路 -> 2 步
            "GROK-CODE -> CODE -> MAIN": "GROK-CODE -> MAIN",
            "LONG -> REASON -> MAIN": "LONG -> MAIN",
            "REASON -> CN -> MAIN": "REASON -> MAIN",
            
            # 2 步链路 -> 1 步
            "GROK-CODE -> MAIN": "GROK-CODE",
            "LONG -> MAIN": "LONG",
            "REASON -> MAIN": "REASON",
        }
    
    def degrade_chain(self, chain: List[str], level: DegradationLevel) -> List[str]:
        """降级链路"""
        if level == DegradationLevel.NONE:
            return chain
        
        chain_str = " -> ".join(chain)
        
        if level == DegradationLevel.LIGHT:
            # 轻度：尝试减少步骤
            if chain_str in self.chain_degradation_map:
                return self.chain_degradation_map[chain_str].split(" -> ")
        
        elif level in [DegradationLevel.MEDIUM, DegradationLevel.SEVERE]:
            # 中度/重度：返回第一个模型
            return [chain[0]] if chain else ["MAIN"]
        
        return chain
    
    def get_fallback_model(self, task_type: str) -> str:
        """获取降级后的模型"""
        fallback_map = {
            "debug": "GROK-CODE",
            "reasoning": "REASON",
            "long_summary": "LONG",
            "single_code": "CODE",
            "polish": "CN",
            "simple_qa": "FAST",
            "explanation": "MAIN",
        }
        return fallback_map.get(task_type, "MAIN")


if __name__ == "__main__":
    # 测试优先级调度器
    print("测试优先级调度器...")
    
    scheduler = PriorityScheduler()
    
    # 提交测试任务
    test_tasks = [
        ("task_1", "P0", "system_check", 100, "low", False, None),
        ("task_2", "P1", "simple_qa", 50, "low", False, None),
        ("task_3", "P2", "debug", 500, "high", True, ["GROK-CODE", "CODE", "MAIN"]),
        ("task_4", "P3", "background", 1000, "medium", False, None),
    ]
    
    for task_id, priority, task_type, length, cost, is_mixed, chain in test_tasks:
        scheduler.submit_task(task_id, "session_1", priority, task_type, 
                            length, cost, is_mixed, chain)
    
    # 查看队列状态
    status = scheduler.get_queue_status()
    print(f"\n队列状态: {status}")
    
    # 模拟降级
    scheduler.set_degradation_level(DegradationLevel.MEDIUM, "资源紧张")
    
    # 获取并降级任务
    task = scheduler.get_next_task()
    if task:
        print(f"\n获取任务: {task.task_id} [P{task.priority}]")
        degraded = scheduler.apply_degradation(task, DegradationLevel.MEDIUM)
        print(f"降级后: is_mixed={degraded.is_mixed}, chain={degraded.chain}")
    
    print("\n✅ 优先级调度器测试完成")