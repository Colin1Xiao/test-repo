#!/usr/bin/env python3
"""
Shadow Statistics Analyzer - 影子模式统计分析器
对比 V4.1 和 V4.2，生成四类核心统计
"""

import json
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ShadowStatisticsAnalyzer:
    """影子模式统计分析器"""
    
    def __init__(self, data_file: str = None):
        """初始化统计分析器"""
        self.data_file = data_file or Path(__file__).parent.parent / 'data' / 'shadow_signals.jsonl'
        self.records = []
        self.stats = {}
        
        # 加载数据
        self._load_data()
        
        logger.info(f"✅ 统计分析器初始化完成，加载 {len(self.records)} 条记录")
    
    def _load_data(self):
        """加载候选信号数据"""
        try:
            if Path(self.data_file).exists():
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            self.records.append(json.loads(line))
        except Exception as e:
            logger.error(f"加载数据失败: {e}")
    
    def generate_full_report(self, hours: int = 6) -> str:
        """生成完整对比报告"""
        report = []
        report.append("=" * 70)
        report.append("📊 V4.1 vs V4.2 影子对比报告")
        report.append("=" * 70)
        report.append(f"统计时间窗口: 最近 {hours} 小时")
        report.append(f"数据记录数: {len(self.records)} 条")
        report.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # 1. 候选信号频率统计
        report.append(self._gen_signal_frequency_report(hours))
        report.append("")
        
        # 2. 与 V4.1 规则信号差异统计
        report.append(self._gen_v41_comparison_report())
        report.append("")
        
        # 3. 分项得分分布统计
        report.append(self._gen_score_breakdown_report())
        report.append("")
        
        # 4. 候选信号后验跟踪
        report.append(self._gen_signal_outcome_report())
        report.append("")
        
        # 5. 结论与建议
        report.append(self._gen_conclusion_report())
        
        report.append("=" * 70)
        
        return "\n".join(report)
    
    def _gen_signal_frequency_report(self, hours: int) -> str:
        """生成候选信号频率报告"""
        lines = []
        lines.append("─" * 70)
        lines.append("📈 1. 候选信号频率统计")
        lines.append("─" * 70)
        
        if not self.records:
            lines.append("⚠️  无数据")
            return "\n".join(lines)
        
        # 统计
        total_evaluations = len(self.records)
        qualified_signals = sum(1 for r in self.records if r.get('v42_is_qualified', False))
        rejected_signals = total_evaluations - qualified_signals
        qualified_rate = (qualified_signals / total_evaluations * 100) if total_evaluations > 0 else 0
        
        # 每小时统计
        hourly_stats = self._get_hourly_stats(hours)
        
        lines.append(f"总评估次数: {total_evaluations}")
        lines.append(f"达标信号数: {qualified_signals}")
        lines.append(f"拒绝信号数: {rejected_signals}")
        lines.append(f"达标率: {qualified_rate:.1f}%")
        lines.append("")
        lines.append("每小时候选信号数:")
        
        for hour, stats in sorted(hourly_stats.items()):
            lines.append(f"  {hour}: 评估 {stats['total']} 次 | 达标 {stats['qualified']} 次")
        
        # 回答问题
        lines.append("")
        lines.append("💡 分析结论:")
        if qualified_rate > 30:
            lines.append("  - V4.2 评分标准相对宽松，候选信号较多")
            lines.append("  - 可能适合高频小波段交易场景")
        elif qualified_rate > 10:
            lines.append("  - V4.2 评分标准适中，有一定候选信号")
            lines.append("  - 需要观察后续表现判断有效性")
        else:
            lines.append("  - V4.2 评分标准严格，候选信号稀少")
            lines.append("  - 可能过于保守，需要调整阈值")
        
        return "\n".join(lines)
    
    def _gen_v41_comparison_report(self) -> str:
        """生成与 V4.1 规则信号差异报告"""
        lines = []
        lines.append("─" * 70)
        lines.append("🔄 2. 与 V4.1 规则信号差异统计")
        lines.append("─" * 70)
        
        if not self.records:
            lines.append("⚠️  无数据")
            return "\n".join(lines)
        
        # 统计差异
        v41_none_v42_qualified = 0  # V4.1无信号但V4.2达标
        v41_signal_v42_not_qualified = 0  # V4.1有信号但V4.2不达标
        both_agree = 0  # 两者一致
        both_disagree = 0  # 两者反向
        
        for r in self.records:
            rule_signal = r.get('rule_signal', 'HOLD')
            v42_qualified = r.get('v42_is_qualified', False)
            
            rule_has_signal = rule_signal in ['BUY', 'SELL', 'STRONG_BUY', 'STRONG_SELL']
            
            if not rule_has_signal and v42_qualified:
                v41_none_v42_qualified += 1
            elif rule_has_signal and not v42_qualified:
                v41_signal_v42_not_qualified += 1
            elif rule_has_signal and v42_qualified:
                both_agree += 1
        
        lines.append(f"V4.1无信号，但V4.2达标: {v41_none_v42_qualified} 次")
        lines.append(f"V4.1有信号，但V4.2不达标: {v41_signal_v42_not_qualified} 次")
        lines.append(f"两者同时看多/看空: {both_agree} 次")
        lines.append("")
        
        # 回答问题
        lines.append("💡 分析结论:")
        if v41_none_v42_qualified > v41_signal_v42_not_qualified:
            lines.append("  - V4.2 主要在**补机会**，捕获了更多潜在信号")
            lines.append("  - 评分标准可能比V4.1规则更敏感")
        elif v41_signal_v42_not_qualified > v41_none_v42_qualified:
            lines.append("  - V4.2 主要在**过滤噪音**，拒绝了部分V4.1信号")
            lines.append("  - 评分标准比V4.1规则更严格")
        else:
            lines.append("  - V4.1 和 V4.2 信号基本一致")
            lines.append("  - 评分逻辑与规则逻辑相似")
        
        return "\n".join(lines)
    
    def _gen_score_breakdown_report(self) -> str:
        """生成分项得分分布报告"""
        lines = []
        lines.append("─" * 70)
        lines.append("📊 3. 分项得分分布统计")
        lines.append("─" * 70)
        
        if not self.records:
            lines.append("⚠️  无数据")
            return "\n".join(lines)
        
        # 统计各因子得分
        factors = [
            'trend_consistency',
            'pullback_breakout', 
            'volume_confirm',
            'spread_quality',
            'volatility_range',
            'rl_filter'
        ]
        
        factor_names = {
            'trend_consistency': '趋势一致性',
            'pullback_breakout': '回撤后突破',
            'volume_confirm': '成交量确认',
            'spread_quality': '点差质量',
            'volatility_range': '波动率适中',
            'rl_filter': 'RL过滤'
        }
        
        max_scores = {
            'trend_consistency': 30,
            'pullback_breakout': 20,
            'volume_confirm': 15,
            'spread_quality': 15,
            'volatility_range': 10,
            'rl_filter': 10
        }
        
        factor_stats = {}
        zero_count = {}
        
        for factor in factors:
            scores = [r.get('v42_score_breakdown', {}).get(factor, 0) for r in self.records]
            qualified_scores = [
                r.get('v42_score_breakdown', {}).get(factor, 0) 
                for r in self.records 
                if r.get('v42_is_qualified', False)
            ]
            
            factor_stats[factor] = {
                'avg': sum(scores) / len(scores) if scores else 0,
                'avg_qualified': sum(qualified_scores) / len(qualified_scores) if qualified_scores else 0,
                'zero_count': sum(1 for s in scores if s == 0)
            }
            
            zero_count[factor] = factor_stats[factor]['zero_count']
        
        # 输出表格
        lines.append(f"{'因子':<15} {'权重':<8} {'平均分':<10} {'达标样本均分':<12} {'零分次数':<10}")
        lines.append("-" * 70)
        
        for factor in factors:
            stats = factor_stats[factor]
            max_score = max_scores[factor]
            lines.append(
                f"{factor_names[factor]:<12} "
                f"{max_score:<8} "
                f"{stats['avg']:<10.1f} "
                f"{stats['avg_qualified']:<12.1f} "
                f"{stats['zero_count']:<10}"
            )
        
        # 找出最常拖后腿的因子
        worst_factor = max(zero_count.items(), key=lambda x: x[1])
        
        lines.append("")
        lines.append("💡 分析结论:")
        lines.append(f"  - 最常拖后腿的因子: **{factor_names[worst_factor[0]]}** ({worst_factor[1]} 次零分)")
        
        # 找出达标样本中得分最低的因子
        lowest_avg = min(factor_stats.items(), key=lambda x: x[1]['avg_qualified'])
        lines.append(f"  - 达标样本中平均分最低: **{factor_names[lowest_avg[0]]}** ({lowest_avg[1]['avg_qualified']:.1f})")
        
        return "\n".join(lines)
    
    def _gen_signal_outcome_report(self) -> str:
        """生成候选信号后验跟踪报告"""
        lines = []
        lines.append("─" * 70)
        lines.append("🔬 4. 候选信号后验跟踪")
        lines.append("─" * 70)
        
        if not self.records:
            lines.append("⚠️  无数据")
            return "\n".join(lines)
        
        # 模拟后验结果（实际需要真实价格数据）
        qualified_records = [r for r in self.records if r.get('v42_is_qualified', False)]
        
        lines.append(f"达标信号数: {len(qualified_records)}")
        lines.append("")
        lines.append("⚠️  后验跟踪需要真实价格数据，当前为模拟阶段")
        lines.append("")
        lines.append("后验指标 (待实现):")
        lines.append("  - 候选信号后30秒价格变化")
        lines.append("  - 候选信号后60秒价格变化")
        lines.append("  - 假突破率")
        lines.append("  - 短期方向正确率")
        
        # 模拟统计
        if qualified_records:
            lines.append("")
            lines.append("📋 候选信号样本 (最近5条):")
            for i, r in enumerate(qualified_records[-5:], 1):
                lines.append(f"  {i}. {r.get('symbol')} @ {r.get('market_state', {}).get('price', 0):.2f}")
        
        return "\n".join(lines)
    
    def _gen_conclusion_report(self) -> str:
        """生成结论与建议"""
        lines = []
        lines.append("─" * 70)
        lines.append("🎯 结论与建议")
        lines.append("─" * 70)
        
        if not self.records:
            lines.append("⚠️  数据不足，无法得出结论")
            return "\n".join(lines)
        
        # 统计关键指标
        total = len(self.records)
        qualified = sum(1 for r in self.records if r.get('v42_is_qualified', False))
        qualified_rate = (qualified / total * 100) if total > 0 else 0
        
        lines.append("📊 关键指标:")
        lines.append(f"  - 总评估次数: {total}")
        lines.append(f"  - 达标信号数: {qualified}")
        lines.append(f"  - 达标率: {qualified_rate:.1f}%")
        lines.append("")
        
        # 建议
        lines.append("💡 下一步建议:")
        
        if qualified_rate >= 20:
            lines.append("  ✅ 达标率适中，建议:")
            lines.append("     1. 继续观察1-2天，积累更多数据")
            lines.append("     2. 分析达标信号的后验表现")
            lines.append("     3. 如果表现良好，进入V4.2出场逻辑实验阶段")
        elif qualified_rate >= 10:
            lines.append("  ⚠️  达标率较低，建议:")
            lines.append("     1. 分析被哪个因子限制")
            lines.append("     2. 考虑微调阈值 (如降至70分)")
            lines.append("     3. 观察是否为市场状态导致")
        else:
            lines.append("  ❌ 达标率过低，建议:")
            lines.append("     1. 检查评分模型是否过于严格")
            lines.append("     2. 考虑降低入场阈值至70分")
            lines.append("     3. 或放宽某个关键因子")
        
        lines.append("")
        lines.append("📅 推荐观察周期: 2-6 小时")
        lines.append("🎯 下一步实验: V4.2出场逻辑 (如果达标率>20%)")
        
        return "\n".join(lines)
    
    def _get_hourly_stats(self, hours: int) -> Dict:
        """获取每小时统计"""
        hourly = {}
        
        for r in self.records:
            ts = r.get('timestamp', '')
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    hour_key = dt.strftime('%Y-%m-%d %H:00')
                    
                    if hour_key not in hourly:
                        hourly[hour_key] = {'total': 0, 'qualified': 0}
                    
                    hourly[hour_key]['total'] += 1
                    if r.get('v42_is_qualified', False):
                        hourly[hour_key]['qualified'] += 1
                except:
                    pass
        
        return hourly
    
    def export_report(self, output_file: str = None):
        """导出报告"""
        if output_file is None:
            output_file = Path(__file__).parent.parent / 'data' / 'shadow_comparison_report.txt'
        
        report = self.generate_full_report()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        logger.info(f"✅ 报告已导出: {output_file}")
        return output_file


# 测试代码
if __name__ == "__main__":
    analyzer = ShadowStatisticsAnalyzer()
    print(analyzer.generate_full_report())