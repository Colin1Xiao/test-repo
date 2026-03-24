#!/usr/bin/env python3
"""
RL Integration Module - 强化学习集成模块
负责将 RL 决策集成到 V3.X 执行框架中
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

from .rl_data_collector import RLDataCollector
from .rl_policy_router import RLPolicyRouter

class RLIntegration:
    """RL 集成模块"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.data_collector = RLDataCollector()
        self.policy_router = RLPolicyRouter()
        self.current_session = None
        
    def start_rl_session(self, session_id: str = None):
        """开始 RL 会话"""
        if session_id is None:
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self.current_session = session_id
        self.data_collector.start_session(session_id)
        print(f"🤖 RL 会话开始: {session_id}")
        
    def evaluate_signal(self, 
                      state: Dict[str, Any], 
                      rule_signal: str,
                      current_position: Dict[str, Any] = None) -> str:
        """
        评估规则信号并返回 RL 决策
        
        Args:
            state: 当前市场和账户状态
            rule_signal: 规则策略信号
            current_position: 当前持仓信息
            
        Returns:
            RL 决策: ALLOW_ENTRY, REJECT_ENTRY, REDUCE_SIZE, HOLD, PARTIAL_EXIT, FULL_EXIT
        """
        # 获取当前激活的策略
        active_policy = self.policy_router.get_active_policy()
        
        if active_policy == "baseline_rule_v3x":
            # 基线策略：直接放行规则信号
            if rule_signal in ["STRONG_BUY", "BUY"]:
                return "ALLOW_ENTRY"
            elif rule_signal in ["STRONG_SELL", "SELL"]:
                return "ALLOW_ENTRY"  # 这里简化，实际需要根据持仓判断
            else:
                return "HOLD"
                
        elif active_policy.startswith("rl_policy_"):
            # RL 策略：调用 RL 模型
            if self.config.get("rl_inference_enabled", False):
                # 实际 RL 推理（暂未实现）
                rl_decision = self._get_rl_decision(state, rule_signal, current_position)
                return rl_decision
            else:
                # 影子模式：只记录不执行
                if self.config.get("rl_shadow_mode_enabled", True):
                    shadow_decision = self._get_rl_decision(state, rule_signal, current_position)
                    self._record_shadow_decision(
                        state=state,
                        rule_signal=rule_signal,
                        rl_decision=shadow_decision,
                        baseline_decision=self._get_baseline_decision(rule_signal)
                    )
                    # 返回基线决策
                    return self._get_baseline_decision(rule_signal)
                else:
                    # 完全禁用 RL
                    return self._get_baseline_decision(rule_signal)
                    
        else:
            # 未知策略，使用基线
            return self._get_baseline_decision(rule_signal)
    
    def _get_baseline_decision(self, rule_signal: str) -> str:
        """获取基线决策"""
        if rule_signal in ["STRONG_BUY", "BUY"]:
            return "ALLOW_ENTRY"
        elif rule_signal in ["STRONG_SELL", "SELL"]:
            return "ALLOW_ENTRY"
        else:
            return "HOLD"
    
    def _get_rl_decision(self, state: Dict, rule_signal: str, current_position: Dict) -> str:
        """获取 RL 决策（模拟）"""
        # 这里是模拟实现，实际需要加载 RL 模型
        # 简单逻辑：在高波动时拒绝入场
        volatility = state.get("volatility", 0)
        if rule_signal in ["STRONG_BUY", "BUY"] and volatility > 0.05:
            return "REJECT_ENTRY"
        elif rule_signal in ["STRONG_SELL", "SELL"] and volatility > 0.05:
            return "REJECT_ENTRY"
        else:
            return "ALLOW_ENTRY"
    
    def _record_shadow_decision(self, 
                              state: Dict,
                              rule_signal: str, 
                              rl_decision: str,
                              baseline_decision: str):
        """记录影子决策"""
        if self.current_session:
            # 记录影子决策数据
            self.data_collector.record_decision(
                state=state,
                rule_signal=rule_signal,
                rl_decision=rl_decision,
                action_taken=baseline_decision,  # 实际执行的是基线决策
                order_result={},
                pnl_result=0.0,
                risk_events=[],
                final_outcome="SHADOW_MODE"
            )
    
    def record_execution_result(self,
                              state: Dict,
                              rule_signal: str,
                              rl_decision: str,
                              action_taken: str,
                              order_result: Dict,
                              pnl_result: float,
                              risk_events: list,
                              final_outcome: str):
        """记录执行结果"""
        if self.current_session:
            self.data_collector.record_decision(
                state=state,
                rule_signal=rule_signal,
                rl_decision=rl_decision,
                action_taken=action_taken,
                order_result=order_result,
                pnl_result=pnl_result,
                risk_events=risk_events,
                final_outcome=final_outcome
            )
