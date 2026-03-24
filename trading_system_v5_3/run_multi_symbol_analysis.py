#!/usr/bin/env python3
"""
多品种历史数据分析运行脚本
支持命令行参数配置
"""

import asyncio
import argparse
import sys
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from multi_symbol_analyzer import MultiSymbolAnalyzer


async def run_analysis(
    symbols: list = None,
    hours: int = 24,
    merge: bool = True,
    output_dir: str = None
):
    """
    运行多品种分析
    
    Args:
        symbols: 交易品种列表
        hours: 历史小时数
        merge: 是否合并现有数据
        output_dir: 输出目录
    """
    print("=" * 80)
    print("🚀 小龙多品种历史数据分析")
    print("=" * 80)
    
    # 创建分析器
    analyzer = MultiSymbolAnalyzer(symbols=symbols)
    
    # 分析所有品种
    stats = await analyzer.analyze_all_symbols(hours=hours)
    
    # 与现有数据合并
    if merge:
        analyzer.merge_with_existing()
    
    # 保存结果
    analyzer.save_results()
    
    # 生成并保存报告
    report = analyzer.generate_multi_symbol_report()
    analyzer.save_report(report)
    
    print("\n" + "=" * 80)
    print("✅ 分析完成!")
    print(f"📊 总样本数: {len(analyzer.all_results)}")
    print(f"📁 结果文件: {analyzer.output_file}")
    print(f"📄 报告文件: {analyzer.report_file}")
    print("=" * 80)
    
    return analyzer


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description='小龙多品种历史数据分析工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 分析默认品种列表 (8个主流币种)
  python run_multi_symbol_analysis.py
  
  # 分析指定品种
  python run_multi_symbol_analysis.py --symbols BTC/USDT:USDT ETH/USDT:USDT
  
  # 分析过去48小时
  python run_multi_symbol_analysis.py --hours 48
  
  # 不合并现有数据
  python run_multi_symbol_analysis.py --no-merge
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
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='输出目录'
    )
    
    args = parser.parse_args()
    
    # 运行分析
    asyncio.run(run_analysis(
        symbols=args.symbols,
        hours=args.hours,
        merge=not args.no_merge,
        output_dir=args.output_dir
    ))


if __name__ == "__main__":
    main()
