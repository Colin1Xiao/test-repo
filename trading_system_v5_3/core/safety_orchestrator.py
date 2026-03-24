#!/usr/bin/env python3
"""
Safety Orchestrator - 自动降级 + 自愈系统

三层响应机制：
- Level 1 (轻微): 仓位降级，不停止
- Level 2 (中度): 暂停交易
- Level 3 (致命): 冻结系统

核心思想：错误不是问题，持续在错误状态下运行才是问题
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum
import json


class SafetyState(Enum):
    """安全状态"""
    NORMAL = "NORMAL"           # 正常运行
    DEGRADED = "DEGRADED"       # 降级运行（仓位减半）
    PAUSED = "PAUSED"           # 暂停交易
    FROZEN = "FROZEN"           # 系统冻结


@dataclass
class SafetyConfig:
    """安全配置"""
    # Level 1 阈值
    degraded_slippage_min: float = 0.0003    # 0.03%
    degraded_slippage_max: float = 0.0005    # 0.05%
    degraded_delay_min: float = 800         # ms
    degraded_delay_max: float = 1500        # ms
    degraded_quality_min: float = 0.7
    degraded_quality_max: float = 0.8
    
    # Level 2 阈值
    paused_slippage: float = 0.0005         # 0.05%
    paused_delay: float = 1500              # ms
    paused_quality: float = 0.7
    paused_consecutive_bad: int = 2         # 连续2笔执行质量差
    
    # Level 3 阈值
    frozen_slippage: float = 0.001          # 0.1%
    frozen_delay: float = 2000              # ms
    frozen_consecutive_losses: int = 3      # 连续亏损次数
    
    # 恢复条件
    recover_good_trades: int = 3            # 需要连续好样本才能恢复


@dataclass
class SafetyStats:
    """安全统计"""
    total_trades: int = 0
    consecutive_losses: int = 0
    consecutive_bad_executions: int = 0
    recent_good_trades: int = 0
    recent_trades: List[Dict] = field(default_factory=list)
    last_state_change: Optional[datetime] = None
    state_history: List[Dict] = field(default_factory=list)


class SafetyOrchestrator:
    """
    安全编排器
    
    职责：
    1. 监控每笔交易的质量指标
    2. 根据规则自动降级/暂停/冻结
    3. 自动恢复（需要数据证明）
    
    与 UnitGuard 联动：
    - UnitGuard 触发 → 直接进入 Level 3
    """
    
    def __init__(self, config: SafetyConfig = None):
        self.config = config or SafetyConfig()
        self.state = SafetyState.NORMAL
        self.stats = SafetyStats()
        
        # 降级状态
        self.degraded = False
        self.frozen = False
        self.paused = False
        
        # 仓位调整因子
        self.position_multiplier = 1.0
        
        # 历史记录
        self.evaluation_history: List[Dict] = []
        
        print("🛡️ Safety Orchestrator 初始化完成")
        print(f"   状态: {self.state.value}")
        print(f"   仓位乘数: {self.position_multiplier}")
    
    def evaluate(
        self,
        execution_quality: float,
        slippage: float,
        delay_ms: float,
        pnl_pct: float = 0,
        unit_guard_triggered: bool = False
    ) -> Dict:
        """
        评估交易质量，返回动作指令
        
        Args:
            execution_quality: 执行质量分数 (0-1)
            slippage: 滑点 (小数形式，如 0.0005 = 0.05%)
            delay_ms: 延迟 (毫秒)
            pnl_pct: 盈亏百分比 (小数形式)
            unit_guard_triggered: UnitGuard 是否触发
        
        Returns:
            {
                "action": "CONTINUE" | "REDUCE_SIZE" | "PAUSE" | "FREEZE",
                "state": SafetyState,
                "position_multiplier": float,
                "reason": str
            }
        """
        self.stats.total_trades += 1
        action = "CONTINUE"
        reason = ""
        
        # 记录当前交易
        trade_record = {
            "timestamp": datetime.now().isoformat(),
            "execution_quality": execution_quality,
            "slippage": slippage,
            "delay_ms": delay_ms,
            "pnl_pct": pnl_pct
        }
        self.stats.recent_trades.append(trade_record)
        if len(self.stats.recent_trades) > 10:
            self.stats.recent_trades = self.stats.recent_trades[-10:]
        
        # ============================================================
        # 🔴 Level 3: 致命异常（最高优先级）
        # ============================================================
        
        # UnitGuard 触发
        if unit_guard_triggered:
            self._freeze("UnitGuard triggered")
            return self._build_result("FREEZE", "UnitGuard 触发，系统冻结")
        
        # 滑点过高
        if slippage > self.config.frozen_slippage:
            self._freeze(f"Slippage {slippage*100:.3f}% > {self.config.frozen_slippage*100:.2f}%")
            return self._build_result("FREEZE", f"滑点过高: {slippage*100:.3f}%")
        
        # 延迟过高
        if delay_ms > self.config.frozen_delay:
            self._freeze(f"Delay {delay_ms:.0f}ms > {self.config.frozen_delay:.0f}ms")
            return self._build_result("FREEZE", f"延迟过高: {delay_ms:.0f}ms")
        
        # 连续亏损
        if pnl_pct < 0:
            self.stats.consecutive_losses += 1
            self.stats.recent_good_trades = 0
        else:
            self.stats.consecutive_losses = 0
            self.stats.recent_good_trades += 1
        
        if self.stats.consecutive_losses >= self.config.frozen_consecutive_losses:
            self._freeze(f"Consecutive losses: {self.stats.consecutive_losses}")
            return self._build_result("FREEZE", f"连续亏损 {self.stats.consecutive_losses} 笔")
        
        # ============================================================
        # 🟡 Level 2: 中度异常（暂停交易）
        # ============================================================
        
        # 执行质量差
        if execution_quality < self.config.paused_quality:
            self.stats.consecutive_bad_executions += 1
        else:
            self.stats.consecutive_bad_executions = 0
        
        if self.stats.consecutive_bad_executions >= self.config.paused_consecutive_bad:
            self._pause(f"Execution quality low: {execution_quality:.2f}")
            return self._build_result("PAUSE", f"执行质量差: {execution_quality:.2f}")
        
        # 滑点超标
        if slippage > self.config.paused_slippage:
            self._pause(f"Slippage {slippage*100:.3f}% > {self.config.paused_slippage*100:.2f}%")
            return self._build_result("PAUSE", f"滑点超标: {slippage*100:.3f}%")
        
        # 延迟超标
        if delay_ms > self.config.paused_delay:
            self._pause(f"Delay {delay_ms:.0f}ms > {self.config.paused_delay:.0f}ms")
            return self._build_result("PAUSE", f"延迟超标: {delay_ms:.0f}ms")
        
        # ============================================================
        # 🟢 Level 1: 轻微异常（降级运行）
        # ============================================================
        
        # 执行质量下降
        if execution_quality < self.config.degraded_quality_max:
            self._degrade(f"Execution quality degraded: {execution_quality:.2f}")
            return self._build_result("REDUCE_SIZE", f"执行质量下降: {execution_quality:.2f}")
        
        # 滑点偏高
        if slippage > self.config.degraded_slippage_min:
            self._degrade(f"Slippage elevated: {slippage*100:.3f}%")
            return self._build_result("REDUCE_SIZE", f"滑点偏高: {slippage*100:.3f}%")
        
        # 延迟偏高
        if delay_ms > self.config.degraded_delay_min:
            self._degrade(f"Delay elevated: {delay_ms:.0f}ms")
            return self._build_result("REDUCE_SIZE", f"延迟偏高: {delay_ms:.0f}ms")
        
        # ============================================================
        # ✅ 正常运行
        # ============================================================
        
        self._restore()
        return self._build_result("CONTINUE", "正常")
    
    def _freeze(self, reason: str):
        """冻结系统"""
        self.state = SafetyState.FROZEN
        self.frozen = True
        self.position_multiplier = 0
        self._record_state_change("FROZEN", reason)
        print(f"🚨 SAFETY FREEZE: {reason}")
    
    def _pause(self, reason: str):
        """暂停交易"""
        if self.state == SafetyState.FROZEN:
            return  # 冻结状态下不能降级
        
        self.state = SafetyState.PAUSED
        self.paused = True
        self.position_multiplier = 0
        self._record_state_change("PAUSED", reason)
        print(f"⚠️ SAFETY PAUSE: {reason}")
    
    def _degrade(self, reason: str):
        """降级运行"""
        if self.state in [SafetyState.FROZEN, SafetyState.PAUSED]:
            return  # 更高优先级状态不降级
        
        self.state = SafetyState.DEGRADED
        self.degraded = True
        self.position_multiplier = 0.5
        self._record_state_change("DEGRADED", reason)
        print(f"⚡ SAFETY DEGRADE: {reason} (仓位减半)")
    
    def _restore(self):
        """恢复正常"""
        if self.state == SafetyState.FROZEN:
            # 冻结状态需要更多条件才能恢复
            if self.stats.recent_good_trades >= self.config.recover_good_trades:
                self.state = SafetyState.NORMAL
                self.frozen = False
                self.degraded = False
                self.paused = False
                self.position_multiplier = 1.0
                self._record_state_change("NORMAL", "Recovered from frozen")
                print(f"✅ SAFETY RESTORE: 恢复正常")
        else:
            self.state = SafetyState.NORMAL
            self.degraded = False
            self.paused = False
            self.position_multiplier = 1.0
    
    def _record_state_change(self, new_state: str, reason: str):
        """记录状态变化"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "old_state": self.state.value if self.state else "NONE",
            "new_state": new_state,
            "reason": reason
        }
        self.stats.state_history.append(record)
        self.stats.last_state_change = datetime.now()
        if len(self.stats.state_history) > 50:
            self.stats.state_history = self.stats.state_history[-50:]
    
    def _build_result(self, action: str, reason: str) -> Dict:
        """构建返回结果"""
        return {
            "action": action,
            "state": self.state.value,
            "position_multiplier": self.position_multiplier,
            "reason": reason,
            "consecutive_losses": self.stats.consecutive_losses,
            "recent_good_trades": self.stats.recent_good_trades
        }
    
    def try_recover(self) -> bool:
        """
        尝试恢复系统
        
        只有在满足条件时才恢复：
        - 连续 N 笔好样本
        """
        if not self.frozen:
            return True
        
        if self.stats.recent_good_trades >= self.config.recover_good_trades:
            self._restore()
            return True
        
        return False
    
    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "state": self.state.value,
            "frozen": self.frozen,
            "paused": self.paused,
            "degraded": self.degraded,
            "position_multiplier": self.position_multiplier,
            "consecutive_losses": self.stats.consecutive_losses,
            "recent_good_trades": self.stats.recent_good_trades,
            "total_trades": self.stats.total_trades
        }
    
    def get_status_emoji(self) -> str:
        """获取状态 emoji"""
        if self.state == SafetyState.NORMAL:
            return "🟢"
        elif self.state == SafetyState.DEGRADED:
            return "🟡"
        elif self.state == SafetyState.PAUSED:
            return "🟠"
        else:
            return "🔴"


# ============================================================
# 便捷函数
# ============================================================
def create_safety_orchestrator() -> SafetyOrchestrator:
    """创建安全编排器"""
    return SafetyOrchestrator()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Safety Orchestrator 测试 ===\n")
    
    safety = SafetyOrchestrator()
    
    # 测试正常情况
    print("1. 正常交易:")
    result = safety.evaluate(
        execution_quality=0.92,
        slippage=0.0005,
        delay_ms=200,
        pnl_pct=0.001
    )
    print(f"   {safety.get_status_emoji()} {result['action']}: {result['reason']}")
    
    # 测试降级
    print("\n2. 执行质量下降:")
    result = safety.evaluate(
        execution_quality=0.75,
        slippage=0.0004,
        delay_ms=500,
        pnl_pct=0
    )
    print(f"   {safety.get_status_emoji()} {result['action']}: {result['reason']}")
    print(f"   仓位乘数: {result['position_multiplier']}")
    
    # 测试暂停
    print("\n3. 滑点超标:")
    result = safety.evaluate(
        execution_quality=0.9,
        slippage=0.0006,
        delay_ms=1000,
        pnl_pct=0
    )
    print(f"   {safety.get_status_emoji()} {result['action']}: {result['reason']}")
    
    # 测试冻结
    print("\n4. 连续亏损:")
    safety = SafetyOrchestrator()  # 重置
    for i in range(3):
        result = safety.evaluate(
            execution_quality=0.9,
            slippage=0.0003,
            delay_ms=200,
            pnl_pct=-0.002
        )
    print(f"   {safety.get_status_emoji()} {result['action']}: {result['reason']}")
    
    print("\n=== 系统状态 ===")
    print(json.dumps(safety.get_state(), indent=2))