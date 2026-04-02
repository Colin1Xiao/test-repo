#!/usr/bin/env python3
"""
V4.2.3 第三轮定向微调决策分析
基于118样本，只改2件事：
1. 成交量因子重映射 (0.9-1.05x最优，1.2-1.5x降为0)
2. 88-92分层附加过滤条件
"""

import sys
from pathlib import Path
from datetime import datetime
import json
import numpy as np

sys.path.insert(0, str(Path(__file__).parent / 'core'))


def load_samples():
    """加载现有样本"""
    data_dir = Path(__file__).parent / 'data'
    shadow_file = data_dir / 'shadow_v422_samples.jsonl'
    
    samples = []
    if shadow_file.exists():
        with open(shadow_file, 'r') as f:
            for line in f:
                try:
                    samples.append(json.loads(line.strip()))
                except:
                    pass
    return samples


def simulate_v423_changes(samples):
    """
    模拟 V4.2.3 调整效果
    
    调整1: 成交量因子重映射
    - <0.9x: 0分
    - 0.9-1.05x: 15分 (最优)
    - 1.05-1.2x: 8分
    - 1.2-1.5x: 0分 (负面)
    - >1.5x: 0分
    
    调整2: 88-92分层附加过滤
    - 88-92分 + 成交量在1.2-1.5x → 降级为不达标
    """
    adjusted_samples = []
    
    for s in samples:
        adjusted = s.copy()
        bd = s['v422_score_breakdown'].copy()
        
        # 调整1: 成交量重映射
        vol_ratio = s['market_state']['volume_ratio']
        if vol_ratio < 0.9:
            bd['volume_confirm'] = 0
        elif vol_ratio < 1.05:
            bd['volume_confirm'] = 15  # 最优
        elif vol_ratio < 1.2:
            bd['volume_confirm'] = 8
        elif vol_ratio < 1.5:
            bd['volume_confirm'] = 0   # 负面
        else:
            bd['volume_confirm'] = 0
        
        # 重新计算总分
        new_total = (
            bd['trend_consistency'] +
            bd['pullback_breakout'] +
            bd['volume_confirm'] +
            bd['spread_quality'] +
            bd['volatility_range'] +
            bd['rl_filter']
        )
        
        # 调整2: 88-92分层附加过滤
        is_qualified = new_total >= 85
        if 88 <= new_total <= 92 and 1.2 <= vol_ratio < 1.5:
            is_qualified = False  # 附加过滤
        
        adjusted['v423_score_breakdown'] = bd
        adjusted['v423_total_score'] = new_total
        adjusted['v423_is_qualified'] = is_qualified
        
        adjusted_samples.append(adjusted)
    
    return adjusted_samples


def generate_decision_report():
    """生成决策分析报告"""
    lines = []
    lines.append("=" * 80)
    lines.append("📊 V4.2.3 第三轮定向微调决策分析")
    lines.append("=" * 80)
    lines.append(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"基础样本: V4.2.2 影子模式 118条")
    lines.append("")
    
    # 加载样本
    samples = load_samples()
    if len(samples) < 100:
        lines.append(f"❌ 样本不足 ({len(samples)}条)，建议继续积累")
        return "\n".join(lines)
    
    lines.append(f"✅ 样本充足: {len(samples)}条")
    lines.append("")
    
    # 模拟V4.2.3调整
    adjusted = simulate_v423_changes(samples)
    
    # 调整方案说明
    lines.append("─" * 80)
    lines.append("⚙️ V4.2.3 拟议调整方案")
    lines.append("─" * 80)
    lines.append("调整1: 成交量因子重映射")
    lines.append("  <0.9x     → 0分")
    lines.append("  0.9-1.05x → 15分 (最优)")
    lines.append("  1.05-1.2x → 8分")
    lines.append("  1.2-1.5x  → 0分 (负面，原为8分)")
    lines.append("  >1.5x     → 0分")
    lines.append("")
    lines.append("调整2: 88-92分层附加过滤")
    lines.append("  88-92分 + 成交量1.2-1.5x → 降级为不达标")
    lines.append("")
    
    # 对比分析
    lines.append("─" * 80)
    lines.append("📈 V4.2.2 vs V4.2.3 对比")
    lines.append("─" * 80)
    
    v422_qualified = [s for s in samples if s.get('v422_is_qualified', True)]
    v423_qualified = [s for s in adjusted if s['v423_is_qualified']]
    
    lines.append(f"{'指标':<25} {'V4.2.2':<20} {'V4.2.3':<20}")
    lines.append("-" * 80)
    lines.append(f"{'达标样本数':<25} {len(v422_qualified):<20} {len(v423_qualified):<20}")
    lines.append(f"{'达标率':<25} {len(v422_qualified)/len(samples)*100:<19.1f}% {len(v423_qualified)/len(samples)*100:<19.1f}%")
    
    # 方向正确率
    v422_dir = sum(1 for s in v422_qualified if s['outcome'].get('is_direction_correct')) / len(v422_qualified) * 100 if v422_qualified else 0
    v423_dir = sum(1 for s in v423_qualified if s['outcome'].get('is_direction_correct')) / len(v423_qualified) * 100 if v423_qualified else 0
    lines.append(f"{'方向正确率':<25} {v422_dir:<19.1f}% {v423_dir:<19.1f}%")
    
    # 60秒表现
    if v422_qualified:
        v422_60 = np.mean([s['outcome']['change_60s_pct'] for s in v422_qualified])
        v422_60_med = np.median([s['outcome']['change_60s_pct'] for s in v422_qualified])
    else:
        v422_60 = v422_60_med = 0
    
    if v423_qualified:
        v423_60 = np.mean([s['outcome']['change_60s_pct'] for s in v423_qualified])
        v423_60_med = np.median([s['outcome']['change_60s_pct'] for s in v423_qualified])
    else:
        v423_60 = v423_60_med = 0
    
    lines.append(f"{'60秒均值':<25} {v422_60:<+19.4f}% {v423_60:<+19.4f}%")
    lines.append(f"{'60秒中位数':<25} {v422_60_med:<+19.4f}% {v423_60_med:<+19.4f}%")
    
    lines.append("")
    
    # 88-92分层改善分析
    lines.append("─" * 80)
    lines.append("🎯 88-92分层改善分析")
    lines.append("─" * 80)
    
    v422_mid = [s for s in v422_qualified if 88 <= s['v422_total_score'] <= 92]
    v423_mid = [s for s in v423_qualified if 88 <= s['v423_total_score'] <= 92]
    
    lines.append(f"V4.2.2 88-92分层: {len(v422_mid)}样本, 60秒均值{np.mean([s['outcome']['change_60s_pct'] for s in v422_mid]):+.4f}%" if v422_mid else "V4.2.2 88-92分层: 0样本")
    lines.append(f"V4.2.3 88-92分层: {len(v423_mid)}样本, 60秒均值{np.mean([s['outcome']['change_60s_pct'] for s in v423_mid]):+.4f}%" if v423_mid else "V4.2.3 88-92分层: 0样本")
    
    # 被过滤掉的样本分析
    filtered_out = [s for s in adjusted if s.get('v422_is_qualified', True) and not s['v423_is_qualified']]
    if filtered_out:
        lines.append("")
        lines.append(f"被V4.2.3过滤的样本: {len(filtered_out)}条")
        lines.append(f"  这些样本的60秒均值: {np.mean([s['outcome']['change_60s_pct'] for s in filtered_out]):+.4f}%")
        lines.append(f"  验证: 过滤掉的是表现差的样本 ✓" if np.mean([s['outcome']['change_60s_pct'] for s in filtered_out]) < 0 else "  警告: 过滤掉的包含表现好的样本")
    
    lines.append("")
    
    # BTC vs ETH 分别分析
    lines.append("─" * 80)
    lines.append("🪙 BTC vs ETH 分别分析 (V4.2.3)")
    lines.append("─" * 80)
    
    for symbol in ['BTC', 'ETH']:
        sym_samples = [s for s in adjusted if symbol in s['symbol'] and s['v423_is_qualified']]
        if not sym_samples:
            continue
        
        lines.append(f"\n{symbol}:")
        lines.append(f"  达标样本: {len(sym_samples)}")
        
        # 三窗口表现
        for window in ['30s', '60s', '120s']:
            key = f'change_{window}_pct'
            changes = [s['outcome'][key] for s in sym_samples]
            lines.append(f"  {window}均值: {np.mean(changes):+.4f}%, 中位数: {np.median(changes):+.4f}%")
        
        # 方向正确率
        dir_acc = sum(1 for s in sym_samples if s['outcome'].get('is_direction_correct')) / len(sym_samples) * 100
        lines.append(f"  方向正确率: {dir_acc:.1f}%")
    
    lines.append("")
    
    # 决策建议
    lines.append("─" * 80)
    lines.append("💡 决策建议")
    lines.append("─" * 80)
    
    # 评估调整效果
    if v423_60 > v422_60:
        lines.append("✅ 60秒均值改善")
    else:
        lines.append("⚠️  60秒均值未改善")
    
    if len(v423_mid) < len(v422_mid) * 0.7:
        lines.append("✅ 88-92分层样本减少 (过滤效果)")
    else:
        lines.append("⚠️  88-92分层样本减少不明显")
    
    if v423_dir >= v422_dir - 2:  # 允许2%的下降
        lines.append("✅ 方向正确率保持")
    else:
        lines.append("⚠️  方向正确率下降")
    
    lines.append("")
    
    # 最终建议
    lines.append("🎯 最终建议:")
    
    improvements = 0
    if v423_60 > v422_60:
        improvements += 1
    if len(v423_mid) < len(v422_mid) * 0.7:
        improvements += 1
    if v423_dir >= v422_dir - 2:
        improvements += 1
    
    if improvements >= 2:
        lines.append("✅ 建议实施 V4.2.3 调整")
        lines.append("  理由: 多数指标改善，风险可控")
    elif improvements == 1:
        lines.append("⏸️  建议谨慎实施 V4.2.3 调整")
        lines.append("  理由: 部分指标改善，需小范围验证")
    else:
        lines.append("❌ 不建议实施 V4.2.3 调整")
        lines.append("  理由: 指标未改善，保持V4.2.2")
    
    lines.append("")
    lines.append("📋 下一步行动:")
    if improvements >= 2:
        lines.append("  1. 实施V4.2.3调整")
        lines.append("  2. 继续影子模式积累50+样本验证")
        lines.append("  3. 评估是否进入小范围执行层实验")
    else:
        lines.append("  1. 保持V4.2.2当前配置")
        lines.append("  2. 继续积累样本至150+")
        lines.append("  3. 重新评估调整方案")
    
    lines.append("=" * 80)
    
    return "\n".join(lines)


if __name__ == "__main__":
    report = generate_decision_report()
    print(report)
    
    # 保存报告
    data_dir = Path(__file__).parent / 'data'
    report_file = data_dir / 'v423_decision_analysis.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 决策分析报告已保存: {report_file}")

