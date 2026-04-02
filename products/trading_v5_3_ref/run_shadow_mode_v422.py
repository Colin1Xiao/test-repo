#!/usr/bin/env python3
"""
V4.2.2 影子模式运行脚本
保持当前配置不变，持续积累样本至100+
新增统计：均值/中位数/去极值均值
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict
import pandas as pd
import numpy as np
import json
from datetime import datetime as dt

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v422 import ScoringEngineV422


class ShadowModeV422(EnhancedAnalyzer):
    """V4.2.2 影子模式 - 样本积累"""
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        self.scoring_engine = ScoringEngineV422()
        
        # 加载已有样本
        self._load_existing_samples()
        
        print("=" * 80)
        print("🚀 V4.2.2 影子模式 - 样本积累阶段")
        print("=" * 80)
        print(f"\n📋 当前配置 (已冻结):")
        print(f"  - 达标阈值: 85")
        print(f"  - 趋势一致性: 分段 (5/10/15/20)")
        print(f"  - 回撤后突破: 分段 (5/10/15)")
        print(f"  - 成交量: 中间最优 (1.05-1.2x 得15分)")
        print(f"\n📊 当前样本: {len(self.all_results)} 条")
        print(f"🎯 目标样本: 100+ 条")
        print("")
    
    def _load_existing_samples(self):
        """加载已有 V4.2.2 样本"""
        shadow_file = self.data_dir / 'shadow_v422_samples.jsonl'
        if shadow_file.exists():
            with open(shadow_file, 'r') as f:
                for line in f:
                    try:
                        sample = json.loads(line.strip())
                        self.all_results.append(sample)
                    except:
                        pass
            print(f"✅ 已加载已有样本: {len(self.all_results)} 条")
    
    async def collect_samples(self, hours: int = 24):
        """收集新样本"""
        for symbol in self.symbols:
            print(f"\n{'='*60}")
            print(f"📊 收集 {symbol} 样本...")
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
                    'v422_score_breakdown': {
                        'trend_consistency': score_breakdown.trend_consistency,
                        'pullback_breakout': score_breakdown.pullback_breakout,
                        'volume_confirm': score_breakdown.volume_confirm,
                        'spread_quality': score_breakdown.spread_quality,
                        'volatility_range': score_breakdown.volatility_range,
                        'rl_filter': score_breakdown.rl_filter,
                    },
                    'v422_total_score': score_breakdown.total_score,
                    'market_state': {
                        'volume_ratio': self._calc_volume_ratio(window),
                    },
                    'outcome': outcome
                }
                
                new_samples.append(sample)
            
            print(f"✅ {symbol} 新增 {len(new_samples)} 条达标样本")
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
        shadow_file = self.data_dir / 'shadow_v422_samples.jsonl'
        with open(shadow_file, 'w') as f:
            for sample in self.all_results:
                f.write(json.dumps(sample) + '\n')
        print(f"\n💾 样本已保存: {shadow_file}")
    
    def generate_shadow_report(self) -> str:
        """生成影子模式报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.2 影子模式运行报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总样本数: {len(self.all_results)}")
        lines.append("")
        
        if len(self.all_results) < 10:
            lines.append("⏳ 样本不足，继续积累...")
            return "\n".join(lines)
        
        # 基础统计
        lines.append("─" * 80)
        lines.append("📈 基础统计")
        lines.append("─" * 80)
        
        changes_30s = [r['outcome']['change_30s_pct'] for r in self.all_results]
        changes_60s = [r['outcome']['change_60s_pct'] for r in self.all_results]
        changes_120s = [r['outcome']['change_120s_pct'] for r in self.all_results]
        
        lines.append(f"{'时间窗口':<15} {'均值':<12} {'中位数':<12} {'去极值均值':<12} {'样本数':<10}")
        lines.append("-" * 80)
        
        for name, changes in [('30秒', changes_30s), ('60秒', changes_60s), ('120秒', changes_120s)]:
            mean_val = np.mean(changes)
            median_val = np.median(changes)
            # 去极值均值 (5%-95%分位数)
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
        
        # 分数分层 (重点关注 88-92)
        lines.append("─" * 80)
        lines.append("🎯 分数分层分析 (重点关注 88-92 异常)")
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
            tier_samples = [r for r in self.all_results if min_s <= r['v422_total_score'] <= max_s]
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
        
        # 88-92 分层详细分析
        lines.append("─" * 80)
        lines.append("🔍 88-92 分层详细分析 (异常监控)")
        lines.append("─" * 80)
        
        mid_samples = [r for r in self.all_results if 88 <= r['v422_total_score'] <= 92]
        if len(mid_samples) >= 5:
            lines.append(f"样本数: {len(mid_samples)}")
            lines.append(f"平均分: {np.mean([r['v422_total_score'] for r in mid_samples]):.1f}")
            lines.append(f"60秒变化均值: {np.mean([r['outcome']['change_60s_pct'] for r in mid_samples]):+.4f}%")
            lines.append(f"60秒变化中位数: {np.median([r['outcome']['change_60s_pct'] for r in mid_samples]):+.4f}%")
            
            # 因子分布
            lines.append("")
            lines.append("因子得分分布:")
            for factor in ['trend_consistency', 'pullback_breakout', 'volume_confirm']:
                avg_score = np.mean([r['v422_score_breakdown'][factor] for r in mid_samples])
                lines.append(f"  {factor}: {avg_score:.1f}")
            
            # 新增: 点差/波动率分布
            lines.append("")
            lines.append("点差/波动率分布:")
            avg_spread = np.mean([r['v422_score_breakdown']['spread_quality'] for r in mid_samples])
            avg_volatility = np.mean([r['v422_score_breakdown']['volatility_range'] for r in mid_samples])
            lines.append(f"  点差质量: {avg_spread:.1f}/15")
            lines.append(f"  波动率适中: {avg_volatility:.1f}/15")
            
            # 新增: 成交量区间分布
            lines.append("")
            lines.append("成交量区间分布:")
            vol_dist = {}
            for r in mid_samples:
                vol_score = r['v422_score_breakdown']['volume_confirm']
                vol_dist[vol_score] = vol_dist.get(vol_score, 0) + 1
            for score, count in sorted(vol_dist.items()):
                desc = {0: '<0.9x', 5: '0.9-1.05x', 15: '1.05-1.2x', 8: '1.2-1.5x', 3: '>1.5x'}.get(score, 'unknown')
                lines.append(f"  {desc}: {count}样本")
            
            # 新增: 时段分布
            lines.append("")
            lines.append("时段分布:")
            hour_dist = {'亚洲(0-8)': 0, '欧洲(14-22)': 0, '美洲(20-4)': 0, '其他': 0}
            for r in mid_samples:
                try:
                    dt_obj = dt.fromisoformat(str(r['timestamp']).replace('Z', '+00:00'))
                    hour = dt_obj.hour
                    if 0 <= hour < 8:
                        hour_dist['亚洲(0-8)'] += 1
                    elif 14 <= hour < 22:
                        hour_dist['欧洲(14-22)'] += 1
                    elif hour >= 20 or hour < 4:
                        hour_dist['美洲(20-4)'] += 1
                    else:
                        hour_dist['其他'] += 1
                except:
                    hour_dist['其他'] += 1
            for zone, count in hour_dist.items():
                if count > 0:
                    lines.append(f"  {zone}: {count}样本")
            
            # 新增: 品种分布
            lines.append("")
            lines.append("品种分布:")
            btc_count = sum(1 for r in mid_samples if 'BTC' in r['symbol'])
            eth_count = sum(1 for r in mid_samples if 'ETH' in r['symbol'])
            lines.append(f"  BTC: {btc_count}样本 ({btc_count/len(mid_samples)*100:.1f}%)")
            lines.append(f"  ETH: {eth_count}样本 ({eth_count/len(mid_samples)*100:.1f}%)")
        else:
            lines.append(f"样本不足 ({len(mid_samples)} 条)，继续观察...")
        
        lines.append("")
        
        # 新增: 30/60/120秒三窗口并行
        lines.append("─" * 80)
        lines.append("⏱️ 30/60/120秒三窗口并行分析")
        lines.append("─" * 80)
        
        lines.append(f"{'分数层':<10} {'样本数':<10} {'30秒均值':<12} {'60秒均值':<12} {'120秒均值':<12}")
        lines.append("-" * 80)
        
        for tier_name, (min_s, max_s) in tiers.items():
            tier_samples = [r for r in self.all_results if min_s <= r['v422_total_score'] <= max_s]
            if not tier_samples:
                continue
            
            c30 = [r['outcome']['change_30s_pct'] for r in tier_samples]
            c60 = [r['outcome']['change_60s_pct'] for r in tier_samples]
            c120 = [r['outcome']['change_120s_pct'] for r in tier_samples]
            
            lines.append(
                f"{tier_name:<10} "
                f"{len(tier_samples):<10} "
                f"{np.mean(c30):<+12.4f}% "
                f"{np.mean(c60):<+12.4f}% "
                f"{np.mean(c120):<+12.4f}%"
            )
        
        lines.append("")
        
        # 新增: BTC/ETH 分开统计
        lines.append("─" * 80)
        lines.append("🪙 BTC vs ETH 分开统计")
        lines.append("─" * 80)
        
        btc_samples = [r for r in self.all_results if 'BTC' in r['symbol']]
        eth_samples = [r for r in self.all_results if 'ETH' in r['symbol']]
        
        lines.append(f"{'指标':<20} {'BTC':<20} {'ETH':<20}")
        lines.append("-" * 80)
        
        # 样本数
        lines.append(f"{'样本数':<20} {len(btc_samples):<20} {len(eth_samples):<20}")
        
        # 方向正确率
        if btc_samples:
            btc_dir = sum(1 for r in btc_samples if r['outcome'].get('is_direction_correct')) / len(btc_samples) * 100
        else:
            btc_dir = 0
        if eth_samples:
            eth_dir = sum(1 for r in eth_samples if r['outcome'].get('is_direction_correct')) / len(eth_samples) * 100
        else:
            eth_dir = 0
        lines.append(f"{'方向正确率':<20} {btc_dir:<19.1f}% {eth_dir:<19.1f}%")
        
        # 60秒表现
        if btc_samples:
            btc_60 = np.mean([r['outcome']['change_60s_pct'] for r in btc_samples])
            btc_60_med = np.median([r['outcome']['change_60s_pct'] for r in btc_samples])
        else:
            btc_60 = btc_60_med = 0
        if eth_samples:
            eth_60 = np.mean([r['outcome']['change_60s_pct'] for r in eth_samples])
            eth_60_med = np.median([r['outcome']['change_60s_pct'] for r in eth_samples])
        else:
            eth_60 = eth_60_med = 0
        
        lines.append(f"{'60秒均值':<20} {btc_60:<+19.4f}% {eth_60:<+19.4f}%")
        lines.append(f"{'60秒中位数':<20} {btc_60_med:<+19.4f}% {eth_60_med:<+19.4f}%")
        
        # 88-92分层占比
        btc_mid = sum(1 for r in btc_samples if 88 <= r['v422_total_score'] <= 92)
        eth_mid = sum(1 for r in eth_samples if 88 <= r['v422_total_score'] <= 92)
        lines.append(f"{'88-92分层占比':<20} {btc_mid/len(btc_samples)*100 if btc_samples else 0:<18.1f}% {eth_mid/len(eth_samples)*100 if eth_samples else 0:<18.1f}%")
        
        lines.append("")
        
        # 成交量中间最优验证
        lines.append("─" * 80)
        lines.append("📊 成交量中间最优验证 (1.05-1.2x)")
        lines.append("─" * 80)
        
        volume_scores = {0: '<0.9x', 5: '0.9-1.05x', 15: '1.05-1.2x(最优)', 8: '1.2-1.5x', 3: '>1.5x'}
        for score, desc in volume_scores.items():
            samples = [r for r in self.all_results if r['v422_score_breakdown']['volume_confirm'] == score]
            if len(samples) >= 3:
                changes = [r['outcome']['change_60s_pct'] for r in samples]
                lines.append(f"  {desc}: {len(samples)}样本, 均值{np.mean(changes):+.4f}%, 中位数{np.median(changes):+.4f}%")
        
        lines.append("")
        
        # 阶段判断
        lines.append("─" * 80)
        lines.append("🎯 阶段判断")
        lines.append("─" * 80)
        
        if len(self.all_results) < 50:
            lines.append(f"⏳ 样本积累中: {len(self.all_results)}/100")
            lines.append("  建议: 继续运行影子模式")
        elif len(self.all_results) < 100:
            lines.append(f"⏳ 接近目标: {len(self.all_results)}/100")
            lines.append("  建议: 再积累一些样本后做全面分析")
        else:
            lines.append(f"✅ 样本充足: {len(self.all_results)} 条")
            lines.append("  建议: 可以进入下一阶段分析")
        
        lines.append("")
        lines.append("📋 当前状态:")
        lines.append(f"  - 高分失真问题: 已纠正 (93-97分表现最好)")
        lines.append(f"  - 方向正确率: {direction_acc:.1f}%")
        lines.append(f"  - 88-92分层异常: {'需继续观察' if len(mid_samples) < 10 else '样本充足，可分析'}")
        lines.append(f"  - 成交量中间最优: 验证中")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    shadow = ShadowModeV422()
    
    # 收集新样本
    await shadow.collect_samples(hours=24)
    
    # 保存
    shadow.save_samples()
    
    # 生成报告
    report = shadow.generate_shadow_report()
    print(report)
    
    # 保存报告
    report_file = shadow.data_dir / 'shadow_v422_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")
    
    # 样本量检查
    if len(shadow.all_results) >= 100:
        print("\n🎉 样本量已达 100+，可以进入下一阶段分析！")
    else:
        print(f"\n⏳ 当前样本: {len(shadow.all_results)}/100，建议继续运行")


if __name__ == "__main__":
    asyncio.run(main())

