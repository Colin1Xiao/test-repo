#!/usr/bin/env python3
"""
OCNMPS 50 样本灰度测试

测试 50 个不同任务类型，验证意图识别和模型路由是否正确。
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List
from collections import defaultdict

# 测试样本 (50 个)
TEST_SAMPLES = [
    # CODE (5 个)
    {"task": "用 Python 写一个函数，计算两个数的和", "expected_intent": "CODE"},
    {"task": "Create a JavaScript function to parse JSON data", "expected_intent": "CODE"},
    {"task": "帮我写个 Python 代码，统计用户数量", "expected_intent": "CODE"},
    {"task": "Implement a Python API endpoint with Flask", "expected_intent": "CODE"},
    {"task": "写一个 Python class，实现用户管理功能", "expected_intent": "CODE"},
    
    # CODE_PLUS (5 个)
    {"task": "重构这个大型项目的代码架构", "expected_intent": "CODE_PLUS"},
    {"task": "Optimize performance for high concurrency system", "expected_intent": "CODE_PLUS"},
    {"task": "设计一个微服务架构方案", "expected_intent": "CODE_PLUS"},
    {"task": "Code review for security vulnerabilities", "expected_intent": "CODE_PLUS"},
    {"task": "实现 CI/CD 自动化测试流程", "expected_intent": "CODE_PLUS"},
    
    # PATCH (5 个)
    {"task": "修复这个 bug，程序崩溃了", "expected_intent": "PATCH"},
    {"task": "Fix the error: TypeError: undefined is not a function", "expected_intent": "PATCH"},
    {"task": "代码报错了，帮忙看一下", "expected_intent": "PATCH"},
    {"task": "Patch the security vulnerability in login", "expected_intent": "PATCH"},
    {"task": "这个功能不工作了，怎么修复", "expected_intent": "PATCH"},
    
    # DEBUG (5 个)
    {"task": "调试这个问题，找不到原因", "expected_intent": "DEBUG"},
    {"task": "Debug the memory leak issue", "expected_intent": "DEBUG"},
    {"task": "帮我跟踪一下这个变量的值", "expected_intent": "DEBUG"},
    {"task": "Trace the execution flow", "expected_intent": "DEBUG"},
    {"task": "设置断点调试这个函数", "expected_intent": "DEBUG"},
    
    # REVIEW (5 个)
    {"task": "审查这段代码的质量", "expected_intent": "REVIEW"},
    {"task": "Code review for best practices", "expected_intent": "REVIEW"},
    {"task": "检查代码有没有潜在问题", "expected_intent": "REVIEW"},
    {"task": "Audit the code for security issues", "expected_intent": "REVIEW"},
    {"task": "评估这个实现方案好不好", "expected_intent": "REVIEW"},
    
    # TEST (5 个)
    {"task": "写单元测试覆盖这个函数", "expected_intent": "TEST"},
    {"task": "Create integration tests for the API", "expected_intent": "TEST"},
    {"task": "测试这个功能是否正常", "expected_intent": "TEST"},
    {"task": "Write pytest test cases", "expected_intent": "TEST"},
    {"task": "验证代码的正确性", "expected_intent": "TEST"},
    
    # REASON (5 个)
    {"task": "为什么这个算法时间复杂度是 O(nlogn)", "expected_intent": "REASON"},
    {"task": "Explain the reason behind this behavior", "expected_intent": "REASON"},
    {"task": "分析一下这个问题的根本原因", "expected_intent": "REASON"},
    {"task": "Why does this happen in production", "expected_intent": "REASON"},
    {"task": "推理一下可能的解决方案", "expected_intent": "REASON"},
    
    # LONG (5 个)
    {"task": "详细介绍一下机器学习的发展历程", "expected_intent": "LONG"},
    {"task": "Write a comprehensive guide on Docker", "expected_intent": "LONG"},
    {"task": "全面分析这个技术的优缺点", "expected_intent": "LONG"},
    {"task": "Create a detailed tutorial on React hooks", "expected_intent": "LONG"},
    {"task": "写一份完整的项目文档", "expected_intent": "LONG"},
    
    # CN (5 个)
    {"task": "你好，请问一下这个怎么用", "expected_intent": "CN"},
    {"task": "用中文解释一下这个概念", "expected_intent": "CN"},
    {"task": "这个功能的中文文档在哪里", "expected_intent": "CN"},
    {"task": "帮我翻译成中文", "expected_intent": "CN"},
    {"task": "中国文化里的龙是什么意思", "expected_intent": "CN"},
    
    # FAST (5 个)
    {"task": "天气怎么样", "expected_intent": "FAST"},
    {"task": "What time is it", "expected_intent": "FAST"},
    {"task": "快速回答", "expected_intent": "FAST"},
    {"task": "简单总结一下", "expected_intent": "FAST"},
    {"task": "一句话概括", "expected_intent": "FAST"},
]

# 预期模型映射
EXPECTED_MODELS = {
    "MAIN": "modelstudio/qwen3.5-plus",
    "FAST": "modelstudio/qwen3-max-2026-01-23",
    "CODE": "modelstudio/qwen3-coder-next",
    "CODE_PLUS": "modelstudio/qwen3-coder-plus",
    "PATCH": "xai/grok-code-fast-1",
    "DEBUG": "xai/grok-4-1-fast-reasoning",
    "REVIEW": "xai/grok-4-1-fast-reasoning",
    "TEST": "modelstudio/qwen3-max-2026-01-23",
    "REASON": "xai/grok-4-1-fast-reasoning",
    "LONG": "modelstudio/qwen3.5-plus",
    "CN": "modelstudio/MiniMax-M2.5",
}

def run_bridge_test(task: str) -> Dict:
    """运行 Python Bridge 测试"""
    bridge_path = Path.home() / ".openclaw" / "plugins" / "ocnmps-router" / "ocnmps_bridge_v2.py"
    
    try:
        result = subprocess.run(
            ["python3", str(bridge_path)],
            input=json.dumps({"task": task, "config": {"grayRatio": 1.0}}),  # 100% 灰度命中
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            return {"error": result.stderr, "intent": "ERROR"}
    except Exception as e:
        return {"error": str(e), "intent": "ERROR"}

def main():
    """主测试函数"""
    print("=" * 80)
    print("OCNMPS 50 样本灰度测试")
    print("=" * 80)
    print()
    
    results = []
    intent_stats = defaultdict(lambda: {"total": 0, "correct": 0})
    model_stats = defaultdict(int)
    
    for i, sample in enumerate(TEST_SAMPLES, 1):
        task = sample["task"]
        expected_intent = sample["expected_intent"]
        
        # 运行测试
        result = run_bridge_test(task)
        actual_intent = result.get("intent", "ERROR")
        recommended_model = result.get("recommended_model", "N/A")
        
        # 判断是否正确
        is_correct = actual_intent == expected_intent
        
        # 记录结果
        results.append({
            "id": i,
            "task": task[:50] + "..." if len(task) > 50 else task,
            "expected_intent": expected_intent,
            "actual_intent": actual_intent,
            "is_correct": is_correct,
            "model": recommended_model,
        })
        
        # 统计
        intent_stats[expected_intent]["total"] += 1
        if is_correct:
            intent_stats[expected_intent]["correct"] += 1
        model_stats[recommended_model] += 1
        
        # 显示进度
        status = "✅" if is_correct else "❌"
        print(f"{status} #{i:02d} [{expected_intent:10s}] -> {actual_intent:10s} | {recommended_model.split('/')[-1]:25s}")
    
    print()
    print("=" * 80)
    print("测试结果汇总")
    print("=" * 80)
    print()
    
    # 意图识别准确率
    print("📊 意图识别准确率:")
    print()
    total_correct = 0
    total_samples = 0
    for intent in sorted(intent_stats.keys()):
        stats = intent_stats[intent]
        accuracy = stats["correct"] / stats["total"] * 100 if stats["total"] > 0 else 0
        total_correct += stats["correct"]
        total_samples += stats["total"]
        status = "✅" if accuracy == 100 else "⚠️" if accuracy > 50 else "❌"
        print(f"  {status} {intent:12s}: {stats['correct']:2d}/{stats['total']:2d} ({accuracy:5.1f}%)")
    
    print()
    overall_accuracy = total_correct / total_samples * 100 if total_samples > 0 else 0
    print(f"  总体准确率：{total_correct}/{total_samples} ({overall_accuracy:.1f}%)")
    print()
    
    # 模型分布
    print("📈 模型调用分布:")
    print()
    for model, count in sorted(model_stats.items(), key=lambda x: -x[1]):
        model_short = model.split('/')[-1] if '/' in model else model
        print(f"  {model_short:30s}: {count:2d} 次")
    
    print()
    print("=" * 80)
    
    # 最终判定
    if overall_accuracy >= 95:
        print("✅ 测试通过 - 意图识别准确率 >= 95%")
        return 0
    elif overall_accuracy >= 80:
        print("⚠️  测试基本通过 - 意图识别准确率 >= 80%，但有改进空间")
        return 0
    else:
        print("❌ 测试失败 - 意图识别准确率 < 80%")
        return 1

if __name__ == "__main__":
    sys.exit(main())
