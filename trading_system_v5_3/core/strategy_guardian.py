#!/usr/bin/env python3
"""
Strategy Guardian V2 - 策略守护者（基于 Edge 驱动）

核心认知：
尾部策略 ≠ 高胜率策略
判断标准：Expectancy > 0（不是 Win Rate）

修复：
- 移除 win_rate STOP 规则
- 改为 Expectancy / Profit Factor 驱动
- 统一系统哲学：唯一真相 = Edge
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
    STOP = "stop"                   # 停止（无持仓时）
    FORCE_EXIT = "force_exit"       # 强制平仓（有持仓时）


@dataclass
class GuardianReport:
    """守护者报告"""
    decision: StrategyDecision
    reason: str
    
    # 核心指标（Edge 驱动）
    expectancy: float               # 期望值
    profit_factor: float            # 盈亏比
    max_drawdown: float             # 最大回撤
    
    # 辅助指标（仅供参考，不做判断）
    win_rate: float
    total_trades: int
    total_pnl: float
    
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
    策略守护者 V2 - 基于 Edge 驱动
    
    核心原则：
    1. 唯一真相 = Edge（Expectancy）
    2. Win Rate 对尾部策略是"毒指标"
    3. 不做胜率判断，只判断 Edge 是否存在
    
    这是系统的"免疫系统" - 但不破坏尾部策略本质
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化守护者
        """
        self.config = config or {}
        
        # 🔥 核心：基于 Edge 的阈值
        self.min_trades_for_judgment = 20   # 判断所需最小交易数
        self.min_expectancy = 0.0           # 最低期望值（必须 > 0）
        self.min_profit_factor = 1.2        # 最低盈亏比
        self.max_drawdown_limit = 0.10      # 最大回撤限制 (10%)
        
        # 熔断保护（仍然保留）
        self.consecutive_loss_limit = 30    # 连续亏损限制（放宽到30笔）
        self.daily_loss_limit = -0.05       # 日亏损限制 (-5%)
        
        # 状态
        self.consecutive_losses = 0
        self.daily_pnl = 0.0
        self.is_stopped = False
        self.stop_reason = None
        
        # 历史决策
        self.decision_history = []
        
        print("🛡️ Strategy Guardian V2 初始化完成")
        print(f"   判断所需交易数: {self.min_trades_for_judgment}")
        print(f"   最低期望值: {self.min_expectancy*100}%")
        print(f"   最低盈亏比: {self.min_profit_factor}")
        print(f"   最大回撤限制: {self.max_drawdown_limit*100}%")
        print(f"   连续亏损限制: {self.consecutive_loss_limit} 笔")
        print(f"   🎯 Edge 驱动模式（不使用 Win Rate）")
    
    def check(self, trades: List[Dict[str, Any]], has_position: bool = False, safety_test_mode: bool = False) -> GuardianReport:
        """
        检查策略状态 - 基于 Edge
        
        Args:
            trades: 交易历史
            has_position: 当前是否有持仓
            safety_test_mode: Safety Test 模式（禁用干预）
        
        Returns:
            GuardianReport: 决策报告
        
        🔥 核心规则：
        - Safety Test 模式 → 只观察不干预
        - 无持仓 + 异常 → STOP
        - 有持仓 + 异常 → FORCE_EXIT（先平仓）
        """
        alerts = []
        
        # 🔥 Safety Test 模式：只观察不干预
        if safety_test_mode:
            return GuardianReport(
                decision=StrategyDecision.CONTINUE,
                reason="[SAFETY_TEST_MODE] Guardian 只观察不干预",
                expectancy=0, profit_factor=0, max_drawdown=0,
                win_rate=0, total_trades=len(trades), total_pnl=0,
                alerts=["Safety Test 模式：Guardian 已禁用干预"]
            )
        
        # 如果已停止
        if self.is_stopped:
            return GuardianReport(
                decision=StrategyDecision.STOP,
                reason=f"策略已停止: {self.stop_reason}",
                expectancy=0, profit_factor=0, max_drawdown=0,
                win_rate=0, total_trades=len(trades), total_pnl=0,
                alerts=["策略处于停止状态"]
            )
        
        # 交易数不足
        if len(trades) < self.min_trades_for_judgment:
            return GuardianReport(
                decision=StrategyDecision.CONTINUE,
                reason=f"样本不足({len(trades)}<{self.min_trades_for_judgment})",
                expectancy=0, profit_factor=0, max_drawdown=0,
                win_rate=0, total_trades=len(trades), total_pnl=0,
                alerts=[f"需要{self.min_trades_for_judgment}笔交易才能判断"]
            )
        
        # ========== 计算 Edge 指标 ==========
        
        pnls = [t.get('net_pnl', 0) for t in trades]
        
        # 期望值（平均每笔盈亏）
        expectancy = sum(pnls) / len(pnls) if pnls else 0
        
        # 盈亏比
        gross_profit = sum(p for p in pnls if p > 0)
        gross_loss = abs(sum(p for p in pnls if p < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 0
        
        # 胜率（仅供参考，不做判断）
        wins = sum(1 for p in pnls if p > 0)
        win_rate = wins / len(pnls) if pnls else 0
        
        # 最大回撤
        cumulative = 0
        peak = 0
        max_drawdown = 0
        for pnl in pnls:
            cumulative += pnl
            if cumulative > peak:
                peak = cumulative
            drawdown = (peak - cumulative) if peak > 0 else 0
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # 总盈亏
        total_pnl = sum(pnls)
        
        # 更新连续亏损
        if pnls and pnls[-1] < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
        
        # 更新日盈亏
        self.daily_pnl = sum(pnls[-20:]) if len(pnls) >= 20 else sum(pnls)
        
        # ========== 判断逻辑（Edge 驱动）==========
        
        decision = StrategyDecision.CONTINUE
        reason = f"Edge 存在 (Expectancy: {expectancy*100:.3f}%, PF: {profit_factor:.2f})"
        
        # 1. 🔥 核心：期望值 <= 0 → STOP
        if expectancy <= 0:
            decision = StrategyDecision.STOP
            reason = f"Edge 消失 (Expectancy: {expectancy*100:.3f}% <= 0)"
            alerts.append(f"期望值 {expectancy*100:.3f}% <= 0，策略无正期望")
        
        # 2. 盈亏比过低 → WARNING（不是 STOP）
        elif profit_factor < self.min_profit_factor:
            if decision == StrategyDecision.CONTINUE:
                decision = StrategyDecision.WARNING
                reason = f"盈亏比偏低 (PF: {profit_factor:.2f} < {self.min_profit_factor})"
                alerts.append(f"盈亏比 {profit_factor:.2f} < {self.min_profit_factor}，风险调整收益偏低")
        
        # 3. 最大回撤过大 → REDUCE_SIZE
        if max_drawdown > self.max_drawdown_limit:
            if decision == StrategyDecision.CONTINUE:
                decision = StrategyDecision.REDUCE_SIZE
                reason = f"回撤过大 ({max_drawdown*100:.1f}% > {self.max_drawdown_limit*100}%)"
                alerts.append(f"最大回撤 {max_drawdown*100:.1f}% > {self.max_drawdown_limit*100}%")
        
        # 4. 连续亏损过多 → WARNING（不是 STOP）
        if self.consecutive_losses >= self.consecutive_loss_limit:
            if decision in [StrategyDecision.CONTINUE, StrategyDecision.WARNING]:
                decision = StrategyDecision.WARNING
                reason = f"连续亏损{self.consecutive_losses}笔"
                alerts.append(f"连续亏损 {self.consecutive_losses} 笔")
        
        # 5. 日亏损过大 → STOP
        if self.daily_pnl < self.daily_loss_limit:
            decision = StrategyDecision.STOP
            reason = f"日亏损{self.daily_pnl*100:.2f}%超过限制"
            alerts.append(f"日亏损 {self.daily_pnl*100:.2f}% < {self.daily_loss_limit*100}%")
        
        # 如果决定停止
        if decision == StrategyDecision.STOP:
            # 🔥 核心修复：有持仓时改为 FORCE_EXIT
            if has_position:
                decision = StrategyDecision.FORCE_EXIT
                reason = f"[FORCE_EXIT] {reason}"
                alerts.insert(0, "🔥 有持仓，先平仓再停止")
            else:
                self.is_stopped = True
                self.stop_reason = reason
        
        # 记录决策
        report = GuardianReport(
            decision=decision,
            reason=reason,
            expectancy=expectancy,
            profit_factor=profit_factor,
            max_drawdown=max_drawdown,
            win_rate=win_rate,
            total_trades=len(trades),
            total_pnl=total_pnl,
            alerts=alerts
        )
        
        self.decision_history.append({
            'timestamp': datetime.now().isoformat(),
            'decision': decision.value,
            'reason': reason,
            'expectancy': expectancy,
            'profit_factor': profit_factor,
            'win_rate': win_rate
        })
        
        return report
    
    def reset(self):
        """重置守护者状态"""
        self.is_stopped = False
        self.stop_reason = None
        self.consecutive_losses = 0
        self.daily_pnl = 0.0
        print("⚠️  Strategy Guardian V2 已重置")
    
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
            'decision_count': len(self.decision_history),
            'mode': 'Edge-Driven V2'
        }


# 创建默认实例
_default_guardian = None

def get_guardian() -> StrategyGuardian:
    """获取全局守护者实例"""
    global _default_guardian
    if _default_guardian is None:
        _default_guardian = StrategyGuardian()
    return _default_guardian