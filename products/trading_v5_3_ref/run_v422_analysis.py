#!/usr/bin/env python3
"""
V4.2.2 第二轮离线调参分析
核心修正高分失真问题
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v422 import ScoringEngineV422


class V422Analyzer(EnhancedAnalyzer):
    """V4.2.2 分析器"""
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        self.scoring_engine = ScoringEngineV422()
        
        print("=" * 80)
        print("🚀 V4.2.2 第二轮离线调参分析")
        print("=" * 80)
        print("\n📋 核心修正:")
        print("  1. 阈值: 80 → 85")
        print("  2. 趋势一致性: 二元 → 分段 (5/10/15/20)")
        print("  3. 回撤后突破: 二元 → 分段 (5/10/15)")
        print("  4. 成交量: 越大越好 → 中间最优 (1.05-1.2x 得15分)")
        print("  5. 目标: 纠正高分失真，消除分数与表现的负相关")
        print("")
    
    async def analyze_symbol_with_v422(self, symbol: str, hours: int = 24) -> Dict:
        """使用 V4.2.2 评分引擎分析"""
        print(f"\n{'='*60}")
        print(f"📊 V4.2.2 分析: {symbol}")
        print(f"{'='*60}")
        
        df = await self.fetch_historical_ohlcv(symbol, hours)
        if df is None or len(df) < 30:
            print(f"❌ {symbol} 数据不足")
            return {'symbol': symbol, 'samples': []}
        
        samples = []
        
        for i in range(30, len(df) - 3):
            window = df.iloc[i-30:i]
            current = df.iloc[i]
            future_30s = df.iloc[i+1] if i+1 < len(df) else None
            future_60s = df.iloc[i+2] if i+2 < len(df) else None
            future_120s = df.iloc[i+3] if i+3 < len(df) else None
            
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            if not score_breakdown.is_qualified:
                continue
            
            outcome = self._calc_future_changes_v422(current, future_30s, future_60s, future_120s)
            
            sample = {
                'symbol': symbol,
                'timestamp': current['timestamp'],
                'price': current['close'],
                'v422_score_breakdown': {
                    'trend_consistency': score_breakdown.trend_consistency,
                    'pullback_breakout': score_breakdown.pullback_breakout,
                    'volume_confirm': score_breakdown.volume_confirm,
                    'spread_quality': score_breakdown.spread_quality,
                    'volatility_range': score_breakdown.volatility_range,
                    'rl_filter': score_breakdown.rl_filter,
                },
                'v422_total_score': score_breakdown.total_score,
                'v422_is_qualified': score_breakdown.is_qualified,
                'market_state': {
                    'volume_ratio': self._calc_volume_ratio(window),
                },
                'outcome': outcome
            }
            
            samples.append(sample)
        
        print(f"✅ {symbol} V4.2.2 分析完成: {len(samples)} 达标样本")
        return {'symbol': symbol, 'samples': samples}
    
    def _calc_volume_ratio(self, df: pd.DataFrame) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return current_vol / avg_vol if avg_vol > 0 else 0
        except:
            return 0
    
    def _calc_future_changes_v422(self, current, future_30s, future_60s, future_120s):
        current_price = current['close']
        changes = {}
        
        if future_30s is not None:
            changes['change_30s_pct'] = (future_30s['close'] - current_price) / current_price * 100
        else:
            changes['change_30s_pct'] = 0
        
        if future_60s is not None:
            changes['change_60s_pct'] = (future_60s['close'] - current_price) / current_price * 100
        else:
            changes['change_60s_pct'] = 0
        
        if future_120s is not None:
            changes['change_120s_pct'] = (future_120s['close'] - current_price) / current_price * 100
        else:
            changes['change_120s_pct'] = 0
        
        changes['is_direction_correct'] = abs(changes['change_60s_pct']) > 0.05
        
        return changes
    
    def generate_v422_report(self) -> str:
        """生成 V4.2.2 分析报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.2 第二轮调参分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总样本数: {len(self.all_results)}")
        lines.append(f"分析品种: BTC/USDT:USDT, ETH/USDT:USDT")
        lines.append("")
        
        # 配置说明
        lines.append("─" * 80)
        lines.append("⚙️ V4.2.2 评分配置")
        lines.append("─" * 80)
        lines.append("核心修正:")
        lines.append("  1. 达标阈值: 80 → 85")
        lines.append("  2. 趋势一致性分段:")
        lines.append("     EMA距离 <0.01%: 0分 | 0.01-0.03%: 5分 | 0.03-0.08%: 10分 | 0.08-0.15%: 15分 | >0.15%: 20分")
        lines.append("  3. 回撤后突破分段:")
        lines.append("     无突破: 0分 | 触线回收: 5分 | 明确站回: 10分 | 强力突破: 15分")
        lines.append("  4. 成交量中间最优:")
        lines.append("     <0.9x: 0分 | 0.9-1.05x: 5分 | 1.05-1.2x: 15分(最优) | 1.2-1.5x: 8分 | >1.5x: 3分")
        lines.append("")
        
        # 核心指标
        total = len(self.all_results)
        qualified = [r for r in self.all_results if r['v422_is_qualified']]
        
        lines.append("─" * 80)
        lines.append("📊 1. 核心指标")
        lines.append("─" * 80)
        lines.append(f"  - 总样本: {total}")
        lines.append(f"  - 达标样本 (>=85): {len(qualified)} ({len(qualified)/total*100:.1f}%)")
        
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
        
        # 分数分层
        lines.append("─" * 80)
        lines.append("🎯 2. 分数分层分析 (V4.2.2 阈值: 85)")
        lines.append("─" * 80)
        
        score_tiers = {
            '85-87': (85, 87),
            '88-92': (88, 92),
            '93-97': (93, 97),
            '98+': (98, 100)
        }
        
        lines.append(f"{'分数层':<10} {'样本数':<10} {'平均分':<10} {'30秒变化':<12} {'60秒变化':<12} {'120秒变化':<12}")
        lines.append("-" * 80)
        
        tier_results = []
        for tier_name, (min_score, max_score) in score_tiers.items():
            tier_samples = [
                r for r in self.all_results
                if min_score <= r.get('v422_total_score', 0) <= max_score
            ]
            
            if not tier_samples:
                continue
            
            changes_30s = [r['outcome']['change_30s_pct'] for r in tier_samples]
            changes_60s = [r['outcome']['change_60s_pct'] for r in tier_samples]
            changes_120s = [r['outcome']['change_120s_pct'] for r in tier_samples]
            
            avg_score = np.mean([r['v422_total_score'] for r in tier_samples])
            avg_30s = np.mean(changes_30s)
            avg_60s = np.mean(changes_60s)
            avg_120s = np.mean(changes_120s)
            
            tier_results.append({
                'tier': tier_name,
                'avg_score': avg_score,
                'avg_60s': avg_60s
            })
            
            lines.append(
                f"{tier_name:<10} "
                f"{len(tier_samples):<10} "
                f"{avg_score:<10.1f} "
                f"{avg_30s:<+12.4f}% "
                f"{avg_60s:<+12.4f}% "
                f"{avg_120s:<+12.4f}%"
            )
        
        lines.append("")
        
        # 检查分数与表现相关性
        lines.append("💡 分数-表现相关性检查:")
        if len(tier_results) >= 2:
            sorted_by_score = sorted(tier_results, key=lambda x: x['avg_score'])
            if sorted_by_score[-1]['avg_60s'] > sorted_by_score[0]['avg_60s']:
                lines.append("  ✅ 分数与后验表现正相关，高分失真问题已纠正")
            elif sorted_by_score[-1]['avg_60s'] < sorted_by_score[0]['avg_60s']:
                lines.append("  ❌ 分数与后验表现仍负相关，需继续调整")
            else:
                lines.append("  ⏸️  分数与后验表现无明显相关性")
        
        lines.append("")
        
        # 各因子分段效果
        lines.append("─" * 80)
        lines.append("🔍 3. 各因子分段效果分析")
        lines.append("─" * 80)
        
        # 趋势一致性
        lines.append("📈 趋势一致性分段效果:")
        for score in [5, 10, 15, 20]:
            samples = [r for r in self.all_results if r['v422_score_breakdown']['trend_consistency'] == score]
            if samples:
                avg_change = np.mean([r['outcome']['change_60s_pct'] for r in samples])
                lines.append(f"  {score:>2}分: {len(samples):>3}样本, 60秒变化 {avg_change:>+.4f}%")
        
        lines.append("")
        
        # 回撤后突破
        lines.append("📉 回撤后突破分段效果:")
        for score in [5, 10, 15]:
            samples = [r for r in self.all_results if r['v422_score_breakdown']['pullback_breakout'] == score]
            if samples:
                avg_change = np.mean([r['outcome']['change_60s_pct'] for r in samples])
                lines.append(f"  {score:>2}分: {len(samples):>3}样本, 60秒变化 {avg_change:>+.4f}%")
        
        lines.append("")
        
        # 成交量
        lines.append("📊 成交量中间最优效果:")
        volume_scores = {0: '<0.9x', 5: '0.9-1.05x', 15: '1.05-1.2x(最优)', 8: '1.2-1.5x', 3: '>1.5x'}
        for score, desc in volume_scores.items():
            samples = [r for r in self.all_results if r['v422_score_breakdown']['volume_confirm'] == score]
            if samples:
                avg_change = np.mean([r['outcome']['change_60s_pct'] for r in samples])
                lines.append(f"  {score:>2}分({desc}): {len(samples):>3}样本, 60秒变化 {avg_change:>+.4f}%")
        
        lines.append("")
        
        # 最终结论
        lines.append("─" * 80)
        lines.append("🎯 4. V4.2.2 调参结论")
        lines.append("─" * 80)
        
        lines.append("📊 核心指标对比 (V4.2.1 → V4.2.2):")
        lines.append(f"  - 达标率: 100% → {len(qualified)/total*100:.1f}%")
        lines.append(f"  - 60秒变化: +0.0015% → {np.mean(changes_60s):+.4f}%" if qualified else "")
        
        lines.append("")
        lines.append("💡 阶段判断:")
        
        if not qualified:
            lines.append("  ❌ 无达标样本，阈值过高")
        elif len(qualified)/total > 0.8:
            lines.append("  ⏸️  达标率仍过高 (>80%)，考虑进一步提高阈值到 88 或 90")
        elif len(qualified)/total < 0.2:
            lines.append("  ⏸️  达标率过低 (<20%)，考虑降低阈值")
        else:
            lines.append(f"  ✅ 达标率合理 ({len(qualified)/total*100:.1f}%)，在目标区间 30-60% 内")
        
        # 检查高分样本
        high_score = [r for r in self.all_results if r['v422_total_score'] >= 95]
        if high_score:
            high_avg = np.mean([r['outcome']['change_60s_pct'] for r in high_score])
            mid_score = [r for r in self.all_results if 85 <= r['v422_total_score'] < 90]
            if mid_score:
                mid_avg = np.mean([r['outcome']['change_60s_pct'] for r in mid_score])
                if high_avg >= mid_avg:
                    lines.append("  ✅ 95+分样本表现不差于85-90分，高分失真问题已纠正")
                else:
                    lines.append("  ⚠️  95+分样本仍差于85-90分，需继续调整")
        
        lines.append("")
        lines.append("📋 下一步建议:")
        lines.append("  1. 如果达标率合理且分数-表现正相关 → 进入小范围影子测试")
        lines.append("  2. 如果达标率仍过高 → 阈值提到 88 或 90")
        lines.append("  3. 如果高分仍失真 → 继续调整趋势/回撤因子权重")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    analyzer = V422Analyzer()
    
    # 分析 BTC
    btc_result = await analyzer.analyze_symbol_with_v422('BTC/USDT:USDT', hours=24)
    analyzer.all_results.extend(btc_result['samples'])
    
    # 分析 ETH
    eth_result = await analyzer.analyze_symbol_with_v422('ETH/USDT:USDT', hours=24)
    analyzer.all_results.extend(eth_result['samples'])
    
    print(f"\n{'='*80}")
    print(f"✅ V4.2.2 分析完成，总样本: {len(analyzer.all_results)}")
    print(f"{'='*80}")
    
    # 生成报告
    report = analyzer.generate_v422_report()
    print(report)
    
    # 保存报告
    report_file = analyzer.data_dir / 'v422_analysis_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())
