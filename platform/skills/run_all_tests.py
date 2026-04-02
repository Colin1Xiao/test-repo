#!/usr/bin/env python3
"""
Unified Test Runner for Crypto Skills
加密货币技能统一测试运行器

Usage:
    python3 run_all_tests.py                    # 运行所有技能测试
    python3 run_all_tests.py --skill crypto-ta  # 运行指定技能测试
    python3 run_all_tests.py --verbose          # 详细输出
    python3 run_all_tests.py --coverage         # 带覆盖率报告
    python3 run_all_tests.py --ci               # CI 模式（简洁输出）
"""

import unittest
import sys
import argparse
import subprocess
from pathlib import Path
from datetime import datetime

# 技能列表
SKILLS = {
    'crypto-data': {
        'name': 'Crypto Data',
        'description': '加密货币行情数据获取',
        'emoji': '📊',
        'path': 'crypto-data/tests'
    },
    'crypto-ta': {
        'name': 'Crypto TA',
        'description': '技术指标计算',
        'emoji': '📈',
        'path': 'crypto-ta/tests'
    },
    'crypto-risk': {
        'name': 'Crypto Risk',
        'description': '风险管理',
        'emoji': '🛡️',
        'path': 'crypto-risk/tests'
    }
}


def run_skill_tests(skill_key, verbose=False, coverage=False):
    """运行单个技能的测试"""
    skill = SKILLS.get(skill_key)
    if not skill:
        print(f"❌ 未知技能: {skill_key}")
        return False
    
    test_path = Path(__file__).parent / skill['path'] / 'run_tests.py'
    
    if not test_path.exists():
        print(f"❌ 测试文件不存在: {test_path}")
        return False
    
    cmd = [sys.executable, str(test_path)]
    if verbose:
        cmd.append('--verbose')
    if coverage:
        cmd.append('--coverage')
    
    print(f"\n{skill['emoji']} 运行 {skill['name']} 测试...")
    print("-" * 60)
    
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def run_all_tests(verbose=False, coverage=False, ci=False):
    """运行所有技能测试"""
    results = {}
    
    print("="*60)
    print("🧪 Crypto Skills Test Suite")
    print("加密货币技能自动化测试套件")
    print("="*60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    for skill_key in SKILLS:
        success = run_skill_tests(skill_key, verbose, coverage)
        results[skill_key] = success
    
    # 打印总结
    print("\n" + "="*60)
    print("📊 测试总结")
    print("="*60)
    
    total = len(results)
    passed = sum(results.values())
    failed = total - passed
    
    for skill_key, success in results.items():
        skill = SKILLS[skill_key]
        status = "✅ 通过" if success else "❌ 失败"
        print(f"{skill['emoji']} {skill['name']:<15} {status}")
    
    print("-" * 60)
    print(f"总计: {total} | 通过: {passed} | 失败: {failed}")
    print("="*60)
    
    return failed == 0


def main():
    parser = argparse.ArgumentParser(
        description="加密货币技能统一测试运行器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 run_all_tests.py                    # 运行所有测试
  python3 run_all_tests.py --skill crypto-ta  # 只运行 TA 测试
  python3 run_all_tests.py --verbose          # 详细输出
  python3 run_all_tests.py --coverage         # 生成覆盖率报告
        """
    )
    parser.add_argument(
        '--skill',
        choices=list(SKILLS.keys()),
        help='指定要测试的技能'
    )
    parser.add_argument('-v', '--verbose', action='store_true', help='详细输出')
    parser.add_argument('-c', '--coverage', action='store_true', help='生成覆盖率报告')
    parser.add_argument('--ci', action='store_true', help='CI 模式（简洁输出）')
    parser.add_argument('--list', action='store_true', help='列出所有技能')
    
    args = parser.parse_args()
    
    if args.list:
        print("可用技能:")
        for key, skill in SKILLS.items():
            print(f"  {skill['emoji']} {key:<15} - {skill['description']}")
        return 0
    
    if args.skill:
        success = run_skill_tests(args.skill, args.verbose, args.coverage)
    else:
        success = run_all_tests(args.verbose, args.coverage, args.ci)
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
