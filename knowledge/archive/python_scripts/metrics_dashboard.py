#!/usr/bin/env python3
"""
OpenClaw 指标监控面板
Metrics Dashboard for Multi-Model System
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List
from observability_logger import logger, TaskStatus


class MetricsDashboard:
    """指标监控面板"""
    
    def __init__(self):
        self.logger = logger
    
    def generate_daily_report(self) -> Dict:
        """生成每日报告"""
        report = self.logger.get_key_metrics_report()
        
        print("=" * 70)
        print("📊 OpenClaw 每日指标报告")
        print("=" * 70)
        print(f"生成时间: {report['generated_at']}")
        print()
        
        # 总体统计
        summary = report['summary']
        print("【总体统计】")
        print(f"  总请求数: {summary['total_requests']}")
        print(f"  成功: {summary['success']} ({summary['success_rate']:.1%})")
        print(f"  超时: {summary['timeout']}")
        print(f"  失败: {summary['failed']}")
        print(f"  平均耗时: {summary['avg_duration_ms']:.0f}ms")
        print()
        
        # 最慢模型
        print("【最慢模型 Top 3】")
        for i, model in enumerate(report['model_performance']['slowest_models'], 1):
            print(f"  {i}. {model['model']}")
            print(f"     平均: {model['avg_duration_ms']:.0f}ms | P95: {model['p95_duration_ms']:.0f}ms")
        print()
        
        # 最不稳定模型
        print("【最不稳定模型 Top 3】")
        for i, model in enumerate(report['model_performance']['most_unstable_models'], 1):
            print(f"  {i}. {model['model']}")
            print(f"     成功率: {model['success_rate']:.1%} | 空输出: {model['empty_rate']:.1%} | 超时: {model['timeout_rate']:.1%}")
        print()
        
        # 异常汇总
        if report['exception_summary']:
            print("【异常分布】")
            for exc_type, count in sorted(report['exception_summary'].items(), key=lambda x: x[1], reverse=True):
                print(f"  {exc_type}: {count}")
            print()
        
        # 关键问题
        if report['top_issues']:
            print("【⚠️ 关键问题】")
            for issue in report['top_issues']:
                severity_emoji = "🔴" if issue['severity'] == 'high' else "🟡"
                print(f"  {severity_emoji} [{issue['model']}] {issue['issue']}")
                print(f"     值: {issue['value']} | 建议: {issue['recommendation']}")
        else:
            print("【✅ 系统健康】")
            print("  未发现关键问题")
        
        print()
        print("=" * 70)
        
        return report
    
    def check_grok_code_health(self) -> Dict:
        """GROK-CODE 健康检查"""
        obs = self.logger.get_grok_code_observation()
        
        print("\n" + "=" * 70)
        print("🔍 GROK-CODE 专项健康检查")
        print("=" * 70)
        
        print(f"总调用次数: {obs['total_calls']}")
        print(f"空输出次数: {obs['empty_count']} ({obs['empty_rate']:.1%})")
        print(f"超时次数: {obs['timeout_count']} ({obs['timeout_rate']:.1%})")
        print()
        print("【耗时分布】")
        print(f"  平均: {obs['avg_duration_ms']:.0f}ms")
        print(f"  P50: {obs['p50_duration_ms']:.0f}ms")
        print(f"  P95: {obs['p95_duration_ms']:.0f}ms")
        print(f"  最大: {obs['max_duration_ms']:.0f}ms")
        print()
        
        # 判断是否需要调整
        needs_adjustment = False
        reasons = []
        
        if obs['p95_duration_ms'] > 40000:
            needs_adjustment = True
            reasons.append(f"P95 ({obs['p95_duration_ms']:.0f}ms) 接近超时阈值")
        
        if obs['empty_rate'] > 0.05:
            needs_adjustment = True
            reasons.append(f"空输出率 ({obs['empty_rate']:.1%}) 超过 5%")
        
        if obs['timeout_rate'] > 0.05:
            needs_adjustment = True
            reasons.append(f"超时率 ({obs['timeout_rate']:.1%}) 超过 5%")
        
        if needs_adjustment:
            print("【⚠️ 建议调整】")
            for reason in reasons:
                print(f"  - {reason}")
            print(f"\n建议: {obs['recommendation']}")
        else:
            print("【✅ 健康状态良好】")
            print("  当前配置无需调整")
        
        print("=" * 70)
        
        return obs
    
    def generate_chain_analysis(self) -> Dict:
        """混合任务链路分析"""
        chain_stats = self.logger.get_chain_stats()
        
        print("\n" + "=" * 70)
        print("🔗 混合任务链路分析")
        print("=" * 70)
        
        if not chain_stats:
            print("暂无混合任务数据")
            return {}
        
        for chain_key, stats in chain_stats.items():
            print(f"\n链路: {chain_key}")
            print(f"  总调用: {stats['count']}")
            print(f"  完全成功: {stats['success']}")
            print(f"  部分成功: {stats.get('partial', 0)}")
            print(f"  失败: {stats['failed']}")
            print(f"  平均耗时: {stats.get('avg_duration_ms', 0):.0f}ms")
            
            if stats.get('step_failure_distribution'):
                print(f"  失败分布:")
                for step, count in sorted(stats['step_failure_distribution'].items(), key=lambda x: x[1], reverse=True):
                    print(f"    - {step}: {count} 次")
        
        print("=" * 70)
        
        return chain_stats
    
    def export_metrics(self, filepath: str = "/Users/colin/.openclaw/workspace/logs/metrics.json"):
        """导出指标到文件"""
        report = self.logger.get_key_metrics_report()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ 指标已导出到: {filepath}")


if __name__ == "__main__":
    dashboard = MetricsDashboard()
    
    # 生成每日报告
    dashboard.generate_daily_report()
    
    # GROK-CODE 健康检查
    dashboard.check_grok_code_health()
    
    # 链路分析
    dashboard.generate_chain_analysis()
    
    # 导出指标
    dashboard.export_metrics()