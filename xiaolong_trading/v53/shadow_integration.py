"""
Shadow Mode 集成 - 决策对比系统

核心原则:
1. Shadow 决策不影响真实执行
2. 所有对比数据持久化
3. 异常自动检测

版本: V5.3
作者: 小龙
"""

import json
import os
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Optional, Literal
from datetime import datetime
from pathlib import Path

from decision_hub_v3 import DecisionHubV3, SystemState, DecisionLog, Action
from module_adapters import StateAggregator


@dataclass
class DecisionDiff:
    """决策对比记录"""
    timestamp: str
    signal_id: str
    
    # 旧系统决策
    old_action: str
    old_multiplier: float
    old_reason: str
    
    # 新系统决策
    new_action: str
    new_multiplier: float
    new_reason: str
    new_triggered_by: list
    
    # 状态快照
    state: Dict[str, str]
    
    # 差异分析
    diff_type: Literal["SAME", "CONSERVATIVE", "AGGRESSIVE", "MULTIPLIER"]
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    
    # 评估路径（新系统）
    evaluation_path: list


class DecisionDiffLogger:
    """决策对比日志器"""
    
    def __init__(self, log_dir: str = "logs/decision_diff"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.diffs: list = []
        self.stats = {
            "total": 0,
            "same": 0,
            "conservative": 0,
            "aggressive": 0,
            "multiplier_diff": 0
        }
    
    def log(self, signal_id: str, old_decision: dict, new_log: DecisionLog, state: SystemState):
        """
        记录决策对比
        
        参数:
            signal_id: 信号ID
            old_decision: 旧系统决策 {"action": "EXECUTE", "multiplier": 1.0, "reason": "..."}
            new_log: 新系统决策日志
            state: 系统状态
        """
        new_final = new_log.final
        
        # 分析差异类型
        diff_type = self._analyze_diff(
            old_decision.get("action", "EXECUTE"),
            new_final.get("action", "EXECUTE")
        )
        
        # 风险等级
        risk_level = self._calc_risk_level(
            old_decision.get("action", "EXECUTE"),
            new_final.get("action", "EXECUTE")
        )
        
        diff = DecisionDiff(
            timestamp=datetime.utcnow().isoformat(),
            signal_id=signal_id,
            old_action=old_decision.get("action", "EXECUTE"),
            old_multiplier=old_decision.get("multiplier", 1.0),
            old_reason=old_decision.get("reason", "unknown"),
            new_action=new_final.get("action", "EXECUTE"),
            new_multiplier=new_final.get("multiplier", 1.0),
            new_reason=new_final.get("reason", "unknown"),
            new_triggered_by=new_final.get("triggered_by", []),
            state=state.to_dict(),
            diff_type=diff_type,
            risk_level=risk_level,
            evaluation_path=[{
                "rule": step.rule,
                "result": step.result,
                "action": step.action
            } for step in new_log.evaluation_path]
        )
        
        self.diffs.append(diff)
        self._update_stats(diff_type)
        self._persist(diff)
        
        # 实时告警
        if risk_level == "HIGH":
            print(f"🚨 HIGH RISK: {signal_id} - 新系统更激进!")
        
        return diff
    
    def _analyze_diff(self, old_action: str, new_action: str) -> str:
        """分析差异类型"""
        if old_action == new_action:
            return "SAME"
        
        # 保守程度排序
        conservative_order = ["EXECUTE", "REDUCE", "SKIP", "BLOCK", "STOP"]
        old_idx = conservative_order.index(old_action)
        new_idx = conservative_order.index(new_action)
        
        if new_idx > old_idx:
            return "CONSERVATIVE"
        else:
            return "AGGRESSIVE"
    
    def _calc_risk_level(self, old_action: str, new_action: str) -> str:
        """计算风险等级"""
        # 最危险：新系统更激进
        if new_action == "EXECUTE" and old_action in ["SKIP", "BLOCK", "STOP"]:
            return "HIGH"
        
        # 中等：新系统更保守
        if old_action == "EXECUTE" and new_action in ["SKIP", "BLOCK", "STOP"]:
            return "LOW"
        
        return "MEDIUM"
    
    def _update_stats(self, diff_type: str):
        """更新统计"""
        self.stats["total"] += 1
        if diff_type == "SAME":
            self.stats["same"] += 1
        elif diff_type == "CONSERVATIVE":
            self.stats["conservative"] += 1
        else:
            self.stats["aggressive"] += 1
    
    def _persist(self, diff: DecisionDiff):
        """持久化到文件"""
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        log_file = self.log_dir / f"decision_diff_{date_str}.jsonl"
        
        with open(log_file, "a") as f:
            f.write(json.dumps(asdict(diff), ensure_ascii=False) + "\n")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        total = self.stats["total"]
        if total == 0:
            return {
                "total": 0,
                "diff_rate": "0%",
                "recommendation": "NO_DATA"
            }
        
        diff_count = total - self.stats["same"]
        diff_rate = diff_count / total
        
        # 自动结论
        if self.stats["aggressive"] > 0:
            recommendation = "BLOCK"
        elif diff_rate > 0.2:
            recommendation = "WARN"
        else:
            recommendation = "PASS"
        
        return {
            "total": total,
            "same": self.stats["same"],
            "conservative": self.stats["conservative"],
            "aggressive": self.stats["aggressive"],
            "diff_rate": f"{diff_rate*100:.1f}%",
            "recommendation": recommendation
        }
    
    def get_recent(self, n: int = 30) -> list:
        """获取最近 n 条记录"""
        return self.diffs[-n:]
    
    def print_summary(self):
        """打印摘要"""
        stats = self.get_stats()
        
        print(f"\n{'='*60}")
        print("决策对比摘要")
        print(f"{'='*60}")
        print(f"总记录数: {stats['total']}")
        print(f"一致: {stats['same']}")
        print(f"更保守: {stats['conservative']}")
        print(f"更激进: {stats['aggressive']} {'🚨' if stats['aggressive'] > 0 else ''}")
        print(f"差异率: {stats['diff_rate']}")
        print(f"建议: {stats['recommendation']}")
        print(f"{'='*60}\n")


class ShadowModeRunner:
    """
    Shadow Mode 运行器
    
    用法:
        runner = ShadowModeRunner()
        
        # 在主循环中
        for signal in signals:
            # 1. 构建状态
            state = runner.build_state(signal, market_data, position_data)
            
            # 2. Shadow 决策（新系统）
            new_log = runner.decide(state)
            
            # 3. 原系统决策（旧系统）
            old_decision = v52_decide(signal)
            
            # 4. 记录对比
            runner.log_diff(signal.id, old_decision, new_log, state)
            
            # 5. 执行旧系统决策（关键！）
            execute(old_decision)
    """
    
    def __init__(self):
        self.hub = DecisionHubV3()
        self.aggregator = StateAggregator()
        self.logger = DecisionDiffLogger()
    
    def build_state(self, signal: dict, market_data: dict, position_data: dict) -> SystemState:
        """
        构建系统状态
        
        从现有系统数据构建 SystemState
        """
        inputs = {
            "system_state": {
                "api_connected": True,
                "position_synced": True,
                "params_locked": True,
                "errors": []
            },
            "metrics": {
                "daily_pnl": position_data.get("daily_pnl", 0),
                "consecutive_errors": 0,
                "latency_ms": market_data.get("latency_ms", 200),
                "drawdown": position_data.get("drawdown", 0.02)
            },
            "audit_data": {
                "total_trades": position_data.get("total_trades", 20),
                "win_rate": position_data.get("win_rate", 0.6),
                "profit_factor": position_data.get("profit_factor", 1.2),
                "sharpe": position_data.get("sharpe", 1.0)
            },
            "position_data": {
                "daily_pnl": position_data.get("daily_pnl", 0),
                "current_position": position_data.get("current_position", 0)
            },
            "market_data": {
                "age_ms": market_data.get("age_ms", 500)
            }
        }
        
        return self.aggregator.aggregate(inputs)
    
    def decide(self, state: SystemState) -> DecisionLog:
        """Shadow 决策（新系统）"""
        return self.hub.decide(state)
    
    def log_diff(self, signal_id: str, old_decision: dict, new_log: DecisionLog, state: SystemState):
        """记录决策对比"""
        return self.logger.log(signal_id, old_decision, new_log, state)
    
    def get_stats(self) -> dict:
        """获取统计"""
        return self.logger.get_stats()
    
    def print_summary(self):
        """打印摘要"""
        self.logger.print_summary()


# ============ 演示 ============

if __name__ == "__main__":
    print("="*60)
    print("Shadow Mode 演示")
    print("="*60)
    
    runner = ShadowModeRunner()
    
    # 模拟 10 笔交易
    test_cases = [
        # 正常
        {"signal_id": "T001", "market": {"age_ms": 300}, "position": {"daily_pnl": 10, "current_position": 30, "win_rate": 0.65}},
        # Edge 弱
        {"signal_id": "T002", "market": {"age_ms": 400}, "position": {"daily_pnl": -5, "current_position": 40, "win_rate": 0.45}},
        # 风险警告
        {"signal_id": "T003", "market": {"age_ms": 500}, "position": {"daily_pnl": -30, "current_position": 50, "win_rate": 0.5}},
        # 资金减少
        {"signal_id": "T004", "market": {"age_ms": 350}, "position": {"daily_pnl": -15, "current_position": 60, "win_rate": 0.55}},
        # 组合降级
        {"signal_id": "T005", "market": {"age_ms": 450}, "position": {"daily_pnl": -20, "current_position": 70, "win_rate": 0.4}},
        # 数据过期
        {"signal_id": "T006", "market": {"age_ms": 6000}, "position": {"daily_pnl": 5, "current_position": 20, "win_rate": 0.6}},
        # 正常
        {"signal_id": "T007", "market": {"age_ms": 250}, "position": {"daily_pnl": 15, "current_position": 25, "win_rate": 0.7}},
        # Edge 死亡
        {"signal_id": "T008", "market": {"age_ms": 400}, "position": {"daily_pnl": -40, "current_position": 80, "win_rate": 0.3}},
        # 风险熔断
        {"signal_id": "T009", "market": {"age_ms": 300}, "position": {"daily_pnl": -120, "current_position": 90, "win_rate": 0.25}},
        # 正常
        {"signal_id": "T010", "market": {"age_ms": 280}, "position": {"daily_pnl": 20, "current_position": 35, "win_rate": 0.68}},
    ]
    
    print("\n模拟 10 笔 Shadow 决策...")
    
    for case in test_cases:
        # 构建状态
        state = runner.build_state(
            signal={"id": case["signal_id"]},
            market_data=case["market"],
            position_data=case["position"]
        )
        
        # Shadow 决策（新系统）
        new_log = runner.decide(state)
        
        # 模拟旧系统决策（简化）
        old_decision = {
            "action": "EXECUTE",
            "multiplier": 1.0,
            "reason": "v52_default"
        }
        
        # 记录对比
        diff = runner.log_diff(case["signal_id"], old_decision, new_log, state)
        
        print(f"{case['signal_id']}: "
              f"旧={old_decision['action']} → "
              f"新={diff.new_action} "
              f"({diff.diff_type}, {diff.risk_level})")
    
    # 打印摘要
    runner.print_summary()
    
    # 显示详细记录
    print("\n详细记录:")
    for diff in runner.logger.get_recent(5):
        print(f"\n{diff.signal_id}:")
        print(f"  旧: {diff.old_action} ({diff.old_reason})")
        print(f"  新: {diff.new_action} ({diff.new_reason})")
        print(f"  差异: {diff.diff_type}, 风险: {diff.risk_level}")
        print(f"  触发: {diff.new_triggered_by}")
    
    print("\n" + "="*60)
    print("Shadow Mode 演示完成")
    print("日志保存至: logs/decision_diff/")
    print("="*60)