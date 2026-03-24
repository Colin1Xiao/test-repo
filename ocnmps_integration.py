#!/usr/bin/env python3
"""
OCNMPS 灰度集成 - 完整版
带日志记录的灰度路由
"""

import os
import sys
import time
from typing import Dict, Any

# 导入桥接和配置
sys.path.insert(0, os.path.expanduser("~/.openclaw/workspace"))
from ocnmps_bridge_v2 import get_model_for_task_v2, OCNMPSBridgeV2
from ocnmps_integration_config import should_use_bridge, FALLBACK_MODEL
from ocnmps_routing_logger import get_logger


def route_with_gray_release(prompt: str) -> Dict[str, Any]:
    """
    带灰度发布 + 日志记录的路由
    
    Args:
        prompt: 用户任务
    
    Returns:
        dict: 路由结果
    """
    start_time = time.time()
    logger = get_logger()
    
    # 1. 先做意图分析（用于灰度判断）
    bridge = OCNMPSBridgeV2()
    intent_analysis = bridge.analyze_intent(prompt)
    
    # 2. 判断是否走桥接
    intent = intent_analysis.get("intent") if intent_analysis.get("detected") else None
    gray_hit = should_use_bridge(intent)
    fallback_used = False
    
    # 3. 根据灰度结果路由
    if gray_hit:
        try:
            result = get_model_for_task_v2(prompt)
            result["used_bridge"] = True
            result["source"] = "ocnmps_bridge_v2"
        except Exception as e:
            # 桥接异常，回退
            result = {
                "use_ocnmps": False,
                "recommended_model": FALLBACK_MODEL,
                "chain": None,
                "task_type": "default",
                "reason": f"桥接异常: {str(e)}",
                "used_bridge": False,
                "source": "fallback",
            }
            fallback_used = True
    else:
        result = {
            "use_ocnmps": False,
            "recommended_model": FALLBACK_MODEL,
            "chain": None,
            "task_type": "default",
            "reason": "灰度未命中，使用默认模型",
            "used_bridge": False,
            "source": "default"
        }
    
    # 4. 计算延迟
    latency_ms = (time.time() - start_time) * 1000
    
    # 5. 记录日志
    task_id = logger.log_routing(
        task_preview=prompt,
        intent=intent,
        use_ocnmps=result["use_ocnmps"],
        recommended_model=result["recommended_model"],
        chain=result.get("chain"),
        gray_hit=gray_hit,
        fallback_used=fallback_used,
        latency_ms=latency_ms,
    )
    
    # 6. 返回结果（包含 task_id 用于后续评分）
    result["task_id"] = task_id
    result["latency_ms"] = round(latency_ms, 2)
    
    return result


def rate_routing(task_id: str, score: int, comment: str = ""):
    """
    对路由结果评分
    
    Args:
        task_id: 任务ID
        score: 评分 1-5
        comment: 评论
    """
    logger = get_logger()
    logger.update_user_score(task_id, score, comment)
    print(f"✅ 已记录评分: {score}/5")


def show_stats():
    """显示当前统计"""
    logger = get_logger()
    stats = logger.get_stats()
    
    print("\n" + "=" * 60)
    print("📊 OCNMPS 灰度统计")
    print("=" * 60)
    print(f"总请求数: {stats['total_requests']}")
    print(f"桥接使用: {stats['bridge_used']} ({stats['bridge_used']/max(stats['total_requests'],1)*100:.1f}%)")
    print(f"回退次数: {stats['fallback_triggered']}")
    print(f"平均延迟: {stats['avg_latency_ms']:.2f}ms")
    
    print("\n按意图分布:")
    for intent, data in stats.get("by_intent", {}).items():
        count = data.get("count", 0)
        total_score = data.get("total_score", 0)
        avg = total_score / count if count > 0 else 0
        print(f"  {intent}: {count}次, 平均分: {avg:.1f}/5" if avg else f"  {intent}: {count}次")
    
    print("\n按模型分布:")
    for model, data in stats.get("by_model", {}).items():
        print(f"  {model}: {data['count']}次")
    
    print("=" * 60)


# ==================== CLI 接口 ====================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("""
用法:
  python3 ocnmps_integration.py test "任务文本"    # 测试路由
  python3 ocnmps_integration.py rate <task_id> <分> [评论]  # 评分
  python3 ocnmps_integration.py stats             # 查看统计
  python3 ocnmps_integration.py logs              # 查看最近日志
""")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "test" and len(sys.argv) >= 3:
        prompt = sys.argv[2]
        result = route_with_gray_release(prompt)
        
        print(f"\n📝 任务ID: {result['task_id']}")
        print(f"    灰度命中: {'✅' if result.get('gray_hit', result['used_bridge']) else '❌'}")
        print(f"    使用桥接: {'✅' if result['used_bridge'] else '❌'}")
        print(f"    推荐模型: {result['recommended_model']}")
        if result.get('chain'):
            print(f"    处理链: {' → '.join(result['chain'])}")
        print(f"    任务类型: {result['task_type']}")
        print(f"    延迟: {result['latency_ms']:.2f}ms")
        
    elif cmd == "rate" and len(sys.argv) >= 4:
        task_id = sys.argv[2]
        score = int(sys.argv[3])
        comment = sys.argv[4] if len(sys.argv) > 4 else ""
        rate_routing(task_id, score, comment)
        
    elif cmd == "stats":
        show_stats()
        
    elif cmd == "logs":
        logger = get_logger()
        logs = logger.get_recent_logs(10)
        
        print("\n最近 10 条路由记录:")
        print("-" * 60)
        for log in logs:
            score_str = f"⭐{log['user_score']}/5" if log.get('user_score') else "⏳待评分"
            print(f"[{log['task_id']}] {score_str} | {log['intent']} → {log['recommended_model']}")
            print(f"    {log['task_preview'][:50]}...")
        
    else:
        print("❌ 命令无效")