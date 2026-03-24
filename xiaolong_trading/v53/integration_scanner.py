"""
V12-V20 Integration Scanner - 自动集成检查工具

扫描目标：
1. 决策链是否唯一入口
2. 状态链是否统一来源
3. 执行链是否正确路由
4. 安全链是否有效

输出：完整集成报告
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CheckResult:
    """检查结果"""
    category: str
    item: str
    status: str  # OK / WARN / ERROR
    message: str
    details: List[str] = field(default_factory=list)


class IntegrationScanner:
    """集成扫描器"""
    
    def __init__(self, base_path: str = "/Users/colin/.openclaw/workspace/xiaolong_trading/v53"):
        self.base_path = Path(base_path)
        self.results: List[CheckResult] = []
        self.bypass_paths: List[str] = []
        self.state_conflicts: List[str] = []
        self.execution_errors: List[str] = []
    
    def scan_all(self) -> Dict[str, Any]:
        """执行所有检查"""
        print("="*60)
        print("🔍 V12-V20 Integration Scanner")
        print("="*60)
        
        # 决策链检查
        self._check_decision_chain()
        
        # 状态链检查
        self._check_state_chain()
        
        # 执行链检查
        self._check_execution_chain()
        
        # 安全链检查
        self._check_safety_chain()
        
        # Control Tower 检查
        self._check_control_tower()
        
        return self._generate_report()
    
    def _check_decision_chain(self):
        """检查决策链"""
        print("\n🧠 检查决策链...")
        
        # 1. 检查是否有多个执行入口
        execute_patterns = [
            r'executor\.execute\s*\(',
            r'execute_signal\s*\(',
            r'execute_trade\s*\(',
        ]
        
        files_with_execute = []
        for py_file in self.base_path.glob("**/*.py"):
            if "__pycache__" in str(py_file):
                continue
            try:
                content = py_file.read_text()
                for pattern in execute_patterns:
                    matches = re.findall(pattern, content)
                    if matches:
                        files_with_execute.append(str(py_file.relative_to(self.base_path)))
                        break
            except:
                pass
        
        if len(files_with_execute) <= 1:
            self.results.append(CheckResult(
                "Decision Chain",
                "执行入口唯一性",
                "OK",
                f"只有 {len(files_with_execute)} 个执行入口"
            ))
        else:
            self.results.append(CheckResult(
                "Decision Chain",
                "执行入口唯一性",
                "WARN",
                f"发现 {len(files_with_execute)} 个可能的执行入口",
                files_with_execute
            ))
        
        # 2. 检查 Decision Hub 是否被使用
        hub_usage = self._search_pattern(r'DecisionHub|decision_hub')
        if hub_usage:
            self.results.append(CheckResult(
                "Decision Chain",
                "Decision Hub 使用",
                "OK",
                f"在 {len(hub_usage)} 个文件中使用"
            ))
        else:
            self.results.append(CheckResult(
                "Decision Chain",
                "Decision Hub 使用",
                "ERROR",
                "未找到 Decision Hub 使用"
            ))
        
        # 3. 检查 Hybrid Controller
        hybrid_usage = self._search_pattern(r'HybridController|hybrid_controller')
        if hybrid_usage:
            self.results.append(CheckResult(
                "Decision Chain",
                "Hybrid Controller",
                "OK",
                f"在 {len(hybrid_usage)} 个文件中使用"
            ))
        else:
            self.results.append(CheckResult(
                "Decision Chain",
                "Hybrid Controller",
                "WARN",
                "未找到 Hybrid Controller 使用（可能还未接入主流程）"
            ))
    
    def _check_state_chain(self):
        """检查状态链"""
        print("\n⚙️ 检查状态链...")
        
        # 1. 检查 StateStore 是否被使用
        state_store_usage = self._search_pattern(r'StateStore|state_store')
        if state_store_usage:
            self.results.append(CheckResult(
                "State Chain",
                "StateStore 使用",
                "OK",
                f"在 {len(state_store_usage)} 个文件中使用"
            ))
        else:
            self.results.append(CheckResult(
                "State Chain",
                "StateStore 使用",
                "ERROR",
                "未找到 StateStore 使用"
            ))
        
        # 2. 检查 on_shadow_trade 调用
        shadow_trade = self._search_pattern(r'on_shadow_trade')
        if shadow_trade:
            self.results.append(CheckResult(
                "State Chain",
                "事件驱动更新",
                "OK",
                f"on_shadow_trade 在 {len(shadow_trade)} 个文件中"
            ))
        else:
            self.results.append(CheckResult(
                "State Chain",
                "事件驱动更新",
                "ERROR",
                "未找到 on_shadow_trade 调用"
            ))
        
        # 3. 检查 GO Stability
        go_stability = self._search_pattern(r'go_streak|GO_STABILITY|go_stability')
        if go_stability:
            self.results.append(CheckResult(
                "State Chain",
                "GO Stability",
                "OK",
                f"在 {len(go_stability)} 个文件中实现"
            ))
        else:
            self.results.append(CheckResult(
                "State Chain",
                "GO Stability",
                "WARN",
                "未找到 GO Stability 实现"
            ))
    
    def _check_execution_chain(self):
        """检查执行链"""
        print("\n⚡ 检查执行链...")
        
        # 1. 检查 route_execution 或类似路由
        route_usage = self._search_pattern(r'route_execution|final_decision')
        if route_usage:
            self.results.append(CheckResult(
                "Execution Chain",
                "决策路由",
                "OK",
                f"在 {len(route_usage)} 个文件中"
            ))
        else:
            self.results.append(CheckResult(
                "Execution Chain",
                "决策路由",
                "WARN",
                "未找到统一决策路由"
            ))
        
        # 2. 检查是否有直接的 old_decision 执行
        direct_old = self._search_pattern(r'execute\(old_decision\)|execute\(v52_decision\)')
        if direct_old:
            self.results.append(CheckResult(
                "Execution Chain",
                "旧决策绕过风险",
                "ERROR",
                "发现可能的旧决策直接执行",
                direct_old
            ))
            self.bypass_paths.extend(direct_old)
        else:
            self.results.append(CheckResult(
                "Execution Chain",
                "旧决策绕过风险",
                "OK",
                "未发现旧决策直接执行"
            ))
        
        # 3. 检查 signal_id 唯一性
        signal_id = self._search_pattern(r'signal_id')
        if signal_id:
            self.results.append(CheckResult(
                "Execution Chain",
                "Signal ID 追踪",
                "OK",
                f"在 {len(signal_id)} 个文件中使用"
            ))
    
    def _check_safety_chain(self):
        """检查安全链"""
        print("\n🔒 检查安全链...")
        
        # 1. 检查 Fallback 机制
        fallback = self._search_pattern(r'FALLBACK|fallback|FORCE_FALLBACK')
        if fallback:
            self.results.append(CheckResult(
                "Safety Chain",
                "Fallback 机制",
                "OK",
                f"在 {len(fallback)} 个文件中实现"
            ))
        else:
            self.results.append(CheckResult(
                "Safety Chain",
                "Fallback 机制",
                "ERROR",
                "未找到 Fallback 机制"
            ))
        
        # 2. 检查 Kill Switch
        kill_switch = self._search_pattern(r'kill_switch|KillSwitch|STOP')
        if kill_switch:
            self.results.append(CheckResult(
                "Safety Chain",
                "Kill Switch",
                "OK",
                f"在 {len(kill_switch)} 个文件中"
            ))
        else:
            self.results.append(CheckResult(
                "Safety Chain",
                "Kill Switch",
                "WARN",
                "未找到 Kill Switch"
            ))
        
        # 3. 检查超时控制
        timeout = self._search_pattern(r'timeout|TIMEOUT')
        if timeout:
            self.results.append(CheckResult(
                "Safety Chain",
                "超时控制",
                "OK",
                f"在 {len(timeout)} 个文件中"
            ))
        else:
            self.results.append(CheckResult(
                "Safety Chain",
                "超时控制",
                "WARN",
                "未找到超时控制"
            ))
        
        # 4. 检查错误限制
        error_limit = self._search_pattern(r'MAX_ERRORS|max_errors|error_count')
        if error_limit:
            self.results.append(CheckResult(
                "Safety Chain",
                "错误限制",
                "OK",
                f"在 {len(error_limit)} 个文件中"
            ))
    
    def _check_control_tower(self):
        """检查 Control Tower"""
        print("\n📊 检查 Control Tower...")
        
        # 1. 检查 API 端点
        api_endpoints = self._search_pattern(r'@app\.(get|post|put|delete)')
        if api_endpoints:
            self.results.append(CheckResult(
                "Control Tower",
                "API 端点",
                "OK",
                f"发现 {len(api_endpoints)} 个 API 端点"
            ))
        
        # 2. 检查是否使用 StateStore
        api_state = self._search_pattern(r'state_store\.to_dict|get_state\(\)')
        if api_state:
            self.results.append(CheckResult(
                "Control Tower",
                "数据来源",
                "OK",
                "API 使用 StateStore 数据"
            ))
        else:
            self.results.append(CheckResult(
                "Control Tower",
                "数据来源",
                "WARN",
                "可能存在非 StateStore 数据来源"
            ))
    
    def _search_pattern(self, pattern: str) -> List[str]:
        """搜索模式"""
        matches = []
        for py_file in self.base_path.glob("**/*.py"):
            if "__pycache__" in str(py_file):
                continue
            try:
                content = py_file.read_text()
                if re.search(pattern, content, re.IGNORECASE):
                    matches.append(str(py_file.relative_to(self.base_path)))
            except:
                pass
        return matches
    
    def _generate_report(self) -> Dict[str, Any]:
        """生成报告"""
        # 统计
        ok_count = sum(1 for r in self.results if r.status == "OK")
        warn_count = sum(1 for r in self.results if r.status == "WARN")
        error_count = sum(1 for r in self.results if r.status == "ERROR")
        
        # 判定
        if error_count == 0 and warn_count == 0:
            verdict = "🟢 FULLY INTEGRATED"
        elif error_count == 0:
            verdict = "🟡 INTEGRATED WITH WARNINGS"
        else:
            verdict = "🔴 INTEGRATION ISSUES FOUND"
        
        # 输出
        print("\n" + "="*60)
        print("📋 V12-V20 INTEGRATION REPORT")
        print("="*60)
        
        for result in self.results:
            status_icon = {"OK": "✅", "WARN": "⚠️", "ERROR": "❌"}[result.status]
            print(f"\n{status_icon} [{result.category}] {result.item}")
            print(f"   {result.message}")
            if result.details:
                for detail in result.details[:3]:
                    print(f"   → {detail}")
        
        print("\n" + "="*60)
        print("📊 统计")
        print("="*60)
        print(f"OK: {ok_count} | WARN: {warn_count} | ERROR: {error_count}")
        print(f"Bypass Paths: {len(self.bypass_paths)}")
        print(f"State Conflicts: {len(self.state_conflicts)}")
        print(f"Execution Errors: {len(self.execution_errors)}")
        print(f"\nVERDICT: {verdict}")
        print("="*60)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "ok": ok_count,
            "warn": warn_count,
            "error": error_count,
            "bypass_paths": len(self.bypass_paths),
            "state_conflicts": len(self.state_conflicts),
            "execution_errors": len(self.execution_errors),
            "verdict": verdict,
            "results": [
                {
                    "category": r.category,
                    "item": r.item,
                    "status": r.status,
                    "message": r.message
                }
                for r in self.results
            ]
        }


def run_integration_scan():
    """运行集成扫描"""
    scanner = IntegrationScanner()
    return scanner.scan_all()


if __name__ == "__main__":
    run_integration_scan()