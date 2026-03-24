#!/usr/bin/env python3
"""
Comprehensive System Diagnosis
全面系统诊断脚本

诊断内容:
1. 核心模块完整性
2. 数据源连接状态
3. 代理配置状态
4. 整合信号生成器
5. 监控系统
6. 性能测试
"""

import sys
import json
import time
from datetime import datetime
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))

print("="*70)
print("🔍 全面系统诊断")
print("="*70)
print(f"诊断时间：{datetime.now().isoformat()}")
print("="*70)
print()

diagnosis_results = {
    'timestamp': datetime.now().isoformat(),
    'modules': {},
    'data_sources': {},
    'integration': {},
    'performance': {},
    'config': {},
    'issues': [],
    'recommendations': []
}

# ========== 诊断 1: 核心模块完整性 ==========
print("诊断 1: 核心模块完整性")
print("-"*70)

core_modules = [
    ('integrated_signal.py', '整合信号生成器'),
    ('unified_pipeline.py', '统一数据管道'),
    ('auto_monitor.py', '自动监控系统'),
    ('dashboard.py', '监控仪表板'),
    ('monitor_config.yaml', '监控配置文件'),
    ('setup_clashx_proxy.sh', 'ClashX 配置脚本'),
]

modules_ok = 0
for module, name in core_modules:
    module_path = Path(__file__).parent / module
    if module_path.exists():
        size = module_path.stat().st_size
        print(f"✅ {name}: {module} ({size/1024:.1f}KB)")
        diagnosis_results['modules'][module] = {'exists': True, 'size_kb': round(size/1024, 1)}
        modules_ok += 1
    else:
        print(f"❌ {name}: {module} (不存在)")
        diagnosis_results['modules'][module] = {'exists': False}
        diagnosis_results['issues'].append(f"缺失模块：{module}")

print(f"\n模块完整性：{modules_ok}/{len(core_modules)} ({modules_ok/len(core_modules)*100:.0f}%)")
print()

# ========== 诊断 2: 数据源连接状态 ==========
print("诊断 2: 数据源连接状态")
print("-"*70)

try:
    from unified_pipeline import UnifiedDataPipeline, PROXY_URL
    import asyncio
    
    pipeline = UnifiedDataPipeline()
    
    # 检查代理配置
    print(f"📋 代理配置:")
    print(f"   代理 URL: {PROXY_URL}")
    if PROXY_URL:
        print(f"   ✅ 代理已配置")
        diagnosis_results['data_sources']['proxy'] = {'configured': True, 'url': PROXY_URL}
    else:
        print(f"   ⚠️  代理未配置")
        diagnosis_results['data_sources']['proxy'] = {'configured': False}
    
    # 测试 OKX
    print(f"\n💰 OKX 市场数据:")
    try:
        market_data = asyncio.run(pipeline.fetch_market_data('BTC/USDT', '5m', 10))
        if 'ohlcv' in market_data and len(market_data['ohlcv']) > 0:
            print(f"   ✅ 连接正常 ({len(market_data['ohlcv'])} 根 K 线)")
            diagnosis_results['data_sources']['okx'] = {'status': 'ok', 'candles': len(market_data['ohlcv'])}
        else:
            print(f"   ⚠️  获取失败：{market_data.get('error', '未知错误')}")
            diagnosis_results['data_sources']['okx'] = {'status': 'error'}
    except Exception as e:
        print(f"   ❌ 连接失败：{e}")
        diagnosis_results['data_sources']['okx'] = {'status': 'error', 'error': str(e)}
    
    # 测试恐惧贪婪指数
    print(f"\n😨 恐惧贪婪指数:")
    try:
        fng = asyncio.run(pipeline.fetch_fear_greed())
        if 'value' in fng:
            print(f"   ✅ 获取成功：{fng['value']} ({fng['value_classification']})")
            diagnosis_results['data_sources']['fear_greed'] = {
                'status': 'ok',
                'value': fng['value'],
                'classification': fng['value_classification']
            }
        else:
            print(f"   ⚠️  获取失败：{fng.get('error', '未知错误')}")
            diagnosis_results['data_sources']['fear_greed'] = {'status': 'error'}
    except Exception as e:
        print(f"   ❌ 连接失败：{e}")
        diagnosis_results['data_sources']['fear_greed'] = {'status': 'error', 'error': str(e)}
    
    # 测试宏观事件
    print(f"\n📰 宏观事件:")
    try:
        macro = asyncio.run(pipeline.fetch_macro_events())
        events = macro.get('events', [])
        print(f"   ✅ 获取成功：{len(events)} 个事件")
        for event in events[:2]:
            print(f"      - {event['event']} ({event['date']})")
        diagnosis_results['data_sources']['macro_events'] = {
            'status': 'ok',
            'count': len(events)
        }
    except Exception as e:
        print(f"   ❌ 获取失败：{e}")
        diagnosis_results['data_sources']['macro_events'] = {'status': 'error'}
    
except Exception as e:
    print(f"\n❌ 数据源诊断失败：{e}")
    diagnosis_results['issues'].append(f"数据源诊断异常：{e}")

print()

# ========== 诊断 3: 整合信号生成器 ==========
print("诊断 3: 整合信号生成器")
print("-"*70)

try:
    from integrated_signal import IntegratedSignalGenerator, SignalType, MarketState
    
    generator = IntegratedSignalGenerator()
    print(f"✅ 信号生成器已加载")
    
    # 测试配置
    print(f"\n📋 配置参数:")
    print(f"   基础风险：{generator.config['base_risk']*100:.1f}%")
    print(f"   最大仓位：{generator.config['max_position']*100:.0f}%")
    print(f"   最大杠杆：{generator.config['max_leverage']}x")
    
    # 测试动态权重
    print(f"\n📊 动态权重配置:")
    for state in MarketState:
        tech_w, pred_w = generator.get_dynamic_weights(state)
        print(f"   {state.value}: 技术{tech_w*100:.0f}% + 预测{pred_w*100:.0f}%")
    
    diagnosis_results['integration']['signal_generator'] = {
        'status': 'ok',
        'config': generator.config
    }
    
except Exception as e:
    print(f"\n❌ 信号生成器加载失败：{e}")
    diagnosis_results['integration']['signal_generator'] = {'status': 'error', 'error': str(e)}
    diagnosis_results['issues'].append(f"信号生成器异常：{e}")

print()

# ========== 诊断 4: 监控系统 ==========
print("诊断 4: 监控系统")
print("-"*70)

monitor_path = Path(__file__).parent / 'auto_monitor.py'
if monitor_path.exists():
    with open(monitor_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    checks = [
        ('IntegratedSignalGenerator', '整合信号生成器'),
        ('analyze_predictive', '预测面分析'),
        ('analyze_technical', '技术面分析'),
        ('detect_market_state', '市场状态检测'),
    ]
    
    print(f"📋 功能整合检查:")
    integration_ok = 0
    for keyword, name in checks:
        if keyword in content:
            print(f"   ✅ {name}")
            integration_ok += 1
        else:
            print(f"   ⚠️  {name} (未整合)")
    
    diagnosis_results['integration']['monitor'] = {
        'status': 'ok' if integration_ok == len(checks) else 'partial',
        'features': integration_ok,
        'total': len(checks)
    }
else:
    print(f"❌ 监控脚本不存在")
    diagnosis_results['integration']['monitor'] = {'status': 'error'}

print()

# ========== 诊断 5: 性能测试 ==========
print("诊断 5: 性能测试")
print("-"*70)

try:
    # 测试信号生成速度
    from integrated_signal import IntegratedSignalGenerator
    generator = IntegratedSignalGenerator()
    
    print(f"⚡ 信号生成速度测试:")
    start = time.time()
    for i in range(100):
        # 模拟调用
        tech_w, pred_w = generator.get_dynamic_weights(MarketState.TREND)
    elapsed = time.time() - start
    per_call = elapsed / 100 * 1000  # 毫秒
    
    print(f"   100 次调用耗时：{elapsed*1000:.1f}ms")
    print(f"   平均每次：{per_call:.2f}ms")
    
    diagnosis_results['performance']['signal_generation'] = {
        'iterations': 100,
        'total_ms': round(elapsed*1000, 1),
        'per_call_ms': round(per_call, 2)
    }
    
    # 测试缓存性能
    print(f"\n⚡ 缓存性能测试:")
    from unified_pipeline import UnifiedDataPipeline
    pipeline = UnifiedDataPipeline()
    
    start = time.time()
    for i in range(100):
        pipeline._set_cache(f'test_{i}', {'data': i})
        pipeline._get_from_cache(f'test_{i}')
    elapsed = time.time() - start
    
    print(f"   100 次缓存操作：{elapsed*1000:.1f}ms")
    print(f"   ✅ 缓存功能正常")
    
    diagnosis_results['performance']['cache'] = {
        'iterations': 100,
        'total_ms': round(elapsed*1000, 1),
        'status': 'ok'
    }
    
except Exception as e:
    print(f"\n❌ 性能测试失败：{e}")
    diagnosis_results['performance'] = {'status': 'error', 'error': str(e)}

print()

# ========== 诊断 6: 配置文件 ==========
print("诊断 6: 配置文件")
print("-"*70)

config_files = [
    ('monitor_config.yaml', '监控配置'),
    ('proxy_config.json', '代理配置'),
]

for config_file, name in config_files:
    config_path = Path(__file__).parent / config_file
    if config_path.exists():
        print(f"✅ {name}: {config_file}")
        diagnosis_results['config'][config_file] = {'exists': True}
    else:
        print(f"⚠️  {name}: {config_file} (不存在)")
        diagnosis_results['config'][config_file] = {'exists': False}

print()

# ========== 诊断总结 ==========
print("="*70)
print("📊 诊断总结")
print("="*70)

# 计算总体健康度
modules_score = modules_ok / len(core_modules) * 100
data_score = sum(1 for v in diagnosis_results['data_sources'].values() if v.get('status') == 'ok') / max(len(diagnosis_results['data_sources']), 1) * 100
integration_score = diagnosis_results['integration'].get('monitor', {}).get('features', 0) / 4 * 100

overall_score = (modules_score + data_score + integration_score) / 3

print(f"""
模块完整性：  {modules_ok}/{len(core_modules)} ({modules_score:.0f}%)
数据源状态：  {int(data_score)}%
整合程度：    {integration_score:.0f}%

总体健康度：  {overall_score:.0f}%
""")

# 问题列表
if diagnosis_results['issues']:
    print("\n⚠️  发现问题:")
    for issue in diagnosis_results['issues']:
        print(f"   • {issue}")
else:
    print("\n✅ 未发现严重问题")

# 建议
print("\n💡 建议:")
if overall_score >= 90:
    print("   ✅ 系统状态优秀，可以投入使用")
    print("   📋 建议：启动模拟盘测试")
elif overall_score >= 70:
    print("   ✅ 系统状态良好，基本功能正常")
    print("   📋 建议：修复小问题后投入使用")
else:
    print("   ⚠️  系统存在一些问题")
    print("   📋 建议：先修复关键问题")

print("\n📋 下一步行动:")
print("   1. 启动监控系统：python3 auto_monitor.py")
print("   2. 查看实时数据：python3 unified_pipeline.py")
print("   3. 监控仪表板：python3 dashboard.py")

print("\n" + "="*70)

# 保存诊断报告
report_path = Path(__file__).parent / 'diagnosis_report.json'
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(diagnosis_results, f, indent=2, ensure_ascii=False, default=str)

print(f"📄 诊断报告已保存：{report_path}")
print("="*70)
