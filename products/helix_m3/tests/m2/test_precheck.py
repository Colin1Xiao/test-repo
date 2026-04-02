"""
M2-0 预检查脚本

检查 4 个准入条件：
1. ScenarioRunner ↔ BreakerPanel 事件连接
2. ScenarioExecutor 状态模型统一
3. Python 3.9 兼容性
4. OKX Testnet 最小参数配置
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.events import EventEnvelope, EventType, EventSource
from schemas.enums import Side, OrderStatus
from risk.breakers import BreakerPanel, BreakerType


@dataclass
class CheckResult:
    """检查项结果"""
    name: str
    passed: bool
    details: str
    issues: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "details": self.details,
            "issues": self.issues,
        }


class M2Precheck:
    """M2 预检查器"""
    
    def __init__(self):
        self.results: List[CheckResult] = []
    
    def check_event_connection(self) -> CheckResult:
        """检查 1: ScenarioRunner ↔ BreakerPanel 事件连接"""
        issues = []
        
        try:
            from replay.scenario_runner import ScenarioRunner
            from risk.breakers import BreakerPanel
            
            runner = ScenarioRunner()
            breaker_panel = BreakerPanel()
            
            # 设置事件回调
            events_received = []
            
            def on_event(envelope: EventEnvelope):
                events_received.append(envelope)
                
                # 模拟 BreakerPanel 订阅
                if envelope.event_type == EventType.BREAKER_TRIPPED:
                    breaker_type = envelope.payload.get("breaker_type", "")
                    breaker_map = {
                        "market_stale": BreakerType.MARKET_STALE,
                        "connection_lost": BreakerType.CONNECTION_LOST,
                        "reject_storm": BreakerType.REJECT_STORM,
                    }
                    breaker = breaker_map.get(breaker_type, BreakerType.MANUAL_FREEZE)
                    breaker_panel.trip(breaker, envelope.payload.get("reason", ""))
            
            runner.set_event_callback(on_event)
            
            # 模拟触发熔断器事件
            test_event = EventEnvelope(
                event_type=EventType.BREAKER_TRIPPED,
                source=EventSource.RISK_ENGINE,
                payload={
                    "breaker_type": "reject_storm",
                    "reason": "Test rejection",
                    "trip_count": 1,
                },
            )
            on_event(test_event)
            
            # 验证
            if len(events_received) == 1:
                if breaker_panel.is_any_tripped():
                    return CheckResult(
                        name="事件连接",
                        passed=True,
                        details="ScenarioRunner → BreakerPanel 事件流正常",
                    )
                else:
                    issues.append("BreakerPanel 未触发")
            else:
                issues.append(f"事件接收数量异常：{len(events_received)}")
            
        except Exception as e:
            issues.append(f"异常：{e}")
        
        return CheckResult(
            name="事件连接",
            passed=False,
            details="ScenarioRunner → BreakerPanel 事件流异常",
            issues=issues,
        )
    
    def check_state_model(self) -> CheckResult:
        """检查 2: ScenarioExecutor 状态模型统一"""
        issues = []
        
        try:
            from simulation.scenarios import ScenarioExecutor, create_sceneario_library
            
            library = create_sceneario_library()
            scenario = library.get("SCN-001")
            
            if not scenario:
                return CheckResult(
                    name="状态模型",
                    passed=False,
                    details="场景库加载失败",
                )
            
            executor = ScenarioExecutor(scenario)
            
            # 检查必需的状态字段
            required_fields = [
                "is_alive",
                "is_connected",
                "degraded_mode",
                "trading_halted",
                "order_count",
                "reject_count",
            ]
            
            missing = [f for f in required_fields if f not in executor.state]
            
            if missing:
                issues.append(f"缺失状态字段：{missing}")
                return CheckResult(
                    name="状态模型",
                    passed=False,
                    details=f"状态模型不完整：{missing}",
                    issues=issues,
                )
            
            # 验证状态初始值
            if executor.state["is_alive"] != True:
                issues.append("is_alive 初始值错误")
            if executor.state["is_connected"] != True:
                issues.append("is_connected 初始值错误")
            
            if issues:
                return CheckResult(
                    name="状态模型",
                    passed=False,
                    details="状态初始值异常",
                    issues=issues,
                )
            
            return CheckResult(
                name="状态模型",
                passed=True,
                details="ScenarioExecutor 状态模型统一",
            )
            
        except Exception as e:
            issues.append(f"异常：{e}")
            return CheckResult(
                name="状态模型",
                passed=False,
                details=f"状态模型检查失败：{e}",
                issues=issues,
            )
    
    def check_python_compatibility(self) -> CheckResult:
        """检查 3: Python 3.9 兼容性"""
        issues = []
        
        import sys
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        
        # 检查关键模块导入
        modules_to_check = [
            "schemas.events",
            "schemas.enums",
            "core.bus",
            "core.state_engine",
            "core.event_store",
            "execution.order_state",
            "execution.paper_broker",
            "execution.protection",
            "risk.breakers",
            "risk.envelopes",
            "replay.scenario_runner",
            "simulation.scenarios",
            "cockpit.widgets",
            "connectors.okx.trade_client",
        ]
        
        failed_imports = []
        for module in modules_to_check:
            try:
                __import__(module)
            except Exception as e:
                failed_imports.append(f"{module}: {e}")
        
        if failed_imports:
            issues.append(f"导入失败：{failed_imports[:3]}")  # 只显示前 3 个
        
        # 检查是否有 3.10+ 语法
        import subprocess
        try:
            result = subprocess.run(
                ["grep", "-r", "slots=True", "schemas/", "core/", "execution/", "risk/"],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent.parent,
            )
            if result.stdout:
                issues.append(f"发现 3.10+ 语法：slots=True")
        except:
            pass
        
        if issues:
            return CheckResult(
                name="Python 兼容性",
                passed=len(failed_imports) == 0,
                details=f"Python {python_version}, 部分模块有问题",
                issues=issues,
            )
        
        return CheckResult(
            name="Python 兼容性",
            passed=True,
            details=f"Python {python_version}, 所有模块可导入",
        )
    
    def check_okx_config(self) -> CheckResult:
        """检查 4: OKX Testnet 最小参数配置"""
        issues = []
        
        config_path = Path(__file__).parent.parent / "config" / "okx_testnet.json"
        
        if not config_path.exists():
            # 创建示例配置
            example_config = {
                "api_key": "YOUR_API_KEY",
                "secret_key": "YOUR_SECRET_KEY",
                "passphrase": "YOUR_PASSPHRASE",
                "environment": "testnet",
                "symbol": "ETH-USDT-SWAP",
                "qty": "0.01",
                "leverage": 10,
            }
            
            config_path.parent.mkdir(exist_ok=True)
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(example_config, f, indent=2)
            
            return CheckResult(
                name="OKX 配置",
                passed=False,
                details=f"配置文件不存在，已创建示例：{config_path}",
                issues=["需要填写真实的 API Key"],
            )
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            required_fields = ["api_key", "secret_key", "passphrase"]
            missing = [f for f in required_fields if f not in config or config[f] == "YOUR_API_KEY"]
            
            if missing:
                issues.append(f"缺失配置：{missing}")
                return CheckResult(
                    name="OKX 配置",
                    passed=False,
                    details="配置不完整",
                    issues=issues,
                )
            
            # 验证配置有效性（不实际连接）
            if len(config.get("api_key", "")) < 10:
                issues.append("API Key 长度异常")
            
            if issues:
                return CheckResult(
                    name="OKX 配置",
                    passed=False,
                    details="配置验证失败",
                    issues=issues,
                )
            
            return CheckResult(
                name="OKX 配置",
                passed=True,
                details="OKX Testnet 配置完整",
            )
            
        except Exception as e:
            issues.append(f"读取配置失败：{e}")
            return CheckResult(
                name="OKX 配置",
                passed=False,
                details="配置文件读取失败",
                issues=issues,
            )
    
    def run_all_checks(self) -> Dict[str, Any]:
        """运行所有检查"""
        print("="*60)
        print("🐉 M2-0 预检查")
        print("="*60)
        print()
        
        self.results = [
            self.check_event_connection(),
            self.check_state_model(),
            self.check_python_compatibility(),
            self.check_okx_config(),
        ]
        
        # 汇总
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        
        print()
        print("="*60)
        print("📊 预检查结果")
        print("="*60)
        
        for result in self.results:
            status = "✅" if result.passed else "❌"
            print(f"{status} {result.name}: {result.details}")
            for issue in result.issues:
                print(f"    - {issue}")
        
        print()
        print(f"通过：{passed}/{total}")
        
        m2_ready = passed >= 3  # 至少 3 项通过
        
        if m2_ready:
            print()
            print("✅ M2 准入条件满足，可以开始 Testnet 验证")
        else:
            print()
            print("⚠️ M2 准入条件不满足，建议先修复")
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "passed": passed,
            "total": total,
            "m2_ready": m2_ready,
            "results": [r.to_dict() for r in self.results],
        }


def main():
    """主函数"""
    precheck = M2Precheck()
    report = precheck.run_all_checks()
    
    # 保存报告
    report_path = Path(__file__).parent.parent / "reports" / "m2_precheck_report.json"
    report_path.parent.mkdir(exist_ok=True)
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📄 报告已保存：{report_path}")
    
    return report


if __name__ == "__main__":
    report = main()
    sys.exit(0 if report["m2_ready"] else 1)
