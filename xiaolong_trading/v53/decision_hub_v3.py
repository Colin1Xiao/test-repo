"""
Decision Hub V3 - Single Decision Core System

核心原则:
1. 唯一决策源 - 所有交易决策必须经过此处
2. 状态驱动 - 模块只输出状态，不决策
3. 可解释 - 每笔决策都有完整路径记录
4. 可审计 - 规则即数据，非代码

版本: V5.3
作者: 小龙
"""

from dataclasses import dataclass, field
from typing import Literal, List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import hashlib
import json


class Action(Enum):
    """决策动作"""
    EXECUTE = "EXECUTE"
    REDUCE = "REDUCE"
    SKIP = "SKIP"
    BLOCK = "BLOCK"
    STOP = "STOP"


@dataclass(frozen=True)
class SystemState:
    """
    系统状态 - 所有模块统一输出此结构
    
    模块角色:
    - Integrity Guard: integrity
    - Circuit Breaker: risk
    - Profit Audit: edge
    - Capital Controller: capital
    - Market Data: market
    - Kill Switch: 通过 RiskStateManager 设置 risk
    """
    integrity: Literal["OK", "FAIL"] = "OK"
    risk: Literal["NORMAL", "WARNING", "STOP_REQUIRED"] = "NORMAL"
    edge: Literal["STRONG", "WEAK", "DEAD"] = "STRONG"
    capital: Literal["NORMAL", "REDUCED", "BLOCKED"] = "NORMAL"
    market: Literal["FRESH", "STALE"] = "FRESH"
    
    def to_dict(self) -> Dict[str, str]:
        return {
            "integrity": self.integrity,
            "risk": self.risk,
            "edge": self.edge,
            "capital": self.capital,
            "market": self.market
        }


@dataclass(frozen=True)
class PriorityRule:
    """优先级规则 - 显式定义，可审计"""
    field: str
    condition: str
    action: Action
    reason: str


# 优先级规则表 - 按顺序执行
# 关键: 这是数据，不是代码逻辑
PRIORITY_RULES: List[PriorityRule] = [
    PriorityRule("integrity", "FAIL", Action.BLOCK, "INTEGRITY_FAIL"),
    PriorityRule("risk", "STOP_REQUIRED", Action.STOP, "RISK_STOP"),
    PriorityRule("edge", "DEAD", Action.STOP, "EDGE_DEAD"),
    PriorityRule("capital", "BLOCKED", Action.BLOCK, "CAPITAL_BLOCK"),
    PriorityRule("market", "STALE", Action.SKIP, "STALE_DATA"),
]


@dataclass(frozen=True)
class DecisionPolicy:
    """
    决策强度配置 - 与逻辑分离
    
    关键设计:
    - 修改强度 = 改配置（安全）
    - 修改逻辑 = 改代码（危险）
    """
    # 单条件降级
    WEAK_EDGE: float = 0.5
    WARNING_RISK: float = 0.3
    REDUCED_CAPITAL: float = 0.5
    
    # 组合降级（更严格）
    WEAK_EDGE_AND_REDUCED_CAPITAL: float = 0.2
    WARNING_RISK_AND_WEAK_EDGE: float = 0.15
    
    # 极端情况
    STALE_DATA_PENALTY: float = 0.0
    
    def get_multiplier(self, state: SystemState) -> float:
        """根据状态组合返回强度"""
        
        # 组合条件优先（更严格）
        if state.edge == "WEAK" and state.capital == "REDUCED":
            return self.WEAK_EDGE_AND_REDUCED_CAPITAL
        
        if state.risk == "WARNING" and state.edge == "WEAK":
            return self.WARNING_RISK_AND_WEAK_EDGE
        
        # 单条件
        if state.edge == "WEAK":
            return self.WEAK_EDGE
        
        if state.risk == "WARNING":
            return self.WARNING_RISK
        
        if state.capital == "REDUCED":
            return self.REDUCED_CAPITAL
        
        return 1.0  # NORMAL
    
    def get_triggered_by(self, state: SystemState) -> List[str]:
        """返回触发的条件字段"""
        triggered = []
        if state.edge == "WEAK":
            triggered.append("edge")
        if state.risk == "WARNING":
            triggered.append("risk")
        if state.capital == "REDUCED":
            triggered.append("capital")
        return triggered


@dataclass(frozen=True)
class InvalidCombo:
    """非法状态组合"""
    name: str
    conditions: Dict[str, str]
    severity: Literal["ERROR", "WARNING"] = "WARNING"


# 非法状态组合表 - 系统化冲突检测
INVALID_COMBINATIONS: List[InvalidCombo] = [
    InvalidCombo("EDGE_STRONG_vs_RISK_STOP", {
        "edge": "STRONG",
        "risk": "STOP_REQUIRED"
    }, "ERROR"),
    InvalidCombo("CAPITAL_BLOCKED_vs_EDGE_STRONG", {
        "capital": "BLOCKED",
        "edge": "STRONG"
    }, "WARNING"),
    InvalidCombo("INTEGRITY_FAIL_vs_ANY_EXECUTE", {
        "integrity": "FAIL"
    }, "ERROR"),
]


@dataclass
class Conflict:
    """冲突记录"""
    type: str
    severity: str
    state: SystemState
    timestamp: datetime = field(default_factory=datetime.utcnow)


class ConflictDetector:
    """系统化冲突检测器"""
    
    def check(self, state: SystemState) -> List[Conflict]:
        """检测所有冲突"""
        conflicts = []
        
        for combo in INVALID_COMBINATIONS:
            if self._matches(state, combo.conditions):
                conflicts.append(Conflict(
                    type=combo.name,
                    severity=combo.severity,
                    state=state
                ))
        
        return conflicts
    
    def _matches(self, state: SystemState, conditions: Dict[str, str]) -> bool:
        """检查状态是否匹配条件组合"""
        return all(
            getattr(state, k) == v
            for k, v in conditions.items()
        )


@dataclass
class Decision:
    """决策结果"""
    action: Action
    reason: str
    multiplier: float = 1.0
    triggered_by: List[str] = field(default_factory=list)
    rule: Optional[PriorityRule] = None
    
    @classmethod
    def execute(cls, reason: str, multiplier: float = 1.0) -> "Decision":
        return cls(Action.EXECUTE, reason, multiplier)
    
    @classmethod
    def reduce(cls, reason: str, multiplier: float, triggered_by: List[str]) -> "Decision":
        return cls(Action.REDUCE, reason, multiplier, triggered_by)
    
    @classmethod
    def skip(cls, reason: str) -> "Decision":
        return cls(Action.SKIP, reason)
    
    @classmethod
    def block(cls, reason: str) -> "Decision":
        return cls(Action.BLOCK, reason)
    
    @classmethod
    def stop(cls, reason: str) -> "Decision":
        return cls(Action.STOP, reason)


@dataclass
class EvaluationStep:
    """评估步骤记录"""
    rule: str
    result: bool
    action: Optional[str] = None


@dataclass
class DecisionLog:
    """完整决策日志 - 可解释、可审计"""
    decision_id: str
    timestamp: datetime
    version: str = "V5.3"
    
    state_snapshot: SystemState = field(default_factory=SystemState)
    evaluation_path: List[EvaluationStep] = field(default_factory=list)
    policy_applied: Optional[Dict[str, Any]] = None
    conflict_check: Dict[str, Any] = field(default_factory=dict)
    final: Dict[str, Any] = field(default_factory=dict)
    audit: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "timestamp": self.timestamp.isoformat(),
            "version": self.version,
            "state_snapshot": self.state_snapshot.to_dict(),
            "evaluation_path": [
                {"rule": step.rule, "result": step.result, "action": step.action}
                for step in self.evaluation_path
            ],
            "policy_applied": self.policy_applied,
            "conflict_check": self.conflict_check,
            "final": self.final,
            "audit": self.audit
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


class RiskStateManager:
    """
    风险状态管理器 - 所有风险状态写入必须经过此处
    
    关键设计:
    - Kill Switch 不能直接改 state
    - 必须通过此管理器，确保可追踪来源
    """
    
    def __init__(self):
        self._state: Literal["NORMAL", "WARNING", "STOP_REQUIRED"] = "NORMAL"
        self._source: Optional[str] = None
        self._history: List[Dict[str, Any]] = []
    
    def set_stop(self, source: str, reason: str):
        """设置 STOP 状态 - Kill Switch 调用入口"""
        old_state = self._state
        self._state = "STOP_REQUIRED"
        self._source = source
        
        self._history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "from": old_state,
            "to": "STOP_REQUIRED",
            "source": source,
            "reason": reason
        })
    
    def set_warning(self, source: str, reason: str):
        """设置 WARNING 状态"""
        if self._state == "STOP_REQUIRED":
            return  # STOP 优先级更高，不降级
        
        old_state = self._state
        self._state = "WARNING"
        self._source = source
        
        self._history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "from": old_state,
            "to": "WARNING",
            "source": source,
            "reason": reason
        })
    
    def reset(self, source: str):
        """重置为 NORMAL"""
        old_state = self._state
        self._state = "NORMAL"
        self._source = source
        
        self._history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "from": old_state,
            "to": "NORMAL",
            "source": source,
            "reason": "reset"
        })
    
    @property
    def state(self) -> str:
        return self._state
    
    @property
    def last_source(self) -> Optional[str]:
        return self._source
    
    @property
    def history(self) -> List[Dict[str, Any]]:
        return self._history.copy()


class DecisionHubV3:
    """
    Decision Hub V3 - 唯一决策源
    
    核心原则:
    1. 所有模块只输出状态
    2. 只有此处做决策
    3. 决策过程完全可解释
    4. 冲突自动检测
    """
    
    def __init__(self, policy: Optional[DecisionPolicy] = None):
        self.policy = policy or DecisionPolicy()
        self.conflict_detector = ConflictDetector()
        self.risk_manager = RiskStateManager()
        self._decision_count = 0
    
    def decide(self, state: SystemState) -> DecisionLog:
        """
        唯一决策入口
        
        返回完整的决策日志，包含:
        - 状态快照
        - 评估路径
        - 冲突检测
        - 最终决策
        """
        start_time = datetime.utcnow()
        self._decision_count += 1
        
        # 生成决策ID
        decision_id = self._generate_id(state, start_time)
        
        # 初始化日志
        log = DecisionLog(
            decision_id=decision_id,
            timestamp=start_time,
            state_snapshot=state
        )
        
        # 1. 冲突检测
        conflicts = self.conflict_detector.check(state)
        log.conflict_check = {
            "checked": len(INVALID_COMBINATIONS),
            "found": len(conflicts),
            "conflicts": [
                {"type": c.type, "severity": c.severity}
                for c in conflicts
            ]
        }
        
        # 2. 按优先级规则评估
        decision = None
        for rule in PRIORITY_RULES:
            field_value = getattr(state, rule.field)
            matched = field_value == rule.condition
            
            log.evaluation_path.append(EvaluationStep(
                rule=f"{rule.field} == {rule.condition}",
                result=matched,
                action=rule.action.value if matched else None
            ))
            
            if matched:
                decision = Decision(
                    action=rule.action,
                    reason=rule.reason,
                    rule=rule
                )
                break
        
        # 3. 无优先级规则触发，检查降级
        if decision is None:
            multiplier = self.policy.get_multiplier(state)
            
            if multiplier < 1.0:
                triggered_by = self.policy.get_triggered_by(state)
                decision = Decision.reduce(
                    reason="LOW_CONFIDENCE",
                    multiplier=multiplier,
                    triggered_by=triggered_by
                )
                
                log.policy_applied = {
                    "name": self._get_policy_name(state),
                    "multiplier": multiplier,
                    "triggered_by": triggered_by
                }
            else:
                decision = Decision.execute("ALL_GREEN", multiplier=1.0)
        
        # 4. 记录最终决策
        log.final = {
            "action": decision.action.value,
            "reason": decision.reason,
            "multiplier": decision.multiplier,
            "triggered_by": decision.triggered_by
        }
        
        # 5. 审计信息
        end_time = datetime.utcnow()
        log.audit = {
            "latency_ms": (end_time - start_time).total_seconds() * 1000,
            "hash": self._hash_decision(log),
            "decision_number": self._decision_count
        }
        
        return log
    
    def _generate_id(self, state: SystemState, timestamp: datetime) -> str:
        """生成唯一决策ID"""
        data = f"{timestamp.isoformat()}:{json.dumps(state.to_dict(), sort_keys=True)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _hash_decision(self, log: DecisionLog) -> str:
        """计算决策哈希"""
        data = json.dumps(log.to_dict(), sort_keys=True)
        return hashlib.sha256(data.encode()).hexdigest()[:32]
    
    def _get_policy_name(self, state: SystemState) -> str:
        """获取策略名称"""
        if state.edge == "WEAK" and state.capital == "REDUCED":
            return "WEAK_EDGE_AND_REDUCED_CAPITAL"
        if state.risk == "WARNING" and state.edge == "WEAK":
            return "WARNING_RISK_AND_WEAK_EDGE"
        if state.edge == "WEAK":
            return "WEAK_EDGE"
        if state.risk == "WARNING":
            return "WARNING_RISK"
        if state.capital == "REDUCED":
            return "REDUCED_CAPITAL"
        return "NORMAL"


# ============ 使用示例 ============

if __name__ == "__main__":
    # 初始化 Decision Hub
    hub = DecisionHubV3()
    
    # 示例1: 正常执行
    print("=" * 50)
    print("示例1: 正常执行 (ALL_GREEN)")
    print("=" * 50)
    state1 = SystemState(
        integrity="OK",
        risk="NORMAL",
        edge="STRONG",
        capital="NORMAL",
        market="FRESH"
    )
    log1 = hub.decide(state1)
    print(log1.to_json())
    
    # 示例2: 降级执行
    print("\n" + "=" * 50)
    print("示例2: 降级执行 (WEAK EDGE)")
    print("=" * 50)
    state2 = SystemState(
        integrity="OK",
        risk="NORMAL",
        edge="WEAK",
        capital="NORMAL",
        market="FRESH"
    )
    log2 = hub.decide(state2)
    print(log2.to_json())
    
    # 示例3: 组合降级
    print("\n" + "=" * 50)
    print("示例3: 组合降级 (WEAK + REDUCED)")
    print("=" * 50)
    state3 = SystemState(
        integrity="OK",
        risk="NORMAL",
        edge="WEAK",
        capital="REDUCED",
        market="FRESH"
    )
    log3 = hub.decide(state3)
    print(log3.to_json())
    
    # 示例4: 风险熔断
    print("\n" + "=" * 50)
    print("示例4: 风险熔断 (STOP_REQUIRED)")
    print("=" * 50)
    state4 = SystemState(
        integrity="OK",
        risk="STOP_REQUIRED",
        edge="STRONG",
        capital="NORMAL",
        market="FRESH"
    )
    log4 = hub.decide(state4)
    print(log4.to_json())
    
    # 示例5: 冲突检测
    print("\n" + "=" * 50)
    print("示例5: 冲突检测 (STRONG vs STOP)")
    print("=" * 50)
    state5 = SystemState(
        integrity="OK",
        risk="STOP_REQUIRED",
        edge="STRONG",
        capital="NORMAL",
        market="FRESH"
    )
    log5 = hub.decide(state5)
    print(log5.to_json())
    
    # 示例6: Kill Switch 使用
    print("\n" + "=" * 50)
    print("示例6: Kill Switch 使用")
    print("=" * 50)
    
    # Kill Switch 触发（通过 RiskStateManager）
    hub.risk_manager.set_stop("kill_switch", "manual_trigger")
    
    # 获取当前风险状态
    current_risk = hub.risk_manager.state
    print(f"Kill Switch 触发后 risk 状态: {current_risk}")
    print(f"来源: {hub.risk_manager.last_source}")
    print(f"历史: {hub.risk_manager.history}")
    
    # 使用当前风险状态做决策
    state6 = SystemState(
        integrity="OK",
        risk=current_risk,  # STOP_REQUIRED
        edge="STRONG",
        capital="NORMAL",
        market="FRESH"
    )
    log6 = hub.decide(state6)
    print(f"\n决策结果: {log6.final}")
    
    print("\n" + "=" * 50)
    print("Decision Hub V3 演示完成")
    print("=" * 50)
    print(f"总决策数: {hub._decision_count}")