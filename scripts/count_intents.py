#!/usr/bin/env python3
"""统计 JSONL 日志中每个 intent 的出现次数"""

import json
from collections import Counter
from pathlib import Path


def count_intents(jsonl_path: str) -> Counter:
    """
    统计 JSONL 文件中每个 intent 的出现次数
    
    Args:
        jsonl_path: JSONL 文件路径
        
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
                intent = record.get('intent')
                if intent:
                    intent_counts[intent] += 1
            except json.JSONDecodeError as e:
                print(f"警告：第 {line_num} 行 JSON 解析失败：{e}")
    
    return intent_counts


def print_intent_stats(intent_counts: Counter, sort_by: str = 'count', limit: int = None):
    """
    打印 intent 统计结果
    
    Args:
        intent_counts: Counter 对象
        sort_by: 排序方式 ('count' 或 'name')
        limit: 限制显示数量
    """
    if sort_by == 'count':
        sorted_intents = intent_counts.most_common(limit)
    else:
        sorted_intents = sorted(intent_counts.items(), key=lambda x: x[0])[:limit]
    
    total = sum(intent_counts.values())
    
    print(f"\n{'Intent':<40} {'计数':>10} {'占比':>10}")
    print("-" * 62)
    
    for intent, count in sorted_intents:
        percentage = (count / total * 100) if total > 0 else 0
        print(f"{intent:<40} {count:>10} {percentage:>9.2f}%")
    
    print("-" * 62)
    print(f"{'总计':<40} {total:>10} {100.0:>9.2f}%")
    print(f"\n唯一 intent 数量：{len(intent_counts)}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='统计 JSONL 日志中每个 intent 的出现次数')
    parser.add_argument('jsonl_path', help='JSONL 文件路径')
    parser.add_argument('--sort', choices=['count', 'name'], default='count',
                       help='排序方式：按计数 (count) 或按名称 (name)')
    parser.add_argument('--limit', type=int, help='限制显示数量')
    
    args = parser.parse_args()
    
    path = Path(args.jsonl_path)
    if not path.exists():
        print(f"错误：文件不存在：{args.jsonl_path}")
        return 1
    
    intent_counts = count_intents(str(path))
    print_intent_stats(intent_counts, sort_by=args.sort, limit=args.limit)
    
    return 0


if __name__ == '__main__':
    exit(main())
