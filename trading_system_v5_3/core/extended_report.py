#!/usr/bin/env python3
"""
Extended Analysis Report Generator - 扩展分析报告生成器
重点分析"新增机会"的后验表现
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime

# 数据目录 - 相对于仓库根目录
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / 'data'
DATA_FILE = DATA_DIR / 'extended_analysis.jsonl'

def generate_extended_report():
    """生成扩展分析报告"""
    
    # 加载数据
    results = []
    with open(DATA_FILE, 'r') as f:
        for line in f:
            if line.strip():
                results.append(json.loads(line))
    
    if not results:
        return "❌ 无数据"
    
    # 分析
    lines = []
    lines.append("=" * 80)
    lines.append("📊 V4.2 扩展分析报告 (样本量: {})".format(len(results)))
    lines.append("=" * 80)
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    # 1. 总体统计
    total = len(results)
    qualified = [r for r in results if r.get('v42_is_qualified')]
    qualified_rate = len(qualified) / total * 100
    
    lines.append("─" * 80)
    lines.append("📈 1. 总体统计")
    lines.append("─" * 80)
    lines.append(f"样本量: {total}")
    lines.append(f"达标样本: {len(qualified)} ({qualified_rate:.1f}%)")
    lines.append(f"平均评分: {np.mean([r['v42_total_score'] for r in results]):.1f}/100")
    lines.append("")
    
    # 2. 新增机会分析 (V4.1无信号但V4.2达标)
    lines.append("─" * 80)
    lines.append("🎯 2. 新增机会分析 (V4.1无信号但V4.2达标)")
    lines.append("─" * 80)
    
    new_opportunities = [r for r in results 
                        if r.get('rule_signal') == 'HOLD' and r.get('v42_is_qualified')]
    
    lines.append(f"新增机会数量: {len(new_opportunities)}")
    
    if new_opportunities:
        # 后验表现
        changes_30s = [r['outcome']['change_30s_pct'] for r in new_opportunities]
        changes_60s = [r['outcome']['change_60s_pct'] for r in new_opportunities]
        changes_120s = [r['outcome']['change_120s_pct'] for r in new_opportunities]
        changes_300s = [r['outcome']['change_300s_pct'] for r in new_opportunities]
        
        lines.append("")
        lines.append("📊 后验价格变化:")
        lines.append(f"  30秒: {np.mean(changes_30s):+.4f}% (σ={np.std(changes_30s):.4f}%)")
        lines.append(f"  60秒: {np.mean(changes_60s):+.4f}% (σ={np.std(changes_60s):.4f}%)")
        lines.append(f"  120秒: {np.mean(changes_120s):+.4f}% (σ={np.std(changes_120s):.4f}%)")
        lines.append(f"  300秒: {np.mean(changes_300s):+.4f}% (σ={np.std(changes_300s):.4f}%)")
        
        # 方向正确率
        correct = sum(1 for r in new_opportunities if r['outcome']['is_direction_correct'])
        correct_rate = correct / len(new_opportunities) * 100
        lines.append("")
        lines.append(f"📊 方向正确率: {correct_rate:.1f}% ({correct}/{len(new_opportunities)})")
        
        # 分位数
        lines.append("")
        lines.append("📊 分位数分析:")
        lines.append(f"  60秒变化 - 25%: {np.percentile(changes_60s, 25):.4f}%, 50%: {np.percentile(changes_60s, 50):.4f}%, 75%: {np.percentile(changes_60s, 75):.4f}%")
        
        # 判断是否有独立边际
        lines.append("")
        lines.append("💡 独立边际判断:")
        if np.mean(changes_60s) > 0.03 and correct_rate > 50:
            lines.append("  ✅ 新增机会有独立正向边际")
            lines.append("     - 60秒平均变化 > 0.03%")
            lines.append("     - 方向正确率 > 50%")
        elif np.mean(changes_60s) > 0:
            lines.append("  ⚠️  新增机会有微弱正向预期，但不显著")
        else:
            lines.append("  ❌ 新增机会无独立边际，可能是噪音")
    else:
        lines.append("  无新增机会样本")
    
    lines.append("")
    
    # 3. 成交量因子分析
    lines.append("─" * 80)
    lines.append("📊 3. 成交量因子深度分析")
    lines.append("─" * 80)
    
    volume_scores = [r['v42_score_breakdown']['volume_confirm'] for r in results]
    volume_avg = np.mean(volume_scores)
    volume_zero_rate = sum(1 for s in volume_scores if s == 0) / len(volume_scores) * 100
    
    lines.append(f"成交量因子平均分: {volume_avg:.1f}/15")
    lines.append(f"零分率: {volume_zero_rate:.1f}%")
    lines.append("")
    
    # 分析为什么低分
    volume_ratios = [r['market_state']['volume_ratio'] for r in results]
    avg_volume_ratio = np.mean(volume_ratios)
    
    lines.append("📊 成交量比率分析:")
    lines.append(f"  平均成交量比率: {avg_volume_ratio:.2f}x")
    lines.append(f"  >1.5x (得分15): {sum(1 for v in volume_ratios if v > 1.5)} 次")
    lines.append(f"  >1.2x (得分10): {sum(1 for v in volume_ratios if v > 1.2)} 次")
    lines.append(f"  >1.0x (得分7): {sum(1 for v in volume_ratios if v > 1.0)} 次")
    lines.append("")
    
    lines.append("💡 成交量因子低分原因:")
    if avg_volume_ratio < 1.2:
        lines.append("  ⚠️  市场整体成交量偏低")
        lines.append("  - 平均成交量比率 < 1.2x")
        lines.append("  - 建议降低成交量阈值或权重")
    else:
        lines.append("  - 成交量阈值可能过严")
        lines.append("  - 建议: 降低成交量确认阈值至 1.2x")
    
    lines.append("")
    
    # 4. 时段分析
    lines.append("─" * 80)
    lines.append("⏰ 4. 时段分析")
    lines.append("─" * 80)
    
    # 定义时段
    asia_hours = list(range(0, 8))  # 0-8点
    europe_hours = list(range(14, 22))  # 14-22点
    us_hours = list(range(20, 24)) + list(range(0, 4))  # 20-4点
    
    asia_samples = [r for r in results if r.get('hour', 0) in asia_hours]
    europe_samples = [r for r in results if r.get('hour', 0) in europe_hours]
    us_samples = [r for r in results if r.get('hour', 0) in us_hours]
    
    lines.append(f"亚洲时段 (00:00-08:00): {len(asia_samples)} 样本")
    if asia_samples:
        lines.append(f"  达标率: {sum(1 for r in asia_samples if r['v42_is_qualified'])/len(asia_samples)*100:.1f}%")
        if any(r['v42_is_qualified'] for r in asia_samples):
            qualified_asia = [r for r in asia_samples if r['v42_is_qualified']]
            lines.append(f"  60秒平均变化: {np.mean([r['outcome']['change_60s_pct'] for r in qualified_asia]):+.4f}%")
    
    lines.append(f"欧洲时段 (14:00-22:00): {len(europe_samples)} 样本")
    if europe_samples:
        lines.append(f"  达标率: {sum(1 for r in europe_samples if r['v42_is_qualified'])/len(europe_samples)*100:.1f}%")
        if any(r['v42_is_qualified'] for r in europe_samples):
            qualified_eu = [r for r in europe_samples if r['v42_is_qualified']]
            lines.append(f"  60秒平均变化: {np.mean([r['outcome']['change_60s_pct'] for r in qualified_eu]):+.4f}%")
    
    lines.append(f"美盘时段 (20:00-04:00): {len(us_samples)} 样本")
    if us_samples:
        lines.append(f"  达标率: {sum(1 for r in us_samples if r['v42_is_qualified'])/len(us_samples)*100:.1f}%")
        if any(r['v42_is_qualified'] for r in us_samples):
            qualified_us = [r for r in us_samples if r['v42_is_qualified']]
            lines.append(f"  60秒平均变化: {np.mean([r['outcome']['change_60s_pct'] for r in qualified_us]):+.4f}%")
    
    lines.append("")
    
    # 5. 结论
    lines.append("─" * 80)
    lines.append("🎯 5. 最终结论")
    lines.append("─" * 80)
    
    lines.append("📊 核心发现:")
    lines.append(f"  1. 样本量: {total} (目标: 100+)")
    lines.append(f"  2. 新增机会后验: {'正向' if new_opportunities and np.mean([r['outcome']['change_60s_pct'] for r in new_opportunities]) > 0 else '中性/负向'}")
    lines.append(f"  3. 成交量因子: 主要限制因素 (零分率 {volume_zero_rate:.0f}%)")
    lines.append("")
    
    lines.append("💡 决策建议:")
    if total < 100:
        lines.append("  ⚠️  样本量不足，继续积累数据")
    if new_opportunities and np.mean([r['outcome']['change_60s_pct'] for r in new_opportunities]) > 0.03:
        lines.append("  ✅ 新增机会有独立边际，继续观察")
    if volume_zero_rate > 60:
        lines.append("  ⚠️  成交量因子过严，建议调整")
    
    lines.append("")
    lines.append("📅 下一步:")
    lines.append("  1. 继续积累样本至 100+")
    lines.append("  2. 观察成交量因子是否持续限制")
    lines.append("  3. 分析不同时段的表现差异")
    
    lines.append("=" * 80)
    
    return "\n".join(lines)

# 执行
report = generate_extended_report()
print(report)

# 保存
output_file = DATA_DIR / 'extended_analysis_report.txt'
with open(output_file, 'w') as f:
    f.write(report)

print(f"\n✅ 报告已保存: {output_file}")