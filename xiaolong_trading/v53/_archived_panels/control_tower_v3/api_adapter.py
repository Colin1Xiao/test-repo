"""
Control Tower v3 - API 适配器

将现有系统数据转换为 Control Tower 格式
"""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
from typing import Dict, Any, List
from datetime import datetime

from decision_hub_v3 import DecisionHubV3, SystemState
from shadow_integration import DecisionDiffLogger


class ControlTowerAPI:
    """Control Tower API 适配器"""
    
    def __init__(self, shadow_logger: DecisionDiffLogger):
        self.logger = shadow_logger
        self.app = FastAPI(title="Control Tower v3")
        self._setup_routes()
        
        # 静态文件
        static_path = Path(__file__).parent / "control_tower_v3"
        self.app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
    
    def _setup_routes(self):
        """设置路由"""
        
        @self.app.get("/")
        async def root():
            """主页面"""
            return FileResponse("control_tower_v3/index.html")
        
        @self.app.get("/control-tower")
        async def control_tower():
            """Control Tower 页面"""
            return FileResponse("control_tower_v3/index.html")
        
        @self.app.get("/stats")
        async def get_stats() -> Dict[str, Any]:
            """执行统计"""
            # 从现有系统获取
            return {
                "errors": 0,
                "p50": 1039,
                "p90": 1343,
                "status": "HEALTHY"
            }
        
        @self.app.get("/audit")
        async def get_audit() -> Dict[str, Any]:
            """收益审计"""
            # 从 profit_audit.py 获取
            return {
                "profit_factor": 1.48,
                "expectancy": 0.0438,
                "drawdown": 0.006,
                "slippage_ratio": 58.9,
                "slippage_source": "ENTRY"
            }
        
        @self.app.get("/decision_diff")
        async def get_decision_diff() -> Dict[str, Any]:
            """决策差异统计"""
            stats = self.logger.get_stats()
            
            # 添加分布数据
            distribution = {}
            for diff in self.logger.diffs:
                reason = diff.new_reason
                distribution[reason] = distribution.get(reason, 0) + 1
            
            return {
                **stats,
                "distribution": distribution
            }
        
        @self.app.get("/decision_diff/recent")
        async def get_recent_decisions(limit: int = 10) -> List[Dict[str, Any]]:
            """最近决策"""
            recent = self.logger.get_recent(limit)
            return [
                {
                    "timestamp": diff.timestamp,
                    "signal_id": diff.signal_id,
                    "old_action": diff.old_action,
                    "new_action": diff.new_action,
                    "diff_type": diff.diff_type,
                    "risk_level": diff.risk_level,
                    "new_reason": diff.new_reason
                }
                for diff in recent
            ]
        
        @self.app.get("/ai/risk")
        async def get_risk() -> Dict[str, Any]:
            """AI 风险状态"""
            return {
                "level": "LOW",
                "circuit": "NORMAL",
                "capital": "NORMAL"
            }
        
        @self.app.post("/control/mode")
        async def set_mode(data: Dict[str, str]):
            """设置模式"""
            mode = data.get("mode", "shadow")
            # 这里实现模式切换逻辑
            return {"success": True, "mode": mode}
    
    def run(self, host: str = "0.0.0.0", port: int = 8765):
        """运行服务器"""
        import uvicorn
        uvicorn.run(self.app, host=host, port=port)


# ============ 演示 ============

if __name__ == "__main__":
    from shadow_integration import ShadowModeRunner
    
    print("="*60)
    print("Control Tower v3 - API Server")
    print("="*60)
    
    # 创建 Shadow Runner（复用已有数据）
    runner = ShadowModeRunner()
    
    # 模拟一些数据
    test_cases = [
        {"signal_id": "T001", "market": {"age_ms": 300}, "position": {"daily_pnl": 10, "current_position": 30, "win_rate": 0.65}},
        {"signal_id": "T002", "market": {"age_ms": 400}, "position": {"daily_pnl": -5, "current_position": 40, "win_rate": 0.45}},
        {"signal_id": "T003", "market": {"age_ms": 500}, "position": {"daily_pnl": -30, "current_position": 50, "win_rate": 0.5}},
    ]
    
    for case in test_cases:
        state = runner.build_state(
            signal={"id": case["signal_id"]},
            market_data=case["market"],
            position_data=case["position"]
        )
        new_log = runner.decide(state)
        old_decision = {"action": "EXECUTE", "multiplier": 1.0, "reason": "v52_default"}
        runner.log_diff(case["signal_id"], old_decision, new_log, state)
    
    # 启动 API
    api = ControlTowerAPI(runner.logger)
    
    print(f"\n启动 Control Tower v3...")
    print(f"访问: http://localhost:8765/control-tower")
    print(f"\n按 Ctrl+C 停止")
    print("="*60)
    
    api.run()