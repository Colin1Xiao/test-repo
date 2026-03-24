#!/usr/bin/env python3
"""
增强版多品种分析运行脚本
包含：分时段统计、新增机会分层、成交量敏感性测试
"""

import asyncio
import argparse
import sys
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer


async def run_enhanced_analysis(
    symbols: list = None,
    hours: int = 24,
    merge: bool = True
):
    """
    运行增强版分析
    
    Args:
        symbols: 交易品种列表
        hours: 历史小时数
        merge: 是否合并现有数据
    """
    print("=" * 80)
    print("🚀 小龙增强版多品种历史数据分析")
    print("=" * 80)
    print("\n📋 分析内容:")
    print("  1. 分时段统计 (亚洲/欧洲/美洲时段)")
    print("  2. 新增机会分层 (75-79/80-89/90+)")
    print("  3. 成交量因子敏感性测试")
    print("")
    
    # 创建增强版分析器
    analyzer = EnhancedAnalyzer(symbols=symbols)
    
    # 分析所有品种
    stats = await analyzer.analyze_all_symbols(hours=hours)
    
    # 与现有数据合并
    if merge:
        analyzer.merge_with_existing()
    
    # 保存结果
    analyzer.save_results()
    
    # 生成并保存增强版报告
    report = analyzer.generate_enhanced_report()
    
    report_file = analyzer.data_dir / 'enhanced_analysis_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print("\n" + report)
    
    print("\n" + "=" * 80)
    print("✅ 增强版分析完成!")
    print(f"📊 总样本数: {len(analyzer.all_results)}")
    print(f"📁 结果文件: {analyzer.output_file}")
    print(f"📄 报告文件: {report_file}")
    print("=" * 80)
    
    return analyzer


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description='小龙增强版多品种历史数据分析工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行完整分析 (默认8个主流币种)
  python run_enhanced_analysis.py
  
  # 分析指定品种
  python run_enhanced_analysis.py --symbols BTC/USDT:USDT ETH/USDT:USDT
  
  # 分析过去48小时
  python run_enhanced_analysis.py --hours 48
  
  # 不合并现有数据
  python run_enhanced_analysis.py --no-merge
        """
    )
    
    parser.add_argument(
        '--symbols',
        nargs='+',
        default=None,
        help='交易品种列表 (默认: 8个主流币种)'
    )
    
    parser.add_argument(
        '--hours',
        type=int,
        default=24,
        help='历史小时数 (默认: 24)'
    )
    
    parser.add_argument(
        '--no-merge',
        action='store_true',
        help='不合并现有数据'
    )
    
    args = parser.parse_args()
    
    # 运行分析
    asyncio.run(run_enhanced_analysis(
        symbols=args.symbols,
        hours=args.hours,
        merge=not args.no_merge
    ))


if __name__ == "__main__":
    main()
