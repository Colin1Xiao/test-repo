#!/usr/bin/env python3
"""
Crypto Risk Skill Test Runner
风险管理技能测试运行器

Usage:
    python3 run_tests.py              # 运行所有测试
    python3 run_tests.py --verbose    # 详细输出
    python3 run_tests.py --coverage   # 带覆盖率报告
"""

import unittest
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
sys.path.insert(0, str(Path(__file__).parent))


def discover_tests():
    """发现所有测试"""
    loader = unittest.TestLoader()
    start_dir = Path(__file__).parent
    suite = loader.discover(start_dir, pattern="test_*.py")
    return suite


def run_tests(verbose=False, coverage=False):
    """运行测试"""
    suite = discover_tests()
    
    if coverage:
        try:
            import coverage
            cov = coverage.Coverage(
                source=[str(Path(__file__).parent.parent / "scripts")],
                omit=["*/tests/*", "*/__pycache__/*"]
            )
            cov.start()
        except ImportError:
            print("警告: coverage 包未安装，跳过覆盖率报告")
            print("安装: pip3 install coverage")
            coverage = False
    
    verbosity = 2 if verbose else 1
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    
    if coverage:
        cov.stop()
        cov.save()
        print("\n" + "="*60)
        print("覆盖率报告")
        print("="*60)
        cov.report()
        
        html_dir = Path(__file__).parent / "htmlcov"
        cov.html_report(directory=str(html_dir))
        print(f"\nHTML 报告已生成: {html_dir}/index.html")
    
    return result.wasSuccessful()


def main():
    parser = argparse.ArgumentParser(description="运行 Crypto Risk 技能测试")
    parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    parser.add_argument("-c", "--coverage", action="store_true", help="生成覆盖率报告")
    parser.add_argument("--list", action="store_true", help="列出所有测试")
    
    args = parser.parse_args()
    
    if args.list:
        print("可用测试:")
        suite = discover_tests()
        for test_group in suite:
            for test in test_group:
                print(f"  - {test}")
        return 0
    
    print("="*60)
    print("Crypto Risk Skill Test Suite")
    print("风险管理自动化测试")
    print("="*60)
    print()
    
    success = run_tests(verbose=args.verbose, coverage=args.coverage)
    
    print()
    print("="*60)
    if success:
        print("✅ 所有测试通过!")
    else:
        print("❌ 测试失败")
    print("="*60)
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
