#!/usr/bin/env python3
"""
OCNMPS 手工验证框架
记录每次路由决策，生成验证报告
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, List

# 导入桥接 v2
import sys
sys.path.insert(0, os.path.expanduser("~/.openclaw/workspace"))
from ocnmps_bridge_v2 import get_model_for_task_v2 as get_model_for_task

VALIDATION_FILE = os.path.expanduser("~/.openclaw/workspace/ocnmps_validation_results.json")


def validate_task(task: str, expected_model: str = None, notes: str = "") -> Dict[str, Any]:
    """
    验证单个任务
    
    Args:
        task: 任务文本
        expected_model: 期望的模型（可选）
        notes: 备注
        
    Returns:
        dict: 验证结果
    """
    result = get_model_for_task(task)
    
    validation = {
        "timestamp": datetime.now().isoformat(),
        "task_preview": task[:100] + "..." if len(task) > 100 else task,
        "task_length": len(task),
        "use_ocnmps": result["use_ocnmps"],
        "recommended_model": result["recommended_model"],
        "chain": result["chain"],
        "task_type": result["task_type"],
        "reason": result["reason"],
        "expected_model": expected_model,
        "match_expected": expected_model == result["recommended_model"] if expected_model else None,
        "notes": notes,
        "user_rating": None,  # 待用户评分: 1-5
        "user_comment": None  # 待用户评论
    }
    
    return validation


def save_validation(validation: Dict[str, Any]):
    """保存验证结果"""
    results = []
    if os.path.exists(VALIDATION_FILE):
        with open(VALIDATION_FILE, "r") as f:
            results = json.load(f)
    
    results.append(validation)
    
    with open(VALIDATION_FILE, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def rate_validation(index: int, rating: int, comment: str = ""):
    """
    对验证结果评分
    
    Args:
        index: 验证结果索引（从1开始）
        rating: 评分 1-5 (5=非常认同, 1=完全不认同)
        comment: 评论
    """
    if not os.path.exists(VALIDATION_FILE):
        print("❌ 没有验证记录")
        return
    
    with open(VALIDATION_FILE, "r") as f:
        results = json.load(f)
    
    if index < 1 or index > len(results):
        print(f"❌ 索引无效，当前有 {len(results)} 条记录")
        return
    
    results[index - 1]["user_rating"] = rating
    results[index - 1]["user_comment"] = comment
    
    with open(VALIDATION_FILE, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 已记录评分: {rating}/5")


def show_report():
    """显示验证报告"""
    if not os.path.exists(VALIDATION_FILE):
        print("❌ 没有验证记录")
        return
    
    with open(VALIDATION_FILE, "r") as f:
        results = json.load(f)
    
    print("\n" + "=" * 70)
    print("📊 OCNMPS 验证报告")
    print("=" * 70)
    print(f"验证任务数: {len(results)}")
    
    # 统计
    triggered = sum(1 for r in results if r["use_ocnmps"])
    rated = [r for r in results if r["user_rating"] is not None]
    
    print(f"触发OCNMPS: {triggered}/{len(results)}")
    print(f"已评分: {len(rated)}/{len(results)}")
    
    if rated:
        avg_rating = sum(r["user_rating"] for r in rated) / len(rated)
        print(f"平均评分: {avg_rating:.1f}/5")
    
    print("\n" + "-" * 70)
    
    # 详细列表
    for i, r in enumerate(results, 1):
        rating_str = f"⭐{r['user_rating']}/5" if r["user_rating"] else "⏳待评分"
        trigger_str = "✅触发" if r["use_ocnmps"] else "⏭️跳过"
        chain_str = f" → {' → '.join(r['chain'])}" if r["chain"] else ""
        
        print(f"\n[{i}] {rating_str} | {trigger_str} | {r['task_type']}")
        print(f"    任务: {r['task_preview'][:60]}...")
        print(f"    推荐: {r['recommended_model']}{chain_str}")
        if r["notes"]:
            print(f"    备注: {r['notes']}")
        if r["user_comment"]:
            print(f"    评价: {r['user_comment']}")
    
    print("\n" + "=" * 70)


def clear_results():
    """清空验证结果"""
    if os.path.exists(VALIDATION_FILE):
        os.remove(VALIDATION_FILE)
        print("✅ 验证结果已清空")


# CLI 接口
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("""
用法:
  python3 ocnmps_validation.py test "任务文本"          # 测试任务
  python3 ocnmps_validation.py rate <索引> <评分> [评论] # 评分 (1-5)
  python3 ocnmps_validation.py report                  # 显示报告
  python3 ocnmps_validation.py clear                   # 清空结果
""")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "test" and len(sys.argv) >= 3:
        task = sys.argv[2]
        result = validate_task(task)
        save_validation(result)
        
        print(f"\n📝 任务已记录 (#{len(json.load(open(VALIDATION_FILE)))})")
        print(f"    触发: {'是' if result['use_ocnmps'] else '否'}")
        print(f"    推荐: {result['recommended_model']}")
        if result["chain"]:
            print(f"    链路: {' → '.join(result['chain'])}")
        print(f"    类型: {result['task_type']}")
        
    elif cmd == "rate" and len(sys.argv) >= 4:
        index = int(sys.argv[2])
        rating = int(sys.argv[3])
        comment = sys.argv[4] if len(sys.argv) > 4 else ""
        rate_validation(index, rating, comment)
        
    elif cmd == "report":
        show_report()
        
    elif cmd == "clear":
        clear_results()
        
    else:
        print("❌ 命令无效")