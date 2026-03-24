#!/usr/bin/env python3
"""
OCNMPS 灰度集成示例
展示如何在 OpenClaw 中集成桥接
"""

import os
import sys

# 导入桥接和配置
sys.path.insert(0, os.path.expanduser("~/.openclaw/workspace"))
from ocnmps_bridge_v2 import get_model_for_task_v2
from ocnmps_integration_config import should_use_bridge, FALLBACK_MODEL


def route_with_gray_release(prompt: str) -> dict:
    """
    带灰度发布的路由
    
    Args:
        prompt: 用户任务
    
    Returns:
        dict: 路由结果 + 是否使用桥接
    """
    # 1. 先做意图分析（用于灰度判断）
    from ocnmps_bridge_v2 import OCNMPSBridgeV2
    bridge = OCNMPSBridgeV2()
    intent_analysis = bridge.analyze_intent(prompt)
    
    # 2. 判断是否走桥接
    intent = intent_analysis.get("intent") if intent_analysis.get("detected") else None
    use_bridge = should_use_bridge(intent)
    
    # 3. 根据灰度结果返回
    if use_bridge:
        result = get_model_for_task_v2(prompt)
        result["used_bridge"] = True
        result["source"] = "ocnmps_bridge_v2"
        return result
    else:
        return {
            "use_ocnmps": False,
            "recommended_model": FALLBACK_MODEL,
            "chain": None,
            "task_type": "default",
            "reason": "灰度未命中，使用默认模型",
            "used_bridge": False,
            "source": "default"
        }


# ==================== 使用示例 ====================

if __name__ == "__main__":
    test_prompts = [
        "Python 是什么？",  # 简单问答
        "分析这个 Python 脚本的性能问题",  # 代码任务
        "比较两种架构方案的优劣",  # 推理任务
    ]
    
    print("=" * 60)
    print("🧪 OCNMPS 灰度集成示例")
    print("=" * 60)
    
    for prompt in test_prompts:
        print(f"\n任务: {prompt[:30]}...")
        result = route_with_gray_release(prompt)
        
        print(f"  使用桥接: {'✅' if result['used_bridge'] else '❌'}")
        print(f"  推荐模型: {result['recommended_model']}")
        if result['chain']:
            print(f"  处理链: {' → '.join(result['chain'])}")
        print(f"  来源: {result['source']}")
    
    print("\n" + "=" * 60)
    print("灰度比例可在 ocnmps_integration_config.py 中调整")