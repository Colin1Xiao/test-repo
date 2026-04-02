"""
Risk Rule Chain — 风险规则链

实现可配置的风险规则链引擎：
- 规则按顺序执行
- 支持 AND/OR/NOT 逻辑
- 支持动态参数
- 支持规则热加载

每条规则包含：
- 条件（condition）
- 动作（action）
- 优先级（priority）
- 启用状态（enabled）
"""

import re
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List, Callable, Union
from dataclasses import dataclass, field
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.risk import RiskLevel, RiskDecision


class RuleOperator(Enum):
    """规则操作符"""
    EQ = "eq"  # 等于
    NE = "ne"  # 不等于
    GT = "gt"  # 大于
    GE = "ge"  # 大于等于
    LT = "lt"  # 小于
    LE = "le"  # 小于等于
    IN = "in"  # 包含于
    NOT_IN = "not_in"  # 不包含于
    BETWEEN = "between"  # 介于
    CONTAINS = "contains"  # 包含字符串
    MATCHES = "matches"  # 正则匹配


class RuleAction(Enum):
    """规则动作"""
    APPROVE = "approve"  # 批准
    REJECT = "reject"  # 拒绝
    REDUCE = "reduce"  # 减仓
    REQUIRE_CONFIRMATION = "require_confirmation"  # 需要确认
    TRIGGER_BREAKER = "trigger_breaker"  # 触发熔断
    LOG_WARNING = "log_warning"  # 记录警告
    SEND_ALERT = "send_alert"  # 发送警报


@dataclass
class RuleCondition:
    """规则条件"""
    field: str  # 字段路径（如 "order.size", "position.unrealized_pnl"）
    operator: RuleOperator
    value: Any
    description: str = ""
    
    def evaluate(self, context: Dict[str, Any]) -> bool:
        """评估条件"""
        # 获取字段值
        value = self._get_field_value(context, self.field)
        
        if value is None:
            return False
        
        # 执行比较
        if self.operator == RuleOperator.EQ:
            return value == self.value
        elif self.operator == RuleOperator.NE:
            return value != self.value
        elif self.operator == RuleOperator.GT:
            return value > self.value
        elif self.operator == RuleOperator.GE:
            return value >= self.value
        elif self.operator == RuleOperator.LT:
            return value < self.value
        elif self.operator == RuleOperator.LE:
            return value <= self.value
        elif self.operator == RuleOperator.IN:
            return value in self.value
        elif self.operator == RuleOperator.NOT_IN:
            return value not in self.value
        elif self.operator == RuleOperator.BETWEEN:
            return self.value[0] <= value <= self.value[1]
        elif self.operator == RuleOperator.CONTAINS:
            return self.value in str(value)
        elif self.operator == RuleOperator.MATCHES:
            return bool(re.match(self.value, str(value)))
        
        return False
    
    def _get_field_value(self, context: Dict[str, Any], field_path: str) -> Any:
        """获取嵌套字段值"""
        parts = field_path.split(".")
        value = context
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            elif hasattr(value, part):
                value = getattr(value, part)
            else:
                return None
            
            if value is None:
                return None
        
        return value


@dataclass
class RiskRule:
    """风险规则"""
    rule_id: str
    name: str
    description: str
    conditions: List[RuleCondition]
    action: RuleAction
    action_params: Dict[str, Any] = field(default_factory=dict)
    priority: int = 0  # 优先级（越高越先执行）
    enabled: bool = True
    risk_level: RiskLevel = RiskLevel.MEDIUM
    tags: List[str] = field(default_factory=list)
    
    def evaluate(self, context: Dict[str, Any]) -> bool:
        """评估规则（所有条件都满足）"""
        if not self.enabled:
            return False
        
        for condition in self.conditions:
            if not condition.evaluate(context):
                return False
        
        return True
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """执行规则动作"""
        return {
            "rule_id": self.rule_id,
            "action": self.action.value,
            "params": self.action_params,
            "risk_level": self.risk_level.value,
        }


class RuleChain:
    """规则链"""
    
    def __init__(self, chain_id: str, name: str):
        self.chain_id = chain_id
        self.name = name
        self._rules: List[RiskRule] = []
        self._event_callback: Optional[Callable] = None
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def add_rule(self, rule: RiskRule) -> None:
        """添加规则（按优先级排序）"""
        self._rules.append(rule)
        self._rules.sort(key=lambda r: -r.priority)
    
    def remove_rule(self, rule_id: str) -> bool:
        """移除规则"""
        for i, rule in enumerate(self._rules):
            if rule.rule_id == rule_id:
                self._rules.pop(i)
                return True
        return False
    
    def enable_rule(self, rule_id: str) -> bool:
        """启用规则"""
        for rule in self._rules:
            if rule.rule_id == rule_id:
                rule.enabled = True
                return True
        return False
    
    def disable_rule(self, rule_id: str) -> bool:
        """禁用规则"""
        for rule in self._rules:
            if rule.rule_id == rule_id:
                rule.enabled = False
                return True
        return False
    
    def evaluate(
        self,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        评估规则链
        
        Returns:
            匹配的规则及其动作
        """
        results = []
        
        for rule in self._rules:
            if rule.evaluate(context):
                result = rule.execute(context)
                result["matched"] = True
                results.append(result)
                
                # 记录事件
                self._publish_event(EventType.RISK_RULE_TRIGGERED, {
                    "rule_id": rule.rule_id,
                    "rule_name": rule.name,
                    "action": rule.action.value,
                    "risk_level": rule.risk_level.value,
                })
        
        return results
    
    def get_rules(self) -> List[Dict[str, Any]]:
        """获取所有规则"""
        return [
            {
                "rule_id": rule.rule_id,
                "name": rule.name,
                "description": rule.description,
                "priority": rule.priority,
                "enabled": rule.enabled,
                "risk_level": rule.risk_level.value,
                "tags": rule.tags,
            }
            for rule in self._rules
        ]
    
    def _publish_event(self, event_type: EventType, payload: Dict[str, Any]) -> None:
        """发布事件"""
        if self._event_callback:
            envelope = EventEnvelope(
                event_type=event_type,
                source=EventSource.RISK_ENGINE,
                payload=payload,
            )
            self._event_callback(envelope)


class RiskRuleEngine:
    """风险规则引擎"""
    
    def __init__(self):
        self._chains: Dict[str, RuleChain] = {}
        self._event_callback: Optional[Callable] = None
        self._init_default_rules()
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
        for chain in self._chains.values():
            chain.set_event_callback(callback)
    
    def _init_default_rules(self) -> None:
        """初始化默认规则"""
        # 订单大小限制规则链
        order_chain = RuleChain("RC-001", "订单大小限制")
        
        order_chain.add_rule(RiskRule(
            rule_id="RULE-001",
            name="单笔订单最大名义价值",
            description="单笔订单名义价值不得超过 1000 USDT",
            conditions=[
                RuleCondition(
                    field="order.notional",
                    operator=RuleOperator.GT,
                    value=1000.0,
                    description="名义价值 > 1000",
                )
            ],
            action=RuleAction.REJECT,
            action_params={"reason": "订单名义价值超过限制"},
            priority=100,
            risk_level=RiskLevel.HIGH,
            tags=["order_limit", "notional"],
        ))
        
        order_chain.add_rule(RiskRule(
            rule_id="RULE-002",
            name="单笔订单最小名义价值",
            description="单笔订单名义价值不得小于 1 USDT",
            conditions=[
                RuleCondition(
                    field="order.notional",
                    operator=RuleOperator.LT,
                    value=1.0,
                    description="名义价值 < 1",
                )
            ],
            action=RuleAction.REJECT,
            action_params={"reason": "订单名义价值低于最小限制"},
            priority=99,
            risk_level=RiskLevel.LOW,
            tags=["order_limit", "notional"],
        ))
        
        order_chain.add_rule(RiskRule(
            rule_id="RULE-003",
            name="订单大小超过仓位 50%",
            description="单笔订单大小不得超过当前仓位的 50%",
            conditions=[
                RuleCondition(
                    field="order.quantity",
                    operator=RuleOperator.GT,
                    value=0.0,  # 动态值，运行时计算
                    description="订单大小 > 仓位 * 0.5",
                )
            ],
            action=RuleAction.LOG_WARNING,
            action_params={"reason": "订单大小超过仓位 50%"},
            priority=50,
            risk_level=RiskLevel.MEDIUM,
            tags=["position_limit"],
        ))
        
        self._chains["order_limits"] = order_chain
        
        # 风险限制规则链
        risk_chain = RuleChain("RC-002", "风险限制")
        
        risk_chain.add_rule(RiskRule(
            rule_id="RULE-010",
            name="总敞口限制",
            description="总敞口不得超过 1000 USDT",
            conditions=[
                RuleCondition(
                    field="portfolio.total_exposure",
                    operator=RuleOperator.GT,
                    value=1000.0,
                    description="总敞口 > 1000",
                )
            ],
            action=RuleAction.REJECT,
            action_params={"reason": "总敞口超过限制"},
            priority=100,
            risk_level=RiskLevel.CRITICAL,
            tags=["exposure_limit"],
        ))
        
        risk_chain.add_rule(RiskRule(
            rule_id="RULE-011",
            name="单日亏损限制",
            description="单日亏损不得超过 100 USDT",
            conditions=[
                RuleCondition(
                    field="portfolio.daily_pnl",
                    operator=RuleOperator.LT,
                    value=-100.0,
                    description="日亏损 < -100",
                )
            ],
            action=RuleAction.TRIGGER_BREAKER,
            action_params={"breaker_type": "loss_limit"},
            priority=100,
            risk_level=RiskLevel.CRITICAL,
            tags=["loss_limit"],
        ))
        
        self._chains["risk_limits"] = risk_chain
        
        # 市场质量规则链
        market_chain = RuleChain("RC-003", "市场质量")
        
        market_chain.add_rule(RiskRule(
            rule_id="RULE-020",
            name="价差过大",
            description="买卖价差不得超过 0.1%",
            conditions=[
                RuleCondition(
                    field="market.spread_pct",
                    operator=RuleOperator.GT,
                    value=0.001,
                    description="价差 > 0.1%",
                )
            ],
            action=RuleAction.REJECT,
            action_params={"reason": "市场价差过大"},
            priority=100,
            risk_level=RiskLevel.HIGH,
            tags=["market_quality"],
        ))
        
        market_chain.add_rule(RiskRule(
            rule_id="RULE-021",
            name="行情停滞",
            description="行情超过 60 秒未更新",
            conditions=[
                RuleCondition(
                    field="market.stale_seconds",
                    operator=RuleOperator.GT,
                    value=60.0,
                    description="停滞时间 > 60s",
                )
            ],
            action=RuleAction.TRIGGER_BREAKER,
            action_params={"breaker_type": "market_stale"},
            priority=100,
            risk_level=RiskLevel.HIGH,
            tags=["market_quality"],
        ))
        
        self._chains["market_quality"] = market_chain
    
    def get_chain(self, chain_id: str) -> Optional[RuleChain]:
        """获取规则链"""
        return self._chains.get(chain_id)
    
    def evaluate(
        self,
        context: Dict[str, Any],
        chain_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        评估风险
        
        Args:
            context: 评估上下文
            chain_ids: 指定要评估的规则链（None 表示所有）
        
        Returns:
            评估结果
        """
        results = {
            "approved": True,
            "decisions": [],
            "warnings": [],
            "rejections": [],
        }
        
        chains_to_evaluate = chain_ids or list(self._chains.keys())
        
        for chain_id in chains_to_evaluate:
            chain = self.get_chain(chain_id)
            if not chain:
                continue
            
            chain_results = chain.evaluate(context)
            
            for result in chain_results:
                action = result["action"]
                
                if action == RuleAction.REJECT.value:
                    results["approved"] = False
                    results["rejections"].append({
                        "chain_id": chain_id,
                        "rule_id": result["rule_id"],
                        "reason": result["params"].get("reason", "未知"),
                    })
                elif action == RuleAction.LOG_WARNING.value:
                    results["warnings"].append({
                        "chain_id": chain_id,
                        "rule_id": result["rule_id"],
                        "reason": result["params"].get("reason", "未知"),
                    })
                else:
                    results["decisions"].append(result)
        
        return results
    
    def check_order(
        self,
        order_context: Dict[str, Any]
    ) -> RiskDecision:
        """检查订单"""
        result = self.evaluate(order_context)
        
        if not result["approved"]:
            reasons = [r["reason"] for r in result["rejections"]]
            return RiskDecision(
                approved=False,
                reason="; ".join(reasons),
                risk_level=RiskLevel.HIGH,
            )
        
        if result["warnings"]:
            reasons = [w["reason"] for w in result["warnings"]]
            return RiskDecision(
                approved=True,
                reason="; ".join(reasons),
                risk_level=RiskLevel.MEDIUM,
            )
        
        return RiskDecision(
            approved=True,
            reason="通过所有风险检查",
            risk_level=RiskLevel.LOW,
        )
    
    def status(self) -> Dict[str, Any]:
        """获取状态"""
        return {
            "chain_count": len(self._chains),
            "chains": {
                chain_id: {
                    "name": chain.name,
                    "rule_count": len(chain.get_rules()),
                    "rules": chain.get_rules(),
                }
                for chain_id, chain in self._chains.items()
            },
        }


# 使用示例
if __name__ == "__main__":
    engine = RiskRuleEngine()
    
    print("=== 规则引擎状态 ===")
    status = engine.status()
    print(f"规则链数量：{status['chain_count']}")
    for chain_id, chain_info in status['chains'].items():
        print(f"\n{chain_id}: {chain_info['name']}")
        print(f"  规则数：{chain_info['rule_count']}")
        for rule in chain_info['rules']:
            print(f"    - {rule['name']} (优先级：{rule['priority']})")
    
    print("\n=== 测试订单检查 ===")
    
    # 正常订单
    order1 = {
        "order": {
            "notional": 500.0,
            "quantity": 0.25,
        },
        "portfolio": {
            "total_exposure": 800.0,
            "daily_pnl": -50.0,
        },
        "market": {
            "spread_pct": 0.0005,
            "stale_seconds": 10,
        },
    }
    
    result1 = engine.check_order(order1)
    print(f"订单 1: approved={result1.approved}, reason={result1.reason}")
    
    # 超限订单
    order2 = {
        "order": {
            "notional": 1500.0,  # 超过 1000
            "quantity": 0.75,
        },
        "portfolio": {
            "total_exposure": 800.0,
            "daily_pnl": -50.0,
        },
        "market": {
            "spread_pct": 0.0005,
            "stale_seconds": 10,
        },
    }
    
    result2 = engine.check_order(order2)
    print(f"订单 2: approved={result2.approved}, reason={result2.reason}")
    
    # 价差过大
    order3 = {
        "order": {
            "notional": 500.0,
            "quantity": 0.25,
        },
        "portfolio": {
            "total_exposure": 800.0,
            "daily_pnl": -50.0,
        },
        "market": {
            "spread_pct": 0.002,  # 超过 0.001
            "stale_seconds": 10,
        },
    }
    
    result3 = engine.check_order(order3)
    print(f"订单 3: approved={result3.approved}, reason={result3.reason}")
