#!/usr/bin/env python3
"""
RL Data Collector - 强化学习数据收集器
负责记录交易决策相关的状态、动作、结果数据
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

class RLDataCollector:
    """RL 数据收集器"""
    
    def __init__(self, data_dir: str = "rl_data"):
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.current_session = None
        
    def start_session(self, session_id: str = None):
        """开始新的数据收集会话"""
        if session_id is None:
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self.current_session = session_id
        session_file = os.path.join(self.data_dir, f"{session_id}.jsonl")
        
        # 初始化会话文件
        with open(session_file, 'w') as f:
            pass
            
        print(f"📊 RL 数据收集会话开始: {session_id}")
        
    def record_decision(self, 
                      state: Dict[str, Any],
                      rule_signal: str,
                      rl_decision: str,
                      action_taken: str,
                      order_result: Dict[str, Any],
                      pnl_result: float,
                      risk_events: list,
                      final_outcome: str,
                      timestamp: str = None):
        """记录单次决策数据"""
        if self.current_session is None:
            print("⚠️  RL 数据收集器未初始化")
            return
            
        if timestamp is None:
            timestamp = datetime.now().isoformat()
            
        record = {
            "timestamp": timestamp,
            "session_id": self.current_session,
            "state": state,
            "rule_signal": rule_signal,
            "rl_decision": rl_decision,
            "action_taken": action_taken,
            "order_result": order_result,
            "pnl_result": pnl_result,
            "risk_events": risk_events,
            "final_outcome": final_outcome
        }
        
        session_file = os.path.join(self.data_dir, f"{self.current_session}.jsonl")
        with open(session_file, 'a') as f:
            f.write(json.dumps(record) + '\n')
            
        print(f"📝 RL 决策已记录: {rl_decision} -> {action_taken}")
        
    def end_session(self):
        """结束当前数据收集会话"""
        if self.current_session:
            print(f"📊 RL 数据收集会话结束: {self.current_session}")
            self.current_session = None
