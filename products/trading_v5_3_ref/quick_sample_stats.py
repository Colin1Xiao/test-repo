#!/usr/bin/env python3
"""
快速样本统计工具
无需重新获取数据，直接分析现有样本
"""

import sys
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer


def main():
    """主函数"""
    print("=" * 80)
    print("📊 快速样本统计")
    print("=" * 80)
    
    # 创建分析器 (不获取新数据)
    analyzer = EnhancedAnalyzer()
    
    # 只加载现有数据
    from sample_aggregator import SampleAggregator
    aggregator = SampleAggregator()
    count = aggregator.load_all_data()
    
    if count == 0:
        print("❌ 无现有数据，请先运行完整分析")
        print("\n运行: python run_enhanced_analysis.py")
        return
    
    # 将数据复制到分析器
    analyzer.all_results = aggregator.all_samples
    
    # 生成增强版报告
    report = analyzer.generate_enhanced_report()
    print(report)
    
    # 保存报告
    report_file = analyzer.data_dir / 'enhanced_analysis_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    main()
