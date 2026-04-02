#!/usr/bin/env python3
"""
Capital Controller - 资金控制闭环

核心功能：
1. 根据审计结果自动调整仓位
2. 状态机控制（STOP/REDUCE/NORMAL/SCALE_UP）
3. 风险阈值保护

决策逻辑：
- 执行错误 > 0 → STOP
- 期望值 ≤ 0 → STOP
- 回撤 > 10% → STOP
- 滑点/利润 > 50% → REDUCE
- 置信度 LOW → REDUCE
- 强边缘确认 → SCALE_UP
"""

import json
import time
from datetime import datetime
from typing import Dict, Optional
from dataclasses import dataclass
from enum import Enum


class SystemState(Enum):
    """系统状态"""
    STOP = "🛑 STOP"           # 立即停止
    REDUCE = "⚠️ REDUCE"       # 减仓运行
    NORMAL = "🟢 NORMAL"       # 正常运行
    SCALE_UP = "🚀 SCALE_UP"   # 放大资金


@dataclass
class CapitalDecision:
    """资金决策"""
    state: SystemState
    position_multiplier: float  # 仓位倍数
    reason: str
    timestamp: str
    audit_summary: Dict


class CapitalController:
    """
    资金控制器
    
    使用方式：
    controller = CapitalController(base_position=3.0)
    decision = controller.decide(audit_report)
    position_usd = controller.get_position_size()
    """
    
    def __init__(
        self,
        base_position: float = 3.0,  # 基础仓位
        max_position: float = 20.0,  # 最大仓位
        scale_steps: list = None      # 放大阶梯
    ):
        """
        初始化
        
        Args:
            base_position: 基础仓位（USD）
            max_position: 最大仓位（USD）
            scale_steps: 放大阶梯 [3, 6, 10, 15, 20]
        """
        self.base_position = base_position
        self.max_position = max_position
        self.scale_steps = scale_steps or [3.0, 6.0, 10.0, 15.0, 20.0]
        
        # 当前状态
        self._state = SystemState.NORMAL
        self._position_multiplier = 1.0
        self._current_step = 0
        
        # 统计
        self.stats = {
            'decisions': 0,
            'stops': 0,
            'reduces': 0,
            'scale_ups': 0
        }
    
    def decide(self, audit_report: Dict) -> CapitalDecision:
        """
        根据审计报告做出决策
        
        Args:
            audit_report: 审计报告
            
        Returns:
            CapitalDecision
        """
        self.stats['decisions'] += 1
        
        verdict = audit_report.get('verdict', '')
        profit_stats = audit_report.get('profit_stats', {})
        slippage_stats = audit_report.get('slippage_stats', {})
        execution_stats = audit_report.get('execution_stats', {})
        confidence = audit_report.get('confidence', 'LOW')
        
        # 提取关键指标
        error_count = execution_stats.get('error_count', 0)
        expectancy = profit_stats.get('expectancy', 0)
        max_drawdown = profit_stats.get('max_drawdown', 0)
        profit_factor = profit_stats.get('profit_factor', 0)
        total_trades = profit_stats.get('total_trades', 0)
        slippage_ratio = slippage_stats.get('slippage_to_profit_ratio', 0)
        
        # ========== 决策逻辑 ==========
        
        # 1. ❌ 硬停止：执行错误
        if error_count > 0:
            return self._make_decision(
                SystemState.STOP,
                0.0,
                f"执行错误: {error_count} 次"
            )
        
        # 2. ❌ 硬停止：负期望
        if expectancy <= 0:
            return self._make_decision(
                SystemState.STOP,
                0.0,
                f"期望值为负: {expectancy:.4f}"
            )
        
        # 3. ❌ 硬停止：回撤过大
        if max_drawdown > 10:
            return self._make_decision(
                SystemState.STOP,
                0.0,
                f"回撤过大: {max_drawdown:.1f}%"
            )
        
        # 4. ⚠️ 减仓：滑点侵蚀
        if slippage_ratio > 0.5:
            return self._make_decision(
                SystemState.REDUCE,
                0.5,
                f"滑点侵蚀利润: {slippage_ratio*100:.1f}%"
            )
        
        # 5. ⚠️ 减仓：样本不足
        if confidence == "LOW":
            return self._make_decision(
                SystemState.REDUCE,
                0.5,
                f"样本不足: {total_trades} 笔"
            )
        
        # 6. ⚠️ 减仓：边缘侵蚀（滑点 40-50%）
        if slippage_ratio > 0.4:
            return self._make_decision(
                SystemState.REDUCE,
                0.7,
                f"边缘被侵蚀: 滑点/利润={slippage_ratio*100:.1f}%"
            )
        
        # 7. ✅ 放大资金：强边缘确认
        if (
            'STRONG_EDGE_CONFIRMED' in verdict and
            total_trades >= 50 and
            max_drawdown < 8 and
            slippage_ratio < 0.4
        ):
            return self._make_decision(
                SystemState.SCALE_UP,
                self._get_next_scale_multiplier(),
                f"强边缘确认: profit_factor={profit_factor:.2f}"
            )
        
        # 8. 🟢 正常运行
        return self._make_decision(
            SystemState.NORMAL,
            1.0,
            "系统状态正常"
        )
    
    def _make_decision(
        self,
        state: SystemState,
        multiplier: float,
        reason: str
    ) -> CapitalDecision:
        """生成决策"""
        self._state = state
        self._position_multiplier = multiplier
        
        # 统计
        if state == SystemState.STOP:
            self.stats['stops'] += 1
        elif state == SystemState.REDUCE:
            self.stats['reduces'] += 1
        elif state == SystemState.SCALE_UP:
            self.stats['scale_ups'] += 1
        
        return CapitalDecision(
            state=state,
            position_multiplier=multiplier,
            reason=reason,
            timestamp=datetime.now().isoformat(),
            audit_summary={
                'state': state.value,
                'multiplier': multiplier,
                'reason': reason
            }
        )
    
    def _get_next_scale_multiplier(self) -> float:
        """获取下一个放大倍数"""
        if self._current_step < len(self.scale_steps) - 1:
            self._current_step += 1
        
        next_position = self.scale_steps[self._current_step]
        return next_position / self.base_position
    
    def get_position_size(self) -> float:
        """获取当前仓位大小"""
        return self.base_position * self._position_multiplier
    
    def get_state(self) -> SystemState:
        """获取当前状态"""
        return self._state
    
    def should_stop(self) -> bool:
        """是否应该停止"""
        return self._state == SystemState.STOP
    
    def should_reduce(self) -> bool:
        """是否应该减仓"""
        return self._state == SystemState.REDUCE
    
    def can_trade(self) -> bool:
        """是否可以交易"""
        return self._state != SystemState.STOP
    
    def report(self) -> str:
        """生成报告"""
        position = self.get_position_size()
        
        return f"""
💰 Capital Controller Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
状态: {self._state.value}
仓位倍数: {self._position_multiplier:.1f}x
当前仓位: {position:.1f} USD

📊 统计:
  决策次数: {self.stats['decisions']}
  停止次数: {self.stats['stops']}
  减仓次数: {self.stats['reduces']}
  放大次数: {self.stats['scale_ups']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


# 全局实例
_controller: Optional[CapitalController] = None


def get_capital_controller() -> CapitalController:
    """获取全局资金控制器"""
    global _controller
    if _controller is None:
        _controller = CapitalController()
    return _controller


# 测试
if __name__ == "__main__":
    print("🧪 资金控制器测试")
    
    controller = CapitalController(base_position=3.0)
    
    # 测试不同场景
    test_cases = [
        {
            'name': '正常',
            'report': {
                'verdict': 'WEAK_EDGE',
                'profit_stats': {'expectancy': 0.02, 'max_drawdown': 3, 'total_trades': 50},
                'slippage_stats': {'slippage_to_profit_ratio': 0.3},
                'execution_stats': {'error_count': 0},
                'confidence': 'MEDIUM'
            }
        },
        {
            'name': '滑点侵蚀',
            'report': {
                'verdict': 'EDGE_ERODED',
                'profit_stats': {'expectancy': 0.01, 'max_drawdown': 5, 'total_trades': 30},
                'slippage_stats': {'slippage_to_profit_ratio': 0.55},
                'execution_stats': {'error_count': 0},
                'confidence': 'MEDIUM'
            }
        },
        {
            'name': '执行错误',
            'report': {
                'verdict': 'FAIL_EXECUTION',
                'profit_stats': {'expectancy': 0.02, 'max_drawdown': 2, 'total_trades': 20},
                'slippage_stats': {'slippage_to_profit_ratio': 0.3},
                'execution_stats': {'error_count': 1},
                'confidence': 'LOW'
            }
        }
    ]
    
    for test in test_cases:
        decision = controller.decide(test['report'])
        print(f"\n📊 场景: {test['name']}")
        print(f"   状态: {decision.state.value}")
        print(f"   仓位: {controller.get_position_size():.1f} USD")
        print(f"   原因: {decision.reason}")