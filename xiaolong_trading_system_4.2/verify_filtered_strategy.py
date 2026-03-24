#!/usr/bin/env python3
"""
验证过滤后策略表现
关键问题：去掉ETH下午后，均值是否仍>0？
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime


def extract_hour(timestamp: str) -> int:
    """提取小时"""
    try:
        if ' ' in timestamp:
            return int(timestamp.split(' ')[1].split(':')[0])
        return 0
    except:
        return 0


def main():
    print("=" * 80)
    print("🔍 环境过滤后策略验证")
    print("=" * 80)
    print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    # 加载样本
    data_dir = Path(__file__).parent / 'data'
    shadow_file = data_dir / 'shadow_v423_samples.jsonl'
    
    if not shadow_file.exists():
        print("❌ 未找到样本文件")
        return
    
    samples = []
    with open(shadow_file, 'r') as f:
        for line in f:
            try:
                samples.append(json.loads(line.strip()))
            except:
                pass
    
    print(f"📊 总样本数: {len(samples)}")
    print("")
    
    # 止损配置
    stop_loss_pct = -0.15
    
    # 1. 原始策略（无过滤）
    print("─" * 80)
    print("📊 原始策略（无过滤）")
    print("─" * 80)
    
    original_returns = []
    stopped_returns = []
    
    for s in samples:
        ret = s['outcome']['change_60s_pct']
        original_returns.append(ret)
        
        # 应用止损
        if ret < stop_loss_pct:
            stopped_returns.append(stop_loss_pct)
        else:
            stopped_returns.append(ret)
    
    original_returns = np.array(original_returns)
    stopped_returns = np.array(stopped_returns)
    
    print(f"样本数: {len(stopped_returns)}")
    print(f"均值: {np.mean(stopped_returns):+.4f}%")
    print(f"中位数: {np.median(stopped_returns):+.4f}%")
    print(f"盈亏比: {np.mean(stopped_returns[stopped_returns > 0]) / abs(np.mean(stopped_returns[stopped_returns < 0])):.2f}")
    
    # 2. 过滤ETH下午
    print("")
    print("─" * 80)
    print("🚫 过滤策略A: 禁用 ETH 下午(12-18)")
    print("─" * 80)
    
    filtered_a = []
    excluded_eth_afternoon = []
    
    for s in samples:
        hour = extract_hour(s['timestamp'])
        is_eth = 'ETH' in s['symbol']
        is_afternoon = 12 <= hour < 18
        
        if is_eth and is_afternoon:
            excluded_eth_afternoon.append(s)
        else:
            ret = s['outcome']['change_60s_pct']
            if ret < stop_loss_pct:
                filtered_a.append(stop_loss_pct)
            else:
                filtered_a.append(ret)
    
    filtered_a = np.array(filtered_a)
    
    print(f"排除样本: {len(excluded_eth_afternoon)} (ETH下午)")
    print(f"剩余样本: {len(filtered_a)}")
    print(f"均值: {np.mean(filtered_a):+.4f}%")
    print(f"中位数: {np.median(filtered_a):+.4f}%")
    
    if len(filtered_a[filtered_a > 0]) > 0 and len(filtered_a[filtered_a < 0]) > 0:
        pl_ratio = np.mean(filtered_a[filtered_a > 0]) / abs(np.mean(filtered_a[filtered_a < 0]))
        print(f"盈亏比: {pl_ratio:.2f}")
    
    if np.mean(filtered_a) > 0:
        print("✅ 过滤后均值仍为正！")
    else:
        print("⚠️  过滤后均值为负")
    
    # 3. 过滤ETH低成交量
    print("")
    print("─" * 80)
    print("🚫 过滤策略B: 禁用 ETH 低成交量(<1.05x)")
    print("─" * 80)
    
    filtered_b = []
    excluded_eth_low_vol = []
    
    for s in samples:
        is_eth = 'ETH' in s['symbol']
        is_low_vol = s['market_state']['volume_ratio'] < 1.05
        
        if is_eth and is_low_vol:
            excluded_eth_low_vol.append(s)
        else:
            ret = s['outcome']['change_60s_pct']
            if ret < stop_loss_pct:
                filtered_b.append(stop_loss_pct)
            else:
                filtered_b.append(ret)
    
    filtered_b = np.array(filtered_b)
    
    print(f"排除样本: {len(excluded_eth_low_vol)} (ETH低成交量)")
    print(f"剩余样本: {len(filtered_b)}")
    print(f"均值: {np.mean(filtered_b):+.4f}%")
    print(f"中位数: {np.median(filtered_b):+.4f}%")
    
    if len(filtered_b[filtered_b > 0]) > 0 and len(filtered_b[filtered_b < 0]) > 0:
        pl_ratio = np.mean(filtered_b[filtered_b > 0]) / abs(np.mean(filtered_b[filtered_b < 0]))
        print(f"盈亏比: {pl_ratio:.2f}")
    
    if np.mean(filtered_b) > 0:
        print("✅ 过滤后均值仍为正！")
    else:
        print("⚠️  过滤后均值为负")
    
    # 4. 组合过滤：ETH下午 + 低成交量
    print("")
    print("─" * 80)
    print("🚫 过滤策略C: 禁用 ETH 下午(12-18) + 低成交量(<1.05x)")
    print("─" * 80)
    
    filtered_c = []
    excluded_combined = []
    
    for s in samples:
        hour = extract_hour(s['timestamp'])
        is_eth = 'ETH' in s['symbol']
        is_afternoon = 12 <= hour < 18
        is_low_vol = s['market_state']['volume_ratio'] < 1.05
        
        if is_eth and (is_afternoon or is_low_vol):
            excluded_combined.append(s)
        else:
            ret = s['outcome']['change_60s_pct']
            if ret < stop_loss_pct:
                filtered_c.append(stop_loss_pct)
            else:
                filtered_c.append(ret)
    
    filtered_c = np.array(filtered_c)
    
    print(f"排除样本: {len(excluded_combined)} (ETH下午或低成交量)")
    print(f"剩余样本: {len(filtered_c)}")
    print(f"均值: {np.mean(filtered_c):+.4f}%")
    print(f"中位数: {np.median(filtered_c):+.4f}%")
    
    if len(filtered_c[filtered_c > 0]) > 0 and len(filtered_c[filtered_c < 0]) > 0:
        pl_ratio = np.mean(filtered_c[filtered_c > 0]) / abs(np.mean(filtered_c[filtered_c < 0]))
        print(f"盈亏比: {pl_ratio:.2f}")
    
    if np.mean(filtered_c) > 0:
        print("✅ 过滤后均值仍为正！")
    else:
        print("⚠️  过滤后均值为负")
    
    # 5. 对比分析
    print("")
    print("=" * 80)
    print("📊 过滤策略对比")
    print("=" * 80)
    
    print(f"{'策略':<30} {'样本数':<10} {'均值':<12} {'中位数':<12} {'状态':<10}")
    print("-" * 80)
    
    strategies = [
        ("原始策略", stopped_returns),
        ("过滤A: ETH下午", filtered_a),
        ("过滤B: ETH低量", filtered_b),
        ("过滤C: ETH下午+低量", filtered_c)
    ]
    
    for name, data in strategies:
        mean_val = np.mean(data)
        median_val = np.median(data)
        status = "✅ 正期望" if mean_val > 0 else "❌ 负期望"
        print(f"{name:<30} {len(data):<10} {mean_val:<+12.4f}% {median_val:<+12.4f}% {status}")
    
    # 6. 关键结论
    print("")
    print("=" * 80)
    print("🎯 关键结论")
    print("=" * 80)
    
    all_positive = all(np.mean(data) > 0 for _, data in strategies)
    
    if all_positive:
        print("✅ 所有过滤策略均保持正期望！")
        print("")
        print("📋 推荐执行层配置:")
        print("  1. 硬止损: -0.15%")
        print("  2. 连续3次止损 → 暂停30分钟")
        print("  3. ETH下午(12-18)禁止开仓")
        print("  4. ETH低成交量(<1.05x)禁止开仓")
        print("")
        print("🚀 策略已具备上线条件（小资金试跑）")
    else:
        print("⚠️  部分过滤策略均值为负，需进一步优化")
    
    # 7. 被排除样本分析
    print("")
    print("=" * 80)
    print("🔍 被排除样本分析")
    print("=" * 80)
    
    if excluded_eth_afternoon:
        returns = [s['outcome']['change_60s_pct'] for s in excluded_eth_afternoon]
        stopped = [max(r, stop_loss_pct) for r in returns]
        print(f"ETH下午样本: {len(excluded_eth_afternoon)}")
        print(f"  原始均值: {np.mean(returns):+.4f}%")
        print(f"  止损后均值: {np.mean(stopped):+.4f}%")
        print(f"  止损触发: {sum(1 for r in returns if r < stop_loss_pct)}次")
    
    if excluded_eth_low_vol:
        returns = [s['outcome']['change_60s_pct'] for s in excluded_eth_low_vol]
        stopped = [max(r, stop_loss_pct) for r in returns]
        print(f"\nETH低成交量样本: {len(excluded_eth_low_vol)}")
        print(f"  原始均值: {np.mean(returns):+.4f}%")
        print(f"  止损后均值: {np.mean(stopped):+.4f}%")
        print(f"  止损触发: {sum(1 for r in returns if r < stop_loss_pct)}次")
    
    print("")
    print("=" * 80)


if __name__ == "__main__":
    main()