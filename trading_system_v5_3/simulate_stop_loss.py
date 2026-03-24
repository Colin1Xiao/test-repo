#!/usr/bin/env python3
"""
V4.2.3 离线止损模拟
模拟加入单笔最大亏损限制后的策略表现
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple


def simulate_stop_loss(samples: List[Dict], max_loss_pct: float) -> Dict:
    """
    模拟止损后的收益
    
    Args:
        samples: 原始样本
        max_loss_pct: 最大允许亏损百分比 (负值，如 -0.15)
    
    Returns:
        模拟后的统计结果
    """
    simulated_returns = []
    stopped_samples = []
    
    for sample in samples:
        original_return = sample['outcome']['change_60s_pct']
        
        # 如果亏损超过限制，触发止损
        if original_return < max_loss_pct:
            simulated_return = max_loss_pct
            stopped_samples.append({
                'original': original_return,
                'simulated': simulated_return,
                'sample': sample
            })
        else:
            simulated_return = original_return
        
        simulated_returns.append(simulated_return)
    
    simulated_returns = np.array(simulated_returns)
    
    # 计算统计
    profits = simulated_returns[simulated_returns > 0]
    losses = simulated_returns[simulated_returns < 0]
    
    result = {
        'max_loss_limit': max_loss_pct,
        'total_samples': len(simulated_returns),
        'stopped_count': len(stopped_samples),
        'stopped_pct': len(stopped_samples) / len(simulated_returns) * 100,
        'mean': np.mean(simulated_returns),
        'median': np.median(simulated_returns),
        'std': np.std(simulated_returns),
        'min': np.min(simulated_returns),
        'max': np.max(simulated_returns),
        'win_rate': len(profits) / len(simulated_returns) * 100,
        'profit_loss_ratio': 0,
        'expected_return': 0,
        'stopped_samples': stopped_samples
    }
    
    if len(profits) > 0 and len(losses) > 0:
        avg_profit = np.mean(profits)
        avg_loss = abs(np.mean(losses))
        result['profit_loss_ratio'] = avg_profit / avg_loss if avg_loss > 0 else 0
        result['expected_return'] = (result['win_rate']/100) * avg_profit - (1 - result['win_rate']/100) * avg_loss
    
    return result


def analyze_extreme_losses(samples: List[Dict]) -> Dict:
    """分析极端亏损样本的共同特征"""
    returns = [s['outcome']['change_60s_pct'] for s in samples]
    returns = np.array(returns)
    
    # 找出最差的10%样本
    p10 = np.percentile(returns, 10)
    extreme_losses = [s for s in samples if s['outcome']['change_60s_pct'] < p10]
    
    if not extreme_losses:
        return {}
    
    analysis = {
        'count': len(extreme_losses),
        'threshold': p10,
        'by_symbol': {},
        'by_score_tier': {},
        'by_volume': {},
        'by_hour': {},
        'avg_return': np.mean([s['outcome']['change_60s_pct'] for s in extreme_losses]),
        'samples': extreme_losses
    }
    
    # 按品种分析
    for s in extreme_losses:
        symbol = s['symbol']
        if symbol not in analysis['by_symbol']:
            analysis['by_symbol'][symbol] = {'count': 0, 'returns': []}
        analysis['by_symbol'][symbol]['count'] += 1
        analysis['by_symbol'][symbol]['returns'].append(s['outcome']['change_60s_pct'])
    
    # 按分数层分析
    for s in extreme_losses:
        score = s['v423_total_score']
        if score >= 93:
            tier = '93-97'
        elif score >= 88:
            tier = '88-92'
        else:
            tier = '85-87'
        
        if tier not in analysis['by_score_tier']:
            analysis['by_score_tier'][tier] = {'count': 0, 'returns': []}
        analysis['by_score_tier'][tier]['count'] += 1
        analysis['by_score_tier'][tier]['returns'].append(s['outcome']['change_60s_pct'])
    
    # 按成交量分析
    for s in extreme_losses:
        vol = s['market_state']['volume_ratio']
        if vol < 0.9:
            vol_tier = '<0.9x'
        elif vol < 1.05:
            vol_tier = '0.9-1.05x'
        elif vol < 1.2:
            vol_tier = '1.05-1.2x'
        else:
            vol_tier = '>1.2x'
        
        if vol_tier not in analysis['by_volume']:
            analysis['by_volume'][vol_tier] = {'count': 0, 'returns': []}
        analysis['by_volume'][vol_tier]['count'] += 1
        analysis['by_volume'][vol_tier]['returns'].append(s['outcome']['change_60s_pct'])
    
    # 按时段分析
    for s in extreme_losses:
        ts = s['timestamp']
        hour = int(ts.split(' ')[1].split(':')[0]) if ' ' in ts else 0
        
        if 0 <= hour < 6:
            period = '凌晨(0-6)'
        elif 6 <= hour < 12:
            period = '上午(6-12)'
        elif 12 <= hour < 18:
            period = '下午(12-18)'
        else:
            period = '晚上(18-24)'
        
        if period not in analysis['by_hour']:
            analysis['by_hour'][period] = {'count': 0, 'returns': []}
        analysis['by_hour'][period]['count'] += 1
        analysis['by_hour'][period]['returns'].append(s['outcome']['change_60s_pct'])
    
    return analysis


def main():
    """主函数"""
    print("=" * 80)
    print("🛡️ V4.2.3 离线止损模拟")
    print("⚠️  当前阶段：风控验证，不修改评分模型，不接入执行层")
    print("=" * 80)
    print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    # 加载样本
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
    
    print(f"📊 加载样本: {len(samples)} 条")
    print("")
    
    # 原始基准
    original_returns = [s['outcome']['change_60s_pct'] for s in samples]
    original_returns = np.array(original_returns)
    
    print("─" * 80)
    print("📈 原始基准 (无止损)")
    print("─" * 80)
    print(f"{'指标':<25} {'数值':<20}")
    print("-" * 80)
    print(f"{'均值':<25} {np.mean(original_returns):>+.4f}%")
    print(f"{'中位数':<25} {np.median(original_returns):>+.4f}%")
    print(f"{'标准差':<25} {np.std(original_returns):>.4f}%")
    print(f"{'最小值':<25} {np.min(original_returns):>+.4f}%")
    print(f"{'最大值':<25} {np.max(original_returns):>+.4f}%")
    
    profits = original_returns[original_returns > 0]
    losses = original_returns[original_returns < 0]
    win_rate = len(profits) / len(original_returns) * 100
    avg_profit = np.mean(profits) if len(profits) > 0 else 0
    avg_loss = abs(np.mean(losses)) if len(losses) > 0 else 0
    pl_ratio = avg_profit / avg_loss if avg_loss > 0 else 0
    expected = (win_rate/100) * avg_profit - (1 - win_rate/100) * avg_loss
    
    print(f"{'胜率':<25} {win_rate:>.1f}%")
    print(f"{'盈亏比':<25} {pl_ratio:>.2f}")
    print(f"{'期望收益':<25} {expected:>+.4f}%")
    print("")
    
    # 模拟不同止损档位
    stop_levels = [-0.15, -0.20, -0.25]
    
    print("=" * 80)
    print("🛡️ 止损模拟对比")
    print("=" * 80)
    print("")
    
    results = []
    for level in stop_levels:
        result = simulate_stop_loss(samples, level)
        results.append(result)
    
    # 对比表
    print("─" * 80)
    print("📊 止损效果对比")
    print("─" * 80)
    print(f"{'指标':<20} {'无止损':<15} {'-0.15%':<15} {'-0.20%':<15} {'-0.25%':<15}")
    print("-" * 80)
    
    metrics = [
        ('触发止损数', lambda r: f"{r['stopped_count']} ({r['stopped_pct']:.1f}%)"),
        ('均值', lambda r: f"{r['mean']:>+.4f}%"),
        ('中位数', lambda r: f"{r['median']:>+.4f}%"),
        ('标准差', lambda r: f"{r['std']:>.4f}%"),
        ('最小值', lambda r: f"{r['min']:>+.4f}%"),
        ('胜率', lambda r: f"{r['win_rate']:>.1f}%"),
        ('盈亏比', lambda r: f"{r['profit_loss_ratio']:>.2f}"),
        ('期望收益', lambda r: f"{r['expected_return']:>+.4f}%")
    ]
    
    # 原始基准
    baseline = {
        'stopped_count': 0,
        'stopped_pct': 0,
        'mean': np.mean(original_returns),
        'median': np.median(original_returns),
        'std': np.std(original_returns),
        'min': np.min(original_returns),
        'win_rate': win_rate,
        'profit_loss_ratio': pl_ratio,
        'expected_return': expected
    }
    
    for metric_name, formatter in metrics:
        row = f"{metric_name:<20} {formatter(baseline):<15}"
        for result in results:
            row += f" {formatter(result):<15}"
        print(row)
    
    print("")
    
    # 关键结论
    print("─" * 80)
    print("🎯 关键结论")
    print("─" * 80)
    
    # 找出最优止损档位
    best_pl = max(results, key=lambda x: x['profit_loss_ratio'])
    best_expected = max(results, key=lambda x: x['expected_return'])
    
    print(f"✅ 最优盈亏比: {best_pl['max_loss_limit']}% 止损 → 盈亏比 {best_pl['profit_loss_ratio']:.2f}")
    print(f"✅ 最优期望收益: {best_expected['max_loss_limit']}% 止损 → 期望收益 {best_expected['expected_return']:+.4f}%")
    
    # 检查是否进入稳定正期望
    if best_expected['expected_return'] > expected:
        print(f"✅ 加入止损后期望收益提升: {expected:+.4f}% → {best_expected['expected_return']:+.4f}%")
    
    if best_pl['profit_loss_ratio'] > pl_ratio:
        print(f"✅ 加入止损后盈亏比提升: {pl_ratio:.2f} → {best_pl['profit_loss_ratio']:.2f}")
    
    if best_pl['profit_loss_ratio'] >= 1.0:
        print(f"🎉 盈亏比突破1.0！策略进入稳定正期望区间")
    
    print("")
    
    # 分析极端亏损样本
    print("=" * 80)
    print("🔍 极端亏损样本分析 (最差的10%)")
    print("=" * 80)
    
    extreme_analysis = analyze_extreme_losses(samples)
    
    if extreme_analysis:
        print(f"极端亏损样本数: {extreme_analysis['count']}")
        print(f"亏损阈值: {extreme_analysis['threshold']:+.4f}%")
        print(f"平均亏损: {extreme_analysis['avg_return']:+.4f}%")
        print("")
        
        # 按品种
        print("─" * 80)
        print("📊 按品种分布")
        print("─" * 80)
        print(f"{'品种':<20} {'数量':<10} {'平均亏损':<15}")
        print("-" * 80)
        for symbol, data in extreme_analysis['by_symbol'].items():
            avg = np.mean(data['returns'])
            print(f"{symbol:<20} {data['count']:<10} {avg:>+.4f}%")
        
        # 按分数层
        print("")
        print("─" * 80)
        print("📊 按分数层分布")
        print("─" * 80)
        print(f"{'分数层':<20} {'数量':<10} {'平均亏损':<15}")
        print("-" * 80)
        for tier, data in extreme_analysis['by_score_tier'].items():
            avg = np.mean(data['returns'])
            print(f"{tier:<20} {data['count']:<10} {avg:>+.4f}%")
        
        # 按成交量
        print("")
        print("─" * 80)
        print("📊 按成交量分布")
        print("─" * 80)
        print(f"{'成交量':<20} {'数量':<10} {'平均亏损':<15}")
        print("-" * 80)
        for vol, data in extreme_analysis['by_volume'].items():
            avg = np.mean(data['returns'])
            print(f"{vol:<20} {data['count']:<10} {avg:>+.4f}%")
        
        # 按时段
        print("")
        print("─" * 80)
        print("📊 按时段分布")
        print("─" * 80)
        print(f"{'时段':<20} {'数量':<10} {'平均亏损':<15}")
        print("-" * 80)
        for period, data in extreme_analysis['by_hour'].items():
            avg = np.mean(data['returns'])
            print(f"{period:<20} {data['count']:<10} {avg:>+.4f}%")
        
        # 极端样本详情
        print("")
        print("─" * 80)
        print("🔍 极端样本详情")
        print("─" * 80)
        for i, s in enumerate(extreme_analysis['samples'][:3], 1):
            print(f"\n样本 {i}:")
            print(f"  收益: {s['outcome']['change_60s_pct']:>+.4f}%")
            print(f"  时间: {s['timestamp']}")
            print(f"  品种: {s['symbol']}")
            print(f"  分数: {s['v423_total_score']}")
            print(f"  成交量比: {s['market_state']['volume_ratio']:.2f}x")
            breakdown = s.get('v423_score_breakdown', {})
            print(f"  评分明细: 趋势{breakdown.get('trend_consistency',0)}/20 回撤{breakdown.get('pullback_breakout',0)}/15 成交量{breakdown.get('volume_confirm',0)}/20")
    
    print("")
    print("=" * 80)
    print("🛡️ 风控建议")
    print("=" * 80)
    
    # 推荐止损档位
    recommended = best_expected['max_loss_limit']
    print(f"✅ 推荐止损档位: {recommended}%")
    print(f"   期望收益: {best_expected['expected_return']:+.4f}%")
    print(f"   盈亏比: {best_expected['profit_loss_ratio']:.2f}")
    print(f"   触发次数: {best_expected['stopped_count']}/{best_expected['total_samples']} ({best_expected['stopped_pct']:.1f}%)")
    
    print("")
    print("📋 执行层风控规则建议:")
    print(f"  1. 单笔最大亏损限制: {recommended}% (硬止损)")
    print(f"  2. 无条件触发，不走逻辑判断")
    print(f"  3. 预计触发率: {best_expected['stopped_pct']:.1f}%")
    
    print("")
    print("⚠️  当前阶段: 风控验证，不修改评分模型，不接入执行层")
    print("🎯 目标: 验证止损后策略是否进入稳定正期望区间")
    print("=" * 80)


if __name__ == "__main__":
    main()
