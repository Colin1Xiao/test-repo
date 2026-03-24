#!/usr/bin/env python3
"""
多模型路由超时配置策略
Optimized Timeout Configuration for Multi-Model Routing
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class TimeoutConfig:
    """超时配置"""
    model: str
    alias: str
    timeout_seconds: int
    task_type: str


# 优化后的超时策略
TIMEOUT_STRATEGY = {
    # 普通任务：30-60s
    "FAST": TimeoutConfig(
        model="bailian/qwen3-max-2026-01-23",
        alias="FAST",
        timeout_seconds=30,
        task_type="简单问答、轻量任务"
    ),
    "CODE": TimeoutConfig(
        model="bailian/qwen3-coder-next",
        alias="CODE",
        timeout_seconds=45,
        task_type="普通代码生成"
    ),
    "GROK-CODE": TimeoutConfig(
        model="xai/grok-code-fast-1",
        alias="GROK-CODE",
        timeout_seconds=60,
        task_type="代码诊断、Debug"
    ),
    "REASON": TimeoutConfig(
        model="xai/grok-4-1-fast-reasoning",
        alias="REASON",
        timeout_seconds=60,
        task_type="复杂推理"
    ),
    
    # 长文/重构/汇总：90-120s
    "LONG": TimeoutConfig(
        model="bailian/qwen3.5-plus",
        alias="LONG",
        timeout_seconds=90,
        task_type="长文档总结、多文档整合"
    ),
    "CODE-PLUS": TimeoutConfig(
        model="bailian/qwen3-coder-plus",
        alias="CODE-PLUS",
        timeout_seconds=120,
        task_type="大型代码重构、多文件任务"
    ),
    "CN": TimeoutConfig(
        model="bailian/MiniMax-M2.5",
        alias="CN",
        timeout_seconds=90,
        task_type="中文润色、长文改写"
    ),
    
    # MAIN 汇总阶段：90s（加限长策略）
    "MAIN": TimeoutConfig(
        model="bailian/kimi-k2.5",
        alias="MAIN",
        timeout_seconds=90,
        task_type="总控、汇总、兜底"
    ),
}


# MAIN 汇总限长策略模板
MAIN_SUMMARY_CONSTRAINTS = """
【MAIN 汇总限长策略】

在最终汇总前，请遵循以下约束：

1. 只输出核心要素：
   - 结论（一句话）
   - 关键理由（3-5条）
   - 风险提示（最多5条）
   - 下一步行动（如有）

2. 避免：
   - 重复展开前两步的全部内容
   - 过长的背景描述
   - 冗余的技术细节

3. 优先：
   - 结构化输出（表格/列表）
   - 关键数据/指标
   - 可执行的结论

4. 长度控制：
   - 简单任务：200-500字
   - 复杂任务：500-800字
   - 除非用户要求详细说明，否则不超过1000字
"""


def get_timeout(alias: str) -> int:
    """获取模型超时时间"""
    config = TIMEOUT_STRATEGY.get(alias)
    return config.timeout_seconds if config else 60


def get_main_summary_prompt(original_task: str) -> str:
    """获取带限长策略的 MAIN 汇总提示词"""
    return f"""{MAIN_SUMMARY_CONSTRAINTS}

原始任务：
{original_task}

请基于以上约束进行汇总。"""


# 混合任务链路超时配置
HYBRID_PIPELINES = {
    "B1_调试修复": {
        "steps": [
            ("GROK-CODE", 60),
            ("CODE", 45),
            ("MAIN", 90)  # 汇总阶段延长
        ],
        "total_timeout": 195
    },
    "B2_长文推理": {
        "steps": [
            ("LONG", 90),
            ("REASON", 60),
            ("MAIN", 90)  # 汇总阶段延长
        ],
        "total_timeout": 240
    },
    "B3_推理润色": {
        "steps": [
            ("REASON", 60),
            ("CN", 90),
            ("MAIN", 90)  # 汇总阶段延长
        ],
        "total_timeout": 240
    }
}


if __name__ == "__main__":
    print("多模型路由超时配置策略")
    print("=" * 60)
    
    for alias, config in TIMEOUT_STRATEGY.items():
        print(f"\n{alias}:")
        print(f"  模型: {config.model}")
        print(f"  超时: {config.timeout_seconds}s")
        print(f"  用途: {config.task_type}")
    
    print("\n" + "=" * 60)
    print("混合任务链路配置:")
    for name, pipeline in HYBRID_PIPELINES.items():
        print(f"\n{name}:")
        print(f"  步骤: {' -> '.join(step[0] for step in pipeline['steps'])}")
        print(f"  总超时: {pipeline['total_timeout']}s")