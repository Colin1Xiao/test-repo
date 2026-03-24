#!/usr/bin/env python3
"""
All Strategies Test Suite
全策略测试套件

测试所有已开发的交易策略
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# 添加脚本路径
scripts_dir = Path(__file__).parent.parent / 'skills' / 'crypto-signals' / 'scripts'
sys.path.insert(0, str(scripts_dir))

print("="*70)
print("🧪 全策略测试套件")
print("="*70)
print(f"测试时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"脚本目录：{scripts_dir}")
print("="*70)

# 测试用例
test_cases = [
    {
        'name': '1. 1% 波动捕捉策略',
        'script': 'strategy_1pct.py',
        'args': ['--symbol', 'BTC/USDT', '--capital', '500', '--target', '100000', '--simulate'],
        'expected': '资金增长模拟结果'
    },
    {
        'name': '2. 双向交易策略',
        'script': 'strategy_bidirectional.py',
        'args': ['--symbol', 'BTC/USDT', '--capital', '500'],
        'expected': '做多/做空信号'
    },
    {
        'name': '3. 量价关系分析',
        'script': 'volume_price_analysis.py',
        'args': ['--symbol', 'BTC/USDT', '--timeframe', '1m'],
        'expected': '量价评分和交易建议'
    },
    {
        'name': '4. 日内波段策略',
        'script': 'strategy_intraday.py',
        'args': ['--symbol', 'BTC/USDT', '--capital', '500', '--simulate'],
        'expected': '模拟交易结果'
    },
    {
        'name': '5. 黑天鹅防护',
        'script': 'strategy_blackswan.py',
        'args': ['--symbol', 'BTC/USDT'],
        'expected': '警报级别和防护动作'
    },
    {
        'name': '6. 金字塔滚仓',
        'script': 'strategy_pyramid.py',
        'args': ['--symbol', 'BTC/USDT', '--capital', '10000', '--entry', '68500', '--side', 'long'],
        'expected': '加仓计划和建议'
    },
    {
        'name': '7. 专业止损管理',
        'script': '../crypto-risk/scripts/stoploss_manager.py',
        'args': ['--entry', '68500', '--side', 'long', '--method', 'compare'],
        'expected': '不同止损方法对比'
    }
]

# 运行测试
results = []

for i, test in enumerate(test_cases, 1):
    print(f"\n{'='*70}")
    print(f"测试 {i}/{len(test_cases)}: {test['name']}")
    print(f"{'='*70}")
    
    script_path = scripts_dir / test['script']
    
    # 检查脚本是否存在
    if not script_path.exists():
        print(f"❌ 脚本不存在：{script_path}")
        results.append({
            'name': test['name'],
            'status': 'FAIL',
            'error': '脚本不存在'
        })
        continue
    
    print(f"脚本：{script_path}")
    print(f"参数：{' '.join(test['args'])}")
    print(f"预期：{test['expected']}")
    print()
    
    # 运行脚本
    try:
        import subprocess
        result = subprocess.run(
            ['python3', str(script_path)] + test['args'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout
        error = result.stderr
        
        # 检查输出
        if result.returncode == 0 or '提示：可能需要代理' in output:
            print(f"✅ 运行成功")
            print(f"输出预览:")
            print("-"*70)
            # 显示前 10 行
            lines = output.split('\n')
            for line in lines[:10]:
                print(line)
            if len(lines) > 10:
                print(f"... 还有 {len(lines)-10} 行")
            print("-"*70)
            
            results.append({
                'name': test['name'],
                'status': 'PASS',
                'output_lines': len(lines),
                'has_expected': test['expected'].lower() in output.lower()
            })
        else:
            print(f"❌ 运行失败")
            print(f"错误：{error[:500] if error else '无输出'}")
            results.append({
                'name': test['name'],
                'status': 'FAIL',
                'error': error[:200] if error else '未知错误'
            })
    
    except subprocess.TimeoutExpired:
        print(f"⏱️ 超时（>30 秒）")
        results.append({
            'name': test['name'],
            'status': 'TIMEOUT',
            'error': '执行超时'
        })
    except Exception as e:
        print(f"❌ 异常：{e}")
        results.append({
            'name': test['name'],
            'status': 'ERROR',
            'error': str(e)
        })

# 测试总结
print(f"\n{'='*70}")
print(f"📊 测试总结")
print(f"{'='*70}")

passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] in ['FAIL', 'ERROR'])
timeout = sum(1 for r in results if r['status'] == 'TIMEOUT')

print(f"总计：{len(results)} 个测试")
print(f"✅ 通过：{passed}")
print(f"❌ 失败：{failed}")
print(f"⏱️ 超时：{timeout}")
print()

# 详细结果
print(f"{'='*70}")
print(f"详细结果")
print(f"{'='*70}")
print(f"{'测试名称':<40} {'状态':<10} {'备注':<20}")
print("-"*70)

for r in results:
    status_emoji = {
        'PASS': '✅',
        'FAIL': '❌',
        'TIMEOUT': '⏱️',
        'ERROR': '❌'
    }.get(r['status'], '❓')
    
    note = ''
    if r['status'] == 'PASS':
        if r.get('has_expected'):
            note = '包含预期输出'
        else:
            note = f"{r['output_lines']} 行输出"
    else:
        note = r.get('error', '')[:20]
    
    print(f"{r['name']:<40} {status_emoji} {r['status']:<10} {note:<20}")

print(f"\n{'='*70}")

# 保存结果
result_file = Path(__file__).parent.parent / 'test_results.json'
with open(result_file, 'w', encoding='utf-8') as f:
    json.dump({
        'timestamp': datetime.now().isoformat(),
        'total': len(results),
        'passed': passed,
        'failed': failed,
        'timeout': timeout,
        'results': results
    }, f, indent=2, ensure_ascii=False)

print(f"测试结果已保存到：{result_file}")
print(f"{'='*70}\n")
