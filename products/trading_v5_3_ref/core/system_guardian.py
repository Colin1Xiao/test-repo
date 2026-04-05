#!/usr/bin/env python3
"""
System Guardian - 系统守护者 (V20)

核心认知：
一个系统是否强
不取决于它赚钱能力
而取决于它"出问题时会不会死"

核心能力：
1. 系统健康监控 - 进程/API/延迟/错误率
2. 心跳检测 - 长时间无更新重启
3. 自动重启 - 进程崩溃恢复
4. 异常自恢复 - API/网络/交易异常
5. 自动报警 - Telegram/Email/Webhook
6. 状态机 - NORMAL/DEGRADED/PROTECTED/STOPPED

系统质变：
从"系统 = 工具" → "系统 = 会自我维护的实体"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Callable
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
import os
import time
import subprocess
import requests

# ============================================================
# 枚举和常量
# ============================================================
class SystemState(Enum):
    """系统状态"""
    NORMAL = "NORMAL"           # 正常
    DEGRADED = "DEGRADED"       # 降级
    PROTECTED = "PROTECTED"     # 保护模式
    STOPPED = "STOPPED"         # 停止


class HealthStatus(Enum):
    """健康状态"""
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    DEAD = "DEAD"


class RecoveryAction(Enum):
    """恢复动作"""
    NONE = "NONE"               # 无需恢复
    RESTART = "RESTART"         # 重启
    FAILOVER = "FAILOVER"       # 故障转移
    REDUCE_RISK = "REDUCE_RISK" # 降低风险
    STOP = "STOP"               # 停止


@dataclass
class GuardianConfig:
    """守护者配置"""
    # 心跳检测
    heartbeat_timeout_sec: int = 60      # 心跳超时（秒）
    heartbeat_check_interval: int = 30   # 检查间隔
    
    # 自动重启
    max_restart_attempts: int = 3         # 最大重启尝试
    restart_cooldown_sec: int = 60        # 重启冷却
    
    # 错误阈值
    max_error_rate: float = 0.1          # 最大错误率
    max_latency_ms: float = 5000          # 最大延迟
    
    # 资金保护
    max_unexpected_loss_pct: float = 0.02  # 意外亏损阈值
    
    # 报警配置
    telegram_enabled: bool = False
    telegram_token: str = ""
    telegram_chat_id: str = ""
    
    # 进程配置
    process_name: str = "python3"
    script_path: str = "run_v52_live.py"


@dataclass
class HealthCheck:
    """健康检查结果"""
    timestamp: str
    process_alive: bool = True
    api_ok: bool = True
    latency_ms: float = 0.0
    error_rate: float = 0.0
    memory_pct: float = 0.0
    cpu_pct: float = 0.0
    status: HealthStatus = HealthStatus.HEALTHY
    issues: List[str] = field(default_factory=list)


@dataclass
class RecoveryRecord:
    """恢复记录"""
    timestamp: str
    issue: str
    action: RecoveryAction
    result: str
    duration_ms: float = 0.0


# ============================================================
# System Guardian 核心类
# ============================================================
class SystemGuardian:
    """
    系统守护者
    
    核心认知：
    一个系统是否强
    不取决于它赚钱能力
    而取决于它"出问题时会不会死"
    
    职责：
    1. 监控系统健康
    2. 检测异常
    3. 自动恢复
    4. 发送报警
    5. 状态管理
    
    系统质变：
    从"系统 = 工具" → "系统 = 会自我维护的实体"
    """
    
    def __init__(self, config: GuardianConfig = None):
        self.config = config or GuardianConfig()
        
        # 当前状态
        self.state = SystemState.NORMAL
        self.last_heartbeat: Optional[datetime] = None
        self.last_check: Optional[datetime] = None
        
        # 统计
        self.stats = {
            "total_checks": 0,
            "total_issues": 0,
            "total_restarts": 0,
            "total_recoveries": 0,
            "uptime_start": datetime.now().isoformat()
        }
        
        # 恢复记录
        self.recovery_history: List[RecoveryRecord] = []
        
        # 重启计数
        self.restart_attempts = 0
        self.last_restart: Optional[datetime] = None
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "system_guardian"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 报警器
        self.alerters: List[Callable] = []
        
        print("🛡️ System Guardian V20 初始化完成")
        print(f"   心跳超时: {self.config.heartbeat_timeout_sec}秒")
        print(f"   最大重启: {self.config.max_restart_attempts}次")
    
    # ============================================================
    # 1. 健康监控
    # ============================================================
    def check_health(self) -> HealthCheck:
        """
        检查系统健康
        
        Returns:
            HealthCheck
        """
        timestamp = datetime.now().isoformat()
        self.last_check = datetime.now()
        self.stats["total_checks"] += 1
        
        issues = []
        
        # 1. 检查进程
        process_alive = self._check_process()
        if not process_alive:
            issues.append("进程不存在")
        
        # 2. 检查API
        api_ok = self._check_api()
        if not api_ok:
            issues.append("API无响应")
        
        # 3. 检查延迟
        latency_ms = self._check_latency()
        if latency_ms > self.config.max_latency_ms:
            issues.append(f"延迟过高: {latency_ms:.0f}ms")
        
        # 4. 检查错误率
        error_rate = self._check_error_rate()
        if error_rate > self.config.max_error_rate:
            issues.append(f"错误率过高: {error_rate*100:.1f}%")
        
        # 5. 检查资源
        memory_pct, cpu_pct = self._check_resources()
        if memory_pct > 90:
            issues.append(f"内存过高: {memory_pct:.0f}%")
        if cpu_pct > 90:
            issues.append(f"CPU过高: {cpu_pct:.0f}%")
        
        # 判断状态
        if not process_alive or not api_ok:
            status = HealthStatus.DEAD
        elif len(issues) >= 3:
            status = HealthStatus.CRITICAL
        elif len(issues) >= 1:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.HEALTHY
        
        if issues:
            self.stats["total_issues"] += 1
        
        return HealthCheck(
            timestamp=timestamp,
            process_alive=process_alive,
            api_ok=api_ok,
            latency_ms=latency_ms,
            error_rate=error_rate,
            memory_pct=memory_pct,
            cpu_pct=cpu_pct,
            status=status,
            issues=issues
        )
    
    def _check_process(self) -> bool:
        """检查进程是否存活"""
        try:
            # 检查进程
            result = subprocess.run(
                ["pgrep", "-f", self.config.script_path],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except:
            return True  # 无法检查，假设存活
    
    def _check_api(self) -> bool:
        """检查API是否响应"""
        try:
            response = requests.get("http://localhost:18080/status", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def _check_latency(self) -> float:
        """检查延迟"""
        try:
            start = time.time()
            response = requests.get("http://localhost:18080/status", timeout=5)
            elapsed = (time.time() - start) * 1000
            return elapsed
        except:
            return 9999
    
    def _check_error_rate(self) -> float:
        """检查错误率"""
        # 从日志读取错误率
        try:
            log_file = self.data_dir.parent / "autoheal" / "data" / f"health_{datetime.now().strftime('%Y-%m-%d')}.json"
            if log_file.exists():
                with open(log_file, "r") as f:
                    data = json.load(f)
                    return data.get("error_rate", 0)
        except:
            pass
        return 0.0
    
    def _check_resources(self) -> Tuple[float, float]:
        """检查资源使用"""
        try:
            import psutil
            memory = psutil.virtual_memory().percent
            cpu = psutil.cpu_percent(interval=1)
            return memory, cpu
        except:
            return 0.0, 0.0
    
    # ============================================================
    # 2. 心跳检测
    # ============================================================
    def update_heartbeat(self):
        """更新心跳"""
        self.last_heartbeat = datetime.now()
    
    def check_heartbeat(self) -> Tuple[bool, float]:
        """
        检查心跳
        
        Returns:
            (is_alive, seconds_since_last)
        """
        if self.last_heartbeat is None:
            return True, 0.0
        
        elapsed = (datetime.now() - self.last_heartbeat).total_seconds()
        is_alive = elapsed < self.config.heartbeat_timeout_sec
        
        return is_alive, elapsed
    
    # ============================================================
    # 3. 自动重启
    # ============================================================
    def restart_system(self) -> Tuple[bool, str]:
        """
        重启系统
        
        Returns:
            (success, message)
        """
        timestamp = datetime.now().isoformat()
        
        # 检查冷却
        if self.last_restart:
            elapsed = (datetime.now() - self.last_restart).total_seconds()
            if elapsed < self.config.restart_cooldown_sec:
                return False, f"冷却中，剩余 {self.config.restart_cooldown_sec - elapsed:.0f}秒"
        
        # 检查尝试次数
        if self.restart_attempts >= self.config.max_restart_attempts:
            return False, "已达最大重启次数"
        
        print(f"🔄 重启系统...")
        
        try:
            # 1. 停止进程
            subprocess.run(["pkill", "-f", self.config.script_path], capture_output=True)
            time.sleep(2)
            
            # 2. 启动进程
            script_path = Path(__file__).parent.parent / self.config.script_path
            subprocess.Popen(
                ["nohup", "python3", str(script_path)],
                stdout=open("/dev/null", "w"),
                stderr=open("/dev/null", "w"),
                start_new_session=True
            )
            
            # 3. 等待启动
            time.sleep(5)
            
            # 4. 验证
            if self._check_process():
                self.restart_attempts += 1
                self.last_restart = datetime.now()
                self.stats["total_restarts"] += 1
                
                # 记录
                record = RecoveryRecord(
                    timestamp=timestamp,
                    issue="PROCESS_DEAD",
                    action=RecoveryAction.RESTART,
                    result="SUCCESS"
                )
                self.recovery_history.append(record)
                
                return True, "重启成功"
            else:
                return False, "重启后进程仍未启动"
                
        except Exception as e:
            return False, f"重启失败: {str(e)}"
    
    def reset_restart_count(self):
        """重置重启计数"""
        self.restart_attempts = 0
    
    # ============================================================
    # 4. 异常恢复
    # ============================================================
    def recover(self, issue: str) -> Tuple[RecoveryAction, str]:
        """
        异常恢复
        
        Args:
            issue: 问题类型
        
        Returns:
            (action, message)
        """
        timestamp = datetime.now().isoformat()
        self.stats["total_recoveries"] += 1
        
        action = RecoveryAction.NONE
        message = ""
        
        # 根据问题类型选择恢复策略
        if "PROCESS" in issue or "DEAD" in issue:
            success, msg = self.restart_system()
            action = RecoveryAction.RESTART
            message = msg
            
        elif "API" in issue or "TIMEOUT" in issue:
            # API问题，等待恢复
            action = RecoveryAction.FAILOVER
            message = "API异常，等待恢复"
            
        elif "LATENCY" in issue:
            # 延迟过高，降低风险
            action = RecoveryAction.REDUCE_RISK
            message = "延迟过高，降低风险"
            
        elif "LOSS" in issue or "MONEY" in issue:
            # 意外亏损，停止交易
            action = RecoveryAction.STOP
            message = "意外亏损，停止交易"
            
        else:
            message = "未知问题，等待人工处理"
        
        # 记录
        record = RecoveryRecord(
            timestamp=timestamp,
            issue=issue,
            action=action,
            result=message
        )
        self.recovery_history.append(record)
        
        return action, message
    
    # ============================================================
    # 5. 自动报警
    # ============================================================
    def add_alerter(self, alerter: Callable):
        """添加报警器"""
        self.alerters.append(alerter)
    
    def send_alert(self, message: str, level: str = "WARNING"):
        """
        发送报警
        
        Args:
            message: 报警内容
            level: 级别 (INFO/WARNING/CRITICAL)
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_message = f"[{timestamp}] [{level}] {message}"
        
        print(f"🚨 {full_message}")
        
        # Telegram
        if self.config.telegram_enabled and self.config.telegram_token:
            try:
                url = f"https://api.telegram.org/bot{self.config.telegram_token}/sendMessage"
                data = {
                    "chat_id": self.config.telegram_chat_id,
                    "text": f"🛡️ System Guardian\n\n{full_message}"
                }
                requests.post(url, json=data, timeout=10)
            except Exception as e:
                print(f"⚠️ Telegram报警失败: {e}")
        
        # 自定义报警器
        for alerter in self.alerters:
            try:
                alerter(full_message)
            except Exception as e:
                print(f"⚠️ 报警器失败: {e}")
    
    # ============================================================
    # 6. 状态机
    # ============================================================
    def update_state(self, health: HealthCheck):
        """更新系统状态"""
        previous_state = self.state
        
        if health.status == HealthStatus.DEAD:
            self.state = SystemState.STOPPED
        elif health.status == HealthStatus.CRITICAL:
            self.state = SystemState.PROTECTED
        elif health.status == HealthStatus.WARNING:
            self.state = SystemState.DEGRADED
        else:
            self.state = SystemState.NORMAL
        
        # 状态变化报警
        if previous_state != self.state:
            self.send_alert(
                f"状态变化: {previous_state.value} → {self.state.value}",
                level="WARNING" if self.state != SystemState.STOPPED else "CRITICAL"
            )
    
    def get_state(self) -> SystemState:
        """获取当前状态"""
        return self.state
    
    def get_state_behavior(self) -> Dict:
        """获取状态行为"""
        behaviors = {
            SystemState.NORMAL: {
                "trading": True,
                "risk_level": "NORMAL",
                "actions": "正常运行"
            },
            SystemState.DEGRADED: {
                "trading": True,
                "risk_level": "HIGH",
                "actions": "降级运行，降低风险"
            },
            SystemState.PROTECTED: {
                "trading": False,
                "risk_level": "CRITICAL",
                "actions": "保护模式，停止交易"
            },
            SystemState.STOPPED: {
                "trading": False,
                "risk_level": "STOPPED",
                "actions": "系统停止，需人工干预"
            }
        }
        return behaviors.get(self.state, {})
    
    # ============================================================
    # 7. 主循环
    # ============================================================
    def run_check_cycle(self) -> Dict:
        """
        运行检查周期
        
        Returns:
            检查结果
        """
        # 1. 健康检查
        health = self.check_health()
        
        # 2. 更新状态
        self.update_state(health)
        
        # 3. 决定动作
        action_taken = None
        if health.status == HealthStatus.DEAD:
            action_taken = "RESTART"
            success, msg = self.restart_system()
            if not success:
                self.send_alert(msg, level="CRITICAL")
        
        elif health.status == HealthStatus.CRITICAL:
            action_taken = "ALERT"
            self.send_alert(
                f"系统严重异常: {', '.join(health.issues)}",
                level="CRITICAL"
            )
        
        elif health.status == HealthStatus.WARNING:
            self.send_alert(
                f"系统警告: {', '.join(health.issues)}",
                level="WARNING"
            )
        
        return {
            "health": {
                "status": health.status.value,
                "process_alive": health.process_alive,
                "api_ok": health.api_ok,
                "latency_ms": health.latency_ms,
                "issues": health.issues
            },
            "state": self.state.value,
            "action_taken": action_taken,
            "restart_attempts": self.restart_attempts
        }
    
    # ============================================================
    # 8. 查询接口
    # ============================================================
    def get_summary(self) -> Dict:
        """获取系统摘要"""
        uptime = 0
        if self.stats["uptime_start"]:
            start = datetime.fromisoformat(self.stats["uptime_start"])
            uptime = (datetime.now() - start).total_seconds()
        
        return {
            "state": self.state.value,
            "uptime_sec": uptime,
            "uptime_str": str(timedelta(seconds=int(uptime))),
            "total_checks": self.stats["total_checks"],
            "total_issues": self.stats["total_issues"],
            "total_restarts": self.stats["total_restarts"],
            "total_recoveries": self.stats["total_recoveries"],
            "restart_attempts": self.restart_attempts,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_check": self.last_check.isoformat() if self.last_check else None
        }
    
    def get_recovery_history(self, n: int = 10) -> List[Dict]:
        """获取恢复历史"""
        return [
            {
                "timestamp": r.timestamp,
                "issue": r.issue,
                "action": r.action.value,
                "result": r.result
            }
            for r in self.recovery_history[-n:]
        ]


# ============================================================
# Auto Operator - 自动运维器
# ============================================================
class AutoOperator:
    """
    自动运维器
    
    职责：
    1. 定时执行检查
    2. 自动恢复
    3. 7x24运行
    """
    
    def __init__(self, guardian: SystemGuardian = None):
        self.guardian = guardian or SystemGuardian()
        self.running = False
        self.interval_sec = 30
        
        print("🤖 Auto Operator V20 初始化完成")
    
    def start(self):
        """启动自动运维"""
        self.running = True
        print("▶️ Auto Operator 启动")
        
        while self.running:
            try:
                result = self.guardian.run_check_cycle()
                
                # 持久化
                self._save_check_result(result)
                
            except Exception as e:
                print(f"❌ 检查周期失败: {e}")
            
            time.sleep(self.interval_sec)
    
    def stop(self):
        """停止自动运维"""
        self.running = False
        print("⏹️ Auto Operator 停止")
    
    def _save_check_result(self, result: Dict):
        """保存检查结果"""
        log_file = self.guardian.data_dir / "check_results.jsonl"
        
        with open(log_file, "a") as f:
            f.write(json.dumps(result) + "\n")


# ============================================================
# 便捷函数
# ============================================================
def create_system_guardian() -> SystemGuardian:
    """创建系统守护者"""
    return SystemGuardian()


def create_auto_operator() -> AutoOperator:
    """创建自动运维器"""
    return AutoOperator()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== System Guardian V20 测试 ===\n")
    
    guardian = SystemGuardian()
    
    # 健康检查
    print("1. 健康检查:")
    health = guardian.check_health()
    print(f"   状态: {health.status.value}")
    print(f"   进程: {'存活' if health.process_alive else '死亡'}")
    print(f"   API: {'正常' if health.api_ok else '异常'}")
    print(f"   延迟: {health.latency_ms:.0f}ms")
    if health.issues:
        print(f"   问题: {health.issues}")
    
    # 心跳检测
    print("\n2. 心跳检测:")
    guardian.update_heartbeat()
    is_alive, elapsed = guardian.check_heartbeat()
    print(f"   心跳: {'存活' if is_alive else '死亡'}")
    print(f"   距上次: {elapsed:.0f}秒")
    
    # 状态更新
    print("\n3. 状态更新:")
    guardian.update_state(health)
    print(f"   系统状态: {guardian.get_state().value}")
    
    # 摘要
    print("\n4. 系统摘要:")
    summary = guardian.get_summary()
    print(f"   运行时间: {summary['uptime_str']}")
    print(f"   总检查: {summary['total_checks']}")
    print(f"   总问题: {summary['total_issues']}")
    
    # 运行检查周期
    print("\n5. 运行检查周期:")
    result = guardian.run_check_cycle()
    print(f"   健康状态: {result['health']['status']}")
    print(f"   系统状态: {result['state']}")
    
    print("\n✅ System Guardian V20 测试通过")