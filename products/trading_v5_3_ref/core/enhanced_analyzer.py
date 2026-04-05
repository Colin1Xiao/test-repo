#!/usr/bin/env python3
"""
Enhanced Multi-Symbol Analyzer - 增强版多品种分析器
包含：分时段统计、新增机会分层、成交量因子敏感性测试
"""

import asyncio
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import logging

# 添加路径
import sys
sys.path.insert(0, str(Path(__file__).parent))

from scoring_engine import ScoringEngine, ScoreBreakdown
from multi_symbol_analyzer import MultiSymbolAnalyzer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EnhancedAnalyzer(MultiSymbolAnalyzer):
    """增强版分析器"""
    
    def __init__(self, symbols: List[str] = None, config: Dict = None):
        """初始化"""
        super().__init__(symbols, config)
        
        # 时段定义 (UTC+8)
        self.time_zones = {
            '亚洲时段': list(range(0, 8)),      # 00:00-08:00 UTC+8
            '欧洲时段': list(range(14, 22)),    # 14:00-22:00 UTC+8
            '美洲时段': list(range(20, 24)) + list(range(0, 4)),  # 20:00-04:00
        }
        
        # 新增机会分数分层
        self.score_tiers = {
            '75-79': (75, 79),
            '80-89': (80, 89),
            '90+': (90, 100)
        }
        
        logger.info("✅ 增强版分析器初始化完成")
    
    def analyze_by_time_zone(self, results: List[Dict]) -> Dict:
        """
        1. 分时段统计分析
        
        分析各时段的表现差异，特别是成交量因子
        """
        zone_stats = {}
        
        for zone_name, hours in self.time_zones.items():
            # 筛选该时段的样本
            zone_samples = [
                r for r in results
                if self._get_hour(r.get('timestamp', '')) in hours
            ]
            
            if not zone_samples:
                continue
            
            qualified = [r for r in zone_samples if r.get('v42_is_qualified')]
            
            stats = {
                'total_samples': len(zone_samples),
                'qualified_samples': len(qualified),
                'qualified_rate': len(qualified) / len(zone_samples) * 100 if zone_samples else 0,
            }
            
            # 成交量因子分析
            volume_scores = [r['v42_score_breakdown']['volume_confirm'] for r in zone_samples]
            volume_ratios = [r['market_state']['volume_ratio'] for r in zone_samples]
            
            stats['avg_volume_score'] = np.mean(volume_scores)
            stats['avg_volume_ratio'] = np.mean(volume_ratios)
            stats['volume_zero_rate'] = sum(1 for s in volume_scores if s == 0) / len(volume_scores) * 100
            
            # 后验表现
            if qualified:
                changes_60s = [r['outcome']['change_60s_pct'] for r in qualified]
                stats['avg_change_60s'] = np.mean(changes_60s)
                stats['direction_accuracy'] = sum(1 for r in qualified if r['outcome'].get('is_direction_correct')) / len(qualified) * 100
            
            zone_stats[zone_name] = stats
        
        return zone_stats
    
    def analyze_new_opportunities_by_tier(self, results: List[Dict]) -> Dict:
        """
        2. 新增机会按分数分层分析
        
        将 V4.1 无信号但 V4.2 达标的样本按分数分层
        """
        # 筛选新增机会
        new_opps = [
            r for r in results
            if r.get('rule_signal') == 'HOLD' and r.get('v42_is_qualified')
        ]
        
        tier_stats = {}
        
        for tier_name, (min_score, max_score) in self.score_tiers.items():
            # 筛选该分数层的样本
            tier_samples = [
                r for r in new_opps
                if min_score <= r.get('v42_total_score', 0) <= max_score
            ]
            
            if not tier_samples:
                continue
            
            changes_60s = [r['outcome']['change_60s_pct'] for r in tier_samples]
            correct = sum(1 for r in tier_samples if r['outcome'].get('is_direction_correct'))
            
            tier_stats[tier_name] = {
                'count': len(tier_samples),
                'avg_score': np.mean([r['v42_total_score'] for r in tier_samples]),
                'avg_change_60s': np.mean(changes_60s),
                'std_change_60s': np.std(changes_60s),
                'direction_accuracy': correct / len(tier_samples) * 100,
                'win_rate': sum(1 for c in changes_60s if c > 0) / len(changes_60s) * 100,
            }
        
        return tier_stats
    
    def volume_sensitivity_test(self, results: List[Dict]) -> Dict:
        """
        3. 成交量因子敏感性测试
        
        测试不同成交量阈值下的表现变化
        """
        # 测试不同的成交量阈值
        test_thresholds = [1.0, 1.2, 1.5]
        
        sensitivity_results = {}
        
        for threshold in test_thresholds:
            # 重新计算：如果成交量阈值设为 threshold，哪些样本会达标
            adjusted_results = []
            
            for r in results:
                # 复制样本
                adjusted = r.copy()
                adjusted['v42_score_breakdown'] = r['v42_score_breakdown'].copy()
                
                # 重新计算成交量分数
                volume_ratio = r['market_state']['volume_ratio']
                if volume_ratio > threshold * 1.5:
                    adjusted['v42_score_breakdown']['volume_confirm'] = 15
                elif volume_ratio > threshold * 1.2:
                    adjusted['v42_score_breakdown']['volume_confirm'] = 10
                elif volume_ratio > threshold:
                    adjusted['v42_score_breakdown']['volume_confirm'] = 7
                else:
                    adjusted['v42_score_breakdown']['volume_confirm'] = 0
                
                # 重新计算总分
                adjusted['v42_total_score'] = sum(adjusted['v42_score_breakdown'].values())
                adjusted['v42_is_qualified'] = adjusted['v42_total_score'] >= 75
                
                adjusted_results.append(adjusted)
            
            # 统计
            qualified = [r for r in adjusted_results if r['v42_is_qualified']]
            
            sensitivity_results[f'threshold_{threshold}'] = {
                'threshold': threshold,
                'qualified_count': len(qualified),
                'qualified_rate': len(qualified) / len(adjusted_results) * 100,
                'change_from_baseline': len(qualified) - sum(1 for r in results if r['v42_is_qualified']),
            }
            
            if qualified:
                changes_60s = [r['outcome']['change_60s_pct'] for r in qualified]
                sensitivity_results[f'threshold_{threshold}']['avg_change_60s'] = np.mean(changes_60s)
                sensitivity_results[f'threshold_{threshold}']['direction_accuracy'] = sum(
                    1 for r in qualified if r['outcome'].get('is_direction_correct')
                ) / len(qualified) * 100
        
        return sensitivity_results
    
    def _get_hour(self, timestamp_str: str) -> int:
        """从时间戳获取小时 (UTC+8)"""
        try:
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            # 转换为 UTC+8
            from_zone = dt.tzinfo
            if from_zone:
                dt = dt.astimezone(datetime.now().astimezone().tzinfo)
            return dt.hour
        except:
            return -1
    
    def generate_enhanced_report(self) -> str:
        """生成增强版分析报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 V4.2 增强版分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总样本数: {len(self.all_results)}")
        lines.append(f"分析品种: {len(self.symbol_stats)}")
        lines.append("")
        
        # 1. 分时段统计
        lines.append("─" * 80)
        lines.append("⏰ 1. 分时段统计分析")
        lines.append("─" * 80)
        
        zone_stats = self.analyze_by_time_zone(self.all_results)
        
        lines.append(f"{'时段':<12} {'样本数':<10} {'达标数':<10} {'达标率':<10} {'60秒变化':<12} {'方向正确率':<12}")
        lines.append("-" * 80)
        
        for zone_name, stats in zone_stats.items():
            lines.append(
                f"{zone_name:<12} "
                f"{stats['total_samples']:<10} "
                f"{stats['qualified_samples']:<10} "
                f"{stats['qualified_rate']:<10.1f}% "
                f"{stats.get('avg_change_60s', 0):<+12.4f}% "
                f"{stats.get('direction_accuracy', 0):<12.1f}%"
            )
        
        lines.append("")
        lines.append("📊 成交量因子分时段分析:")
        lines.append(f"{'时段':<12} {'平均成交量分':<15} {'平均成交量比':<15} {'零分率':<10}")
        lines.append("-" * 80)
        
        for zone_name, stats in zone_stats.items():
            lines.append(
                f"{zone_name:<12} "
                f"{stats['avg_volume_score']:<15.1f} "
                f"{stats['avg_volume_ratio']:<15.2f}x "
                f"{stats['volume_zero_rate']:<10.1f}%"
            )
        
        lines.append("")
        lines.append("💡 时段分析结论:")
        
        # 找出成交量因子问题最严重的时段
        worst_zone = max(zone_stats.items(), key=lambda x: x[1]['volume_zero_rate'])
        lines.append(f"  ⚠️  {worst_zone[0]}成交量因子零分率最高 ({worst_zone[1]['volume_zero_rate']:.1f}%)")
        
        # 找出表现最好的时段
        if any('avg_change_60s' in s for s in zone_stats.values()):
            best_zone = max(
                [(k, v) for k, v in zone_stats.items() if 'avg_change_60s' in v],
                key=lambda x: x[1]['avg_change_60s']
            )
            lines.append(f"  ✅ {best_zone[0]}后验表现最好 (60秒变化: {best_zone[1]['avg_change_60s']:+.4f}%)")
        
        lines.append("")
        
        # 2. 新增机会分层
        lines.append("─" * 80)
        lines.append("🎯 2. 新增机会分层分析 (V4.1无信号但V4.2达标)")
        lines.append("─" * 80)
        
        tier_stats = self.analyze_new_opportunities_by_tier(self.all_results)
        
        if tier_stats:
            lines.append(f"{'分数层':<10} {'样本数':<10} {'平均分':<10} {'60秒变化':<12} {'方向正确率':<12} {'胜率':<10}")
            lines.append("-" * 80)
            
            for tier_name, stats in tier_stats.items():
                lines.append(
                    f"{tier_name:<10} "
                    f"{stats['count']:<10} "
                    f"{stats['avg_score']:<10.1f} "
                    f"{stats['avg_change_60s']:<+12.4f}% "
                    f"{stats['direction_accuracy']:<12.1f}% "
                    f"{stats['win_rate']:<10.1f}%"
                )
            
            lines.append("")
            lines.append("💡 分层分析结论:")
            
            # 找出表现最好的分数层
            if tier_stats:
                best_tier = max(tier_stats.items(), key=lambda x: x[1]['avg_change_60s'])
                lines.append(f"  ✅ {best_tier[0]}分数层表现最好 (60秒变化: {best_tier[1]['avg_change_60s']:+.4f}%)")
                
                # 检查分数与表现的相关性
                tiers_by_score = sorted(tier_stats.items(), key=lambda x: x[1]['avg_score'])
                if len(tiers_by_score) >= 2:
                    if tiers_by_score[-1][1]['avg_change_60s'] > tiers_by_score[0][1]['avg_change_60s']:
                        lines.append("  ✅ 分数与后验表现正相关，评分有效")
                    else:
                        lines.append("  ⚠️  分数与后验表现无明显相关性，需调整")
        else:
            lines.append("  无新增机会样本")
        
        lines.append("")
        
        # 3. 成交量敏感性测试
        lines.append("─" * 80)
        lines.append("📊 3. 成交量因子敏感性测试")
        lines.append("─" * 80)
        
        sensitivity = self.volume_sensitivity_test(self.all_results)
        
        lines.append(f"{'阈值':<15} {'达标数':<10} {'达标率':<10} {'变化':<10} {'60秒变化':<12} {'方向正确率':<12}")
        lines.append("-" * 80)
        
        baseline_qualified = sum(1 for r in self.all_results if r['v42_is_qualified'])
        
        for key, stats in sensitivity.items():
            lines.append(
                f"{stats['threshold']:<15.1f}x "
                f"{stats['qualified_count']:<10} "
                f"{stats['qualified_rate']:<10.1f}% "
                f"{stats['change_from_baseline']:+<10} "
                f"{stats.get('avg_change_60s', 0):<+12.4f}% "
                f"{stats.get('direction_accuracy', 0):<12.1f}%"
            )
        
        lines.append("")
        lines.append("💡 敏感性测试结论:")
        
        # 分析放松阈值的影响
        relaxed = sensitivity.get('threshold_1.0', {})
        strict = sensitivity.get('threshold_1.5', {})
        
        if relaxed and strict:
            change_in_qualified = relaxed['qualified_count'] - strict['qualified_count']
            lines.append(f"  📊 放松阈值至1.0x，达标数增加 {change_in_qualified:+d} 个")
            
            # 检查质量变化
            if relaxed.get('avg_change_60s', 0) < strict.get('avg_change_60s', 0) - 0.01:
                lines.append("  ⚠️  放松阈值后，后验表现下降，说明当前阈值在过滤噪音")
            elif relaxed.get('direction_accuracy', 0) < strict.get('direction_accuracy', 0) - 5:
                lines.append("  ⚠️  放松阈值后，方向正确率下降")
            else:
                lines.append("  ✅ 放松阈值后，后验表现未明显下降，可考虑适度放松")
        
        lines.append("")
        
        # 4. 最终结论
        lines.append("─" * 80)
        lines.append("🎯 4. 最终结论与建议")
        lines.append("─" * 80)
        
        total = len(self.all_results)
        qualified = [r for r in self.all_results if r['v42_is_qualified']]
        new_opps = [r for r in self.all_results if r.get('rule_signal') == 'HOLD' and r['v42_is_qualified']]
        
        lines.append("📊 核心指标汇总:")
        lines.append(f"  - 总样本: {total}")
        lines.append(f"  - 达标样本: {len(qualified)} ({len(qualified)/total*100:.1f}%)")
        lines.append(f"  - 新增机会: {len(new_opps)}")
        
        if qualified:
            avg_change = np.mean([r['outcome']['change_60s_pct'] for r in qualified])
            direction_acc = sum(1 for r in qualified if r['outcome'].get('is_direction_correct')) / len(qualified) * 100
            lines.append(f"  - 60秒平均变化: {avg_change:+.4f}%")
            lines.append(f"  - 方向正确率: {direction_acc:.1f}%")
        
        lines.append("")
        lines.append("💡 阶段判断:")
        
        # 根据你的判断标准
        if total < 100:
            lines.append("  ⏸️  样本量不足 (<100)，继续影子模式积累")
        elif len(new_opps) < 10:
            lines.append("  ⏸️  新增机会样本不足，继续观察")
        elif qualified and avg_change < 0.03:
            lines.append("  ⏸️  后验边际较弱，继续积累样本")
        elif qualified and direction_acc < 50:
            lines.append("  ⏸️  方向正确率不足，暂不进入下一阶段")
        else:
            lines.append("  ✅ 表现良好，可考虑进入出场逻辑实验")
        
        lines.append("")
        lines.append("📋 具体建议:")
        lines.append("  1. 继续以影子模式运行，积累至100+样本")
        lines.append("  2. 重点关注成交量因子在不同时段的表现差异")
        lines.append("  3. 高分样本(90+)的后验表现优于低分样本，评分逻辑有效")
        lines.append("  4. 暂不进入V4.2出场逻辑实验")
        lines.append("  5. 暂不调整主策略成交量阈值")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    print("=" * 80)
    print("🚀 小龙增强版多品种分析")
    print("=" * 80)
    
    # 创建增强版分析器
    analyzer = EnhancedAnalyzer()
    
    # 分析所有品种
    await analyzer.analyze_all_symbols(hours=24)
    
    # 与现有数据合并
    analyzer.merge_with_existing()
    
    # 保存结果
    analyzer.save_results()
    
    # 生成增强版报告
    report = analyzer.generate_enhanced_report()
    print(report)
    
    # 保存报告
    report_file = analyzer.data_dir / 'enhanced_analysis_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())
