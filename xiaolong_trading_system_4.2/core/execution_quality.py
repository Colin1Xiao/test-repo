#!/usr/bin/env python3
"""
Execution Quality Evaluator - 执行质量评估器

评估：执行是否干净
过滤"看起来赚钱但不可复制"的交易

⚠️ 单位系统强制规范：
- 所有阈值使用 constants.py 中的常量
- 禁止硬编码
"""

from dataclasses import dataclass
from typing import Dict, Any, List
from datetime import datetime
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from constants import (
    PCT, BPS,
    MAX_SAMPLE_SLIPPAGE,
    MAX_SAMPLE_LATENCY,
    MIN_FILL_RATIO,
    assert_unit_valid
)


@dataclass
class ExecutionQualityReport:
    """执行质量报告"""
    score: float
    slippage_score: float
    latency_score: float
    structure_score: float
    
    is_clean: bool
    issues: List[str]
    
    def __str__(self):
        status = "✅ 干净" if self.is_clean else "⚠️ 有问题"
        return f"执行质量: {self.score:.2f} {status}"


class ExecutionQualityEvaluator:
    """
    执行质量评估器
    
    核心逻辑：
    1. 滑点评估 (40%) - 滑点是否在可接受范围
    2. 延迟评估 (30%) - 延迟是否过大
    3. 成交结构 (30%) - 是否完整成交
    
    关键作用：
    过滤"看起来赚钱但不可复制"的交易
    
    ⚠️ 评分必须有分布：
    - 如果全部 > 0.9，说明评估失效
    - 正常分布应在 0.6-0.9 区间
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化评估器
        """
        self.config = config or {}
        
        # 滑点阈值 - 使用单位常量
        self.slippage_excellent = 2 * BPS   # 0.02% - 优秀
        self.slippage_good = 3 * BPS        # 0.03% - 良好
        self.slippage_ok = 5 * BPS          # 0.05% - 可接受
        self.slippage_bad = 10 * BPS        # 0.1% - 差
        
        # 延迟阈值（秒）
        self.latency_excellent = 0.2       # 200ms - 优秀
        self.latency_good = 0.3            # 300ms - 良好
        self.latency_ok = 0.8              # 800ms - 可接受
        self.latency_bad = 1.5             # 1.5s - 差
        
        # 成交比阈值
        self.fill_excellent = 0.98         # 98% - 优秀
        self.fill_good = 0.95              # 95% - 良好
        self.fill_ok = MIN_FILL_RATIO      # 80% - 可接受
        
        # 干净执行阈值
        self.clean_threshold = 0.7
        
        # 统计
        self.evaluation_history = []
        
        print("📊 Execution Quality Evaluator 初始化完成")
        print(f"   滑点阈值: 优秀<{self.slippage_excellent/BPS:.0f}bps < 良好<{self.slippage_good/BPS:.0f}bps < 可接受<{self.slippage_ok/BPS:.0f}bps")
        print(f"   延迟阈值: 优秀<{self.latency_excellent*1000:.0f}ms < 良好<{self.latency_good*1000:.0f}ms < 可接受<{self.latency_ok*1000:.0f}ms")
        print(f"   干净执行阈值: {self.clean_threshold}")
    
    def evaluate(self, trade: Dict[str, Any]) -> ExecutionQualityReport:
        """
        评估执行质量
        
        Args:
            trade: 交易记录，需包含:
                - slippage: 滑点 (小数, 如 0.0003 = 0.03%)
                - latency / delay: 延迟 (秒)
                - fill_ratio: 成交比例 (小数, 如 0.95 = 95%)
        
        Returns:
            ExecutionQualityReport
        """
        issues = []
        
        # ============================================================
        # 提取参数
        # ============================================================
        slippage = abs(trade.get('slippage', 0))
        latency = trade.get('latency', trade.get('delay', 0))
        fill_ratio = trade.get('fill_ratio', 1.0)
        
        # ============================================================
        # 单位断言 - 防止单位混淆
        # ============================================================
        if slippage > 0.1:
            print(f"⚠️ 警告: slippage={slippage} 过大，可能单位错误")
            slippage = slippage * PCT  # 自动纠正
        
        # ============================================================
        # 评分逻辑 - 必须有梯度分布
        # ============================================================
        
        # 1. 滑点评分 (0-1，越高越好)
        slippage_score = self._score_slippage(slippage)
        if slippage_score < 0.7:
            issues.append(f"滑点偏高({slippage/BPS:.1f}bps)")
        
        # 2. 延迟评分 (0-1，越高越好)
        latency_score = self._score_latency(latency)
        if latency_score < 0.7:
            issues.append(f"延迟偏高({latency*1000:.0f}ms)")
        
        # 3. 成交比评分 (0-1，越高越好)
        structure_score = self._score_fill_ratio(fill_ratio)
        if structure_score < 0.8:
            issues.append(f"成交不完整({fill_ratio*100:.0f}%)")
        
        # ============================================================
        # 综合评分 (加权平均)
        # ============================================================
        # 权重：滑点 40%，延迟 30%，成交 30%
        score = (
            slippage_score * 0.4 +
            latency_score * 0.3 +
            structure_score * 0.3
        )
        
        # ============================================================
        # 判断是否干净
        # ============================================================
        is_clean = score >= self.clean_threshold and len(issues) == 0
        
        report = ExecutionQualityReport(
            score=round(score, 3),
            slippage_score=round(slippage_score, 3),
            latency_score=round(latency_score, 3),
            structure_score=round(structure_score, 3),
            is_clean=is_clean,
            issues=issues
        )
        
        # 记录历史
        self.evaluation_history.append({
            'timestamp': datetime.now().isoformat(),
            'score': score,
            'slippage_score': slippage_score,
            'latency_score': latency_score,
            'structure_score': structure_score,
            'is_clean': is_clean,
            'issues': issues
        })
        
        return report
    
    def _score_slippage(self, slippage: float) -> float:
        """
        滑点评分
        
        分数分布：
        - < 0.02%: 1.0 (优秀)
        - < 0.03%: 0.9 (良好)
        - < 0.05%: 0.75 (可接受)
        - < 0.1%:  0.5 (差)
        - >= 0.1%: 0.2 (极差)
        """
        if slippage <= self.slippage_excellent:
            return 1.0
        elif slippage <= self.slippage_good:
            return 0.9
        elif slippage <= self.slippage_ok:
            # 线性插值
            ratio = (slippage - self.slippage_good) / (self.slippage_ok - self.slippage_good)
            return 0.9 - ratio * 0.15
        elif slippage <= self.slippage_bad:
            ratio = (slippage - self.slippage_ok) / (self.slippage_bad - self.slippage_ok)
            return 0.75 - ratio * 0.25
        else:
            # 超出阈值，极低分
            return max(0.1, 0.5 - (slippage - self.slippage_bad) / self.slippage_bad * 0.4)
    
    def _score_latency(self, latency: float) -> float:
        """
        延迟评分
        
        分数分布：
        - < 200ms: 1.0 (优秀)
        - < 300ms: 0.9 (良好)
        - < 800ms: 0.75 (可接受)
        - < 1.5s:  0.5 (差)
        - >= 1.5s: 0.2 (极差)
        """
        if latency <= self.latency_excellent:
            return 1.0
        elif latency <= self.latency_good:
            return 0.9
        elif latency <= self.latency_ok:
            ratio = (latency - self.latency_good) / (self.latency_ok - self.latency_good)
            return 0.9 - ratio * 0.15
        elif latency <= self.latency_bad:
            ratio = (latency - self.latency_ok) / (self.latency_bad - self.latency_ok)
            return 0.75 - ratio * 0.25
        else:
            return max(0.1, 0.5 - (latency - self.latency_bad) / self.latency_bad * 0.4)
    
    def _score_fill_ratio(self, fill_ratio: float) -> float:
        """
        成交比评分
        
        分数分布：
        - >= 98%: 1.0 (优秀)
        - >= 95%: 0.9 (良好)
        - >= 80%: 0.7 (可接受)
        - < 80%:  线性下降
        """
        if fill_ratio >= self.fill_excellent:
            return 1.0
        elif fill_ratio >= self.fill_good:
            return 0.9
        elif fill_ratio >= self.fill_ok:
            ratio = (fill_ratio - self.fill_ok) / (self.fill_good - self.fill_ok)
            return 0.7 + ratio * 0.2
        else:
            # 低于阈值
            return fill_ratio / self.fill_ok * 0.7
    
    def get_stats(self, last_n: int = 50) -> Dict[str, Any]:
        """获取最近N笔执行的统计"""
        if not self.evaluation_history:
            return {}
        
        recent = self.evaluation_history[-last_n:]
        
        scores = [e['score'] for e in recent]
        clean_count = sum(1 for e in recent if e['is_clean'])
        
        # 分数分布
        score_distribution = {
            'excellent': sum(1 for s in scores if s >= 0.9),
            'good': sum(1 for s in scores if 0.7 <= s < 0.9),
            'acceptable': sum(1 for s in scores if 0.5 <= s < 0.7),
            'poor': sum(1 for s in scores if s < 0.5)
        }
        
        # 常见问题统计
        issue_counts = {}
        for e in recent:
            for issue in e.get('issues', []):
                key = issue.split('(')[0]
                issue_counts[key] = issue_counts.get(key, 0) + 1
        
        return {
            'count': len(recent),
            'avg_score': sum(scores) / len(scores) if scores else 0,
            'min_score': min(scores) if scores else 0,
            'max_score': max(scores) if scores else 0,
            'clean_rate': clean_count / len(recent) if recent else 0,
            'score_distribution': score_distribution,
            'common_issues': issue_counts
        }
    
    def print_stats(self, last_n: int = 50):
        """打印统计信息"""
        stats = self.get_stats(last_n)
        if not stats:
            print("暂无执行记录")
            return
        
        print("\n" + "="*60)
        print("📊 Execution Quality 统计")
        print("="*60)
        print(f"样本数: {stats['count']}")
        print(f"平均分: {stats['avg_score']:.2f}")
        print(f"最低分: {stats['min_score']:.2f}")
        print(f"最高分: {stats['max_score']:.2f}")
        print(f"干净率: {stats['clean_rate']*100:.1f}%")
        
        print("\n分数分布:")
        dist = stats['score_distribution']
        total = sum(dist.values())
        for level, count in dist.items():
            pct = count/total*100 if total else 0
            print(f"  {level}: {count} ({pct:.0f}%)")
        
        if stats['common_issues']:
            print("\n常见问题:")
            for issue, count in sorted(stats['common_issues'].items(), key=lambda x: -x[1]):
                print(f"  - {issue}: {count}")
        print("="*60)


# 创建默认实例
_default_evaluator = None

def get_evaluator() -> ExecutionQualityEvaluator:
    """获取全局评估器实例"""
    global _default_evaluator
    if _default_evaluator is None:
        _default_evaluator = ExecutionQualityEvaluator()
    return _default_evaluator


# ============================================================
# 测试代码
# ============================================================
if __name__ == "__main__":
    evaluator = ExecutionQualityEvaluator()
    
    # 测试样本 - 模拟真实分布
    test_trades = [
        {'slippage': 0.0001, 'latency': 0.15, 'fill_ratio': 0.99},   # 优秀
        {'slippage': 0.0003, 'latency': 0.25, 'fill_ratio': 0.96},   # 良好
        {'slippage': 0.0005, 'latency': 0.5, 'fill_ratio': 0.92},    # 可接受
        {'slippage': 0.001, 'latency': 1.0, 'fill_ratio': 0.88},     # 边缘
        {'slippage': 0.002, 'latency': 1.5, 'fill_ratio': 0.82},     # 差
        {'slippage': 0.005, 'latency': 2.0, 'fill_ratio': 0.75},     # 极差
        {'slippage': 0.5, 'latency': 0.3, 'fill_ratio': 0.95},       # 单位错误
    ]
    
    print("\n测试执行质量评估:")
    for i, trade in enumerate(test_trades):
        report = evaluator.evaluate(trade)
        print(f"\n样本 {i+1}:")
        print(f"  {report}")
        print(f"  滑点: {trade['slippage']/BPS:.1f}bps → {report.slippage_score:.2f}")
        print(f"  延迟: {trade['latency']*1000:.0f}ms → {report.latency_score:.2f}")
        print(f"  成交: {trade['fill_ratio']*100:.0f}% → {report.structure_score:.2f}")
    
    evaluator.print_stats()