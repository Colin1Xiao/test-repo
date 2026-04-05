#!/usr/bin/env python3
"""
信号流调试工具
定位：为什么没有信号产生？
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class SignalFlowDebugger(EnhancedAnalyzer):
    """
    信号流调试器
    
    输出关键信息：
    1. Score分布（看是否有>85的信号）
    2. Volume_ratio（看是否被过滤）
    3. Hour（看时区是否正确）
    4. Block reason（看被拦截原因）
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        # 统计
        self.stats = {
            'total_checks': 0,
            'score_distribution': [],
            'volume_ratios': [],
            'hours': [],
            'block_reasons': {},
            'high_score_signals': []  # score > 85
        }
        
        print("=" * 80)
        print("🔍 信号流调试工具")
        print("=" * 80)
        print("目标: 定位为什么没有信号产生")
        print("")
    
    def _extract_hour(self, timestamp: str) -> int:
        try:
            if ' ' in timestamp:
                hour = int(timestamp.split(' ')[1].split(':')[0])
                return hour
            return 0
        except:
            return 0
    
    def _calc_volume_ratio(self, df) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    async def debug_cycle(self):
        """调试一个周期"""
        for symbol in self.symbols:
            df = await self.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 30:
                continue
            
            current = df.iloc[-1]
            window = df.tail(30)
            
            # 1. 评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            score = score_breakdown.total_score
            self.stats['score_distribution'].append(score)
            self.stats['total_checks'] += 1
            
            # 2. 环境参数
            hour = self._extract_hour(str(current['timestamp']))
            volume_ratio = self._calc_volume_ratio(window)
            
            self.stats['hours'].append(hour)
            self.stats['volume_ratios'].append(volume_ratio)
            
            # 3. 环境过滤检查
            context = EnvironmentContext(
                symbol=symbol,
                timestamp=str(current['timestamp']),
                hour=hour,
                volume_ratio=volume_ratio,
                consecutive_stop_loss=self.env_filter.consecutive_losses
            )
            
            filter_result = self.env_filter.evaluate(context)
            
            # 记录高评分信号
            if score >= 85:
                signal_info = {
                    'symbol': symbol,
                    'timestamp': str(current['timestamp']),
                    'score': score,
                    'hour': hour,
                    'volume_ratio': volume_ratio,
                    'filter_decision': filter_result.decision,
                    'filter_reason': filter_result.reason if filter_result.decision != "ALLOW" else "PASSED"
                }
                self.stats['high_score_signals'].append(signal_info)
            
            # 记录被过滤原因
            if filter_result.decision != "ALLOW":
                reason = filter_result.rule_triggered
                self.stats['block_reasons'][reason] = self.stats['block_reasons'].get(reason, 0) + 1
            
            # 实时输出
            status = "✅" if score >= 85 else "❌"
            filter_status = "🚫 BLOCKED" if filter_result.decision != "ALLOW" else "✅ ALLOWED"
            
            print(f"{status} {symbol} | Score: {score:2d}/100 | Hour: {hour:2d} | Vol: {volume_ratio:.2f}x | {filter_status}")
            
            if filter_result.decision != "ALLOW":
                print(f"   🚫 Blocked: {filter_result.reason}")
    
    def generate_debug_report(self) -> str:
        """生成调试报告"""
        import numpy as np
        
        lines = []
        lines.append("=" * 80)
        lines.append("🔍 信号流调试报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总检查次数: {self.stats['total_checks']}")
        lines.append("")
        
        # 1. Score分布
        lines.append("─" * 80)
        lines.append("📊 Score分布")
        lines.append("─" * 80)
        
        scores = self.stats['score_distribution']
        if scores:
            lines.append(f"最小值: {min(scores)}")
            lines.append(f"最大值: {max(scores)}")
            lines.append(f"平均值: {np.mean(scores):.1f}")
            lines.append(f"中位数: {np.median(scores):.1f}")
            
            # 分数段统计
            ranges = [
                (0, 60, "0-60"),
                (60, 70, "60-70"),
                (70, 80, "70-80"),
                (80, 85, "80-85"),
                (85, 90, "85-90"),
                (90, 100, "90-100")
            ]
            
            lines.append("")
            lines.append("分数段分布:")
            for min_s, max_s, label in ranges:
                count = sum(1 for s in scores if min_s <= s < max_s)
                pct = count / len(scores) * 100
                marker = "🔥" if min_s >= 85 else ""
                lines.append(f"  {label}: {count:3d} ({pct:5.1f}%) {marker}")
            
            high_score_count = sum(1 for s in scores if s >= 85)
            lines.append("")
            lines.append(f"🎯 >=85分信号: {high_score_count} 个")
        
        lines.append("")
        
        # 2. 环境参数
        lines.append("─" * 80)
        lines.append("📊 环境参数")
        lines.append("─" * 80)
        
        hours = self.stats['hours']
        if hours:
            lines.append(f"Hour范围: {min(hours)} - {max(hours)}")
            lines.append(f"当前Hour: {hours[-1] if hours else 'N/A'}")
            
            # 时段分布
            morning = sum(1 for h in hours if 6 <= h < 12)
            afternoon = sum(1 for h in hours if 12 <= h < 18)
            evening = sum(1 for h in hours if 18 <= h < 24)
            night = sum(1 for h in hours if 0 <= h < 6)
            
            lines.append("")
            lines.append("时段分布:")
            lines.append(f"  上午(6-12): {morning}")
            lines.append(f"  下午(12-18): {afternoon} ⚠️ ETH过滤时段")
            lines.append(f"  晚上(18-24): {evening}")
            lines.append(f"  凌晨(0-6): {night}")
        
        vol_ratios = self.stats['volume_ratios']
        if vol_ratios:
            lines.append("")
            lines.append(f"Volume_ratio范围: {min(vol_ratios):.2f} - {max(vol_ratios):.2f}")
            lines.append(f"当前Volume_ratio: {vol_ratios[-1]:.2f}")
            
            low_vol = sum(1 for v in vol_ratios if v < 1.05)
            lines.append(f"低成交量(<1.05x): {low_vol} ({low_vol/len(vol_ratios)*100:.1f}%)")
        
        lines.append("")
        
        # 3. 过滤统计
        lines.append("─" * 80)
        lines.append("🚫 过滤统计")
        lines.append("─" * 80)
        
        if self.stats['block_reasons']:
            for reason, count in sorted(self.stats['block_reasons'].items(), key=lambda x: -x[1]):
                lines.append(f"  {reason}: {count}")
        else:
            lines.append("  无过滤记录")
        
        lines.append("")
        
        # 4. 高评分信号详情
        if self.stats['high_score_signals']:
            lines.append("─" * 80)
            lines.append("🔥 高评分信号详情 (>=85分)")
            lines.append("─" * 80)
            
            for i, sig in enumerate(self.stats['high_score_signals'][:10], 1):
                lines.append(f"\n信号 {i}:")
                lines.append(f"  品种: {sig['symbol']}")
                lines.append(f"  时间: {sig['timestamp']}")
                lines.append(f"  分数: {sig['score']}")
                lines.append(f"  时段: {sig['hour']}")
                lines.append(f"  成交量: {sig['volume_ratio']:.2f}x")
                lines.append(f"  过滤结果: {sig['filter_decision']}")
                if sig['filter_reason']:
                    lines.append(f"  过滤原因: {sig['filter_reason']}")
        else:
            lines.append("─" * 80)
            lines.append("🔥 高评分信号详情")
            lines.append("─" * 80)
            lines.append("  无 >=85分信号")
        
        lines.append("")
        
        # 5. 结论
        lines.append("=" * 80)
        lines.append("🎯 诊断结论")
        lines.append("=" * 80)
        
        high_score_count = len(self.stats['high_score_signals'])
        total_checks = self.stats['total_checks']
        
        if high_score_count == 0:
            lines.append("❌ 未发现 >=85分信号")
            lines.append("")
            lines.append("可能原因:")
            lines.append("  1. 当前市场条件不满足V4.2.3评分标准")
            lines.append("  2. 数据源有问题（检查数据更新）")
            lines.append("  3. 评分阈值过高（但不建议降低）")
            lines.append("")
            lines.append("建议: 继续观察，或检查数据流")
        else:
            passed_count = sum(1 for s in self.stats['high_score_signals'] if s['filter_decision'] == 'ALLOW')
            blocked_count = high_score_count - passed_count
            
            lines.append(f"✅ 发现 {high_score_count} 个 >=85分信号")
            lines.append(f"   通过过滤: {passed_count}")
            lines.append(f"   被拦截: {blocked_count}")
            lines.append("")
            
            if blocked_count > passed_count:
                lines.append("⚠️  过滤拦截率过高，检查过滤条件")
            else:
                lines.append("✅ 过滤比例正常")
        
        lines.append("")
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    debugger = SignalFlowDebugger()
    
    print("🚀 启动信号流调试...")
    print("运行20个周期，收集数据...\n")
    
    for i in range(20):
        print(f"--- 周期 {i+1}/20 ---")
        await debugger.debug_cycle()
        await asyncio.sleep(0.5)
    
    # 生成报告
    report = debugger.generate_debug_report()
    print("\n" + report)
    
    # 保存报告
    report_file = debugger.data_dir / 'signal_flow_debug_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())
