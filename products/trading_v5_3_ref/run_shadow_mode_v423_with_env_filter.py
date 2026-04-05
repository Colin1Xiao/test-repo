#!/usr/bin/env python3
"""
V4.2.3 影子模式 + 环境识别器 V1
验证环境过滤后策略表现
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List
import pandas as pd
import numpy as np
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class ShadowModeV423WithEnvFilter(EnhancedAnalyzer):
    """
    V4.2.3 影子模式 + 环境识别器
    对比：原始策略 vs 环境过滤策略
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        # 止损配置
        self.stop_loss_pct = -0.15
        
        # 结果存储
        self.original_results = []  # 原始策略结果
        self.filtered_results = []  # 环境过滤后结果
        self.blocked_samples = []   # 被过滤的样本
        
        print("=" * 80)
        print("🚀 V4.2.3 影子模式 + 环境识别器 V1")
        print("=" * 80)
        print("⚠️  重要提示：此版本仅在V4.2影子实验线运行")
        print("🚫 不接入V4.1执行层，不做真实下单")
        print("")
        print("📋 对比目标:")
        print("  原始策略: 无环境过滤")
        print("  过滤策略: ETH下午禁用 + 低成交量禁用 + 连续止损熔断")
        print("")
    
    def _extract_hour(self, timestamp: str) -> int:
        """提取小时"""
        try:
            if ' ' in timestamp:
                return int(timestamp.split(' ')[1].split(':')[0])
            return 0
        except:
            return 0
    
    async def collect_and_compare(self, hours: int = 24):
        """收集样本并对比两种策略"""
        for symbol in self.symbols:
            print(f"\n{'='*60}")
            print(f"📊 收集 {symbol} 样本...")
            print(f"{'='*60}")
            
            df = await self.fetch_historical_ohlcv(symbol, hours)
            if df is None or len(df) < 30:
                continue
            
            for i in range(30, len(df) - 3):
                window = df.iloc[i-30:i]
                current = df.iloc[i]
                future_30s = df.iloc[i+1] if i+1 < len(df) else None
                future_60s = df.iloc[i+2] if i+2 < len(df) else None
                future_120s = df.iloc[i+3] if i+3 < len(df) else None
                
                # V4.2.3评分
                score_breakdown = self.scoring_engine.calculate_score(
                    ohlcv_df=window,
                    current_price=current['close'],
                    spread_bps=2.0,
                    rl_decision='ALLOW'
                )
                
                if not score_breakdown.is_qualified:
                    continue
                
                outcome = self._calc_outcome(current, future_30s, future_60s, future_120s)
                
                # 构建样本
                sample = {
                    'symbol': symbol,
                    'timestamp': str(current['timestamp']),
                    'price': float(current['close']),
                    'v423_total_score': score_breakdown.total_score,
                    'market_state': {
                        'volume_ratio': self._calc_volume_ratio(window),
                    },
                    'outcome': outcome
                }
                
                # 原始策略结果
                original_return = outcome['change_60s_pct']
                if original_return < self.stop_loss_pct:
                    original_return = self.stop_loss_pct
                
                self.original_results.append({
                    **sample,
                    'return_60s': original_return
                })
                
                # 环境过滤检查
                hour = self._extract_hour(sample['timestamp'])
                context = EnvironmentContext(
                    symbol=symbol,
                    timestamp=sample['timestamp'],
                    hour=hour,
                    volume_ratio=sample['market_state']['volume_ratio'],
                    consecutive_stop_loss=self.env_filter.consecutive_losses
                )
                
                filter_result = self.env_filter.evaluate(context)
                
                if filter_result.decision == "ALLOW":
                    # 记录交易结果
                    self.env_filter.record_trade(
                        symbol=symbol,
                        pnl_pct=original_return,
                        timestamp=sample['timestamp']
                    )
                    
                    self.filtered_results.append({
                        **sample,
                        'return_60s': original_return,
                        'env_filter_passed': True
                    })
                else:
                    # 被过滤
                    self.blocked_samples.append({
                        **sample,
                        'return_60s': original_return,
                        'filter_decision': filter_result.decision,
                        'filter_reason': filter_result.reason,
                        'filter_rule': filter_result.rule_triggered
                    })
            
            print(f"✅ {symbol} 收集完成")
    
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
        
        if future_60s is not None:
            outcome['change_60s_pct'] = float((future_60s['close'] - current_price) / current_price * 100)
        else:
            outcome['change_60s_pct'] = 0.0
        
        return outcome
    
    def generate_comparison_report(self) -> str:
        """生成对比报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2.3 环境过滤效果对比报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 基础统计
        lines.append("─" * 80)
        lines.append("📈 基础统计")
        lines.append("─" * 80)
        
        orig_returns = [r['return_60s'] for r in self.original_results]
        filt_returns = [r['return_60s'] for r in self.filtered_results]
        
        orig_returns = np.array(orig_returns)
        filt_returns = np.array(filt_returns)
        
        lines.append(f"{'指标':<25} {'原始策略':<20} {'过滤策略':<20} {'变化':<15}")
        lines.append("-" * 80)
        lines.append(f"{'样本数':<25} {len(orig_returns):<20} {len(filt_returns):<20} {len(filt_returns)-len(orig_returns):<+15}")
        lines.append(f"{'均值':<25} {np.mean(orig_returns):>+.4f}%{'':<12} {np.mean(filt_returns):>+.4f}%{'':<12} {np.mean(filt_returns)-np.mean(orig_returns):>+.4f}%")
        lines.append(f"{'中位数':<25} {np.median(orig_returns):>+.4f}%{'':<12} {np.median(filt_returns):>+.4f}%{'':<12} {np.median(filt_returns)-np.median(orig_returns):>+.4f}%")
        lines.append(f"{'标准差':<25} {np.std(orig_returns):>.4f}%{'':<12} {np.std(filt_returns):>.4f}%{'':<12} {np.std(filt_returns)-np.std(orig_returns):>.4f}%")
        lines.append(f"{'最小值':<25} {np.min(orig_returns):>+.4f}%{'':<12} {np.min(filt_returns):>+.4f}%{'':<12} -")
        lines.append(f"{'最大值':<25} {np.max(orig_returns):>+.4f}%{'':<12} {np.max(filt_returns):>+.4f}%{'':<12} -")
        
        # 盈亏比
        orig_profits = orig_returns[orig_returns > 0]
        orig_losses = orig_returns[orig_returns < 0]
        orig_pl = np.mean(orig_profits) / abs(np.mean(orig_losses)) if len(orig_losses) > 0 else 0
        
        filt_profits = filt_returns[filt_returns > 0]
        filt_losses = filt_returns[filt_returns < 0]
        filt_pl = np.mean(filt_profits) / abs(np.mean(filt_losses)) if len(filt_losses) > 0 else 0
        
        lines.append(f"{'盈亏比':<25} {orig_pl:>.2f}{'':<17} {filt_pl:>.2f}{'':<17} {filt_pl-orig_pl:>+.2f}")
        
        # 胜率
        orig_win_rate = len(orig_profits) / len(orig_returns) * 100
        filt_win_rate = len(filt_profits) / len(filt_returns) * 100
        lines.append(f"{'胜率':<25} {orig_win_rate:>.1f}%{'':<15} {filt_win_rate:>.1f}%{'':<15} {filt_win_rate-orig_win_rate:>+.1f}%")
        
        lines.append("")
        
        # 过滤效果
        lines.append("─" * 80)
        lines.append("🚫 过滤效果分析")
        lines.append("─" * 80)
        
        total_samples = len(self.original_results)
        passed_samples = len(self.filtered_results)
        blocked_samples = len(self.blocked_samples)
        
        lines.append(f"总样本: {total_samples}")
        lines.append(f"通过过滤: {passed_samples} ({passed_samples/total_samples*100:.1f}%)")
        lines.append(f"被过滤: {blocked_samples} ({blocked_samples/total_samples*100:.1f}%)")
        lines.append("")
        
        # 按规则统计
        if self.blocked_samples:
            lines.append("按过滤规则:")
            rule_counts = {}
            for s in self.blocked_samples:
                rule = s.get('filter_rule', 'UNKNOWN')
                rule_counts[rule] = rule_counts.get(rule, 0) + 1
            
            for rule, count in sorted(rule_counts.items(), key=lambda x: -x[1]):
                lines.append(f"  {rule}: {count} 次")
        
        lines.append("")
        
        # 关键结论
        lines.append("=" * 80)
        lines.append("🎯 关键结论")
        lines.append("=" * 80)
        
        if np.mean(filt_returns) > np.mean(orig_returns):
            lines.append("✅ 过滤后均值提升")
        
        if filt_pl > orig_pl:
            lines.append("✅ 过滤后盈亏比提升")
        
        if np.std(filt_returns) < np.std(orig_returns):
            lines.append("✅ 过滤后标准差降低（风险收敛）")
        
        if np.mean(filt_returns) > 0 and filt_pl >= 1.0:
            lines.append("🎉 过滤后策略进入稳定正期望区间！")
        
        lines.append("")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    shadow = ShadowModeV423WithEnvFilter()
    
    # 收集并对比
    await shadow.collect_and_compare(hours=24)
    
    # 生成报告
    report = shadow.generate_comparison_report()
    print(report)
    
    # 保存报告
    report_file = shadow.data_dir / 'shadow_v423_env_filter_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 对比报告已保存: {report_file}")
    
    print("\n" + "=" * 80)
    print("⚠️  重要提醒：V4.2.3+环境识别器仅在影子实验线运行")
    print("🚫 不接入V4.1执行层")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
