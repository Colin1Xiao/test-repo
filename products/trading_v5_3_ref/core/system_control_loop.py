#!/usr/bin/env python3
"""
System Control Loop - 系统主控制循环

整合：
1. 收益审计系统
2. 资金控制器
3. 滑点分解引擎

输出：完整的系统健康报告和资金决策
"""

import json
from datetime import datetime
from typing import Dict, Optional
from dataclasses import dataclass

from profit_audit import ProfitAuditor, AuditReport, SystemVerdict
from capital_controller import CapitalController, CapitalDecision, SystemState
from slippage_decomposer import SlippageDecomposer, SlippageBreakdown


@dataclass
class SystemControlReport:
    """系统控制报告"""
    timestamp: str
    audit_verdict: str
    capital_state: str
    position_usd: float
    can_trade: bool
    slippage_source: str
    
    profit_factor: float
    expectancy: float
    max_drawdown: float
    slippage_ratio: float
    confidence: str
    
    should_stop: bool
    should_reduce: bool
    can_scale_up: bool
    
    recommendations: list


class SystemControlLoop:
    """系统主控制循环"""
    
    def __init__(self, auditor, controller, decomposer):
        self.auditor = auditor
        self.controller = controller
        self.decomposer = decomposer
    
    def evaluate(self) -> SystemControlReport:
        """评估系统状态并做出决策"""
        audit_report = self.auditor.generate_report()
        
        audit_dict = {
            'verdict': audit_report.verdict,
            'profit_stats': {
                'expectancy': audit_report.profit_stats.expectancy,
                'max_drawdown': audit_report.profit_stats.max_drawdown,
                'profit_factor': audit_report.profit_stats.profit_factor,
                'total_trades': audit_report.profit_stats.total_trades
            },
            'slippage_stats': {
                'slippage_to_profit_ratio': audit_report.slippage_stats.slippage_to_profit_ratio
            },
            'execution_stats': {
                'error_count': audit_report.execution_stats.error_count
            },
            'confidence': audit_report.confidence
        }
        
        capital_decision = self.controller.decide(audit_dict)
        slippage_breakdown = self.decomposer.analyze()
        slippage_source = self.decomposer.get_dominant_source()
        recommendations = self.decomposer.get_recommendations()
        
        if capital_decision.state == SystemState.STOP:
            recommendations.insert(0, "🛑 系统停止：请检查错误")
        elif capital_decision.state == SystemState.REDUCE:
            recommendations.insert(0, f"⚠️ 建议减仓：{capital_decision.reason}")
        
        return SystemControlReport(
            timestamp=datetime.now().isoformat(),
            audit_verdict=audit_report.verdict,
            capital_state=capital_decision.state.value,
            position_usd=self.controller.get_position_size(),
            can_trade=self.controller.can_trade(),
            slippage_source=slippage_source,
            profit_factor=audit_report.profit_stats.profit_factor,
            expectancy=audit_report.profit_stats.expectancy,
            max_drawdown=audit_report.profit_stats.max_drawdown,
            slippage_ratio=audit_report.slippage_stats.slippage_to_profit_ratio,
            confidence=audit_report.confidence,
            should_stop=self.controller.should_stop(),
            should_reduce=self.controller.should_reduce(),
            can_scale_up=audit_report.can_scale_capital,
            recommendations=recommendations
        )
    
    def report(self) -> str:
        """生成完整报告"""
        r = self.evaluate()
        
        output = f"""
{'='*60}
📊 SYSTEM CONTROL REPORT
{'='*60}
时间: {r.timestamp}

🎯 系统状态:
   审计裁决: {r.audit_verdict}
   资金状态: {r.capital_state}
   当前仓位: {r.position_usd:.1f} USD
   置信度: {r.confidence}

📈 核心指标:
   盈亏比: {r.profit_factor:.2f}
   期望值: {r.expectancy:.4f}
   最大回撤: {r.max_drawdown:.2f}%
   滑点/利润: {r.slippage_ratio*100:.1f}%

🔍 滑点来源: {r.slippage_source}

🚦 决策:
   可交易: {'✅' if r.can_trade else '❌'}
   应减仓: {'⚠️' if r.should_reduce else '✅ 无需'}
   可放大: {'✅' if r.can_scale_up else '❌ 暂不可'}

💡 建议:
"""
        for rec in r.recommendations:
            output += f"   {rec}\n"
        
        output += f"{'='*60}"
        return output


if __name__ == "__main__":
    print("🧪 系统主控制循环测试")
    
    from profit_audit import TradeRecord
    import random
    
    auditor = ProfitAuditor()
    controller = CapitalController()
    decomposer = SlippageDecomposer()
    
    loop = SystemControlLoop(auditor, controller, decomposer)
    
    for i in range(15):
        trade = TradeRecord(
            timestamp=datetime.now().isoformat(),
            symbol="ETH/USDT:USDT",
            signal_price=2200,
            execution_price=2200 + random.uniform(-2, 5),
            pnl_pct=random.uniform(-0.3, 0.5),
            slippage_pct=random.uniform(0.02, 0.12),
            latency_ms=random.uniform(900, 1400),
            is_win=random.random() > 0.45
        )
        auditor.record_trade(trade)
        
        decomposer.record_trade({
            'signal_price': 2200,
            'execution_price': trade.execution_price,
            'slippage_pct': trade.slippage_pct,
            'latency_ms': trade.latency_ms,
            'spread_pct': random.uniform(0.01, 0.04)
        })
    
    print(loop.report())