#!/usr/bin/env python3
"""
多模型路由协调器 - 修复混合任务拆分
Multi-Model Router - Fixed Hybrid Task Orchestration
"""

import json
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum


class ModelAlias(Enum):
    """模型别名"""
    MAIN = "MAIN"
    FAST = "FAST"
    LONG = "LONG"
    CODE = "CODE"
    CODE_PLUS = "CODE-PLUS"
    GROK_CODE = "GROK-CODE"
    REASON = "REASON"
    CN = "CN"


@dataclass
class TaskResult:
    """任务结果"""
    model: str
    content: str
    success: bool
    error: Optional[str] = None


class MultiModelRouter:
    """多模型路由器"""
    
    def __init__(self):
        self.model_mapping = {
            ModelAlias.MAIN: "bailian/kimi-k2.5",
            ModelAlias.FAST: "bailian/qwen3-max-2026-01-23",
            ModelAlias.LONG: "bailian/qwen3.5-plus",
            ModelAlias.CODE: "bailian/qwen3-coder-next",
            ModelAlias.CODE_PLUS: "bailian/qwen3-coder-plus",
            ModelAlias.GROK_CODE: "xai/grok-code-fast-1",
            ModelAlias.REASON: "xai/grok-4-1-fast-reasoning",
            ModelAlias.CN: "bailian/MiniMax-M2.5",
        }
        self.execution_log = []
    
    def route_single(self, task: str, model_alias: ModelAlias) -> TaskResult:
        """单模型路由 - 直接返回，不拆分"""
        model = self.model_mapping[model_alias]
        
        # 记录路由决策
        self.execution_log.append({
            "type": "single",
            "task_preview": task[:100],
            "model_alias": model_alias.value,
            "model": model,
            "rationale": f"任务类型匹配 {model_alias.value} 专长"
        })
        
        return TaskResult(
            model=model,
            content=f"[由 {model_alias.value} 模型处理]\n{task}",
            success=True
        )
    
    def route_hybrid_b1_debug_fix(self, error_log: str, code: str) -> TaskResult:
        """
        B1: 调试 + 修复 (GROK-CODE -> CODE -> MAIN)
        修复后的调用链
        """
        results = []
        
        # Step 1: GROK-CODE 诊断根因
        step1_task = f"""分析这个报错的根因：

报错：{error_log}
代码：{code}

请给出：
1. 最可能的根因
2. 排查顺序
3. 修复建议"""
        
        results.append({
            "step": 1,
            "model": ModelAlias.GROK_CODE,
            "task": step1_task
        })
        
        # Step 2: CODE 生成修复代码
        step2_task = f"""基于以下诊断生成修复代码：

报错：{error_log}
原始代码：{code}

请给出：
1. 修复后的完整代码
2. 关键改动说明"""
        
        results.append({
            "step": 2,
            "model": ModelAlias.CODE,
            "task": step2_task
        })
        
        # Step 3: MAIN 汇总解释
        step3_task = f"""汇总以下修复方案并解释：

原始问题：{error_log}
原始代码：{code}

请给出：
1. 问题总结
2. 修复方案
3. 为什么这样改"""
        
        results.append({
            "step": 3,
            "model": ModelAlias.MAIN,
            "task": step3_task
        })
        
        # 记录执行计划
        self.execution_log.append({
            "type": "hybrid",
            "task_id": "B1",
            "steps": len(results),
            "pipeline": "GROK-CODE -> CODE -> MAIN"
        })
        
        return TaskResult(
            model="pipeline:B1",
            content=json.dumps(results, indent=2, ensure_ascii=False),
            success=True
        )
    
    def route_hybrid_b2_long_reason(self, document: str) -> TaskResult:
        """
        B2: 长文 + 推理 (LONG -> REASON -> MAIN)
        修复后的调用链
        """
        results = []
        
        # Step 1: LONG 总结文档
        step1_task = f"""总结以下文档的关键信息：

{document}

请提取：
1. 核心需求
2. 约束条件
3. 关键决策点"""
        
        results.append({
            "step": 1,
            "model": ModelAlias.LONG,
            "task": step1_task
        })
        
        # Step 2: REASON 做架构决策
        step2_task = f"""基于以下文档摘要做架构决策：

文档摘要：[待填充]

请分析：
1. 单体架构 vs 微服务架构的权衡
2. 推荐方案及理由
3. 风险提示"""
        
        results.append({
            "step": 2,
            "model": ModelAlias.REASON,
            "task": step2_task
        })
        
        # Step 3: MAIN 汇总输出
        step3_task = f"""汇总架构决策并输出最终建议：

分析过程：[待填充]

请给出：
1. 最终推荐架构
2. 关键理由
3. 实施建议"""
        
        results.append({
            "step": 3,
            "model": ModelAlias.MAIN,
            "task": step3_task
        })
        
        self.execution_log.append({
            "type": "hybrid",
            "task_id": "B2",
            "steps": len(results),
            "pipeline": "LONG -> REASON -> MAIN"
        })
        
        return TaskResult(
            model="pipeline:B2",
            content=json.dumps(results, indent=2, ensure_ascii=False),
            success=True
        )
    
    def route_hybrid_b3_reason_cn(self, options: List[str]) -> TaskResult:
        """
        B3: 推理 + 中文润色 (REASON -> CN -> MAIN)
        """
        results = []
        
        # Step 1: REASON 方案比较
        step1_task = f"""比较以下方案并选出最优：

{chr(10).join(f"方案{i+1}：{opt}" for i, opt in enumerate(options))}

请给出：
1. 各方案优劣分析
2. 最优方案及理由
3. 风险提示"""
        
        results.append({
            "step": 1,
            "model": ModelAlias.REASON,
            "task": step1_task
        })
        
        # Step 2: CN 中文润色
        step2_task = """将以下结论改写成正式中文汇报：

分析结论：[待填充]

要求：
1. 适合发给老板看
2. 简洁明了
3. 专业但不生硬"""
        
        results.append({
            "step": 2,
            "model": ModelAlias.CN,
            "task": step2_task
        })
        
        # Step 3: MAIN 汇总
        step3_task = """汇总最终汇报：

润色后内容：[待填充]

请确保：
1. 逻辑完整
2. 表达自然"""
        
        results.append({
            "step": 3,
            "model": ModelAlias.MAIN,
            "task": step3_task
        })
        
        self.execution_log.append({
            "type": "hybrid",
            "task_id": "B3",
            "steps": len(results),
            "pipeline": "REASON -> CN -> MAIN"
        })
        
        return TaskResult(
            model="pipeline:B3",
            content=json.dumps(results, indent=2, ensure_ascii=False),
            success=True
        )
    
    def get_execution_log(self) -> List[Dict]:
        """获取执行日志"""
        return self.execution_log


# 使用示例
def demo_routing():
    """演示路由"""
    router = MultiModelRouter()
    
    # 单模型示例
    print("=== A1: 简单问答 -> FAST ===")
    result = router.route_single("REST vs GraphQL 区别", ModelAlias.FAST)
    print(f"模型: {result.model}")
    
    # 混合任务示例
    print("\n=== B1: 调试 + 修复 ===")
    result = router.route_hybrid_b1_debug_fix(
        "IndexError: list index out of range",
        "def get_user(users, id): return users[id]"
    )
    print(f"执行计划:\n{result.content}")
    
    print("\n=== 执行日志 ===")
    for log in router.get_execution_log():
        print(json.dumps(log, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    demo_routing()