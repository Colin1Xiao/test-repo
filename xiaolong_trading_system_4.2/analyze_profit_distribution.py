#!/usr/bin/env python3
"""
V4.2.3 盈亏分布分析
新增：最大盈利/亏损、分位数分布、盈亏结构
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime


def analyze_profit_distribution():
    """分析盈亏分布结构"""
    data_dir = Path(__file__).parent / 'data'
    shadow_file = data_dir / 'shadow_v423_samples.jsonl'
    
    if not shadow_file.exists():
        print("❌ 未找到V4.2.3样本文件")
        return
    
    samples = []
    with open(shadow_file, 'r') as f:
        for line in f:
            try:
                samples.append(json.loads(line.strip()))
            except:
                pass
    
    if not samples:
        print("❌ 样本为空")
        return
    
    print("=" * 80)
    print("📊 V4.2.3 盈亏分布结构分析")
    print("=" * 80)
    print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"样本总数: {len(samples)}")
    print("")
    
    # 提取60秒收益
    returns_60s = [s['outcome']['change_60s_pct'] for s in samples]
    returns_60s = np.array(returns_60s)
    
    # 1. 基础统计
    print("─" * 80)
    print("📈 基础统计")
    print("─" * 80)
    print(f"{'指标':<25} {'数值':<20}")
    print("-" * 80)
    print(f"{'样本数':<25} {len(returns_60s):<20}")
    print(f"{'均值':<25} {np.mean(returns_60s):>+.4f}%")
    print(f"{'中位数':<25} {np.median(returns_60s):>+.4f}%")
    print(f"{'标准差':<25} {np.std(returns_60s):>.4f}%")
    print(f"{'最小值':<25} {np.min(returns_60s):>+.4f}%")
    print(f"{'最大值':<25} {np.max(returns_60s):>+.4f}%")
    print(f"{'极差':<25} {np.max(returns_60s) - np.min(returns_60s):>.4f}%")
    
    # 2. 分位数分布
    print("")
    print("─" * 80)
    print("📊 分位数分布 (60秒收益)")
    print("─" * 80)
    print(f"{'分位':<15} {'收益':<20} {'说明':<30}")
    print("-" * 80)
    
    percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99]
    for p in percentiles:
        val = np.percentile(returns_60s, p)
        desc = {
            1: "极端亏损",
            5: "尾部风险",
            10: "较大概率亏损",
            25: "下四分位",
            50: "中位数",
            75: "上四分位",
            90: "较大概率盈利",
            95: "尾部收益",
            99: "极端盈利"
        }.get(p, "")
        print(f"{p}th{'':<12} {val:>+.4f}%{'':<12} {desc}")
    
    # 3. 盈亏分布
    print("")
    print("─" * 80)
    print("💰 盈亏分布")
    print("─" * 80)
    
    profits = returns_60s[returns_60s > 0]
    losses = returns_60s[returns_60s < 0]
    zeros = returns_60s[returns_60s == 0]
    
    print(f"盈利样本: {len(profits)} ({len(profits)/len(returns_60s)*100:.1f}%)")
    print(f"亏损样本: {len(losses)} ({len(losses)/len(returns_60s)*100:.1f}%)")
    print(f"零收益: {len(zeros)} ({len(zeros)/len(returns_60s)*100:.1f}%)")
    
    if len(profits) > 0:
        print(f"\n盈利侧:")
        print(f"  均值: {np.mean(profits):>+.4f}%")
        print(f"  中位数: {np.median(profits):>+.4f}%")
        print(f"  标准差: {np.std(profits):>.4f}%")
        print(f"  最大盈利: {np.max(profits):>+.4f}%")
        print(f"  最小盈利: {np.min(profits):>+.4f}%")
    
    if len(losses) > 0:
        print(f"\n亏损侧:")
        print(f"  均值: {np.mean(losses):>+.4f}%")
        print(f"  中位数: {np.median(losses):>+.4f}%")
        print(f"  标准差: {np.std(losses):>.4f}%")
        print(f"  最大亏损: {np.min(losses):>+.4f}%")
        print(f"  最小亏损: {np.max(losses):>+.4f}%")
    
    # 4. 盈亏比
    print("")
    print("─" * 80)
    print("⚖️ 盈亏比分析")
    print("─" * 80)
    
    if len(profits) > 0 and len(losses) > 0:
        avg_profit = np.mean(profits)
        avg_loss = abs(np.mean(losses))
        profit_loss_ratio = avg_profit / avg_loss if avg_loss > 0 else 0
        
        print(f"平均盈利: {avg_profit:>+.4f}%")
        print(f"平均亏损: {-avg_loss:>+.4f}%")
        print(f"盈亏比: {profit_loss_ratio:.2f}")
        print(f"胜率: {len(profits)/len(returns_60s)*100:.1f}%")
        
        # 期望收益
        win_rate = len(profits) / len(returns_60s)
        expected_return = win_rate * avg_profit - (1 - win_rate) * avg_loss
        print(f"期望收益: {expected_return:>+.4f}%")
        
        if expected_return > 0:
            print(f"✅ 期望收益为正，策略有正期望值")
        else:
            print(f"⚠️  期望收益为负，需优化")
    
    # 5. 极端值分析
    print("")
    print("─" * 80)
    print("🎯 极端值分析")
    print("─" * 80)
    
    # 找出最大盈利和最大亏损样本
    max_profit_idx = np.argmax(returns_60s)
    max_loss_idx = np.argmin(returns_60s)
    
    max_profit_sample = samples[max_profit_idx]
    max_loss_sample = samples[max_loss_idx]
    
    print(f"最大盈利样本:")
    print(f"  收益: {returns_60s[max_profit_idx]:>+.4f}%")
    print(f"  时间: {max_profit_sample['timestamp']}")
    print(f"  品种: {max_profit_sample['symbol']}")
    print(f"  分数: {max_profit_sample['v423_total_score']}")
    print(f"  成交量比: {max_profit_sample['market_state']['volume_ratio']:.2f}x")
    
    print(f"\n最大亏损样本:")
    print(f"  收益: {returns_60s[max_loss_idx]:>+.4f}%")
    print(f"  时间: {max_loss_sample['timestamp']}")
    print(f"  品种: {max_loss_sample['symbol']}")
    print(f"  分数: {max_loss_sample['v423_total_score']}")
    print(f"  成交量比: {max_loss_sample['market_state']['volume_ratio']:.2f}x")
    
    # 6. 按分数层分析盈亏分布
    print("")
    print("─" * 80)
    print("🎯 按分数层分析盈亏分布")
    print("─" * 80)
    
    tiers = {
        '85-87': (85, 87),
        '88-92': (88, 92),
        '93-97': (93, 97),
        '98-100': (98, 100)
    }
    
    print(f"{'分数层':<10} {'样本':<8} {'盈利':<8} {'亏损':<8} {'胜率':<10} {'盈亏比':<10}")
    print("-" * 80)
    
    for tier_name, (min_s, max_s) in tiers.items():
        tier_samples = [s for s in samples if min_s <= s['v423_total_score'] <= max_s]
        if not tier_samples:
            continue
        
        tier_returns = [s['outcome']['change_60s_pct'] for s in tier_samples]
        tier_returns = np.array(tier_returns)
        
        profits = tier_returns[tier_returns > 0]
        losses = tier_returns[tier_returns < 0]
        
        win_rate = len(profits) / len(tier_returns) * 100 if len(tier_returns) > 0 else 0
        
        if len(profits) > 0 and len(losses) > 0:
            avg_profit = np.mean(profits)
            avg_loss = abs(np.mean(losses))
            pl_ratio = avg_profit / avg_loss
        else:
            pl_ratio = 0
        
        print(f"{tier_name:<10} {len(tier_samples):<8} {len(profits):<8} {len(losses):<8} {win_rate:<9.1f}% {pl_ratio:<10.2f}")
    
    # 7. 关键洞察
    print("")
    print("=" * 80)
    print("🔍 关键洞察")
    print("=" * 80)
    
    # 检查是否有少数大亏损
    if len(losses) > 0:
        loss_95 = np.percentile(returns_60s[returns_60s < 0], 5)
        extreme_losses = losses[losses < loss_95]
        if len(extreme_losses) > 0:
            print(f"⚠️  尾部亏损样本: {len(extreme_losses)} 个")
            print(f"   占总亏损比例: {np.sum(extreme_losses) / np.sum(losses) * 100:.1f}%")
            print(f"   建议: 考虑增加止损机制")
    
    # 检查盈利集中度
    if len(profits) > 0:
        profit_95 = np.percentile(returns_60s[returns_60s > 0], 95)
        extreme_profits = profits[profits > profit_95]
        if len(extreme_profits) > 0:
            print(f"💡 尾部盈利样本: {len(extreme_profits)} 个")
            print(f"   占总盈利比例: {np.sum(extreme_profits) / np.sum(profits) * 100:.1f}%")
    
    # 整体评价
    print("")
    if np.mean(returns_60s) > 0 and np.median(returns_60s) > 0:
        print("✅ 整体分布向正收益偏移")
    
    if len(profits) > len(losses):
        print(f"✅ 胜率 {len(profits)/len(returns_60s)*100:.1f}% > 50%")
    
    if expected_return > 0:
        print(f"✅ 期望收益为正 ({expected_return:+.4f}%)")
    
    print("")
    print("=" * 80)


if __name__ == "__main__":
    analyze_profit_distribution()
