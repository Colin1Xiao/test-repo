#!/usr/bin/env python3
"""
OCNMPS Bridge - OpenClaw 多模型路由桥接
用于复杂任务的路由决策，不改主路由，先验证价值
"""

import sys
import os
from typing import Optional, Dict, Any, List

# 添加 OCNMPS 到路径
OCNMPS_DIR = os.path.expanduser("~/.openclaw/workspace/ocnmps")
sys.path.insert(0, OCNMPS_DIR)

from multi_window_router import WindowRouter
from multi_window_session_manager import MultiWindowSessionManager


class OCNMPSBridge:
    """OCNMPS 路由桥接器"""
    
    # 触发 OCNMPS 路由的关键词
    TRIGGER_KEYWORDS = [
        "分析", "规划", "修复", "推理", "代码",
        "compare", "analyze", "plan", "fix", "reason",
        "总结", "概括", "提炼", "润色", "优化",
        "架构", "设计", "重构", "调试", "debug"
    ]
    
    # 需要走 OCNMPS 的任务类型
    COMPLEX_TASK_TYPES = [
        "reasoning",      # 复杂推理
        "debug",          # 代码调试
        "refactor",       # 大型重构
        "long_summary",   # 长文总结
        "polish",         # 中文润色
    ]
    
    def __init__(self):
        self.manager = MultiWindowSessionManager()
        self._session_cache = {}
    
    def should_use_ocnmps(self, prompt: str, context: Optional[Dict] = None) -> bool:
        """
        判断是否应该使用 OCNMPS 路由
        
        Args:
            prompt: 用户输入
            context: 额外上下文
            
        Returns:
            bool: 是否应该使用 OCNMPS
        """
        # 条件1: 包含触发关键词
        prompt_lower = prompt.lower()
        has_keyword = any(kw in prompt_lower for kw in self.TRIGGER_KEYWORDS)
        
        # 条件2: 长文本 (>500字符)
        is_long = len(prompt) > 500
        
        # 条件3: 代码块
        has_code = "```" in prompt or "def " in prompt or "function " in prompt
        
        # 条件4: 多步骤任务
        is_multi_step = any(word in prompt_lower for word in 
            ["步骤", "step", "首先", "然后", "最后", "first", "then", "finally"])
        
        return has_keyword or is_long or has_code or is_multi_step
    
    def route(self, prompt: str, profile: str = "standard", priority: str = "P1") -> Dict[str, Any]:
        """
        执行路由决策
        
        Args:
            prompt: 用户输入
            profile: 路由档位 (light/standard/heavy)
            priority: 优先级 (P0/P1/P2/P3)
            
        Returns:
            dict: 路由决策结果
        """
        # 创建会话
        session = self.manager.create_session(
            channel_type="openclaw",
            window_type="interactive",
            routing_profile=profile,
            priority_level=priority
        )
        
        try:
            # 路由决策
            router = WindowRouter(session)
            decision = router.route(prompt)
            
            result = {
                "task_type": decision.task_type,
                "is_mixed": decision.is_mixed,
                "selected_model": getattr(decision, "selected_model", None),
                "chain": getattr(decision, "chain", None),
                "confidence": getattr(decision, "confidence", 1.0),
                "session_id": session.session_id,
                "profile": profile,
                "priority": priority,
            }
            
            return result
            
        finally:
            # 清理会话
            self.manager.close_session(session.session_id)
    
    def get_model_recommendation(self, prompt: str) -> Dict[str, Any]:
        """
        获取模型推荐（简化接口）
        
        Returns:
            dict: {
                "use_ocnmps": bool,
                "recommended_model": str,
                "chain": Optional[List[str]],
                "task_type": str,
                "reason": str
            }
        """
        # 先判断是否需要 OCNMPS
        if not self.should_use_ocnmps(prompt):
            return {
                "use_ocnmps": False,
                "recommended_model": "default",  # 使用 OpenClaw 默认模型
                "chain": None,
                "task_type": "simple_qa",
                "reason": "简单任务，不需要多模型路由"
            }
        
        # 执行路由
        result = self.route(prompt)
        
        if result["is_mixed"]:
            return {
                "use_ocnmps": True,
                "recommended_model": result["chain"][0] if result["chain"] else "MAIN",
                "chain": result["chain"],
                "task_type": result["task_type"],
                "reason": f"复杂任务，推荐链式处理: {' → '.join(result['chain'])}"
            }
        else:
            return {
                "use_ocnmps": True,
                "recommended_model": result["selected_model"],
                "chain": None,
                "task_type": result["task_type"],
                "reason": f"任务类型 {result['task_type']}，推荐模型 {result['selected_model']}"
            }


# 便捷函数
_bridge = None

def get_ocnmps_bridge() -> OCNMPSBridge:
    """获取全局桥接实例"""
    global _bridge
    if _bridge is None:
        _bridge = OCNMPSBridge()
    return _bridge


def route_task(prompt: str) -> Dict[str, Any]:
    """快捷路由接口"""
    return get_ocnmps_bridge().route(prompt)


def get_model_for_task(prompt: str) -> Dict[str, Any]:
    """快捷模型推荐接口"""
    return get_ocnmps_bridge().get_model_recommendation(prompt)


# CLI 测试
if __name__ == "__main__":
    import json
    
    test_cases = [
        "Python 是什么？",
        "分析这个错误：IndexError: list index out of range，帮我修复代码",
        "比较 REST API 和 GraphQL 的优劣，给出架构选型建议",
        "润色这段文字：这个产品很好用，功能很强大",
        "总结这份技术文档的关键点：" + "这是一份重要的技术文档。" * 100,
        "帮我重构这个函数，优化性能和可读性",
    ]
    
    print("=" * 60)
    print("🧪 OCNMPS Bridge 测试")
    print("=" * 60)
    
    bridge = OCNMPSBridge()
    
    for i, task in enumerate(test_cases, 1):
        print(f"\n[{i}] 输入: {task[:50]}...")
        
        result = bridge.get_model_recommendation(task)
        
        print(f"    使用OCNMPS: {result['use_ocnmps']}")
        print(f"    推荐模型: {result['recommended_model']}")
        if result['chain']:
            print(f"    处理链: {' → '.join(result['chain'])}")
        print(f"    任务类型: {result['task_type']}")
        print(f"    理由: {result['reason']}")
    
    print("\n" + "=" * 60)
    print("✅ 测试完成")