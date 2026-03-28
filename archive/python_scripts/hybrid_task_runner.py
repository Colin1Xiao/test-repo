#!/usr/bin/env python3
"""
混合任务执行器 - 修复版
支持正确的子代理调用链
"""

import json
import subprocess
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class SubagentConfig:
    """子代理配置"""
    model: str
    task: str
    timeout: int = 120  # 延长超时时间


class HybridTaskRunner:
    """混合任务运行器"""
    
    def __init__(self):
        self.results = []
    
    def run_subagent(self, config: SubagentConfig) -> Dict:
        """
        运行子代理 - 修复参数传递
        
        关键修复点：
        1. 使用 --message 传递任务内容
        2. 使用 --model 指定模型
        3. 使用 --timeout 设置超时
        4. 使用 --mode run 确保一次性执行
        """
        cmd = [
            "openclaw", "agent",
            "--model", config.model,
            "--message", config.task,
            "--timeout", str(config.timeout),
            "--mode", "run"
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=config.timeout + 10  # 额外缓冲
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "model": config.model
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "timeout",
                "model": config.model
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "model": config.model
            }
    
    def run_b1_debug_fix(self, error_log: str, code: str) -> Dict:
        """
        B1: 调试 + 修复
        链：GROK-CODE -> CODE -> MAIN
        """
        print("🔄 执行 B1: 调试 + 修复")
        
        # Step 1: GROK-CODE 诊断
        print("  Step 1/3: GROK-CODE 诊断根因...")
        step1 = self.run_subagent(SubagentConfig(
            model="xai/grok-code-fast-1",
            task=f"""分析这个 Python 报错的根因：

报错：{error_log}
代码：{code}

请给出：
1. 最可能的根因
2. 排查顺序
3. 修复建议""",
            timeout=60
        ))
        
        if not step1["success"]:
            return {"success": False, "step": 1, "error": step1.get("error", "unknown")}
        
        diagnosis = step1["stdout"]
        
        # Step 2: CODE 生成修复
        print("  Step 2/3: CODE 生成修复代码...")
        step2 = self.run_subagent(SubagentConfig(
            model="bailian/qwen3-coder-next",
            task=f"""基于以下诊断生成修复代码：

报错：{error_log}
原始代码：{code}

诊断分析：{diagnosis[:500]}

请给出：
1. 修复后的完整代码
2. 关键改动说明""",
            timeout=60
        ))
        
        if not step2["success"]:
            return {"success": False, "step": 2, "error": step2.get("error", "unknown")}
        
        fix_code = step2["stdout"]
        
        # Step 3: MAIN 汇总
        print("  Step 3/3: MAIN 汇总解释...")
        step3 = self.run_subagent(SubagentConfig(
            model="bailian/kimi-k2.5",
            task=f"""汇总以下修复方案并解释：

原始问题：{error_log}
原始代码：{code}

诊断分析：{diagnosis[:300]}

修复方案：{fix_code[:300]}

请给出：
1. 问题总结
2. 修复方案
3. 为什么这样改""",
            timeout=60
        ))
        
        return {
            "success": step3["success"],
            "pipeline": "GROK-CODE -> CODE -> MAIN",
            "steps": [
                {"model": "GROK-CODE", "output": diagnosis[:200]},
                {"model": "CODE", "output": fix_code[:200]},
                {"model": "MAIN", "output": step3.get("stdout", "")[:200]}
            ]
        }
    
    def run_b2_long_reason(self, document: str) -> Dict:
        """
        B2: 长文 + 推理
        链：LONG -> REASON -> MAIN
        """
        print("🔄 执行 B2: 长文 + 推理")
        
        # Step 1: LONG 总结
        print("  Step 1/3: LONG 总结文档...")
        step1 = self.run_subagent(SubagentConfig(
            model="bailian/qwen3.5-plus",
            task=f"""总结以下文档的关键信息：

{document}

请提取：
1. 核心需求
2. 约束条件
3. 关键决策点""",
            timeout=90  # 长文需要更长时间
        ))
        
        if not step1["success"]:
            return {"success": False, "step": 1, "error": step1.get("error", "unknown")}
        
        summary = step1["stdout"]
        
        # Step 2: REASON 决策
        print("  Step 2/3: REASON 架构决策...")
        step2 = self.run_subagent(SubagentConfig(
            model="xai/grok-4-1-fast-reasoning",
            task=f"""基于以下文档摘要做架构决策：

文档摘要：{summary[:800]}

请分析：
1. 单体架构 vs 微服务架构的权衡
2. 推荐方案及理由
3. 风险提示""",
            timeout=90
        ))
        
        if not step2["success"]:
            return {"success": False, "step": 2, "error": step2.get("error", "unknown")}
        
        decision = step2["stdout"]
        
        # Step 3: MAIN 汇总
        print("  Step 3/3: MAIN 汇总输出...")
        step3 = self.run_subagent(SubagentConfig(
            model="bailian/kimi-k2.5",
            task=f"""汇总架构决策并输出最终建议：

文档摘要：{summary[:400]}

分析结论：{decision[:400]}

请给出：
1. 最终推荐架构
2. 关键理由
3. 实施建议""",
            timeout=60
        ))
        
        return {
            "success": step3["success"],
            "pipeline": "LONG -> REASON -> MAIN",
            "steps": [
                {"model": "LONG", "output": summary[:200]},
                {"model": "REASON", "output": decision[:200]},
                {"model": "MAIN", "output": step3.get("stdout", "")[:200]}
            ]
        }
    
    def run_b3_reason_cn(self, options: List[str]) -> Dict:
        """
        B3: 推理 + 中文润色
        链：REASON -> CN -> MAIN
        """
        print("🔄 执行 B3: 推理 + 中文润色")
        
        # Step 1: REASON 比较
        print("  Step 1/3: REASON 方案比较...")
        options_text = "\n".join(f"方案{i+1}：{opt}" for i, opt in enumerate(options))
        
        step1 = self.run_subagent(SubagentConfig(
            model="xai/grok-4-1-fast-reasoning",
            task=f"""比较以下方案并选出最优：

{options_text}

请给出：
1. 各方案优劣分析
2. 最优方案及理由
3. 风险提示""",
            timeout=90
        ))
        
        if not step1["success"]:
            return {"success": False, "step": 1, "error": step1.get("error", "unknown")}
        
        analysis = step1["stdout"]
        
        # Step 2: CN 润色
        print("  Step 2/3: CN 中文润色...")
        step2 = self.run_subagent(SubagentConfig(
            model="bailian/MiniMax-M2.5",
            task=f"""将以下结论改写成正式中文汇报：

分析结论：{analysis[:600]}

要求：
1. 适合发给老板看
2. 简洁明了
3. 专业但不生硬""",
            timeout=90
        ))
        
        if not step2["success"]:
            return {"success": False, "step": 2, "error": step2.get("error", "unknown")}
        
        polished = step2["stdout"]
        
        # Step 3: MAIN 汇总
        print("  Step 3/3: MAIN 最终汇总...")
        step3 = self.run_subagent(SubagentConfig(
            model="bailian/kimi-k2.5",
            task=f"""汇总最终汇报：

润色后内容：{polished[:400]}

请确保：
1. 逻辑完整
2. 表达自然
3. 适合正式场合""",
            timeout=60
        ))
        
        return {
            "success": step3["success"],
            "pipeline": "REASON -> CN -> MAIN",
            "steps": [
                {"model": "REASON", "output": analysis[:200]},
                {"model": "CN", "output": polished[:200]},
                {"model": "MAIN", "output": step3.get("stdout", "")[:200]}
            ]
        }


# 测试执行
if __name__ == "__main__":
    runner = HybridTaskRunner()
    
    # 测试 B1
    print("=" * 50)
    result = runner.run_b1_debug_fix(
        "IndexError: list index out of range",
        "def get_user(users, id): return users[id]"
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))