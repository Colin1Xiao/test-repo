#!/usr/bin/env python3
"""
Live Ops Dashboard - 实盘运营监控面板

一眼看出：
1. Edge 是否在消失
2. 滑点是否在吞噬利润
3. 系统是否稳定
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class HealthStatus(Enum):
    HEALTHY = "🟢"
    WARNING = "🟡"
    CRITICAL = "🔴"
    DEAD = "💀"


class Verdict(Enum):
    """最终裁决"""
    HEALTHY = "🟢 HEALTHY"
    WEAK_EDGE = "🟡 WEAK_EDGE"
    EDGE_ERODED = "🟡 EDGE_ERODED"
    EDGE_DESTROYED = "🔴 EDGE_DESTROYED"
    NO_EDGE = "💀 NO_EDGE"
    SYSTEM_FAIL = "💀 SYSTEM_FAIL"


@dataclass
class EdgeHealth:
    profit_factor: float
    expectancy: float
    win_rate: float
    trend: str
    status: HealthStatus


@dataclass
class SlippageDrain:
    slippage_ratio: float
    drain_level: str
    status: HealthStatus


@dataclass
class SystemStability:
    error_count: int
    latency_p50: float
    latency_p90: float
    status: HealthStatus


@dataclass
class FinalVerdict:
    """最终裁决"""
    verdict: Verdict
    can_trade: bool
    should_reduce: bool
    can_scale: bool
    reasons: List[str]


class LiveOpsDashboard:
    """实盘运营监控面板"""
    
    def __init__(self, logs_dir: str = "logs"):
        self.logs_dir = Path(logs_dir)
        self.edge_health: Optional[EdgeHealth] = None
        self.slippage_drain: Optional[SlippageDrain] = None
        self.system_stability: Optional[SystemStability] = None
        self.final_verdict: Optional[FinalVerdict] = None
        self.alerts: List[str] = []
        self.pf_history: List[float] = []
    
    def load_data(self):
        """加载数据"""
        try:
            with open(self.logs_dir / 'profit_audit.json') as f:
                audit = json.load(f)
            
            ps = audit.get('profit_stats', {})
            ss = audit.get('slippage_stats', {})
            es = audit.get('execution_stats', {})
            fs = audit.get('filter_stats', {})
            
            pf = ps.get('profit_factor', 0)
            exp = ps.get('expectancy', 0)
            wr = ps.get('win_rate', 0)
            
            self.pf_history.append(pf)
            if len(self.pf_history) > 10:
                self.pf_history.pop(0)
            
            trend = "→"
            if len(self.pf_history) >= 3:
                recent = sum(self.pf_history[-3:]) / 3
                older = sum(self.pf_history[:3]) / 3 if len(self.pf_history) >= 6 else recent
                if recent > older * 1.1:
                    trend = "↑"
                elif recent < older * 0.9:
                    trend = "↓"
            
            if pf < 1.0 or exp <= 0:
                status = HealthStatus.DEAD
            elif pf < 1.3:
                status = HealthStatus.CRITICAL
            elif pf < 1.5:
                status = HealthStatus.WARNING
            else:
                status = HealthStatus.HEALTHY
            
            self.edge_health = EdgeHealth(pf, exp, wr, trend, status)
            
            sr = ss.get('slippage_to_profit_ratio', 0)
            if sr > 0.7:
                drain_level = "HIGH"
                status = HealthStatus.CRITICAL
            elif sr > 0.5:
                drain_level = "MEDIUM"
                status = HealthStatus.WARNING
            else:
                drain_level = "LOW"
                status = HealthStatus.HEALTHY
            
            self.slippage_drain = SlippageDrain(sr, drain_level, status)
            
            err = es.get('error_count', 0)
            
            try:
                with open(self.logs_dir / 'latency_samples.json') as f:
                    ld = json.load(f)
                samples = [s for s in ld.get('samples', []) if s.get('total_ms', 9999) < 3000]
                if samples:
                    totals = sorted([s['total_ms'] for s in samples])
                    p50 = totals[len(totals)//2]
                    p90 = totals[int(len(totals)*0.9)]
                else:
                    p50, p90 = 0, 0
            except:
                p50, p90 = 0, 0
            
            if err > 0 or p90 > 2000:
                status = HealthStatus.CRITICAL
            elif p90 > 1500:
                status = HealthStatus.WARNING
            else:
                status = HealthStatus.HEALTHY
            
            self.system_stability = SystemStability(err, p50, p90, status)
            self._generate_alerts()
            
        except Exception as e:
            self.alerts.append(f"⚠️ 数据加载失败: {e}")
    
    def _generate_alerts(self):
        self.alerts = []
        
        if self.edge_health:
            if self.edge_health.status == HealthStatus.DEAD:
                self.alerts.append("💀 EDGE消失！期望值为负")
            elif self.edge_health.status == HealthStatus.CRITICAL:
                self.alerts.append("⚠️ EDGE正在消失")
        
        if self.slippage_drain:
            if self.slippage_drain.status == HealthStatus.CRITICAL:
                self.alerts.append("🔴 滑点吞噬>70%利润")
        
        if self.system_stability:
            if self.system_stability.error_count > 0:
                self.alerts.append(f"🚨 执行错误{self.system_stability.error_count}次")
    
    def calculate_verdict(self) -> FinalVerdict:
        """
        计算最终裁决
        
        决策优先级（从高到低）:
        1. 执行错误 → SYSTEM_FAIL
        2. 期望值 ≤ 0 → NO_EDGE
        3. 滑点 > 70% → EDGE_DESTROYED
        4. 滑点 > 50% → EDGE_ERODED
        5. PF > 1.5 → HEALTHY
        6. 其他 → WEAK_EDGE
        """
        reasons = []
        
        # 1. 执行错误（最高优先级）
        if self.system_stability and self.system_stability.error_count > 0:
            return FinalVerdict(
                verdict=Verdict.SYSTEM_FAIL,
                can_trade=False,
                should_reduce=True,
                can_scale=False,
                reasons=["执行错误 > 0，系统不可信"]
            )
        
        # 2. Edge 是否存在
        if self.edge_health:
            if self.edge_health.expectancy <= 0:
                return FinalVerdict(
                    verdict=Verdict.NO_EDGE,
                    can_trade=False,
                    should_reduce=True,
                    can_scale=False,
                    reasons=[f"期望值为负: {self.edge_health.expectancy:.4f}"]
                )
        
        # 3. 滑点侵蚀（关键判断）
        if self.slippage_drain:
            sr = self.slippage_drain.slippage_ratio
            
            if sr > 0.7:
                return FinalVerdict(
                    verdict=Verdict.EDGE_DESTROYED,
                    can_trade=True,
                    should_reduce=True,
                    can_scale=False,
                    reasons=[f"滑点吞噬利润: {sr*100:.1f}% > 70%"]
                )
            
            if sr > 0.5:
                reasons.append(f"滑点侵蚀利润: {sr*100:.1f}%")
        
        # 4. 判断健康度
        if self.edge_health:
            pf = self.edge_health.profit_factor
            
            if pf > 1.5:
                verdict = Verdict.HEALTHY
                can_scale = True
            elif pf > 1.2:
                verdict = Verdict.WEAK_EDGE
                can_scale = False
            else:
                verdict = Verdict.WEAK_EDGE
                can_scale = False
                reasons.append(f"盈亏比过低: {pf:.2f}")
        else:
            verdict = Verdict.WEAK_EDGE
            can_scale = False
        
        # 是否需要减仓
        should_reduce = (
            self.slippage_drain and 
            self.slippage_drain.slippage_ratio > 0.5
        )
        
        return FinalVerdict(
            verdict=verdict,
            can_trade=True,
            should_reduce=should_reduce,
            can_scale=can_scale,
            reasons=reasons if reasons else ["系统状态正常"]
        )
    
    def get_overall(self) -> HealthStatus:
        statuses = []
        if self.edge_health:
            statuses.append(self.edge_health.status)
        if self.slippage_drain:
            statuses.append(self.slippage_drain.status)
        if self.system_stability:
            statuses.append(self.system_stability.status)
        
        if not statuses:
            return HealthStatus.WARNING
        
        priority = {HealthStatus.HEALTHY: 0, HealthStatus.WARNING: 1, HealthStatus.CRITICAL: 2, HealthStatus.DEAD: 3}
        return max(statuses, key=lambda s: priority[s])
    
    def render(self) -> str:
        self.load_data()
        
        # 计算最终裁决
        self.final_verdict = self.calculate_verdict()
        
        lines = [
            "╔══════════════════════════════════════════════════════╗",
            "║       📊 LIVE OPS DASHBOARD - 实盘运营监控          ║",
            "╠══════════════════════════════════════════════════════╣",
            f"║ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "╠══════════════════════════════════════════════════════╣",
            "║",
            "║ 📈 EDGE HEALTH",
        ]
        
        if self.edge_health:
            lines.extend([
                f"║   Profit Factor: {self.edge_health.profit_factor:.2f} {self.edge_health.trend}",
                f"║   Expectancy:    {self.edge_health.expectancy:.4f}",
                f"║   状态: {self.edge_health.status.value}",
            ])
        
        lines.extend([
            "║",
            "║ 💰 SLIPPAGE DRAIN",
        ])
        
        if self.slippage_drain:
            filled = int(min(self.slippage_drain.slippage_ratio, 1.0) * 20)
            bar = "█" * filled + "░" * (20 - filled)
            lines.extend([
                f"║   [{bar}] {self.slippage_drain.slippage_ratio*100:.1f}%",
                f"║   Level: {self.slippage_drain.drain_level}",
                f"║   状态: {self.slippage_drain.status.value}",
            ])
        
        lines.extend([
            "║",
            "║ ⚙️ SYSTEM STABILITY",
        ])
        
        if self.system_stability:
            lines.extend([
                f"║   Errors:  {self.system_stability.error_count}",
                f"║   P50:     {self.system_stability.latency_p50:.0f}ms",
                f"║   P90:     {self.system_stability.latency_p90:.0f}ms",
                f"║   状态: {self.system_stability.status.value}",
            ])
        
        # 最终裁决层
        lines.extend([
            "║",
            "╠══════════════════════════════════════════════════════╣",
            "║ 🎯 FINAL VERDICT",
            "║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ])
        
        if self.final_verdict:
            v = self.final_verdict
            lines.extend([
                f"║ 状态: {v.verdict.value}",
                "║",
                "║ 决策:",
                f"║   {'✅' if v.can_trade else '❌'} 允许交易: {'YES' if v.can_trade else 'NO'}",
                f"║   {'⚠️' if v.should_reduce else '  '} 建议减仓: {'YES' if v.should_reduce else 'NO'}",
                f"║   {'❌' if not v.can_scale else '  '} 禁止放大: {'YES' if not v.can_scale else 'NO'}",
                "║",
                "║ 原因:",
            ])
            for reason in v.reasons[:3]:
                lines.append(f"║   - {reason}")
        
        lines.append("╚══════════════════════════════════════════════════════╝")
        
        return "\n".join(lines)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=30)
    args = parser.parse_args()
    
    dashboard = LiveOpsDashboard()
    
    if args.watch:
        try:
            while True:
                print("\033[2J\033[H")
                print(dashboard.render())
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n👋 监控结束")
    else:
        print(dashboard.render())


if __name__ == "__main__":
    main()