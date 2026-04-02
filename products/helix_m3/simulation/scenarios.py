"""
Simulation Scenarios — 仿真场景定义

定义各种测试场景，用于系统级演练：
- 网络断开
- 行情停滞
- 拒绝风暴
- 熔断触发
- 混合故障

每个场景包含：
- 前置条件
- 注入的故障/事件
- 预期行为
- 验证标准
"""

import random
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side as OrderSide, OrderStatus


@dataclass
class ScenarioStep:
    """场景步骤"""
    delay_seconds: float  # 延迟时间（相对于上一步）
    action: str  # 动作类型
    params: Dict[str, Any] = field(default_factory=dict)  # 动作参数
    description: str = ""  # 步骤描述


@dataclass
class ScenarioExpectation:
    """场景预期"""
    check_type: str  # 检查类型
    condition: Callable  # 验证函数
    description: str  # 预期描述


@dataclass
class ScenarioDefinition:
    """场景定义"""
    scenario_id: str
    name: str
    description: str
    difficulty: str  # easy / medium / hard / extreme
    duration_seconds: float
    steps: List[ScenarioStep] = field(default_factory=list)
    expectations: List[ScenarioExpectation] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)  # 前置场景 ID


class ScenarioBuilder:
    """场景构建器"""
    
    def __init__(self, scenario_id: str, name: str):
        self.definition = ScenarioDefinition(
            scenario_id=scenario_id,
            name=name,
            description="",
            difficulty="medium",
            duration_seconds=0.0
        )
    
    def description(self, desc: str) -> 'ScenarioBuilder':
        self.definition.description = desc
        return self
    
    def difficulty(self, level: str) -> 'ScenarioBuilder':
        self.definition.difficulty = level
        return self
    
    def step(
        self,
        delay: float,
        action: str,
        **params
    ) -> 'ScenarioBuilder':
        self.definition.steps.append(ScenarioStep(
            delay_seconds=delay,
            action=action,
            params=params
        ))
        return self
    
    def expectation(
        self,
        check_type: str,
        condition: Callable,
        description: str
    ) -> 'ScenarioBuilder':
        self.definition.expectations.append(ScenarioExpectation(
            check_type=check_type,
            condition=condition,
            description=description
        ))
        return self
    
    def build(self) -> ScenarioDefinition:
        # 计算总时长
        total = sum(s.delay_seconds for s in self.definition.steps)
        self.definition.duration_seconds = total
        return self.definition


# ============================================================================
# 预定义场景库
# ============================================================================

def create_disconnect_scenario() -> ScenarioDefinition:
    """
    场景：网络断开
    
    模拟交易所连接断开，测试系统重连行为。
    """
    return (ScenarioBuilder("SCN-001", "网络断开")
        .description("模拟交易所 WebSocket 断开，验证重连机制")
        .difficulty("medium")
        
        # T+0: 正常交易
        .step(0.0, "inject_market_data", price=2000.0, volume=100.0)
        .step(1.0, "inject_signal", side="buy", size=0.1)
        .step(2.0, "inject_order_accepted", order_id="ORD-001")
        
        # T+3s: 断开连接
        .step(3.0, "inject_disconnect", reason="network_timeout")
        
        # T+3s ~ T+30s: 无行情
        .step(27.0, "wait", description="等待重连")
        
        # T+30s: 重连成功
        .step(30.0, "inject_reconnect", success=True)
        .step(31.0, "inject_market_data", price=2005.0, volume=100.0)
        
        # 预期：系统应自动重连，不应重复下单
        .expectation(
            "no_duplicate_orders",
            lambda state: state.order_count == 1,
            "不应重复下单"
        )
        .expectation(
            "auto_reconnect",
            lambda state: state.is_connected == True,
            "应自动重连"
        )
        
        .build()
    )


def create_stale_feed_scenario() -> ScenarioDefinition:
    """
    场景：行情停滞
    
    模拟行情数据停滞（价格长时间不变），测试 stale detection。
    """
    return (ScenarioBuilder("SCN-002", "行情停滞")
        .description("模拟行情数据停滞，验证 stale detection 和熔断")
        .difficulty("medium")
        
        # T+0: 正常行情
        .step(0.0, "inject_market_data", price=2000.0, volume=100.0)
        .step(1.0, "inject_market_data", price=2001.0, volume=100.0)
        .step(2.0, "inject_market_data", price=2002.0, volume=100.0)
        
        # T+3s ~ T+63s: 价格停滞（60 秒）
        .step(3.0, "inject_market_data", price=2002.0, volume=100.0)
        .step(60.0, "inject_market_data", price=2002.0, volume=100.0)
        
        # 预期：应触发 stale feed 熔断
        .expectation(
            "stale_detected",
            lambda state: state.stale_feed_detected == True,
            "应检测到行情停滞"
        )
        .expectation(
            "trading_halted",
            lambda state: state.trading_halted == True,
            "应停止交易"
        )
        
        .build()
    )


def create_reject_storm_scenario() -> ScenarioDefinition:
    """
    场景：拒绝风暴
    
    模拟订单连续被拒绝，测试 reject 熔断。
    """
    return (ScenarioBuilder("SCN-003", "拒绝风暴")
        .description("模拟订单连续被拒绝，验证 reject 熔断")
        .difficulty("hard")
        
        # T+0: 正常下单
        .step(0.0, "inject_signal", side="buy", size=0.1)
        .step(1.0, "inject_order_rejected", reason="insufficient_margin")
        
        # T+2s ~ T+10s: 连续拒绝
        .step(2.0, "inject_signal", side="buy", size=0.1)
        .step(3.0, "inject_order_rejected", reason="insufficient_margin")
        .step(4.0, "inject_signal", side="buy", size=0.1)
        .step(5.0, "inject_order_rejected", reason="insufficient_margin")
        .step(6.0, "inject_signal", side="buy", size=0.1)
        .step(7.0, "inject_order_rejected", reason="insufficient_margin")
        .step(8.0, "inject_signal", side="buy", size=0.1)
        .step(9.0, "inject_order_rejected", reason="insufficient_margin")
        
        # 预期：应触发 reject 熔断
        .expectation(
            "reject_circuit_breaker",
            lambda state: state.reject_count >= 5 and state.breaker_tripped == True,
            "连续 5 次拒绝应触发熔断"
        )
        .expectation(
            "trading_suspended",
            lambda state: state.trading_suspended == True,
            "应暂停交易"
        )
        
        .build()
    )


def create_price_gap_scenario() -> ScenarioDefinition:
    """
    场景：价格跳空
    
    模拟价格大幅跳空，测试滑点保护和风控。
    """
    return (ScenarioBuilder("SCN-004", "价格跳空")
        .description("模拟价格大幅跳空，验证滑点保护")
        .difficulty("hard")
        
        # T+0: 正常行情
        .step(0.0, "inject_market_data", price=2000.0, bid=1999.0, ask=2001.0)
        .step(1.0, "inject_signal", side="buy", size=0.1, limit_price=2001.0)
        
        # T+2s: 价格跳空 5%
        .step(2.0, "inject_market_data", price=2100.0, bid=2099.0, ask=2101.0)
        
        # 预期：订单应被重新定价或取消
        .expectation(
            "slippage_protection",
            lambda state: state.order_repriced or state.order_cancelled,
            "应触发滑点保护"
        )
        
        .build()
    )


def create_mixed_failure_scenario() -> ScenarioDefinition:
    """
    场景：混合故障
    
    同时发生多种故障，测试系统综合应对能力。
    """
    return (ScenarioBuilder("SCN-005", "混合故障")
        .description("网络断开 + 行情停滞 + 拒绝风暴，极限压力测试")
        .difficulty("extreme")
        
        # T+0: 正常
        .step(0.0, "inject_market_data", price=2000.0)
        .step(1.0, "inject_signal", side="buy", size=0.1)
        .step(2.0, "inject_order_accepted", order_id="ORD-001")
        
        # T+3s: 断开
        .step(3.0, "inject_disconnect", reason="network_timeout")
        
        # T+10s: 重连但行情停滞
        .step(10.0, "inject_reconnect", success=True)
        .step(11.0, "inject_market_data", price=2000.0)
        .step(70.0, "inject_market_data", price=2000.0)  # 60 秒停滞
        
        # T+80s: 恢复但连续拒绝
        .step(80.0, "inject_signal", side="buy", size=0.1)
        .step(81.0, "inject_order_rejected", reason="risk_limit")
        .step(82.0, "inject_signal", side="buy", size=0.1)
        .step(83.0, "inject_order_rejected", reason="risk_limit")
        .step(84.0, "inject_signal", side="buy", size=0.1)
        .step(85.0, "inject_order_rejected", reason="risk_limit")
        
        # 预期：系统应保持存活，不崩溃
        .expectation(
            "system_alive",
            lambda state: state.is_alive == True,
            "系统应保持存活"
        )
        .expectation(
            "graceful_degradation",
            lambda state: state.degraded_mode == True,
            "应进入降级模式"
        )
        
        .build()
    )


def create_sceneario_library() -> Dict[str, ScenarioDefinition]:
    """获取场景库"""
    return {
        "SCN-001": create_disconnect_scenario(),
        "SCN-002": create_stale_feed_scenario(),
        "SCN-003": create_reject_storm_scenario(),
        "SCN-004": create_price_gap_scenario(),
        "SCN-005": create_mixed_failure_scenario(),
    }


# ============================================================================
# 场景执行器（用于测试）
# ============================================================================

class ScenarioExecutor:
    """场景执行器"""
    
    def __init__(self, scenario: ScenarioDefinition):
        self.scenario = scenario
        # 状态模型统一
        self.state = {
            "is_alive": True,
            "is_connected": True,
            "degraded_mode": False,
            "trading_halted": False,
            "trading_suspended": False,
            "stale_feed_detected": False,
            "breaker_tripped": False,
            "order_count": 0,
            "reject_count": 0,
            "orders": {},
        }
        self.events: List[EventEnvelope] = []
    
    def inject_event(self, event: EventEnvelope) -> None:
        """注入事件到系统"""
        self.events.append(event)
    
    def run(self) -> Dict[str, Any]:
        """执行场景"""
        print(f"[Scenario] 开始执行：{self.scenario.name}")
        
        current_time = 0.0
        
        for step in self.scenario.steps:
            # 等待
            if step.delay_seconds > 0:
                time.sleep(min(step.delay_seconds, 0.1))  # 加速测试
                current_time += step.delay_seconds
            
            # 执行动作
            self._execute_step(step)
        
        # 验证预期
        results = self._validate_expectations()
        
        print(f"[Scenario] 完成：{self.scenario.name}")
        return results
    
    def _execute_step(self, step: ScenarioStep) -> None:
        """执行单个步骤"""
        action = step.action
        params = step.params
        
        if action == "inject_market_data":
            self._inject_market_data(params)
        elif action == "inject_signal":
            self._inject_signal(params)
        elif action == "inject_order_accepted":
            self._inject_order_accepted(params)
        elif action == "inject_order_rejected":
            self._inject_order_rejected(params)
        elif action == "inject_disconnect":
            self._inject_disconnect(params)
        elif action == "inject_reconnect":
            self._inject_reconnect(params)
        # ... 其他动作
    
    def _inject_market_data(self, params: Dict[str, Any]) -> None:
        """注入行情数据"""
        event = EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.MARKET_DATA_ENGINE,
            payload={
                "price": params.get("price", 2000.0),
                "bid": params.get("bid", params.get("price", 2000.0) - 1.0),
                "ask": params.get("ask", params.get("price", 2000.0) + 1.0),
                "volume": params.get("volume", 100.0),
            }
        )
        self.inject_event(event)
    
    def _inject_signal(self, params: Dict[str, Any]) -> None:
        """注入交易信号"""
        event = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={
                "side": params.get("side", "buy"),
                "size": params.get("size", 0.1),
                "limit_price": params.get("limit_price"),
            }
        )
        self.inject_event(event)
    
    def _inject_order_accepted(self, params: Dict[str, Any]) -> None:
        """注入订单接受事件"""
        event = EventEnvelope(
            event_type=EventType.ORDER_ACCEPTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={
                "order_id": params.get("order_id"),
            }
        )
        self.inject_event(event)
    
    def _inject_order_rejected(self, params: Dict[str, Any]) -> None:
        """注入订单拒绝事件"""
        event = EventEnvelope(
            event_type=EventType.ORDER_REJECTED,
            source=EventSource.EXECUTION_ENGINE,
            payload={
                "reason": params.get("reason", "unknown"),
            }
        )
        self.inject_event(event)
    
    def _inject_disconnect(self, params: Dict[str, Any]) -> None:
        """注入断开连接事件"""
        self.state["is_connected"] = False
        event = EventEnvelope(
            event_type=EventType.CONNECTION_LOST,
            source=EventSource.CONNECTOR,
            payload={
                "reason": params.get("reason", "unknown"),
            }
        )
        self.inject_event(event)
    
    def _inject_reconnect(self, params: Dict[str, Any]) -> None:
        """注入重连事件"""
        success = params.get("success", True)
        self.state["is_connected"] = success
        event = EventEnvelope(
            event_type=EventType.CONNECTION_RESTORED,
            source=EventSource.CONNECTOR,
            payload={
                "success": success,
            }
        )
        self.inject_event(event)
    
    def _inject_signal(self, params: Dict[str, Any]) -> None:
        """注入交易信号"""
        self.state["order_count"] += 1
        event = EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.STRATEGY_ENGINE,
            payload={
                "side": params.get("side", "buy"),
                "size": params.get("size", 0.1),
                "limit_price": params.get("limit_price"),
            }
        )
        self.inject_event(event)
    
    def _validate_expectations(self) -> Dict[str, bool]:
        """验证预期"""
        results = {}
        
        for exp in self.scenario.expectations:
            try:
                passed = exp.condition(self.state)
                results[exp.description] = passed
                print(f"  ✓ {exp.description}: {'PASS' if passed else 'FAIL'}")
            except Exception as e:
                print(f"  ✗ {exp.description}: ERROR - {e}")
                results[exp.description] = False
        
        return results


# 使用示例
if __name__ == "__main__":
    library = create_sceneario_library()
    
    print("=== 场景库 ===")
    for scenario_id, scenario in library.items():
        print(f"{scenario_id}: {scenario.name} ({scenario.difficulty})")
        print(f"  {scenario.description}")
        print(f"  时长：{scenario.duration_seconds}s")
        print(f"  步骤：{len(scenario.steps)}")
        print()
    
    # 执行一个场景
    print("\n=== 执行场景：网络断开 ===")
    executor = ScenarioExecutor(library["SCN-001"])
    results = executor.run()
    print(f"\n验证结果：{results}")
