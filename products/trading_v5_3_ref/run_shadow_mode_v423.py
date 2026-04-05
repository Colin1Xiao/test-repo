#!/usr/bin/env python3
"""
V4.2.3 影子模式运行脚本
仅在V4.2影子实验线实施，不接入V4.1执行层
目标：累计50+新样本验证V4.2.3效果
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict
import pandas as pd
import numpy as np
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423


class ShadowModeV423(EnhancedAnalyzer):
    """
    V4.2.3 影子模式 - 仅在实验线运行
    ⚠️ 重要：不接入V4.1执行层
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        self.scoring_engine = ScoringEngineV423()
        
        # 加载已有V4.2.3样本
        self._load_existing_samples()
        
        print("=" * 80)
        print("🚀 V4.2.3 影子模式 - 第三轮定向微调验证")
        print("=" * 80)
        print("⚠️  重要提示：此版本仅在V4.2影子实验线运行")
        print("🚫 不接入V4.1执行层，不做真实下单")
        print("")
        print("📋 V4.2.3 调整内容:")
        print("  1. 成交量重映射: 0.9-1.05x=15分, 1.2-1.5x=0分")
        print("  2. 88-92分层附加过滤: 88-92分+1.2-1.5x成交量→不达标")
        print("")
        print(f"📊 当前V4.2.3样本: {len(self.all_results)} 条")
        print(f"🎯 目标样本: 50+ 条 (用于验证V4.2.3效果)")
        print("")
    
    def _load_existing_samples(self):
        """加载已有V4.2.3样本"""
        shadow_file = self.data_dir / 'shadow_v423_samples.jsonl'
        if shadow_file.exists():
            with open(shadow_file, 'r') as f:
                for line in f:
                    try:
                        sample = json.loads(line.strip())
                        self.all_results.append(sample)
                    except:
                        pass
            print(f"✅ 已加载已有V4.2.3样本: {len(self.all_results)} 条")
    
    async def collect_samples(self, hours: int = 24):
        """收集新样本"""
        for symbol in self.symbols:
            print(f"\n{'='*60}")
            print(f"📊 V4.2.3 收集 {symbol} 样本...")
            print(f"{'='*60}")
            
            df = await self.fetch_historical_ohlcv(symbol, hours)
            if df is None or len(df) < 30:
                continue
            
            new_samples = []
            
            for i in range(30, len(df) - 3):
                window = df.iloc[i-30:i]
                current = df.iloc[i]
                future_30s = df.iloc[i+1] if i+1 < len(df) else None
                future_60s = df.iloc[i+2] if i+2 < len(df) else None
                future_120s = df.iloc[i+3] if i+3 < len(df) else None
                
                # 使用V4.2.3评分引擎
                score_breakdown = self.scoring_engine.calculate_score(
                    ohlcv_df=window,
                    current_price=current['close'],
                    spread_bps=2.0,
                    rl_decision='ALLOW'
                )
                
                if not score_breakdown.is_qualified:
                    continue
                
                outcome = self._calc_outcome(current, future_30s, future_60s, future_120s)
                
                sample = {
                    'symbol': symbol,
                    'timestamp': str(current['timestamp']),
                    'price': float(current['close']),
                    'v423_score_breakdown': {
                        'trend_consistency': score_breakdown.trend_consistency,
                        'pullback_breakout': score_breakdown.pullback_breakout,
                        'volume_confirm': score_breakdown.volume_confirm,
                        'spread_quality': score_breakdown.spread_quality,
                        'volatility_range': score_breakdown.volatility_range,
                        'rl_filter': score_breakdown.rl_filter,
                    },
                    'v423_total_score': score_breakdown.total_score,
                    'v423_filter_reason': score_breakdown.filter_reason,
                    'market_state': {
                        'volume_ratio': self._calc_volume_ratio(window),
                    },
                    'outcome': outcome
                }
                
                new_samples.append(sample)
            
            print(f"✅ {symbol} 新增 {len(new_samples)} 条V4.2.3达标样本")
            self.all_results.extend(new_samples)
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    def _calc_outcome(self, current, future_30s, future_60s, future_120s):
        current_price = float(current['close'])
        outcome = {}
        
        if future_30s is not None:
            outcome['change_30s_pct'] = float((future_30s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_30s_pct'] = 0.0
        
        if future_60s is not None:
            outcome['change_60s_pct'] = float((future_60s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_60s_pct'] = 0.0
        
        if future_120s is not None:
            outcome['change_120s_pct'] = float((future_120s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_120s_pct'] = 0.0
        
        outcome['is_direction_correct'] = abs(outcome['change_60s_pct']) > 0.05
        
        return outcome
    
    def save_samples(self):
        """保存样本"""
        shadow_file = self.data_dir / 'shadow_v423_samples.jsonl'
        with open(shadow_file, 'w') as f:
            for sample in self.all_results:
                f.write(json.dumps(sample) + '\n')
        print(f"\n💾 V4.2.3样本已保存: {shadow_file}")
    
    def generate_validation_report(self) -> str:
        """生成V4.2.3验证报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.3 影子模式验证报告")
        lines.append("⚠️  仅在V4.2实验线运行，不接入V4.1执行层")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"V4.2.3总样本数: {len(self.all_results)}")
        lines.append("")
        
        if len(self.all_results) < 10:
            lines.append("⏳ V4.2.3样本不足，继续积累...")
            return "\n".join(lines)
        
        # 基础统计
        lines.append("─" * 80)
        lines.append("📈 基础统计 (V4.2.3)")
        lines.append("─" * 80)
        
        changes_30s = [r['outcome']['change_30s_pct'] for r in self.all_results]
        changes_60s = [r['outcome']['change_60s_pct'] for r in self.all_results]
        changes_120s = [r['outcome']['change_120s_pct'] for r in self.all_results]
        
        lines.append(f"{'时间窗口':<15} {'均值':<12} {'中位数':<12} {'去极值均值':<12} {'样本数':<10}")
        lines.append("-" * 80)
        
        for name, changes in [('30秒', changes_30s), ('60秒', changes_60s), ('120秒', changes_120s)]:
            mean_val = np.mean(changes)
            median_val = np.median(changes)
            lower = np.percentile(changes, 5)
            upper = np.percentile(changes, 95)
            trimmed = [c for c in changes if lower <= c <= upper]
            trimmed_mean = np.mean(trimmed) if trimmed else 0
            
            lines.append(
                f"{name:<15} "
                f"{mean_val:<+12.4f}% "
                f"{median_val:<+12.4f}% "
                f"{trimmed_mean:<+12.4f}% "
                f"{len(changes):<10}"
            )
        
        lines.append("")
        
        # 方向正确率
        direction_acc = sum(1 for r in self.all_results if r['outcome'].get('is_direction_correct')) / len(self.all_results) * 100
        lines.append(f"方向正确率: {direction_acc:.1f}%")
        lines.append("")
        
        # 分数分层
        lines.append("─" * 80)
        lines.append("🎯 分数分层分析 (V4.2.3)")
        lines.append("─" * 80)
        
        tiers = {
            '85-87': (85, 87),
            '88-92': (88, 92),
            '93-97': (93, 97),
            '98-100': (98, 100)
        }
        
        lines.append(f"{'分数层':<10} {'样本数':<10} {'均值':<12} {'中位数':<12} {'去极值均值':<12}")
        lines.append("-" * 80)
        
        for tier_name, (min_s, max_s) in tiers.items():
            tier_samples = [r for r in self.all_results if min_s <= r['v423_total_score'] <= max_s]
            if not tier_samples:
                continue
            
            changes = [r['outcome']['change_60s_pct'] for r in tier_samples]
            mean_val = np.mean(changes)
            median_val = np.median(changes)
            
            lower = np.percentile(changes, 5)
            upper = np.percentile(changes, 95)
            trimmed = [c for c in changes if lower <= c <= upper]
            trimmed_mean = np.mean(trimmed) if trimmed else 0
            
            lines.append(
                f"{tier_name:<10} "
                f"{len(tier_samples):<10} "
                f"{mean_val:<+12.4f}% "
                f"{median_val:<+12.4f}% "
                f"{trimmed_mean:<+12.4f}%"
            )
        
        lines.append("")
        
        # BTC vs ETH
        lines.append("─" * 80)
        lines.append("🪙 BTC vs ETH 分开统计 (V4.2.3)")
        lines.append("─" * 80)
        
        btc_samples = [r for r in self.all_results if 'BTC' in r['symbol']]
        eth_samples = [r for r in self.all_results if 'ETH' in r['symbol']]
        
        lines.append(f"{'指标':<20} {'BTC':<20} {'ETH':<20}")
        lines.append("-" * 80)
        lines.append(f"{'样本数':<20} {len(btc_samples):<20} {len(eth_samples):<20}")
        
        if btc_samples:
            btc_dir = sum(1 for r in btc_samples if r['outcome'].get('is_direction_correct')) / len(btc_samples) * 100
            btc_60 = np.mean([r['outcome']['change_60s_pct'] for r in btc_samples])
        else:
            btc_dir = btc_60 = 0
        
        if eth_samples:
            eth_dir = sum(1 for r in eth_samples if r['outcome'].get('is_direction_correct')) / len(eth_samples) * 100
            eth_60 = np.mean([r['outcome']['change_60s_pct'] for r in eth_samples])
        else:
            eth_dir = eth_60 = 0
        
        lines.append(f"{'方向正确率':<20} {btc_dir:<19.1f}% {eth_dir:<19.1f}%")
        lines.append(f"{'60秒均值':<20} {btc_60:<+19.4f}% {eth_60:<+19.4f}%")
        
        lines.append("")
        
        # 阶段判断
        lines.append("─" * 80)
        lines.append("🎯 阶段判断")
        lines.append("─" * 80)
        
        if len(self.all_results) < 25:
            lines.append(f"⏳ V4.2.3样本积累中: {len(self.all_results)}/50")
            lines.append("  建议: 继续运行影子模式")
        elif len(self.all_results) < 50:
            lines.append(f"⏳ V4.2.3接近目标: {len(self.all_results)}/50")
            lines.append("  建议: 再积累一些样本后做全面分析")
        else:
            lines.append(f"✅ V4.2.3样本充足: {len(self.all_results)} 条")
            lines.append("  建议: 可以评估是否进入下一阶段")
        
        lines.append("")
        lines.append("📋 V4.2.3验证状态:")
        
        # 检查关键指标
        if np.mean(changes_60s) > 0:
            lines.append("  ✅ 60秒均值为正")
        else:
            lines.append("  ⚠️  60秒均值为负，需观察")
        
        if np.median(changes_60s) > 0:
            lines.append("  ✅ 60秒中位数为正")
        else:
            lines.append("  ⚠️  60秒中位数为负，需观察")
        
        if direction_acc >= 90:
            lines.append("  ✅ 方向正确率>=90%")
        else:
            lines.append(f"  ⏸️  方向正确率{direction_acc:.1f}%")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    shadow = ShadowModeV423()
    
    # 收集新样本
    await shadow.collect_samples(hours=24)
    
    # 保存
    shadow.save_samples()
    
    # 生成报告
    report = shadow.generate_validation_report()
    print(report)
    
    # 保存报告
    report_file = shadow.data_dir / 'shadow_v423_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ V4.2.3验证报告已保存: {report_file}")
    
    # 样本量检查
    if len(shadow.all_results) >= 50:
        print("\n🎉 V4.2.3样本量已达 50+，可以评估是否进入下一阶段！")
    else:
        print(f"\n⏳ V4.2.3当前样本: {len(shadow.all_results)}/50，建议继续运行")
    
    print("\n" + "=" * 80)
    print("⚠️  重要提醒：V4.2.3仅在影子实验线运行")
    print("🚫 不要接入V4.1执行层")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
