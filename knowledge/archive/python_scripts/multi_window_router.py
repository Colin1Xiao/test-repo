#!/usr/bin/env python3
"""
OpenClaw 多窗口路由器
Multi-Window Router

Phase 2: 窗口内独立路由
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class TaskType(Enum):
    """任务类型"""
    SIMPLE_QA = "simple_qa"
    EXPLANATION = "explanation"
    LONG_SUMMARY = "long_summary"
    MULTI_DOC = "multi_doc"
    SINGLE_CODE = "single_code"
    REFACTOR = "refactor"
    DEBUG = "debug"
    REASONING = "reasoning"
    POLISH = "polish"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class RoutingProfile(Enum):
    """路由档位"""
    LIGHT = "light"
    STANDARD = "standard"
    HEAVY = "heavy"


@dataclass
class RouteDecision:
    """路由决策"""
    task_type: str
    routing_profile: str
    selected_model: Optional[str]
    chain: Optional[List[str]]
    is_mixed: bool
    estimated_cost: str
    timeout_seconds: int
    fallback_strategy: str
    requires_global_check: bool


class WindowRouter:
    """窗口级路由器"""
    
    def __init__(self, session_context):
        self.session = session_context
        self.profile = session_context.routing_profile
    
    def classify_task(self, input_text: str) -> TaskType:
        """Step 1: 任务分类 - 优化版"""
        input_lower = input_text.lower()
        input_length = len(input_text)
        
        # 调试相关 - 扩展关键词
        debug_keywords = ["报错", "错误", "error", "exception", "debug", "修复", "fix", "bug", 
                         "崩溃", "crash", "traceback", "indexerror", "typeerror", "valueerror",
                         "分析这个报错", "分析错误", "排查", "调试"]
        code_fix_keywords = ["代码", "code", "修复", "fix", "解决", "排查", "调试"]
        if any(kw in input_lower for kw in debug_keywords):
            if any(kw in input_lower for kw in code_fix_keywords) or "error" in input_lower:
                return TaskType.DEBUG
        
        # 长文本总结 - 优先检查（在代码和推理之前）
        if input_length > 1000:
            summary_keywords = ["总结", "摘要", "summary", "文档", "提炼", "概括", "要点",
                               "关键点", "核心内容", "tl;dr", "tldr", "太长不看"]
            if any(kw in input_lower for kw in summary_keywords):
                return TaskType.LONG_SUMMARY
            multi_doc_keywords = ["多份", "多个文档", "整合", "合并", "对比文档"]
            if any(kw in input_lower for kw in multi_doc_keywords):
                return TaskType.MULTI_DOC
            # 长文本默认走 LONG
            return TaskType.LONG_SUMMARY
        
        # 代码相关
        code_keywords = ["写代码", "生成代码", "函数", "class", "def ", "编写",
                        "代码实现", "写个函数", "写个类", "程序", "script", "coding"]
        if any(kw in input_lower for kw in code_keywords):
            if input_length > 500:
                return TaskType.REFACTOR
            return TaskType.SINGLE_CODE
        
        # 推理决策
        reasoning_keywords = ["比较", "选择", "方案", "决策", "分析", "权衡", "优劣", "对比",
                             "选型", "建议", "推荐", "哪个好", "vs", "versus", "还是"]
        if any(kw in input_lower for kw in reasoning_keywords):
            return TaskType.REASONING
        
        # 中文润色
        polish_keywords = ["润色", "改写", "更自然", "更正式", "中文优化", "优化表达",
                          "改写得", "调整语气", "让这段话", "表达更"]
        if any(kw in input_lower for kw in polish_keywords):
            return TaskType.POLISH
        
        # 解释说明
        explanation_keywords = ["解释", "说明", "什么是", "how to", "原理", "介绍", 
                               "讲讲", "说说", "怎么", "如何", "为什么"]
        if any(kw in input_lower for kw in explanation_keywords):
            return TaskType.EXPLANATION
        
        # 简单问答（默认）
        if input_length < 200:
            return TaskType.SIMPLE_QA
        
        return TaskType.UNKNOWN
    
    def check_profile_constraint(self, task_type: TaskType, input_length: int) -> Tuple[bool, str]:
        """Step 2: 档位约束检查"""
        profile_rules = {
            RoutingProfile.LIGHT: {
                "max_input_length": 200,
                "allowed_tasks": [TaskType.SIMPLE_QA, TaskType.EXPLANATION, TaskType.POLISH],
                "allow_mixed": False
            },
            RoutingProfile.STANDARD: {
                "max_input_length": 2000,
                "allowed_tasks": [
                    TaskType.SIMPLE_QA, TaskType.EXPLANATION, 
                    TaskType.LONG_SUMMARY, TaskType.SINGLE_CODE,
                    TaskType.DEBUG, TaskType.REASONING, TaskType.POLISH
                ],
                "allow_mixed": True,
                "max_chain_steps": 2
            },
            RoutingProfile.HEAVY: {
                "max_input_length": 10000,
                "allowed_tasks": "all",
                "allow_mixed": True,
                "max_chain_steps": 3
            }
        }
        
        rules = profile_rules.get(RoutingProfile(self.profile), profile_rules[RoutingProfile.STANDARD])
        
        if input_length > rules["max_input_length"]:
            return False, f"输入长度 {input_length} 超过限制 {rules['max_input_length']}"
        
        if rules["allowed_tasks"] != "all" and task_type not in rules["allowed_tasks"]:
            return False, f"任务类型 {task_type.value} 不在允许范围内"
        
        return True, "允许"
    
    def make_decision(self, task_type: TaskType) -> RouteDecision:
        """生成路由决策"""
        single_model_map = {
            TaskType.SIMPLE_QA: ("FAST", 30),
            TaskType.EXPLANATION: ("MAIN", 60),
            TaskType.LONG_SUMMARY: ("LONG", 90),
            TaskType.MULTI_DOC: ("LONG", 90),
            TaskType.SINGLE_CODE: ("CODE", 45),
            TaskType.REFACTOR: ("CODE-PLUS", 120),
            TaskType.POLISH: ("CN", 90),
        }
        
        mixed_chain_map = {
            TaskType.DEBUG: (["GROK-CODE", "CODE", "MAIN"], 195, "degrade_to_code_main"),
            TaskType.REASONING: (["REASON", "CN", "MAIN"], 240, "degrade_to_reason_main"),
        }
        
        if task_type in single_model_map:
            model, timeout = single_model_map[task_type]
            return RouteDecision(
                task_type=task_type.value,
                routing_profile=self.profile,
                selected_model=model,
                chain=None,
                is_mixed=False,
                estimated_cost="low",
                timeout_seconds=timeout,
                fallback_strategy="direct_main",
                requires_global_check=False
            )
        
        if task_type in mixed_chain_map:
            chain, timeout, fallback = mixed_chain_map[task_type]
            
            if self.profile == RoutingProfile.LIGHT.value:
                return RouteDecision(
                    task_type=task_type.value,
                    routing_profile=self.profile,
                    selected_model="MAIN",
                    chain=None,
                    is_mixed=False,
                    estimated_cost="medium",
                    timeout_seconds=90,
                    fallback_strategy="direct_main",
                    requires_global_check=False
                )
            
            return RouteDecision(
                task_type=task_type.value,
                routing_profile=self.profile,
                selected_model=None,
                chain=chain,
                is_mixed=True,
                estimated_cost="high",
                timeout_seconds=timeout,
                fallback_strategy=fallback,
                requires_global_check=True
            )
        
        return RouteDecision(
            task_type=task_type.value,
            routing_profile=self.profile,
            selected_model="MAIN",
            chain=None,
            is_mixed=False,
            estimated_cost="medium",
            timeout_seconds=90,
            fallback_strategy="direct_main",
            requires_global_check=False
        )
    
    def degrade_route(self, task_type: TaskType, reason: str) -> RouteDecision:
        """生成降级路由"""
        degrade_map = {
            TaskType.DEBUG: ("GROK-CODE", 60),
            TaskType.REASONING: ("REASON", 60),
            TaskType.REFACTOR: ("CODE", 45),
            TaskType.LONG_SUMMARY: ("LONG", 90),
        }
        
        model, timeout = degrade_map.get(task_type, ("MAIN", 90))
        
        return RouteDecision(
            task_type=task_type.value,
            routing_profile=self.profile,
            selected_model=model,
            chain=None,
            is_mixed=False,
            estimated_cost="medium",
            timeout_seconds=timeout,
            fallback_strategy="degraded_from_mixed",
            requires_global_check=False
        )
    
    def route(self, input_text: str) -> RouteDecision:
        """路由入口"""
        task_type = self.classify_task(input_text)
        input_length = len(input_text)
        
        allowed, reason = self.check_profile_constraint(task_type, input_length)
        
        if not allowed:
            return self.degrade_route(task_type, reason)
        
        return self.make_decision(task_type)


if __name__ == "__main__":
    print("多窗口路由器已加载")
