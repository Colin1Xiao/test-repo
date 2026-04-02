#!/usr/bin/env python3
"""
Sample Aggregator - 样本聚合器
整合多品种历史数据，为评分引擎提供统一样本池
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SampleAggregator:
    """样本聚合器"""
    
    def __init__(self, data_dir: Path = None):
        """
        初始化聚合器
        
        Args:
            data_dir: 数据目录
        """
        self.data_dir = data_dir or Path(__file__).parent.parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        
        # 数据文件
        self.multi_symbol_file = self.data_dir / 'multi_symbol_analysis.jsonl'
        self.historical_file = self.data_dir / 'historical_analysis.jsonl'
        self.extended_file = self.data_dir / 'extended_analysis.jsonl'
        
        # 聚合数据
        self.all_samples = []
        self.symbol_distribution = {}
        self.quality_metrics = {}
        
        logger.info("✅ 样本聚合器初始化完成")
    
    def load_all_data(self) -> int:
        """
        加载所有数据源
        
        Returns:
            总样本数
        """
        self.all_samples = []
        
        # 加载多品种数据
        if self.multi_symbol_file.exists():
            count = self._load_jsonl(self.multi_symbol_file)
            logger.info(f"📊 多品种数据: {count} 条")
        
        # 加载历史数据
        if self.historical_file.exists():
            count = self._load_jsonl(self.historical_file)
            logger.info(f"📊 历史数据: {count} 条")
        
        # 加载扩展数据
        if self.extended_file.exists():
            count = self._load_jsonl(self.extended_file)
            logger.info(f"📊 扩展数据: {count} 条")
        
        # 去重
        self._deduplicate()
        
        logger.info(f"✅ 加载完成，总样本: {len(self.all_samples)} 条")
        return len(self.all_samples)
    
    def _load_jsonl(self, file_path: Path) -> int:
        """加载 JSONL 文件"""
        count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        self.all_samples.append(data)
                        count += 1
                    except json.JSONDecodeError:
                        continue
        return count
    
    def _deduplicate(self):
        """去重 (基于 timestamp + symbol)"""
        seen = set()
        unique = []
        
        for sample in self.all_samples:
            key = (sample.get('timestamp'), sample.get('symbol'))
            if key not in seen and key[0] is not None:
                seen.add(key)
                unique.append(sample)
        
        removed = len(self.all_samples) - len(unique)
        self.all_samples = unique
        
        if removed > 0:
            logger.info(f"🗑️  去重: 移除 {removed} 条重复样本")
    
    def calculate_symbol_distribution(self) -> Dict:
        """
        计算品种分布
        
        Returns:
            品种分布统计
        """
        distribution = {}
        
        for sample in self.all_samples:
            symbol = sample.get('symbol', 'UNKNOWN')
            
            if symbol not in distribution:
                distribution[symbol] = {
                    'total': 0,
                    'qualified': 0,
                    'avg_score': 0,
                    'scores': []
                }
            
            distribution[symbol]['total'] += 1
            
            if sample.get('v42_is_qualified'):
                distribution[symbol]['qualified'] += 1
            
            distribution[symbol]['scores'].append(sample.get('v42_total_score', 0))
        
        # 计算平均值
        for symbol, stats in distribution.items():
            if stats['scores']:
                stats['avg_score'] = np.mean(stats['scores'])
                stats['qualified_rate'] = stats['qualified'] / stats['total'] * 100
            del stats['scores']  # 删除原始分数列表
        
        self.symbol_distribution = distribution
        return distribution
    
    def calculate_quality_metrics(self) -> Dict:
        """
        计算质量指标
        
        Returns:
            质量指标字典
        """
        if not self.all_samples:
            return {}
        
        qualified = [s for s in self.all_samples if s.get('v42_is_qualified')]
        
        metrics = {
            'total_samples': len(self.all_samples),
            'qualified_samples': len(qualified),
            'qualified_rate': len(qualified) / len(self.all_samples) * 100,
            'symbol_count': len(set(s.get('symbol') for s in self.all_samples)),
            'avg_score': np.mean([s.get('v42_total_score', 0) for s in self.all_samples]),
        }
        
        if qualified:
            # 后验表现
            changes_60s = [s['outcome']['change_60s_pct'] for s in qualified]
            metrics['avg_change_60s'] = np.mean(changes_60s)
            metrics['std_change_60s'] = np.std(changes_60s)
            
            # 方向正确率
            correct = sum(1 for s in qualified if s['outcome'].get('is_direction_correct'))
            metrics['direction_accuracy'] = correct / len(qualified) * 100
            
            # 假突破率
            fake = sum(1 for s in qualified if s['outcome'].get('is_fake_breakout'))
            metrics['fake_breakout_rate'] = fake / len(qualified) * 100
        
        self.quality_metrics = metrics
        return metrics
    
    def get_samples_by_symbol(self, symbol: str) -> List[Dict]:
        """获取指定品种的样本"""
        return [s for s in self.all_samples if s.get('symbol') == symbol]
    
    def get_samples_by_score_range(self, min_score: int, max_score: int) -> List[Dict]:
        """获取指定分数范围的样本"""
        return [
            s for s in self.all_samples
            if min_score <= s.get('v42_total_score', 0) <= max_score
        ]
    
    def get_qualified_samples(self) -> List[Dict]:
        """获取达标样本"""
        return [s for s in self.all_samples if s.get('v42_is_qualified')]
    
    def get_new_opportunities(self) -> List[Dict]:
        """获取新增机会样本 (V4.1无信号但V4.2达标)"""
        return [
            s for s in self.all_samples
            if s.get('rule_signal') == 'HOLD' and s.get('v42_is_qualified')
        ]
    
    def export_to_csv(self, output_file: Path = None) -> Path:
        """
        导出为 CSV
        
        Args:
            output_file: 输出文件路径
            
        Returns:
            输出文件路径
        """
        if output_file is None:
            output_file = self.data_dir / 'aggregated_samples.csv'
        
        if not self.all_samples:
            logger.warning("⚠️  无数据可导出")
            return None
        
        # 转换为 DataFrame
        df = pd.json_normalize(self.all_samples)
        
        # 保存
        df.to_csv(output_file, index=False, encoding='utf-8')
        logger.info(f"✅ 已导出到: {output_file}")
        
        return output_file
    
    def generate_summary_report(self) -> str:
        """生成汇总报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 样本聚合汇总报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 1. 总体统计
        lines.append("─" * 80)
        lines.append("📈 1. 总体统计")
        lines.append("─" * 80)
        
        metrics = self.calculate_quality_metrics()
        
        lines.append(f"总样本数: {metrics.get('total_samples', 0)}")
        lines.append(f"达标样本: {metrics.get('qualified_samples', 0)}")
        lines.append(f"达标率: {metrics.get('qualified_rate', 0):.1f}%")
        lines.append(f"平均评分: {metrics.get('avg_score', 0):.1f}/100")
        lines.append(f"品种数量: {metrics.get('symbol_count', 0)}")
        lines.append("")
        
        if metrics.get('qualified_samples', 0) > 0:
            lines.append("📊 后验表现:")
            lines.append(f"  60秒平均变化: {metrics.get('avg_change_60s', 0):+.4f}%")
            lines.append(f"  60秒标准差: {metrics.get('std_change_60s', 0):.4f}%")
            lines.append(f"  方向正确率: {metrics.get('direction_accuracy', 0):.1f}%")
            lines.append(f"  假突破率: {metrics.get('fake_breakout_rate', 0):.1f}%")
        
        lines.append("")
        
        # 2. 品种分布
        lines.append("─" * 80)
        lines.append("📊 2. 品种分布")
        lines.append("─" * 80)
        
        distribution = self.calculate_symbol_distribution()
        
        # 按样本数排序
        sorted_symbols = sorted(
            distribution.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )
        
        lines.append(f"{'品种':<20} {'样本数':<10} {'达标数':<10} {'达标率':<10} {'平均分':<10}")
        lines.append("-" * 80)
        
        for symbol, stats in sorted_symbols:
            lines.append(
                f"{symbol:<20} "
                f"{stats['total']:<10} "
                f"{stats['qualified']:<10} "
                f"{stats.get('qualified_rate', 0):<10.1f} "
                f"{stats['avg_score']:<10.1f}"
            )
        
        lines.append("")
        
        # 3. 新增机会
        lines.append("─" * 80)
        lines.append("🎯 3. 新增机会分析 (V4.1无信号但V4.2达标)")
        lines.append("─" * 80)
        
        new_opps = self.get_new_opportunities()
        lines.append(f"新增机会数量: {len(new_opps)}")
        
        if new_opps:
            changes_60s = [s['outcome']['change_60s_pct'] for s in new_opps]
            correct = sum(1 for s in new_opps if s['outcome'].get('is_direction_correct'))
            
            lines.append(f"60秒平均变化: {np.mean(changes_60s):+.4f}%")
            lines.append(f"方向正确率: {correct / len(new_opps) * 100:.1f}%")
        
        lines.append("")
        
        # 4. 结论
        lines.append("─" * 80)
        lines.append("🎯 4. 结论与建议")
        lines.append("─" * 80)
        
        total = metrics.get('total_samples', 0)
        qualified_rate = metrics.get('qualified_rate', 0)
        avg_change = metrics.get('avg_change_60s', 0)
        direction_acc = metrics.get('direction_accuracy', 0)
        
        lines.append("📊 核心指标:")
        lines.append(f"  - 样本量: {total}")
        lines.append(f"  - 达标率: {qualified_rate:.1f}%")
        lines.append(f"  - 60秒变化: {avg_change:+.4f}%")
        lines.append(f"  - 方向正确率: {direction_acc:.1f}%")
        lines.append("")
        
        lines.append("💡 评估:")
        if total < 100:
            lines.append("  ⚠️  样本量不足，继续积累数据")
        elif qualified_rate > 20 and avg_change > 0.03 and direction_acc > 50:
            lines.append("  ✅ 表现良好，可考虑进入下一阶段")
        elif avg_change > 0:
            lines.append("  ⚠️  有正向预期，但不够显著")
        else:
            lines.append("  ❌ 表现不佳，需要调整参数")
        
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def save_summary_report(self, output_file: Path = None) -> Path:
        """保存汇总报告"""
        if output_file is None:
            output_file = self.data_dir / 'sample_summary_report.txt'
        
        report = self.generate_summary_report()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        logger.info(f"✅ 报告已保存: {output_file}")
        return output_file


def main():
    """主函数"""
    print("=" * 80)
    print("🚀 样本聚合器")
    print("=" * 80)
    
    # 创建聚合器
    aggregator = SampleAggregator()
    
    # 加载数据
    count = aggregator.load_all_data()
    
    if count == 0:
        print("❌ 无数据可分析")
        return
    
    # 计算分布
    aggregator.calculate_symbol_distribution()
    
    # 计算质量指标
    aggregator.calculate_quality_metrics()
    
    # 导出 CSV
    aggregator.export_to_csv()
    
    # 生成并保存报告
    report = aggregator.generate_summary_report()
    aggregator.save_summary_report()
    
    print("\n" + report)
    
    print("\n" + "=" * 80)
    print("✅ 聚合完成!")
    print("=" * 80)


if __name__ == "__main__":
    main()
