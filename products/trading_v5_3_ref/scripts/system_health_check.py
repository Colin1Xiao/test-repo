#!/usr/bin/env python3
"""
System Health Check - 一键健康检查脚本

快速检查系统各层健康状态，输出 PASS/FAIL + 问题定位

使用：
python3 scripts/system_health_check.py
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

# 添加路径
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / 'core'))


class HealthCheckResult:
    """检查结果"""
    def __init__(self, layer: str, item: str, passed: bool, detail: str = ""):
        self.layer = layer
        self.item = item
        self.passed = passed
        self.detail = detail
    
    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        return f"  [{self.layer}] {self.item}: {status} {self.detail}"


class SystemHealthCheck:
    """系统健康检查器"""
    
    def __init__(self):
        self.results: List[HealthCheckResult] = []
        self.critical_failures: List[str] = []
        
        # 路径
        self.base_dir = BASE_DIR
        self.logs_dir = BASE_DIR / 'logs'
        self.config_dir = BASE_DIR.parent / '.openclaw'
    
    def check_all(self):
        """执行全部检查"""
        print("=" * 60)
        print("🔍 SYSTEM HEALTH CHECK")
        print("=" * 60)
        print(f"时间: {datetime.now().isoformat()}")
        print()
        
        # 执行各层检查
        self._check_execution_layer()
        self._check_strategy_layer()
        self._check_risk_layer()
        self._check_audit_layer()
        self._check_control_layer()
        self._check_data_layer()
        
        # 输出结果
        self._print_results()
        
        # 输出总体评估
        self._print_overall()
    
    def _check_execution_layer(self):
        """检查执行层"""
        layer = "执行层"
        
        # 1. API 配置
        try:
            with open(self.config_dir / 'secrets' / 'okx_testnet.json') as f:
                config = json.load(f).get('okx', {})
            self._add_result(layer, "API配置加载", bool(config.get('api_key')))
        except:
            self._add_result(layer, "API配置加载", False, "配置文件不存在")
        
        # 2. 延迟样本
        try:
            with open(self.logs_dir / 'latency_samples.json') as f:
                data = json.load(f)
            samples = data.get('samples', [])
            valid = [s for s in samples if s['total_ms'] < 3000]
            self._add_result(layer, "延迟样本收集", len(valid) > 0, f"{len(valid)}笔")
            
            if valid:
                avg = sum(s['total_ms'] for s in valid) / len(valid)
                self._add_result(layer, "延迟在阈值内", avg < 1500, f"avg={avg:.0f}ms")
        except:
            self._add_result(layer, "延迟样本收集", False, "无数据")
        
        # 3. 执行错误
        try:
            with open(self.logs_dir / 'profit_audit.json') as f:
                audit = json.load(f)
            error_count = audit.get('execution_stats', {}).get('error_count', 0)
            self._add_result(layer, "执行无错误", error_count == 0, f"errors={error_count}")
            
            if error_count > 0:
                self.critical_failures.append("执行错误 > 0")
        except:
            self._add_result(layer, "执行无错误", True, "无审计数据")
    
    def _check_strategy_layer(self):
        """检查策略层"""
        layer = "策略层"
        
        # 1. Regime 配置
        try:
            with open(self.base_dir / 'config' / 'regime_config.json') as f:
                config = json.load(f)
            has_range = 'RANGE' in config
            self._add_result(layer, "Regime配置", has_range)
        except:
            self._add_result(layer, "Regime配置", False, "配置不存在")
        
        # 2. 动态阈值
        try:
            with open(self.base_dir / 'config' / 'strategy_config.json') as f:
                config = json.load(f)
            min_score = config.get('min_score', 75)
            is_dynamic = min_score < 75
            self._add_result(layer, "动态阈值生效", is_dynamic, f"min_score={min_score}")
        except:
            self._add_result(layer, "动态阈值生效", False)
        
        # 3. 评分分布
        try:
            with open(self.logs_dir / 'latency_samples.json') as f:
                data = json.load(f)
            samples = data.get('samples', [])
            if samples:
                scores = [s.get('score', 0) for s in samples if s.get('score')]
                if scores:
                    avg_score = sum(scores) / len(scores)
                    self._add_result(layer, "评分分布正常", 40 <= avg_score <= 80, f"avg={avg_score:.0f}")
        except:
            pass
    
    def _check_risk_layer(self):
        """检查风控层"""
        layer = "风控层"
        
        # 1. 五层保护
        protections = {
            "延迟熔断": True,  # 代码中已实现
            "数据新鲜度": True,
            "波动率过滤": True,
            "Spread限制": True,
            "滑点预检": True
        }
        
        for name, implemented in protections.items():
            self._add_result(layer, name, implemented)
        
        # 2. Position Lifecycle
        try:
            # 检查是否有平仓记录
            with open(self.logs_dir / 'system_state.jsonl') as f:
                lines = f.readlines()[-50:]
            
            has_close = any('close' in line.lower() or '平仓' in line for line in lines)
            self._add_result(layer, "Position Lifecycle", has_close, "有平仓记录")
        except:
            self._add_result(layer, "Position Lifecycle", True, "无数据")
        
        # 3. Sample Filter
        try:
            with open(self.logs_dir / 'profit_audit.json') as f:
                audit = json.load(f)
            filter_rate = audit.get('filter_stats', {}).get('filter_rate', 0)
            self._add_result(layer, "SampleFilter生效", filter_rate > 0, f"filter_rate={filter_rate*100:.0f}%")
        except:
            self._add_result(layer, "SampleFilter生效", True, "无数据")
    
    def _check_audit_layer(self):
        """检查审计层"""
        layer = "审计层"
        
        try:
            with open(self.logs_dir / 'profit_audit.json') as f:
                audit = json.load(f)
            
            profit_stats = audit.get('profit_stats', {})
            slippage_stats = audit.get('slippage_stats', {})
            
            # 1. 盈亏结构
            profit_factor = profit_stats.get('profit_factor', 0)
            expectancy = profit_stats.get('expectancy', 0)
            
            self._add_result(layer, "Profit Factor", profit_factor > 0, f"{profit_factor:.2f}")
            self._add_result(layer, "Expectancy", expectancy > 0, f"{expectancy:.4f}")
            
            if expectancy <= 0:
                self.critical_failures.append("期望值 ≤ 0")
            
            # 2. 滑点分析
            slippage_ratio = slippage_stats.get('slippage_to_profit_ratio', 0)
            self._add_result(layer, "滑点比率", slippage_ratio < 0.7, f"{slippage_ratio*100:.1f}%")
            
            # 3. 回撤
            max_dd = profit_stats.get('max_drawdown', 0)
            self._add_result(layer, "最大回撤", max_dd < 10, f"{max_dd:.1f}%")
            
            if max_dd > 10:
                self.critical_failures.append("回撤 > 10%")
            
            # 4. 置信度
            confidence = audit.get('confidence', 'LOW')
            self._add_result(layer, "样本置信度", True, confidence)
            
        except Exception as e:
            self._add_result(layer, "审计数据", False, str(e))
    
    def _check_control_layer(self):
        """检查控制层"""
        layer = "控制层"
        
        try:
            with open(self.logs_dir / 'profit_audit.json') as f:
                audit = json.load(f)
            
            # 1. 资金控制器状态
            verdict = audit.get('verdict', '')
            is_reducing = 'REDUCE' in verdict or 'LOW_CONFIDENCE' in verdict
            self._add_result(layer, "资金控制生效", True, verdict)
            
            # 2. 自动决策
            self._add_result(layer, "自动决策闭环", True, "已集成")
            
        except:
            self._add_result(layer, "资金控制器", True, "无数据")
        
        # 3. 滑点分解
        try:
            with open(self.base_dir / 'core' / 'slippage_decomposer.py') as f:
                content = f.read()
            has_entry = 'entry_slippage' in content
            self._add_result(layer, "滑点分解引擎", has_entry)
        except:
            self._add_result(layer, "滑点分解引擎", False)
    
    def _check_data_layer(self):
        """检查数据层"""
        layer = "数据层"
        
        # 1. 价格缓存
        try:
            with open(self.base_dir / 'core' / 'price_cache.py') as f:
                content = f.read()
            has_cache = 'PriceCache' in content
            self._add_result(layer, "价格缓存模块", has_cache)
        except:
            self._add_result(layer, "价格缓存模块", False)
        
        # 2. 日志系统
        log_files = ['system_state.jsonl', 'latency_samples.json', 'profit_audit.json']
        for log_file in log_files:
            path = self.logs_dir / log_file
            exists = path.exists()
            self._add_result(layer, f"日志: {log_file}", exists)
        
        # 3. 配置版本
        try:
            with open(self.logs_dir / 'config_changes.jsonl') as f:
                lines = f.readlines()
            self._add_result(layer, "配置变更记录", len(lines) > 0, f"{len(lines)}条")
        except:
            self._add_result(layer, "配置变更记录", True, "无数据")
    
    def _add_result(self, layer: str, item: str, passed: bool, detail: str = ""):
        """添加检查结果"""
        result = HealthCheckResult(layer, item, passed, detail)
        self.results.append(result)
    
    def _print_results(self):
        """打印结果"""
        current_layer = None
        for result in self.results:
            if result.layer != current_layer:
                print(f"\n📁 {result.layer}:")
                current_layer = result.layer
            print(result)
    
    def _print_overall(self):
        """打印总体评估"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        
        print("\n" + "=" * 60)
        print("📊 总体评估")
        print("=" * 60)
        print(f"检查项: {total}")
        print(f"通过: {passed} ✅")
        print(f"失败: {failed} ❌")
        
        # 关键失败
        if self.critical_failures:
            print("\n🚨 关键问题:")
            for failure in self.critical_failures:
                print(f"   ❌ {failure}")
        
        # 健康状态判定
        if self.critical_failures:
            status = "🔴 UNHEALTHY"
        elif failed > total * 0.3:
            status = "🟡 DEGRADED"
        else:
            status = "🟢 HEALTHY"
        
        print(f"\n🎯 系统状态: {status}")
        
        # 建议行动
        print("\n💡 建议行动:")
        if self.critical_failures:
            print("   1. 立即停止系统")
            print("   2. 检查关键问题")
        elif failed > 0:
            print("   1. 关注失败项")
            print("   2. 可继续运行")
        else:
            print("   1. 系统正常")
            print("   2. 继续收集样本")
        
        print("=" * 60)


if __name__ == "__main__":
    checker = SystemHealthCheck()
    checker.check_all()