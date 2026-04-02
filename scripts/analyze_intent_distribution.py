#!/usr/bin/env python3
"""
统计 JSONL 日志中的 intent 分布

用法:
    python analyze_intent_distribution.py <jsonl_file>
    python analyze_intent_distribution.py <jsonl_file> --top 10
"""

import json
import sys
from collections import Counter
from pathlib import Path


def analyze_intent_distribution(jsonl_path: str, intent_field: str = "intent") -> Counter:
    """
    统计 JSONL 文件中 intent 字段的分布
    
    Args:
        jsonl_path: JSONL 文件路径
        intent_field: intent 字段名，默认为 "intent"
    
    Returns:
        Counter 对象，包含每个 intent 的计数
    """
    intent_counts = Counter()
    
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
                intent = record.get(intent_field)
                if intent is not None:
                    intent_counts[intent] += 1
            except json.JSONDecodeError as e:
                print(f"警告：第 {line_num} 行 JSON 解析失败：{e}", file=sys.stderr)
    
    return intent_counts


def print_distribution(intent_counts: Counter, top_n: int = None, sort_by: str = "count"):
    """
    打印 intent 分布统计
    
    Args:
        intent_counts: Counter 对象
        top_n: 只显示前 N 个，None 表示全部
        sort_by: 排序方式，"count" 或 "name"
    """
    total = sum(intent_counts.values())
    
    if sort_by == "count":
        sorted_items = intent_counts.most_common(top_n)
    else:
        sorted_items = sorted(intent_counts.items(), key=lambda x: x[0])
        if top_n:
            sorted_items = sorted_items[:top_n]
    
    print(f"\n{'Intent':<40} {'Count':>8} {'Percentage':>12}")
    print("-" * 62)
    
    for intent, count in sorted_items:
        percentage = (count / total * 100) if total > 0 else 0
        print(f"{intent:<40} {count:>8} {percentage:>11.2f}%")
    
    print("-" * 62)
    print(f"{'TOTAL':<40} {total:>8} {100.0:>11.2f}%")
    print(f"\n唯一 intent 数量：{len(intent_counts)}")


def main():
    if len(sys.argv) < 2:
        print("用法：python analyze_intent_distribution.py <jsonl_file> [--top N]")
        print("示例：python analyze_intent_distribution.py logs.jsonl")
        print("      python analyze_intent_distribution.py logs.jsonl --top 10")
        sys.exit(1)
    
    jsonl_path = sys.argv[1]
    top_n = None
    
    # 解析 --top 参数
    if "--top" in sys.argv:
        top_idx = sys.argv.index("--top") + 1
        if top_idx < len(sys.argv):
            top_n = int(sys.argv[top_idx])
    
    # 检查文件是否存在
    if not Path(jsonl_path).exists():
        print(f"错误：文件不存在：{jsonl_path}", file=sys.stderr)
        sys.exit(1)
    
    # 分析分布
    intent_counts = analyze_intent_distribution(jsonl_path)
    
    if not intent_counts:
        print("未找到任何 intent 记录")
        sys.exit(0)
    
    # 打印结果
    print_distribution(intent_counts, top_n=top_n)


if __name__ == "__main__":
    main()
