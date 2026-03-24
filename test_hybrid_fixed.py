#!/usr/bin/env python3
"""
混合任务修复验证 - 使用正确的 sessions_spawn 参数
"""

import json

# 修复后的调用模板说明
"""
修复要点：
1. sessions_spawn 必须使用 runtime="subagent" 模式
2. task 参数必须包含完整的任务描述
3. model 参数必须使用完整模型路径，不是 alias
4. timeoutSeconds 需要设置足够长（混合任务建议 90-120s）
5. agentId 必须指定为 "main"

错误示例（之前）：
- 子代理内部调用 sessions_spawn 时缺少 message 参数
- 使用了错误的调用方式

正确示例（修复后）：
- 主代理直接控制整个调用链
- 每个子任务明确指定 model 和 task
"""

def get_fixed_b1_task():
    """B1 修复后的任务定义"""
    return {
        "task_id": "B1",
        "description": "调试 + 修复 (GROK-CODE -> CODE -> MAIN)",
        "steps": [
            {
                "step": 1,
                "model": "xai/grok-code-fast-1",
                "alias": "GROK-CODE",
                "task": """分析这个 Python 报错的根因：

报错：IndexError: list index out of range
代码：def get_user(users, id): return users[id]

请给出：
1. 最可能的根因
2. 排查顺序
3. 修复建议""",
                "timeout": 60
            },
            {
                "step": 2,
                "model": "bailian/qwen3-coder-next",
                "alias": "CODE",
                "task": """基于诊断生成修复代码：

报错：IndexError: list index out of range
原始代码：def get_user(users, id): return users[id]

请给出：
1. 修复后的完整代码
2. 关键改动说明""",
                "timeout": 60
            },
            {
                "step": 3,
                "model": "bailian/kimi-k2.5",
                "alias": "MAIN",
                "task": """汇总修复方案并解释：

原始问题：IndexError: list index out of range
原始代码：def get_user(users, id): return users[id]

请给出：
1. 问题总结
2. 修复方案
3. 为什么这样改""",
                "timeout": 60
            }
        ]
    }

def get_fixed_b2_task():
    """B2 修复后的任务定义"""
    document = """电商平台重构需求：
- 模块：用户、订单、支付、库存
- 团队：10人
- 用户量：100万
- 要求：高并发、快速上线、易于维护、成本可控"""
    
    return {
        "task_id": "B2",
        "description": "长文 + 推理 (LONG -> REASON -> MAIN)",
        "steps": [
            {
                "step": 1,
                "model": "bailian/qwen3.5-plus",
                "alias": "LONG",
                "task": f"""总结以下文档的关键信息：

{document}

请提取：
1. 核心需求
2. 约束条件
3. 关键决策点""",
                "timeout": 90
            },
            {
                "step": 2,
                "model": "xai/grok-4-1-fast-reasoning",
                "alias": "REASON",
                "task": """基于文档摘要做架构决策：

请分析：
1. 单体架构 vs 微服务架构的权衡
2. 推荐方案及理由
3. 风险提示""",
                "timeout": 90
            },
            {
                "step": 3,
                "model": "bailian/kimi-k2.5",
                "alias": "MAIN",
                "task": """汇总架构决策并输出最终建议：

请给出：
1. 最终推荐架构
2. 关键理由
3. 实施建议""",
                "timeout": 60
            }
        ]
    }

def get_fixed_b3_task():
    """B3 修复后的任务定义"""
    return {
        "task_id": "B3",
        "description": "推理 + 中文润色 (REASON -> CN -> MAIN)",
        "steps": [
            {
                "step": 1,
                "model": "xai/grok-4-1-fast-reasoning",
                "alias": "REASON",
                "task": """比较以下方案并选出最优：

方案A：外包开发，成本低，周期短，但质量风险高
方案B：内部团队开发，成本中等，质量可控，但周期长
方案C：混合模式，核心功能内部做，边缘功能外包，成本较高，但质量和进度都有保障

请给出：
1. 各方案优劣分析
2. 最优方案及理由
3. 风险提示""",
                "timeout": 90
            },
            {
                "step": 2,
                "model": "bailian/MiniMax-M2.5",
                "alias": "CN",
                "task": """将以下结论改写成正式中文汇报：

要求：
1. 适合发给老板看
2. 简洁明了
3. 专业但不生硬""",
                "timeout": 90
            },
            {
                "step": 3,
                "model": "bailian/kimi-k2.5",
                "alias": "MAIN",
                "task": """汇总最终汇报：

请确保：
1. 逻辑完整
2. 表达自然
3. 适合正式场合""",
                "timeout": 60
            }
        ]
    }

def print_task_plan(task_def):
    """打印任务计划"""
    print(f"\n{'='*60}")
    print(f"任务: {task_def['task_id']} - {task_def['description']}")
    print(f"{'='*60}")
    
    for step in task_def['steps']:
        print(f"\nStep {step['step']}: {step['alias']} ({step['model']})")
        print(f"  超时: {step['timeout']}s")
        print(f"  任务预览: {step['task'][:80]}...")

if __name__ == "__main__":
    print("混合任务修复验证 - 任务计划")
    print("=" * 60)
    
    # 打印三个修复后的任务
    print_task_plan(get_fixed_b1_task())
    print_task_plan(get_fixed_b2_task())
    print_task_plan(get_fixed_b3_task())
    
    print("\n" + "=" * 60)
    print("修复要点总结:")
    print("=" * 60)
    print("1. 使用完整模型路径 (非 alias)")
    print("2. 每个 step 包含完整 task 描述")
    print("3. timeout 设置充足 (60-90s)")
    print("4. 主代理控制整个调用链")
    print("5. 避免子代理嵌套调用")