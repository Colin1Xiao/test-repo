#!/usr/bin/env python3
"""
V4.2.1 离线调参分析
只分析 BTC + ETH，使用新评分体系
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v421 import ScoringEngineV421, ScoreBreakdown
import pandas as pd
import numpy as np


class V421Analyzer(EnhancedAnalyzer):
    """V4.2.1 分析器 - 使用新评分引擎"""
    
    def __init__(self):
        """初始化 - 只保留 BTC 和 ETH"""
        # 只分析 BTC 和 ETH
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        # 使用 V4.2.1 评分引擎
        self.scoring_engine = ScoringEngineV421()
        
        print("=" * 80)
        print("🚀 V4.2.1 离线调参分析")
        print("=" * 80)
        print("\n📋 调整内容:")
        print("  1. 剔除 SOL，只保留 BTC/ETH")
        print("  2. 权重: trend 20 / pullback 15 / volume 20 / spread 15 / volatility 15 / RL 15")
        print("  3. 成交量分段打分: <0.9=0分 / 0.9-1.05=5分 / 1.05-1.2=10分 / >1.2=20分")
        print("  4. 达标阈值: 75 → 80")
        print("")
    
    async def analyze_symbol_with_v421(self, symbol: str, hours: int = 24) -> Dict:
        """使用 V4.2.1 评分引擎分析单个品种"""
        print(f"\n{'='*60}")
        print(f"📊 V4.2.1 分析: {symbol}")
        print(f"{'='*60}")
        
        # 获取数据 (使用父类的异步方法)
        df = await self.fetch_historical_ohlcv(symbol, hours)
        if df is None or len(df) < 30:
            print(f"❌ {symbol} 数据不足")
            return {'symbol': symbol, 'samples': []}
        
        samples = []
        
        # 滑动窗口分析
        for i in range(30, len(df) - 3):
            window = df.iloc[i-30:i]
            current = df.iloc[i]
            future_30s = df.iloc[i+1] if i+1 < len(df) else None
            future_60s = df.iloc[i+2] if i+2 < len(df) else None
            future_120s = df.iloc[i+3] if i+3 < len(df) else None
            
            # 使用 V4.2.1 评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            if not score_breakdown.is_qualified:
                continue
            
            # 计算后验表现
            outcome = self._calc_future_changes_v421(current, future_30s, future_60s, future_120s)
            
            sample = {
                'symbol': symbol,
                'timestamp': current['timestamp'],
                'price': current['close'],
                'v421_score_breakdown': {
                    'trend_consistency': score_breakdown.trend_consistency,
                    'pullback_breakout': score_breakdown.pullback_breakout,
                    'volume_confirm': score_breakdown.volume_confirm,
                    'spread_quality': score_breakdown.spread_quality,
                    'volatility_range': score_breakdown.volatility_range,
                    'rl_filter': score_breakdown.rl_filter,
                },
                'v421_total_score': score_breakdown.total_score,
                'v421_is_qualified': score_breakdown.is_qualified,
                'market_state': {
                    'volume_ratio': self._calc_volume_ratio(window),
                },
                'outcome': outcome
            }
            
            samples.append(sample)
        
        print(f"✅ {symbol} V4.2.1 分析完成: {len(samples)} 达标样本")
        return {'symbol': symbol, 'samples': samples}
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        """计算成交量比"""
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return current_vol / avg_vol if avg_vol > 0 else 0
        except:
            return 0
    
    def _calc_future_changes_v421(self, current, future_30s, future_60s, future_120s):
        """计算未来价格变化"""
        current_price = current['close']
        changes = {}
        
        # 30秒变化
        if future_30s is not None:
            changes['change_30s_pct'] = (future_30s['close'] - current_price) / current_price * 100
        else:
            changes['change_30s_pct'] = 0
        
        # 60秒变化
        if future_60s is not None:
            changes['change_60s_pct'] = (future_60s['close'] - current_price) / current_price * 100
        else:
            changes['change_60s_pct'] = 0
        
        # 120秒变化
        if future_120s is not None:
            changes['change_120s_pct'] = (future_120s['close'] - current_price) / current_price * 100
        else:
            changes['change_120s_pct'] = 0
        
        # 方向正确性
        changes['is_direction_correct'] = abs(changes['change_60s_pct']) > 0.05
        
        return changes
    
    def generate_v421_report(self) -> str:
        """生成 V4.2.1 分析报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.1 离线调参分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总样本数: {len(self.all_results)}")
        lines.append(f"分析品种: BTC/USDT:USDT, ETH/USDT:USDT (已剔除 SOL)")
        lines.append("")
        
        # 权重配置
        lines.append("─" * 80)
        lines.append("⚙️ V4.2.1 评分配置")
        lines.append("─" * 80)
        lines.append("权重调整:")
        lines.append("  趋势一致性: 30 → 20 (降权)")
        lines.append("  回撤后突破: 20 → 15 (降权)")
        lines.append("  成交量确认: 15 → 20 (升权 + 分段)")
        lines.append("  点差质量:   15 → 15 (保持)")
        lines.append("  波动率适中: 10 → 15 (升权)")
        lines.append("  RL过滤:    10 → 15 (升权)")
        lines.append("")
        lines.append("成交量分段规则:")
        lines.append("  < 0.9x   → 0分")
        lines.append("  0.9-1.05x → 5分")
        lines.append("  1.05-1.2x → 10分")
        lines.append("  > 1.2x   → 20分")
        lines.append("")
        lines.append("达标阈值: 75 → 80")
        lines.append("")
        
        # 分时段统计
        lines.append("─" * 80)
        lines.append("⏰ 1. 分时段统计分析 (V4.2.1)")
        lines.append("─" * 80)
        
        zone_stats = self.analyze_by_time_zone(self.all_results)
        
        if zone_stats:
            lines.append(f"{'时段':<12} {'样本数':<10} {'达标数':<10} {'30秒变化':<12} {'60秒变化':<12} {'120秒变化':<12}")
            lines.append("-" * 80)
            
            for zone_name, stats in zone_stats.items():
                lines.append(
                    f"{zone_name:<12} "
                    f"{stats['total_samples']:<10} "
                    f"{stats['qualified_samples']:<10} "
                    f"{stats.get('avg_change_30s', 0):<+12.4f}% "
                    f"{stats.get('avg_change_60s', 0):<+12.4f}% "
                    f"{stats.get('avg_change_120s', 0):<+12.4f}%"
                )
        else:
            lines.append("  时段数据不足")
        
        lines.append("")
        
        # 分数分层 (V4.2.1 新阈值 80)
        lines.append("─" * 80)
        lines.append("🎯 2. 分数分层分析 (V4.2.1 阈值: 80)")
        lines.append("─" * 80)
        
        # V4.2.1 新分层: 80-84, 85-89, 90+
        score_tiers_v421 = {
            '80-84': (80, 84),
            '85-89': (85, 89),
            '90+': (90, 100)
        }
        
        lines.append(f"{'分数层':<10} {'样本数':<10} {'平均分':<10} {'30秒变化':<12} {'60秒变化':<12} {'120秒变化':<12}")
        lines.append("-" * 80)
        
        for tier_name, (min_score, max_score) in score_tiers_v421.items():
            tier_samples = [
                r for r in self.all_results
                if min_score <= r.get('v421_total_score', 0) <= max_score
            ]
            
            if not tier_samples:
                continue
            
            changes_30s = [r['outcome']['change_30s_pct'] for r in tier_samples]
            changes_60s = [r['outcome']['change_60s_pct'] for r in tier_samples]
            changes_120s = [r['outcome']['change_120s_pct'] for r in tier_samples]
            
            lines.append(
                f"{tier_name:<10} "
                f"{len(tier_samples):<10} "
                f"{np.mean([r['v421_total_score'] for r in tier_samples]):<10.1f} "
                f"{np.mean(changes_30s):<+12.4f}% "
                f"{np.mean(changes_60s):<+12.4f}% "
                f"{np.mean(changes_120s):<+12.4f}%"
            )
        
        lines.append("")
        
        # 90+ 样本详细分析
        lines.append("─" * 80)
        lines.append("🔍 3. 90+ 高分样本详细分析")
        lines.append("─" * 80)
        
        high_score_samples = [
            r for r in self.all_results
            if r.get('v421_total_score', 0) >= 90
        ]
        
        if high_score_samples:
            lines.append(f"90+ 样本数: {len(high_score_samples)}")
            lines.append("")
            lines.append(f"{'样本':<8} {'总分':<8} {'趋势':<6} {'回撤':<6} {'成交量':<8} {'点差':<6} {'波动':<6} {'RL':<6} {'60秒变化':<12}")
            lines.append("-" * 80)
            
            for i, sample in enumerate(high_score_samples[:10]):  # 只显示前10条
                bd = sample['v421_score_breakdown']
                lines.append(
                    f"#{i+1:<7} "
                    f"{sample['v421_total_score']:<8} "
                    f"{bd['trend_consistency']:<6} "
                    f"{bd['pullback_breakout']:<6} "
                    f"{bd['volume_confirm']:<8} "
                    f"{bd['spread_quality']:<6} "
                    f"{bd['volatility_range']:<6} "
                    f"{bd['rl_filter']:<6} "
                    f"{sample['outcome']['change_60s_pct']:<+12.4f}%"
                )
            
            lines.append("")
            
            # 分析高分来源
            lines.append("💡 90+ 样本高分来源分析:")
            avg_breakdown = {
                'trend': np.mean([s['v421_score_breakdown']['trend_consistency'] for s in high_score_samples]),
                'pullback': np.mean([s['v421_score_breakdown']['pullback_breakout'] for s in high_score_samples]),
                'volume': np.mean([s['v421_score_breakdown']['volume_confirm'] for s in high_score_samples]),
                'spread': np.mean([s['v421_score_breakdown']['spread_quality'] for s in high_score_samples]),
                'volatility': np.mean([s['v421_score_breakdown']['volatility_range'] for s in high_score_samples]),
                'rl': np.mean([s['v421_score_breakdown']['rl_filter'] for s in high_score_samples]),
            }
            
            lines.append(f"  趋势一致性平均分: {avg_breakdown['trend']:.1f}/20")
            lines.append(f"  回撤后突破平均分: {avg_breakdown['pullback']:.1f}/15")
            lines.append(f"  成交量确认平均分: {avg_breakdown['volume']:.1f}/20")
            lines.append(f"  点差质量平均分:   {avg_breakdown['spread']:.1f}/15")
            lines.append(f"  波动率适中平均分: {avg_breakdown['volatility']:.1f}/15")
            lines.append(f"  RL过滤平均分:     {avg_breakdown['rl']:.1f}/15")
            
            # 判断高分来源
            if avg_breakdown['trend'] > 18 and avg_breakdown['pullback'] > 13:
                lines.append("")
                lines.append("⚠️  发现: 90+ 样本主要依赖趋势+回撤因子，这两个因子可能给分过满")
        else:
            lines.append("  无 90+ 样本")
        
        lines.append("")
        
        # 成交量因子分析
        lines.append("─" * 80)
        lines.append("📊 4. 成交量因子分段效果分析")
        lines.append("─" * 80)
        
        volume_score_dist = {}
        for score in [0, 5, 10, 20]:
            samples = [r for r in self.all_results if r['v421_score_breakdown']['volume_confirm'] == score]
            if samples:
                changes_60s = [r['outcome']['change_60s_pct'] for r in samples]
                volume_score_dist[score] = {
                    'count': len(samples),
                    'avg_change_60s': np.mean(changes_60s)
                }
        
        lines.append(f"{'成交量得分':<12} {'样本数':<10} {'60秒变化':<15}")
        lines.append("-" * 80)
        for score, stats in sorted(volume_score_dist.items()):
            lines.append(f"{score:<12} {stats['count']:<10} {stats['avg_change_60s']:<+15.4f}%")
        
        lines.append("")
        
        # 最终结论
        lines.append("─" * 80)
        lines.append("🎯 5. V4.2.1 调参结论")
        lines.append("─" * 80)
        
        total = len(self.all_results)
        qualified = [r for r in self.all_results if r['v421_is_qualified']]
        
        lines.append("📊 核心指标:")
        lines.append(f"  - 总样本: {total}")
        lines.append(f"  - 达标样本 (>=80): {len(qualified)} ({len(qualified)/total*100:.1f}%)")
        
        if qualified:
            changes_30s = [r['outcome']['change_30s_pct'] for r in qualified]
            changes_60s = [r['outcome']['change_60s_pct'] for r in qualified]
            changes_120s = [r['outcome']['change_120s_pct'] for r in qualified]
            
            lines.append(f"  - 30秒平均变化: {np.mean(changes_30s):+.4f}%")
            lines.append(f"  - 60秒平均变化: {np.mean(changes_60s):+.4f}%")
            lines.append(f"  - 120秒平均变化: {np.mean(changes_120s):+.4f}%")
            
            direction_acc = sum(1 for r in qualified if r['outcome'].get('is_direction_correct')) / len(qualified) * 100
            lines.append(f"  - 方向正确率: {direction_acc:.1f}%")
        
        lines.append("")
        lines.append("💡 阶段判断:")
        
        if total < 50:
            lines.append("  ⏸️  样本量不足 (<50)，继续积累")
        elif qualified and np.mean([r['outcome']['change_60s_pct'] for r in qualified]) < 0.02:
            lines.append("  ⏸️  60秒后验边际较弱，继续观察")
        elif qualified and direction_acc < 55:
            lines.append("  ⏸️  方向正确率不足，暂不进入执行层")
        else:
            lines.append("  ✅ V4.2.1 表现改善，可考虑小范围影子测试")
        
        lines.append("")
        lines.append("📋 与 V4.2 对比:")
        lines.append("  - 达标率下降 (剔除低质量样本)")
        lines.append("  - 成交量因子现在有连续区分度")
        lines.append("  - 90+ 样本结构更清晰，便于判断失真原因")
        lines.append("  - BTC/ETH 分离后，品种特异性更明显")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    analyzer = V421Analyzer()
    
    # 分析 BTC
    btc_result = await analyzer.analyze_symbol_with_v421('BTC/USDT:USDT', hours=24)
    analyzer.all_results.extend(btc_result['samples'])
    
    # 分析 ETH
    eth_result = await analyzer.analyze_symbol_with_v421('ETH/USDT:USDT', hours=24)
    analyzer.all_results.extend(eth_result['samples'])
    
    print(f"\n{'='*80}")
    print(f"✅ V4.2.1 分析完成，总样本: {len(analyzer.all_results)}")
    print(f"{'='*80}")
    
    # 生成报告
    report = analyzer.generate_v421_report()
    print(report)
    
    # 保存报告
    report_file = analyzer.data_dir / 'v421_analysis_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())

        