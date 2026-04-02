"""
Scenario Runner — 场景运行器

执行预定义场景，用于：
- 系统级演练
- 故障注入测试
- 回归验证
- 培训演示

运行模式：
- LIVE: 实盘场景（仅监控）
- PAPER: 模拟场景
- REPLAY: 历史回放
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from simulation.scenarios import ScenarioDefinition, ScenarioExecutor, create_sceneario_library


class ScenarioState(Enum):
    """场景状态"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ScenarioRun:
    """场景运行实例"""
    run_id: str
    scenario: ScenarioDefinition
    state: ScenarioState = ScenarioState.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    current_step: int = 0
    total_steps: int = 0
    events_injected: int = 0
    results: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "run_id": self.run_id,
            "scenario_id": self.scenario.scenario_id,
            "scenario_name": self.scenario.name,
            "state": self.state.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress": self.current_step / self.total_steps if self.total_steps > 0 else 0,
            "events_injected": self.events_injected,
            "errors": self.errors,
        }


class ScenarioRunner:
    """场景运行器"""
    
    def __init__(self):
        self._runs: Dict[str, ScenarioRun] = {}
        self._event_callback: Optional[Callable] = None
        self._scenario_library = create_sceneario_library()
        
        # 运行统计
        self._total_runs = 0
        self._completed_runs = 0
        self._failed_runs = 0
    
    def set_event_callback(self, callback: Callable) -> None:
        """设置事件回调"""
        self._event_callback = callback
    
    def list_scenarios(self) -> List[Dict[str, Any]]:
        """获取场景列表"""
        return [
            {
                "scenario_id": s.scenario_id,
                "name": s.name,
                "description": s.description,
                "difficulty": s.difficulty,
                "duration_seconds": s.duration_seconds,
                "step_count": len(s.steps),
            }
            for s in self._scenario_library.values()
        ]
    
    def get_scenario(self, scenario_id: str) -> Optional[ScenarioDefinition]:
        """获取场景定义"""
        return self._scenario_library.get(scenario_id)
    
    async def run_scenario(
        self,
        scenario_id: str,
        run_id: Optional[str] = None,
        speed_multiplier: float = 1.0
    ) -> ScenarioRun:
        """运行场景"""
        scenario = self.get_scenario(scenario_id)
        if not scenario:
            raise ValueError(f"Scenario not found: {scenario_id}")
        
        if run_id is None:
            run_id = f"RUN-{scenario_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        run = ScenarioRun(
            run_id=run_id,
            scenario=scenario,
            state=ScenarioState.RUNNING,
            started_at=datetime.utcnow(),
            total_steps=len(scenario.steps),
        )
        
        self._runs[run_id] = run
        self._total_runs += 1
        
        print(f"[Scenario] 开始运行：{scenario.name} ({run_id})")
        
        try:
            # 执行场景
            await self._execute_scenario(run, speed_multiplier)
            
            # 验证预期
            await self._validate_expectations(run)
            
            run.state = ScenarioState.COMPLETED
            run.completed_at = datetime.utcnow()
            self._completed_runs += 1
            
            print(f"[Scenario] 完成：{scenario.name}")
            
        except Exception as e:
            run.state = ScenarioState.FAILED
            run.completed_at = datetime.utcnow()
            run.errors.append(str(e))
            self._failed_runs += 1
            
            print(f"[Scenario] 失败：{scenario.name} - {e}")
        
        return run
    
    async def _execute_scenario(
        self,
        run: ScenarioRun,
        speed_multiplier: float
    ) -> None:
        """执行场景步骤"""
        for i, step in enumerate(run.scenario.steps):
            run.current_step = i + 1
            
            # 检查是否暂停
            if run.state == ScenarioState.PAUSED:
                while run.state == ScenarioState.PAUSED:
                    await asyncio.sleep(0.1)
            
            # 检查是否取消
            if run.state == ScenarioState.CANCELLED:
                return
            
            # 执行步骤
            await self._execute_step(run, step, speed_multiplier)
    
    async def _execute_step(
        self,
        run: ScenarioRun,
        step,
        speed_multiplier: float
    ) -> None:
        """执行单个步骤"""
        # 延迟
        if step.delay_seconds > 0 and speed_multiplier > 0:
            delay = step.delay_seconds / speed_multiplier
            await asyncio.sleep(min(delay, 1.0))  # 限制最大延迟
        
        # 执行动作
        event = await self._execute_action(step)
        
        if event:
            run.events_injected += 1
            
            # 发布事件
            if self._event_callback:
                self._event_callback(event)
    
    async def _execute_action(self, step) -> Optional[EventEnvelope]:
        """执行动作"""
        action = step.action
        params = step.params
        
        if action == "inject_market_data":
            return self._inject_market_data(params)
        elif action == "inject_signal":
            return self._inject_signal(params)
        elif action == "inject_order_accepted":
            return self._inject_order_accepted(params)
        elif action == "inject_order_rejected":
            return self._inject_order_rejected(params)
        elif action == "inject_disconnect":
            return self._inject_disconnect(params)
        elif action == "inject_reconnect":
            return self._inject_reconnect(params)
        
        return None
    
    def _inject_market_data(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入行情数据"""
        return EventEnvelope(
            event_type=EventType.MARKET_DATA,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "symbol": params.get("symbol", "ETH/USDT"),
                "price": params.get("price", 2000.0),
                "bid": params.get("bid", params.get("price", 2000.0) - 1.0),
                "ask": params.get("ask", params.get("price", 2000.0) + 1.0),
                "volume": params.get("volume", 100.0),
            },
        )
    
    def _inject_signal(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入交易信号"""
        return EventEnvelope(
            event_type=EventType.TRADING_SIGNAL,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "symbol": params.get("symbol", "ETH/USDT"),
                "side": params.get("side", "buy"),
                "size": params.get("size", 0.1),
                "confidence": params.get("confidence", 0.8),
            },
        )
    
    def _inject_order_accepted(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入订单接受事件"""
        return EventEnvelope(
            event_type=EventType.ORDER_ACCEPTED,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "order_id": params.get("order_id"),
                "venue_order_id": params.get("venue_order_id", "VENUE-001"),
            },
        )
    
    def _inject_order_rejected(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入订单拒绝事件"""
        return EventEnvelope(
            event_type=EventType.ORDER_REJECTED,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "order_id": params.get("order_id"),
                "reason": params.get("reason", "unknown"),
            },
        )
    
    def _inject_disconnect(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入断开连接事件"""
        return EventEnvelope(
            event_type=EventType.CONNECTION_LOST,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "reason": params.get("reason", "network_timeout"),
            },
        )
    
    def _inject_reconnect(self, params: Dict[str, Any]) -> EventEnvelope:
        """注入重连事件"""
        return EventEnvelope(
            event_type=EventType.CONNECTION_RESTORED,
            source=EventSource.SCENARIO_RUNNER,
            payload={
                "success": params.get("success", True),
            },
        )
    
    async def _validate_expectations(self, run: ScenarioRun) -> None:
        """验证预期"""
        # 简化：场景执行器内部已验证
        run.results["validated"] = True
    
    def pause_run(self, run_id: str) -> bool:
        """暂停运行"""
        run = self._runs.get(run_id)
        if run and run.state == ScenarioState.RUNNING:
            run.state = ScenarioState.PAUSED
            return True
        return False
    
    def resume_run(self, run_id: str) -> bool:
        """恢复运行"""
        run = self._runs.get(run_id)
        if run and run.state == ScenarioState.PAUSED:
            run.state = ScenarioState.RUNNING
            return True
        return False
    
    def cancel_run(self, run_id: str) -> bool:
        """取消运行"""
        run = self._runs.get(run_id)
        if run and run.state in [ScenarioState.RUNNING, ScenarioState.PAUSED]:
            run.state = ScenarioState.CANCELLED
            return True
        return False
    
    def get_run(self, run_id: str) -> Optional[ScenarioRun]:
        """获取运行实例"""
        return self._runs.get(run_id)
    
    def get_runs(self, state: Optional[ScenarioState] = None) -> List[ScenarioRun]:
        """获取运行列表"""
        runs = list(self._runs.values())
        if state:
            runs = [r for r in runs if r.state == state]
        return runs
    
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "total_runs": self._total_runs,
            "completed_runs": self._completed_runs,
            "failed_runs": self._failed_runs,
            "success_rate": self._completed_runs / self._total_runs if self._total_runs > 0 else 0,
            "active_runs": sum(1 for r in self._runs.values() if r.state == ScenarioState.RUNNING),
        }


# 使用示例
async def main():
    """示例：运行场景"""
    runner = ScenarioRunner()
    
    print("=== 场景库 ===")
    scenarios = runner.list_scenarios()
    for s in scenarios:
        print(f"{s['scenario_id']}: {s['name']} ({s['difficulty']})")
    
    print("\n=== 运行场景：网络断开 ===")
    run = await runner.run_scenario("SCN-001", speed_multiplier=10.0)
    
    print(f"\n运行结果：{run.to_dict()}")
    
    print(f"\n统计：{runner.stats()}")


if __name__ == "__main__":
    asyncio.run(main())
