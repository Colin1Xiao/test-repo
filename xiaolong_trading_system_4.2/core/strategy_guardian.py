#!/usr/bin/env python3
"""
Strategy Guardian - 策略守护者

最关键的组件：系统自己决定还能不能继续交易
自动停止亏损策略
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum


class StrategyDecision(Enum):
    """策略决策"""
    CONTINUE = "continue"           # 继续
    REDUCE_SIZE = "reduce_size"     # 降低仓位
    WARNING = "warning"             # 警告
    STOP = "stop"                   # 停止


@dataclass
class GuardianReport:
    """守护者报告"""
    decision: StrategyDecision
    reason: str
    
    win_rate: float
    avg_pnl: float
    total_trades: int
    
    signal_quality_avg: float
    execution_quality_avg: float
    
    alerts: List[str]
    
    def __str__(self):
        emoji = {
            StrategyDecision.CONTINUE: "✅",
            StrategyDecision.REDUCE_SIZE: "⚠️",
            StrategyDecision.WARNING: "⚠️",
            StrategyDecision.STOP: "🛑"
        }[self.decision]
        
        return f"{emoji} {self.decision.value.upper()}: {self.reason}"


class StrategyGuardian:
    """
    策略守护者
    
    核心职责：
    1. 监控策略表现
    2. 自动停止亏损策略
    3. 保护资金安全
    
    这是系统的"免疫系统"
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化守护者
        """
        self.config = config or {}
        
        # 核心阈值（非常重要）
        self.min_trades_for_judgment = 20   # 判断所需最小交易数
        self.min_win_rate = 0.05            # 最低胜率（尾部策略允许低胜率）
        self.min_avg_pnl = 0.0              # 最低平均盈亏
        self.min_signal_quality = 0.0       # 最低信号质量
        self.min_execution_quality = 0.5    # 最低执行质量
        
        # 警告阈值
        self.warning_win_rate = 0.15        # 警告胜率（尾部策略调整）
        self.warning_signal_quality = 0.3
        
        # 熔断
        self.consecutive_loss_limit = 5     # 连续亏损限制
        self.daily_loss_limit = -0.03       # 日亏损限制 (-3%)
        
        # 状态
        self.consecutive_losses = 0
        self.daily_pnl = 0.0
        self.is_stopped = False
        self.stop_reason = None
        
        # 历史决策
        self.decision_history = []
        
        print("🛡️ Strategy Guardian 初始化完成")
        print(f"   判断所需交易数: {self.min_trades_for_judgment}")
        print(f"   最低胜率: {self.min_win_rate*100}%")
        print(f"   最低平均盈亏: {self.min_avg_pnl*100}%")
        print(f"   连续亏损限制: {self.consecutive_loss_limit}")
        print(f"   日亏损限制: {self.daily_loss_limit*100}%")
    
    def check(self, trades: List[Dict[str, Any]]) -> GuardianReport:
        """
        检查策略状态
        
        Args:
            trades: 交易列表，每个需包含:
                - net_pnl: 净盈亏
                - signal_quality: 信号质量分数
                - execution_quality: 执行质量分数
        
        Returns:
            GuardianReport
        """
        alerts = []
        
        # 如果已停止
        if self.is_stopped:
            return GuardianReport(
                decision=StrategyDecision.STOP,
                reason=f"策略已停止: {self.stop_reason}",
                win_rate=0, avg_pnl=0, total_trades=len(trades),
                signal_quality_avg=0, execution_quality_avg=0,
                alerts=["策略处于停止状态"]
            )
        
        # 交易数不足
        if len(trades) < self.min_trades_for_judgment:
            return GuardianReport(
                decision=StrategyDecision.CONTINUE,
                reason=f"样本不足({len(trades)}<{self.min_trades_for_judgment})",
                win_rate=0, avg_pnl=0, total_trades=len(trades),
                signal_quality_avg=0, execution_quality_avg=0,
                alerts=[f"需要{self.min_trades_for_judgment}笔交易才能判断"]
            )
        
        # 计算核心指标
        pnls = [t.get('net_pnl', 0) for t in trades]
        signal_qualities = [t.get('signal_quality', 0) for t in trades]
        execution_qualities = [t.get('execution_quality_score', t.get('execution_quality', 0)) for t in trades]
        
        win_rate = sum(1 for p in pnls if p > 0) / len(pnls) if pnls else 0
        avg_pnl = sum(pnls) / len(pnls) if pnls else 0
        signal_quality_avg = sum(signal_qualities) / len(signal_qualities) if signal_qualities else 0
        execution_quality_avg = sum(execution_qualities) / len(execution_qualities) if execution_qualities else 0
        
        # 更新连续亏损
        if pnls and pnls[-1] < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
        
        # 更新日盈亏
        if pnls:
            self.daily_pnl = sum(pnls[-20:])  # 最近20笔
        
        # ========== 判断逻辑 ==========
        
        decision = StrategyDecision.CONTINUE
        reason = "策略表现正常"
        
        # 1. 胜率过低 → STOP
        if win_rate < self.min_win_rate:
            decision = StrategyDecision.STOP
            reason = f"胜率过低({win_rate*100:.1f}%<{self.min_win_rate*100}%)"
            alerts.append(f"胜率{win_rate*100:.1f}% 低于阈值{self.min_win_rate*100}%")
        
        # 2. 平均盈亏为负 → STOP
        elif avg_pnl < self.min_avg_pnl:
            decision = StrategyDecision.STOP
            reason = f"平均盈亏为负({avg_pnl*100:.3f}%)"
            alerts.append(f"平均盈亏{avg_pnl*100:.3f}% < 0")
        
        # 3. 连续亏损过多 → STOP
        if self.consecutive_losses >= self.consecutive_loss_limit:
            decision = StrategyDecision.STOP
            reason = f"连续亏损{self.consecutive_losses}次"
            alerts.append(f"连续亏损{self.consecutive_losses}次 ≥ {self.consecutive_loss_limit}")
        
        # 4. 日亏损过大 → STOP
        if self.daily_pnl < self.daily_loss_limit:
            decision = StrategyDecision.STOP
            reason = f"日亏损{self.daily_pnl*100:.2f}%超过限制"
            alerts.append(f"日亏损{self.daily_pnl*100:.2f}% < {self.daily_loss_limit*100}%")
        
        # 5. 胜率警告 → REDUCE_SIZE
        elif win_rate < self.warning_win_rate and decision == StrategyDecision.CONTINUE:
            decision = StrategyDecision.REDUCE_SIZE
            reason = f"胜率偏低({win_rate*100:.1f}%)，建议降低仓位"
            alerts.append(f"胜率{win_rate*100:.1f}% 接近警戒线{self.warning_win_rate*100}%")
        
        # 6. 信号质量过低 → WARNING
        elif signal_quality_avg < self.warning_signal_quality and decision == StrategyDecision.CONTINUE:
            decision = StrategyDecision.WARNING
            reason = f"信号质量偏低({signal_quality_avg:.2f})"
            alerts.append(f"信号质量{signal_quality_avg:.2f} < {self.warning_signal_quality}")
        
        # 7. 执行质量过低 → WARNING
        elif execution_quality_avg < self.min_execution_quality and decision == StrategyDecision.CONTINUE:
            decision = StrategyDecision.WARNING
            reason = f"执行质量偏低({execution_quality_avg:.2f})"
            alerts.append(f"执行质量{execution_quality_avg:.2f} < {self.min_execution_quality}")
        
        # 如果决定停止
        if decision == StrategyDecision.STOP:
            self.is_stopped = True
            self.stop_reason = reason
        
        # 记录决策
        report = GuardianReport(
            decision=decision,
            reason=reason,
            win_rate=win_rate,
            avg_pnl=avg_pnl,
            total_trades=len(trades),
            signal_quality_avg=signal_quality_avg,
            execution_quality_avg=execution_quality_avg,
            alerts=alerts
        )
        
        self.decision_history.append({
            'timestamp': datetime.now().isoformat(),
            'decision': decision.value,
            'reason': reason,
            'win_rate': win_rate,
            'avg_pnl': avg_pnl
        })
        
        return report
    
    def reset(self):
        """重置守护者状态（谨慎使用）"""
        self.is_stopped = False
        self.stop_reason = None
        self.consecutive_losses = 0
        self.daily_pnl = 0.0
        print("⚠️  Strategy Guardian 已重置")
    
    def force_stop(self, reason: str):
        """强制停止"""
        self.is_stopped = True
        self.stop_reason = f"强制停止: {reason}"
        print(f"🛑 强制停止: {reason}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            'is_stopped': self.is_stopped,
            'stop_reason': self.stop_reason,
            'consecutive_losses': self.consecutive_losses,
            'daily_pnl': self.daily_pnl,
            'decision_count': len(self.decision_history)
        }


# 创建默认实例
_default_guardian = None

def get_guardian() -> StrategyGuardian:
    """获取全局守护者实例"""
    global _default_guardian
    if _default_guardian is None:
        _default_guardian = StrategyGuardian()
    return _default_guardian