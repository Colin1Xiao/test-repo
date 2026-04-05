#!/usr/bin/env python3
"""
Profit Reality Audit System (PRAS)
收益真实性审计系统

核心目标：判断收益是否"真实可复制"

四大审计维度：
1. 盈亏分布（Profit Distribution）
2. 滑点 vs 收益（Slippage vs Profit）
3. 过滤率（Filter Efficiency）
4. 错误执行（Execution Errors）
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class SystemVerdict(Enum):
    """系统裁决结果"""
    STRONG_EDGE_CONFIRMED = "✅ STRONG_EDGE_CONFIRMED"
    STRONG_EDGE = "✅ STRONG_EDGE"
    WEAK_EDGE = "⚠️ WEAK_EDGE"
    EDGE_ERODED = "⚠️ EDGE_ERODED"
    NO_EDGE = "❌ NO_EDGE"
    FAIL_EXECUTION = "❌ FAIL_EXECUTION"
    TOO_STRICT = "⚠️ TOO_STRICT"
    LOW_CONFIDENCE = "⚠️ LOW_CONFIDENCE"
    RISK_TOO_HIGH = "❌ RISK_TOO_HIGH"

class Confidence(Enum):
    """置信度"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class TradeRecord:
    """交易记录"""
    timestamp: str
    symbol: str
    signal_price: float
    execution_price: float
    exit_price: float = 0.0
    pnl_pct: float = 0.0
    slippage_pct: float = 0.0
    fees_pct: float = 0.0
    latency_ms: float = 0.0
    regime: str = ""
    score: int = 0
    is_win: bool = False
    reject_reason: str = ""
    is_error: bool = False


@dataclass
class ProfitStats:
    """盈亏统计"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    total_profit: float = 0.0
    total_loss: float = 0.0
    profit_factor: float = 0.0  # 总盈利 / 总亏损
    expectancy: float = 0.0  # 单笔期望
    max_drawdown: float = 0.0
    confidence: str = "LOW"  # 样本置信度


@dataclass
class SlippageStats:
    """滑点统计"""
    total_slippage: float = 0.0
    avg_slippage: float = 0.0
    max_slippage: float = 0.0
    slippage_to_profit_ratio: float = 0.0  # 滑点/利润比


@dataclass
class FilterStats:
    """过滤统计"""
    total_signals: int = 0
    accepted_signals: int = 0
    rejected_signals: int = 0
    filter_rate: float = 0.0
    reject_reasons: Dict[str, int] = field(default_factory=dict)


@dataclass
class ExecutionStats:
    """执行统计"""
    total_executions: int = 0
    successful_executions: int = 0
    error_count: int = 0
    error_rate: float = 0.0
    errors: List[str] = field(default_factory=list)


@dataclass
class AuditReport:
    """审计报告"""
    timestamp: str
    profit_stats: ProfitStats
    slippage_stats: SlippageStats
    filter_stats: FilterStats
    execution_stats: ExecutionStats
    verdict: str
    verdict_detail: str
    confidence: str = "LOW"
    can_scale_capital: bool = False  # 是否可放大资金


class ProfitAuditor:
    """
    收益真实性审计器
    
    使用方式：
    auditor = ProfitAuditor()
    auditor.record_trade(trade_record)
    report = auditor.generate_report()
    """
    
    def __init__(self, report_interval: int = 10):
        """
        初始化
        
        Args:
            report_interval: 报告间隔（每N笔交易）
        """
        self.report_interval = report_interval
        
        # 交易记录
        self.trades: List[TradeRecord] = []
        
        # 统计缓存
        self._profit_stats: Optional[ProfitStats] = None
        self._slippage_stats: Optional[SlippageStats] = None
        self._filter_stats: Optional[FilterStats] = None
        self._execution_stats: Optional[ExecutionStats] = None
    
    def record_trade(self, trade: TradeRecord):
        """记录交易"""
        self.trades.append(trade)
        self._invalidate_cache()
        
        # 定期输出报告
        if len(self.trades) % self.report_interval == 0:
            report = self.generate_report()
            self._print_report(report)
    
    def _invalidate_cache(self):
        """清除缓存"""
        self._profit_stats = None
        self._slippage_stats = None
        self._filter_stats = None
        self._execution_stats = None
    
    def _calc_profit_stats(self) -> ProfitStats:
        """计算盈亏统计"""
        if not self.trades:
            return ProfitStats()
        
        # 只统计已完成的交易（有 pnl_pct）
        completed = [t for t in self.trades if t.pnl_pct != 0 and not t.is_error]
        
        if not completed:
            return ProfitStats(total_trades=len(self.trades))
        
        wins = [t for t in completed if t.is_win]
        losses = [t for t in completed if not t.is_win]
        
        total_profit = sum(t.pnl_pct for t in wins)
        total_loss = abs(sum(t.pnl_pct for t in losses))
        
        avg_win = total_profit / len(wins) if wins else 0
        avg_loss = total_loss / len(losses) if losses else 0
        
        profit_factor = total_profit / total_loss if total_loss > 0 else float('inf')
        
        # 期望值
        win_rate = len(wins) / len(completed)
        expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)
        
        # 最大回撤
        cumulative = 0
        max_dd = 0
        peak = 0
        for t in completed:
            cumulative += t.pnl_pct
            if cumulative > peak:
                peak = cumulative
            dd = peak - cumulative
            if dd > max_dd:
                max_dd = dd
        
        # 样本置信度
        n = len(completed)
        if n < 30:
            confidence = "LOW"
        elif n < 80:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"
        
        return ProfitStats(
            total_trades=n,
            winning_trades=len(wins),
            losing_trades=len(losses),
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            total_profit=total_profit,
            total_loss=total_loss,
            profit_factor=profit_factor,
            expectancy=expectancy,
            max_drawdown=max_dd,
            confidence=confidence
        )
    
    def _calc_slippage_stats(self) -> SlippageStats:
        """计算滑点统计"""
        completed = [t for t in self.trades if t.pnl_pct != 0 and not t.is_error]
        
        if not completed:
            return SlippageStats()
        
        slippages = [abs(t.slippage_pct) for t in completed]
        total_slippage = sum(slippages)
        
        stats = SlippageStats(
            total_slippage=total_slippage,
            avg_slippage=total_slippage / len(completed),
            max_slippage=max(slippages)
        )
        
        # 滑点/利润比
        profit_stats = self._calc_profit_stats()
        if profit_stats.total_profit > 0:
            stats.slippage_to_profit_ratio = total_slippage / profit_stats.total_profit
        
        return stats
    
    def _calc_filter_stats(self) -> FilterStats:
        """计算过滤统计"""
        all_trades = self.trades
        
        accepted = [t for t in all_trades if not t.reject_reason and not t.is_error]
        rejected = [t for t in all_trades if t.reject_reason]
        
        # 统计拒绝原因
        reject_reasons = {}
        for t in rejected:
            reason = t.reject_reason or "unknown"
            reject_reasons[reason] = reject_reasons.get(reason, 0) + 1
        
        total = len(all_trades)
        filter_rate = len(rejected) / total if total > 0 else 0
        
        return FilterStats(
            total_signals=total,
            accepted_signals=len(accepted),
            rejected_signals=len(rejected),
            filter_rate=filter_rate,
            reject_reasons=reject_reasons
        )
    
    def _calc_execution_stats(self) -> ExecutionStats:
        """计算执行统计"""
        all_trades = self.trades
        
        errors = [t for t in all_trades if t.is_error]
        successful = [t for t in all_trades if not t.is_error and not t.reject_reason]
        
        total = len(all_trades)
        error_rate = len(errors) / total if total > 0 else 0
        
        return ExecutionStats(
            total_executions=total,
            successful_executions=len(successful),
            error_count=len(errors),
            error_rate=error_rate,
            errors=[f"{t.timestamp}: {t.reject_reason}" for t in errors[:10]]
        )
    
    def evaluate_system(self) -> SystemVerdict:
        """评估系统状态（升级版：置信度 + 回撤判定）"""
        execution = self._calc_execution_stats()
        
        # ❌ 硬失败：执行错误
        if execution.error_count > 0:
            return SystemVerdict.FAIL_EXECUTION
        
        profit = self._calc_profit_stats()
        
        # ❌ 硬失败：负期望
        if profit.expectancy <= 0:
            return SystemVerdict.NO_EDGE
        
        # ⚠️ 样本不足：低置信度
        if profit.total_trades < 30:
            return SystemVerdict.LOW_CONFIDENCE
        
        # ❌ 回撤过大：风险过高
        if profit.max_drawdown > 10:  # 10%
            return SystemVerdict.RISK_TOO_HIGH
        
        slippage = self._calc_slippage_stats()
        
        # ⚠️ 滑点吃掉 50% 利润
        if slippage.slippage_to_profit_ratio > 0.5:
            return SystemVerdict.EDGE_ERODED
        
        filter_stats = self._calc_filter_stats()
        
        # ⚠️ 过滤率 > 90%
        if filter_stats.filter_rate > 0.9:
            return SystemVerdict.TOO_STRICT
        
        # ✅ 强边缘确认（需要足够样本）
        if profit.profit_factor > 1.5 and profit.total_trades >= 50:
            return SystemVerdict.STRONG_EDGE_CONFIRMED
        
        # ✅ 强边缘（样本不足但指标好）
        if profit.profit_factor > 1.5:
            return SystemVerdict.STRONG_EDGE
        
        return SystemVerdict.WEAK_EDGE
    
    def generate_report(self) -> AuditReport:
        """生成审计报告"""
        self._profit_stats = self._calc_profit_stats()
        self._slippage_stats = self._calc_slippage_stats()
        self._filter_stats = self._calc_filter_stats()
        self._execution_stats = self._calc_execution_stats()
        
        verdict = self.evaluate_system()
        
        # 判断是否可放大资金
        can_scale = (
            verdict in [SystemVerdict.STRONG_EDGE_CONFIRMED] and
            self._profit_stats.total_trades >= 50 and
            self._profit_stats.max_drawdown < 10 and
            self._slippage_stats.slippage_to_profit_ratio < 0.4
        )
        
        # 裁决详情
        details = []
        if self._execution_stats.error_count > 0:
            details.append(f"执行错误: {self._execution_stats.error_count} 次")
        if self._profit_stats.total_trades < 30:
            details.append(f"样本不足: {self._profit_stats.total_trades} < 30")
        if self._profit_stats.expectancy <= 0:
            details.append(f"期望值为负: {self._profit_stats.expectancy:.4f}")
        if self._profit_stats.max_drawdown > 10:
            details.append(f"回撤过大: {self._profit_stats.max_drawdown:.1f}%")
        if self._slippage_stats.slippage_to_profit_ratio > 0.5:
            details.append(f"滑点吃掉利润: {self._slippage_stats.slippage_to_profit_ratio*100:.1f}%")
        if self._filter_stats.filter_rate > 0.9:
            details.append(f"过度过滤: {self._filter_stats.filter_rate*100:.1f}%")
        
        return AuditReport(
            timestamp=datetime.now().isoformat(),
            profit_stats=self._profit_stats,
            slippage_stats=self._slippage_stats,
            filter_stats=self._filter_stats,
            execution_stats=self._execution_stats,
            verdict=verdict.value,
            verdict_detail="; ".join(details) if details else "系统状态正常",
            confidence=self._profit_stats.confidence,
            can_scale_capital=can_scale
        )
    
    def _print_report(self, report: AuditReport):
        """打印报告"""
        print("\n" + "=" * 60)
        print("📊 PROFIT REALITY AUDIT REPORT")
        print("=" * 60)
        print(f"时间: {report.timestamp}")
        print(f"交易数: {report.profit_stats.total_trades}")
        print(f"置信度: {report.confidence}")
        
        print("\n📈 盈亏分布:")
        print(f"  胜率: {report.profit_stats.win_rate*100:.1f}%")
        print(f"  盈亏比: {report.profit_stats.profit_factor:.2f}")
        print(f"  期望值: {report.profit_stats.expectancy:.4f}")
        print(f"  最大回撤: {report.profit_stats.max_drawdown:.2f}%")
        
        print("\n💰 滑点统计:")
        print(f"  平均滑点: {report.slippage_stats.avg_slippage:.4f}%")
        print(f"  滑点/利润: {report.slippage_stats.slippage_to_profit_ratio*100:.1f}%")
        
        print("\n🔍 过滤统计:")
        print(f"  过滤率: {report.filter_stats.filter_rate*100:.1f}%")
        if report.filter_stats.reject_reasons:
            print(f"  拒绝原因: {report.filter_stats.reject_reasons}")
        
        print("\n⚡ 执行统计:")
        print(f"  成功率: {(1-report.execution_stats.error_rate)*100:.1f}%")
        print(f"  错误数: {report.execution_stats.error_count}")
        
        print(f"\n🎯 裁决: {report.verdict}")
        if report.verdict_detail:
            print(f"   详情: {report.verdict_detail}")
        
        print(f"\n💰 资金决策: {'✅ 可以放大资金' if report.can_scale_capital else '❌ 不建议放大资金'}")
        
        print("=" * 60 + "\n")
    
    def save_report(self, filepath: str = "logs/profit_audit.json"):
        """保存报告"""
        report = self.generate_report()
        
        # 转换为可序列化格式
        data = {
            'timestamp': report.timestamp,
            'verdict': report.verdict,
            'verdict_detail': report.verdict_detail,
            'profit_stats': asdict(report.profit_stats),
            'slippage_stats': asdict(report.slippage_stats),
            'filter_stats': asdict(report.filter_stats),
            'execution_stats': asdict(report.execution_stats)
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filepath


# 全局实例
_auditor: Optional[ProfitAuditor] = None


def get_profit_auditor() -> ProfitAuditor:
    """获取全局审计器"""
    global _auditor
    if _auditor is None:
        _auditor = ProfitAuditor()
    return _auditor


# 测试
if __name__ == "__main__":
    print("🧪 收益真实性审计系统测试")
    
    auditor = ProfitAuditor(report_interval=5)
    
    # 模拟交易
    import random
    
    for i in range(15):
        trade = TradeRecord(
            timestamp=datetime.now().isoformat(),
            symbol="ETH/USDT:USDT",
            signal_price=2200 + random.uniform(-10, 10),
            execution_price=2200 + random.uniform(-15, 15),
            pnl_pct=random.uniform(-0.5, 0.8),
            slippage_pct=random.uniform(0.01, 0.15),
            latency_ms=random.uniform(800, 1500),
            is_win=random.random() > 0.45
        )
        auditor.record_trade(trade)
        time.sleep(0.1)
    
    # 最终报告
    auditor.save_report()