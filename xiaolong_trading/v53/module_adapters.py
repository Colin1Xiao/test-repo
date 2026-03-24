"""
模块适配器 - 将现有模块输出转为 SystemState

核心原则:
- 模块只输出状态，不决策
- 所有决策权收归 Decision Hub

版本: V5.3
作者: 小龙
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

from decision_hub_v3 import SystemState, RiskStateManager


@dataclass
class ModuleState:
    """模块状态输出"""
    field: str
    value: str
    metadata: Dict[str, Any]
    timestamp: datetime


class IntegrityGuardAdapter:
    """
    Integrity Guard 适配器
    
    原职责: 运行许可
    新职责: 只输出 integrity 状态
    """
    
    def __init__(self):
        self._last_check = None
        self._failures = []
    
    def check(self, system_state: Dict[str, Any]) -> ModuleState:
        """
        检查系统完整性
        
        返回: integrity = OK / FAIL
        """
        # 检查项
        checks = {
            "api_connected": system_state.get("api_connected", False),
            "position_synced": system_state.get("position_synced", False),
            "params_locked": system_state.get("params_locked", True),
            "no_errors": len(system_state.get("errors", [])) == 0
        }
        
        all_ok = all(checks.values())
        
        if not all_ok:
            failed = [k for k, v in checks.items() if not v]
            self._failures.append({
                "timestamp": datetime.utcnow().isoformat(),
                "failed_checks": failed
            })
        
        self._last_check = checks
        
        return ModuleState(
            field="integrity",
            value="OK" if all_ok else "FAIL",
            metadata={"checks": checks, "failures": self._failures[-5:]},
            timestamp=datetime.utcnow()
        )


class CircuitBreakerAdapter:
    """
    Circuit Breaker 适配器
    
    原职责: 停机机制
    新职责: 只输出 risk 状态
    """
    
    def __init__(self, risk_manager: RiskStateManager):
        self.risk_manager = risk_manager
        self._thresholds = {
            "daily_loss": -100,  # USD
            "consecutive_errors": 5,
            "latency_ms": 5000,
            "drawdown": 0.1  # 10%
        }
    
    def evaluate(self, metrics: Dict[str, Any]) -> ModuleState:
        """
        评估风险状态
        
        返回: risk = NORMAL / WARNING / STOP_REQUIRED
        """
        # 检查各项阈值
        warnings = []
        stops = []
        
        # 日亏损
        daily_pnl = metrics.get("daily_pnl", 0)
        if daily_pnl < self._thresholds["daily_loss"]:
            stops.append("DAILY_LOSS_LIMIT")
        elif daily_pnl < self._thresholds["daily_loss"] * 0.5:
            warnings.append("DAILY_LOSS_WARNING")
        
        # 连续错误
        consecutive_errors = metrics.get("consecutive_errors", 0)
        if consecutive_errors >= self._thresholds["consecutive_errors"]:
            stops.append("CONSECUTIVE_ERRORS")
        elif consecutive_errors >= self._thresholds["consecutive_errors"] * 0.6:
            warnings.append("ERROR_RATE_WARNING")
        
        # 延迟
        latency = metrics.get("latency_ms", 0)
        if latency > self._thresholds["latency_ms"]:
            stops.append("HIGH_LATENCY")
        elif latency > self._thresholds["latency_ms"] * 0.5:
            warnings.append("LATENCY_WARNING")
        
        # 回撤
        drawdown = metrics.get("drawdown", 0)
        if drawdown > self._thresholds["drawdown"]:
            stops.append("MAX_DRAWDOWN")
        elif drawdown > self._thresholds["drawdown"] * 0.5:
            warnings.append("DRAWDOWN_WARNING")
        
        # 确定状态
        if stops:
            # 通过 RiskStateManager 设置（可追踪来源）
            self.risk_manager.set_stop("circuit_breaker", stops[0])
            value = "STOP_REQUIRED"
        elif warnings:
            self.risk_manager.set_warning("circuit_breaker", warnings[0])
            value = "WARNING"
        else:
            value = "NORMAL"
        
        return ModuleState(
            field="risk",
            value=value,
            metadata={
                "warnings": warnings,
                "stops": stops,
                "metrics": metrics
            },
            timestamp=datetime.utcnow()
        )


class ProfitAuditAdapter:
    """
    Profit Audit 适配器
    
    原职责: 质量评估
    新职责: 只输出 edge 状态
    """
    
    def __init__(self):
        self._history = []
        self._thresholds = {
            "strong_win_rate": 0.6,
            "weak_win_rate": 0.4,
            "min_trades": 10
        }
    
    def evaluate(self, audit_data: Dict[str, Any]) -> ModuleState:
        """
        评估 Edge 状态
        
        返回: edge = STRONG / WEAK / DEAD
        """
        # 计算指标
        total_trades = audit_data.get("total_trades", 0)
        win_rate = audit_data.get("win_rate", 0.5)
        profit_factor = audit_data.get("profit_factor", 1.0)
        sharpe = audit_data.get("sharpe", 0)
        
        # 记录历史
        self._history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "sharpe": sharpe
        })
        
        # 简化判断（实际应更复杂）
        if total_trades < self._thresholds["min_trades"]:
            # 样本不足，保守处理
            value = "WEAK"
        elif win_rate < 0.3 or profit_factor < 0.8:
            value = "DEAD"
        elif win_rate >= self._thresholds["strong_win_rate"] and profit_factor > 1.2:
            value = "STRONG"
        elif win_rate >= self._thresholds["weak_win_rate"]:
            value = "NORMAL"
        else:
            value = "WEAK"
        
        return ModuleState(
            field="edge",
            value=value,
            metadata={
                "win_rate": win_rate,
                "profit_factor": profit_factor,
                "sharpe": sharpe,
                "total_trades": total_trades
            },
            timestamp=datetime.utcnow()
        )


class CapitalControllerAdapter:
    """
    Capital Controller 适配器
    
    原职责: 仓位控制（直接改 multiplier）
    新职责: 只输出 capital 状态
    
    关键变化: 不再输出 multiplier，只输出 NORMAL/REDUCED/BLOCKED
    """
    
    def __init__(self):
        self._daily_pnl = 0
        self._max_position = 100  # USD
        self._current_position = 0
        self._thresholds = {
            "block_loss": -50,
            "reduce_loss": -20,
            "max_position_pct": 0.8
        }
    
    def evaluate(self, position_data: Dict[str, Any]) -> ModuleState:
        """
        评估资金状态
        
        返回: capital = NORMAL / REDUCED / BLOCKED
        """
        self._daily_pnl = position_data.get("daily_pnl", 0)
        self._current_position = position_data.get("current_position", 0)
        
        # 判断状态
        if self._daily_pnl < self._thresholds["block_loss"]:
            value = "BLOCKED"
        elif self._daily_pnl < self._thresholds["reduce_loss"]:
            value = "REDUCED"
        elif self._current_position > self._max_position * self._thresholds["max_position_pct"]:
            value = "REDUCED"
        else:
            value = "NORMAL"
        
        return ModuleState(
            field="capital",
            value=value,
            metadata={
                "daily_pnl": self._daily_pnl,
                "current_position": self._current_position,
                "max_position": self._max_position
            },
            timestamp=datetime.utcnow()
        )


class MarketDataAdapter:
    """
    Market Data 适配器
    
    职责: 只输出 market 状态
    """
    
    def __init__(self):
        self._max_age_ms = 5000  # 5秒
    
    def evaluate(self, data: Dict[str, Any]) -> ModuleState:
        """
        评估市场数据状态
        
        返回: market = FRESH / STALE
        """
        age_ms = data.get("age_ms", 0)
        
        if age_ms > self._max_age_ms:
            value = "STALE"
        else:
            value = "FRESH"
        
        return ModuleState(
            field="market",
            value=value,
            metadata={
                "age_ms": age_ms,
                "max_age_ms": self._max_age_ms
            },
            timestamp=datetime.utcnow()
        )


class StateAggregator:
    """
    状态聚合器
    
    将各模块状态聚合为 SystemState
    """
    
    def __init__(self):
        self.integrity_adapter = IntegrityGuardAdapter()
        self.circuit_adapter: Optional[CircuitBreakerAdapter] = None
        self.profit_adapter = ProfitAuditAdapter()
        self.capital_adapter = CapitalControllerAdapter()
        self.market_adapter = MarketDataAdapter()
    
    def set_circuit_breaker(self, adapter: CircuitBreakerAdapter):
        """设置 Circuit Breaker（需要 RiskStateManager）"""
        self.circuit_adapter = adapter
    
    def aggregate(self, inputs: Dict[str, Any]) -> SystemState:
        """
        聚合所有模块状态
        
        输入:
        {
            "system_state": {...},
            "metrics": {...},
            "audit_data": {...},
            "position_data": {...},
            "market_data": {...}
        }
        """
        # 各模块评估
        integrity = self.integrity_adapter.check(inputs.get("system_state", {}))
        
        risk = ModuleState("risk", "NORMAL", {}, datetime.utcnow())
        if self.circuit_adapter:
            risk = self.circuit_adapter.evaluate(inputs.get("metrics", {}))
        
        edge = self.profit_adapter.evaluate(inputs.get("audit_data", {}))
        capital = self.capital_adapter.evaluate(inputs.get("position_data", {}))
        market = self.market_adapter.evaluate(inputs.get("market_data", {}))
        
        # 聚合为 SystemState
        return SystemState(
            integrity=integrity.value,
            risk=risk.value,
            edge=edge.value,
            capital=capital.value,
            market=market.value
        )


# ============ 使用示例 ============

if __name__ == "__main__":
    from decision_hub_v3 import DecisionHubV3, RiskStateManager
    from decision_trace_viewer import DecisionTraceViewer
    
    print("="*60)
    print("模块适配器演示")
    print("="*60)
    
    # 初始化
    risk_manager = RiskStateManager()
    hub = DecisionHubV3()
    viewer = DecisionTraceViewer(hub)
    
    aggregator = StateAggregator()
    aggregator.set_circuit_breaker(CircuitBreakerAdapter(risk_manager))
    
    # 场景1: 正常交易
    print("\n场景1: 正常交易")
    inputs1 = {
        "system_state": {"api_connected": True, "position_synced": True, "params_locked": True, "errors": []},
        "metrics": {"daily_pnl": 10, "consecutive_errors": 0, "latency_ms": 200, "drawdown": 0.02},
        "audit_data": {"total_trades": 20, "win_rate": 0.65, "profit_factor": 1.5, "sharpe": 1.2},
        "position_data": {"daily_pnl": 10, "current_position": 30},
        "market_data": {"age_ms": 500}
    }
    state1 = aggregator.aggregate(inputs1)
    print(f"SystemState: {state1}")
    log1 = viewer.decide_and_log(state1)
    print(f"决策: {log1.final}")
    
    # 场景2: Edge 弱 + 资金减少（组合降级）
    print("\n场景2: Edge 弱 + 资金减少")
    inputs2 = {
        "system_state": {"api_connected": True, "position_synced": True, "params_locked": True, "errors": []},
        "metrics": {"daily_pnl": -5, "consecutive_errors": 0, "latency_ms": 300, "drawdown": 0.05},
        "audit_data": {"total_trades": 15, "win_rate": 0.45, "profit_factor": 1.0, "sharpe": 0.5},
        "position_data": {"daily_pnl": -25, "current_position": 50},
        "market_data": {"age_ms": 800}
    }
    state2 = aggregator.aggregate(inputs2)
    print(f"SystemState: {state2}")
    log2 = viewer.decide_and_log(state2)
    print(f"决策: {log2.final}")
    
    # 场景3: 风险熔断
    print("\n场景3: 风险熔断")
    inputs3 = {
        "system_state": {"api_connected": True, "position_synced": True, "params_locked": True, "errors": []},
        "metrics": {"daily_pnl": -120, "consecutive_errors": 0, "latency_ms": 200, "drawdown": 0.15},
        "audit_data": {"total_trades": 10, "win_rate": 0.3, "profit_factor": 0.8, "sharpe": -0.5},
        "position_data": {"daily_pnl": -120, "current_position": 80},
        "market_data": {"age_ms": 600}
    }
    state3 = aggregator.aggregate(inputs3)
    print(f"SystemState: {state3}")
    log3 = viewer.decide_and_log(state3)
    print(f"决策: {log3.final}")
    print(f"Risk 来源: {risk_manager.last_source}")
    print(f"Risk 历史: {risk_manager.history}")
    
    # 场景4: Kill Switch 使用
    print("\n场景4: Kill Switch 触发")
    # Kill Switch 通过 RiskStateManager 设置
    risk_manager.set_stop("kill_switch", "manual_emergency")
    
    inputs4 = {
        "system_state": {"api_connected": True, "position_synced": True, "params_locked": True, "errors": []},
        "metrics": {"daily_pnl": 50, "consecutive_errors": 0, "latency_ms": 200, "drawdown": 0.03},
        "audit_data": {"total_trades": 25, "win_rate": 0.7, "profit_factor": 1.8, "sharpe": 1.5},
        "position_data": {"daily_pnl": 50, "current_position": 40},
        "market_data": {"age_ms": 400}
    }
    
    # 覆盖 risk 状态
    state4 = aggregator.aggregate(inputs4)
    # 使用 RiskStateManager 的状态
    state4_with_kill = SystemState(
        integrity=state4.integrity,
        risk=risk_manager.state,  # STOP_REQUIRED
        edge=state4.edge,
        capital=state4.capital,
        market=state4.market
    )
    print(f"SystemState: {state4_with_kill}")
    log4 = viewer.decide_and_log(state4_with_kill)
    print(f"决策: {log4.final}")
    print(f"Risk 来源: {risk_manager.last_source}")
    
    # 显示统计
    print("\n" + "="*60)
    viewer.print_stats(last=4)
    
    print("\n" + "="*60)
    print("演示完成")
    print("="*60)